/**
 * Integration tests for the stateless `client_id` DCR path.
 *
 * The key cross-pod claim is that two GitLabOAuthServerProvider instances,
 * sharing only OAUTH_STATELESS_SECRET, can successfully issue a client_id on
 * one and validate it on the other — matching the scenario where a Kubernetes
 * load balancer routes POST /register to pod A and GET /authorize to pod B.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, test } from "node:test";

import { createGitLabOAuthProvider } from "../../oauth-proxy.js";
import {
  mintClientId,
  openClientId,
  looksLikeStatelessClientId,
} from "../../stateless/client-id.js";
import { loadKeyMaterialFromEnv } from "../../stateless/index.js";
import type { StatelessKeyMaterial } from "../../stateless/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function secret(): string {
  return randomBytes(32).toString("base64url");
}

function loadMaterial(current: string, previous?: string): StatelessKeyMaterial {
  const env: NodeJS.ProcessEnv = {
    OAUTH_STATELESS_SECRET: current,
  };
  if (previous) env.OAUTH_STATELESS_SECRET_PREVIOUS = previous;
  const m = loadKeyMaterialFromEnv(true, env);
  assert.ok(m, "expected material to load");
  return m!;
}

function makeProvider(
  material: StatelessKeyMaterial | null,
  { callbackProxy = false }: { callbackProxy?: boolean } = {}
) {
  return createGitLabOAuthProvider(
    "https://gitlab.example.com",
    "real-gitlab-app-id",
    "GitLab MCP Server (test)",
    false, // readOnly
    undefined, // customScopes
    callbackProxy,
    callbackProxy ? "https://mcp.example.com/callback" : "",
    material
      ? {
          material,
          clientTtlSeconds: 86400,
          pendingTtlSeconds: 600,
          storedTtlSeconds: 600,
        }
      : null
  );
}

// ---------------------------------------------------------------------------
// mint / open helpers (direct)
// ---------------------------------------------------------------------------

describe("mintClientId / openClientId", () => {
  test("roundtrips redirect_uris", () => {
    const m = loadMaterial(secret());
    const cid = mintClientId(m, {
      redirectUris: ["https://client.example.com/cb"],
      grantTypes: ["authorization_code"],
      clientName: "Test Client",
    });
    assert.ok(looksLikeStatelessClientId(cid));
    const p = openClientId(m, cid, 86400);
    assert.ok(p);
    assert.deepEqual(p!.ruris, ["https://client.example.com/cb"]);
    assert.deepEqual(p!.gt, ["authorization_code"]);
    assert.equal(p!.cn, "Test Client");
  });

  test("openClientId returns null on signature error", () => {
    const m1 = loadMaterial(secret());
    const m2 = loadMaterial(secret()); // different secret entirely
    const cid = mintClientId(m1, {
      redirectUris: ["https://client.example.com/cb"],
    });
    assert.equal(openClientId(m2, cid, 86400), null);
  });

  test("openClientId returns null when expired", () => {
    const m = loadMaterial(secret());
    // Mint at t-3600
    const past = Math.floor(Date.now() / 1000) - 3600;
    const cid = mintClientId(m, {
      redirectUris: ["https://client.example.com/cb"],
      now: () => past,
    });
    // TTL = 60s ⇒ expired
    assert.equal(openClientId(m, cid, 60), null);
  });

  test("rotation: cid minted under previous secret still opens", () => {
    const s1 = secret();
    const s2 = secret();
    const mOld = loadMaterial(s1);
    const cid = mintClientId(mOld, {
      redirectUris: ["https://client.example.com/cb"],
    });
    // Operator rotated: new is current, old is previous.
    const mRotated = loadMaterial(s2, s1);
    assert.ok(openClientId(mRotated, cid, 86400));
  });
});

// ---------------------------------------------------------------------------
// clientsStore end-to-end across two provider instances (cross-pod)
// ---------------------------------------------------------------------------

describe("clientsStore cross-pod (stateless)", () => {
  test("register on pod A ⇒ getClient succeeds on pod B", async () => {
    const sharedSecret = secret();
    const podA = makeProvider(loadMaterial(sharedSecret));
    const podB = makeProvider(loadMaterial(sharedSecret));

    // Register on A
    const registered = await podA.clientsStore.registerClient!({
      redirect_uris: ["https://client.example.com/cb"],
      token_endpoint_auth_method: "none",
    });
    assert.ok(looksLikeStatelessClientId(registered.client_id));
    assert.deepEqual(registered.redirect_uris, ["https://client.example.com/cb"]);

    // Lookup on B — no shared memory, only shared secret
    const looked = await podB.clientsStore.getClient(registered.client_id);
    assert.ok(looked, "B should resolve the signed client_id");
    assert.equal(looked!.client_id, registered.client_id);
    assert.deepEqual(looked!.redirect_uris, ["https://client.example.com/cb"]);
    // token_endpoint_auth_method defaults to "none" for DCR
    assert.equal(looked!.token_endpoint_auth_method, "none");
  });

  test("getClient on pod B with different secret rejects the client_id", async () => {
    const podA = makeProvider(loadMaterial(secret()));
    const podB = makeProvider(loadMaterial(secret())); // different secret

    const registered = await podA.clientsStore.registerClient!({
      redirect_uris: ["https://client.example.com/cb"],
      token_endpoint_auth_method: "none",
    });

    const looked = await podB.clientsStore.getClient(registered.client_id);
    assert.equal(looked, undefined);
  });

  test("non-stateless provider falls back to legacy cache path", async () => {
    // Simulating a pod with stateless mode OFF — it should keep working
    // against its own in-memory cache.
    const provider = makeProvider(null);
    const registered = await provider.clientsStore.registerClient!({
      redirect_uris: ["https://client.example.com/cb"],
      token_endpoint_auth_method: "none",
    });
    // Legacy mode uses UUID client_ids, not stateless v1.cid.*
    assert.ok(!looksLikeStatelessClientId(registered.client_id));
    const looked = await provider.clientsStore.getClient(registered.client_id);
    assert.ok(looked);
    assert.deepEqual(looked!.redirect_uris, ["https://client.example.com/cb"]);
  });

  test("legacy client_id is unchanged in stateless mode (e.g. pre-existing GitLab app uid)", async () => {
    // A caller that passes a non-stateless client_id should receive the
    // legacy stub so unrelated flows (like token exchange with a pre-registered
    // GitLab app) continue to work.
    const provider = makeProvider(loadMaterial(secret()));
    const looked = await provider.clientsStore.getClient("legacy-app-id");
    assert.ok(looked);
    assert.equal(looked!.client_id, "legacy-app-id");
    // Stub has empty redirect_uris — the caller's code path must tolerate this.
    assert.deepEqual(looked!.redirect_uris, []);
  });

  test("rotation: client_id minted on pod-old verifies on pod-rotated", async () => {
    const s1 = secret();
    const s2 = secret();
    const podOld = makeProvider(loadMaterial(s1));
    const podRotated = makeProvider(loadMaterial(s2, s1));

    const registered = await podOld.clientsStore.registerClient!({
      redirect_uris: ["https://client.example.com/cb"],
      token_endpoint_auth_method: "none",
    });
    const looked = await podRotated.clientsStore.getClient(registered.client_id);
    assert.ok(looked);
    assert.deepEqual(looked!.redirect_uris, ["https://client.example.com/cb"]);
  });

  test("long redirect_uri list roundtrips", async () => {
    const sharedSecret = secret();
    const podA = makeProvider(loadMaterial(sharedSecret));
    const podB = makeProvider(loadMaterial(sharedSecret));
    const ruris = Array.from(
      { length: 5 },
      (_, i) => `https://client.example.com/cb-${i}`
    );
    const registered = await podA.clientsStore.registerClient!({
      redirect_uris: ruris,
      token_endpoint_auth_method: "none",
    });
    const looked = await podB.clientsStore.getClient(registered.client_id);
    assert.ok(looked);
    assert.deepEqual(looked!.redirect_uris, ruris);
  });
});
