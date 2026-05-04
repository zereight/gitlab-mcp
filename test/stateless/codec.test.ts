/**
 * Unit tests for the stateless token codec.
 *
 * Covers:
 * - secret loading from env (valid, missing, malformed, rotation)
 * - HKDF subkey derivation (purpose isolation)
 * - sign / verify roundtrip (happy path, tamper, TTL, purpose mismatch)
 * - seal / open roundtrip (happy path, tamper, TTL, purpose mismatch)
 * - rotation: values minted under previous secret still verify
 */

import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { describe, test } from "node:test";

import {
  open,
  seal,
  sign,
  verify,
  STATELESS_PURPOSES,
  StatelessCodecError,
  StatelessConfigError,
  decodeSecret,
  deriveSubkey,
  deriveSubkeys,
  loadKeyMaterialFromEnv,
} from "../../stateless/index.js";
import type {
  StatelessBasePayload,
  StatelessKeyMaterial,
} from "../../stateless/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a 32-byte secret string as an operator would. */
function genSecret(): string {
  return randomBytes(32).toString("base64url");
}

function buildMaterial(current?: string, previous?: string): StatelessKeyMaterial {
  const env: NodeJS.ProcessEnv = {
    OAUTH_STATELESS_SECRET: current ?? genSecret(),
  };
  if (previous) env.OAUTH_STATELESS_SECRET_PREVIOUS = previous;
  const material = loadKeyMaterialFromEnv(true, env);
  assert.ok(material, "material should load");
  return material!;
}

interface DummyPayload extends StatelessBasePayload {
  v: 1;
  iat: number;
  hello: string;
}

function dummyPayload(now = Math.floor(Date.now() / 1000)): DummyPayload {
  return { v: 1, iat: now, hello: "world" };
}

// ---------------------------------------------------------------------------
// loadKeyMaterialFromEnv
// ---------------------------------------------------------------------------

describe("loadKeyMaterialFromEnv", () => {
  test("returns null when mode disabled", () => {
    // `enabled=false` short-circuits regardless of env contents.
    assert.equal(loadKeyMaterialFromEnv(false, {}), null);
    assert.equal(
      loadKeyMaterialFromEnv(false, { OAUTH_STATELESS_SECRET: genSecret() }),
      null
    );
  });

  test("ignores env.OAUTH_STATELESS_MODE — enablement is caller-resolved", () => {
    // The loader must not re-parse the raw env var; the resolved config flag
    // (which honors the CLI --oauth-stateless-mode) is the single source of
    // truth. Regression guard for the silent fallback-to-per-pod bug when
    // stateless mode was enabled only via CLI.
    const secret = genSecret();
    // enabled=true with no env.OAUTH_STATELESS_MODE set → still loads.
    const m = loadKeyMaterialFromEnv(true, { OAUTH_STATELESS_SECRET: secret });
    assert.ok(m, "loader must not require env.OAUTH_STATELESS_MODE");
    // enabled=false with env.OAUTH_STATELESS_MODE=true → still null.
    assert.equal(
      loadKeyMaterialFromEnv(false, {
        OAUTH_STATELESS_MODE: "true",
        OAUTH_STATELESS_SECRET: secret,
      }),
      null
    );
  });

  test("throws when mode enabled but secret missing", () => {
    assert.throws(() => loadKeyMaterialFromEnv(true, {}), StatelessConfigError);
  });

  test("throws on too-short secret", () => {
    assert.throws(
      () =>
        loadKeyMaterialFromEnv(true, {
          OAUTH_STATELESS_SECRET: Buffer.from("short").toString("base64url"),
        }),
      StatelessConfigError
    );
  });

  test("loads current only", () => {
    const m = loadKeyMaterialFromEnv(true, {
      OAUTH_STATELESS_SECRET: genSecret(),
    });
    assert.ok(m);
    assert.equal(m!.previous, undefined);
  });

  test("loads current + previous", () => {
    const m = loadKeyMaterialFromEnv(true, {
      OAUTH_STATELESS_SECRET: genSecret(),
      OAUTH_STATELESS_SECRET_PREVIOUS: genSecret(),
    });
    assert.ok(m);
    assert.equal(m!.current.length, 32);
    assert.equal(m!.previous!.length, 32);
  });

  test("rejects malformed base64url previous", () => {
    assert.throws(
      () =>
        loadKeyMaterialFromEnv(true, {
          OAUTH_STATELESS_SECRET: genSecret(),
          OAUTH_STATELESS_SECRET_PREVIOUS: "!!!not-base64!!!",
        }),
      StatelessConfigError
    );
  });
});

// ---------------------------------------------------------------------------
// decodeSecret direct
// ---------------------------------------------------------------------------

describe("decodeSecret", () => {
  test("rejects empty", () => {
    assert.throws(() => decodeSecret("   ", "X"), StatelessConfigError);
  });

  test("accepts exactly 32 bytes", () => {
    const s = randomBytes(32).toString("base64url");
    assert.equal(decodeSecret(s, "X").length, 32);
  });

  test("accepts more than 32 bytes", () => {
    const s = randomBytes(64).toString("base64url");
    assert.equal(decodeSecret(s, "X").length, 64);
  });
});

// ---------------------------------------------------------------------------
// deriveSubkey / deriveSubkeys — purpose isolation
// ---------------------------------------------------------------------------

describe("HKDF subkey derivation", () => {
  test("same purpose + same secret ⇒ same key", () => {
    const secret = genSecret();
    const m1 = buildMaterial(secret);
    const m2 = buildMaterial(secret);
    const k1 = deriveSubkey(m1, "current", STATELESS_PURPOSES.CLIENT_ID);
    const k2 = deriveSubkey(m2, "current", STATELESS_PURPOSES.CLIENT_ID);
    assert.ok(k1.equals(k2));
  });

  test("different purposes ⇒ different keys", () => {
    const m = buildMaterial();
    const kC = deriveSubkey(m, "current", STATELESS_PURPOSES.CLIENT_ID);
    const kS = deriveSubkey(m, "current", STATELESS_PURPOSES.SESSION_ID);
    const kP = deriveSubkey(m, "current", STATELESS_PURPOSES.PENDING_AUTH);
    const kT = deriveSubkey(m, "current", STATELESS_PURPOSES.STORED_TOKENS);
    const set = new Set([kC.toString("hex"), kS.toString("hex"), kP.toString("hex"), kT.toString("hex")]);
    assert.equal(set.size, 4);
  });

  test("different master secrets ⇒ different keys", () => {
    const m1 = buildMaterial();
    const m2 = buildMaterial();
    assert.notEqual(
      deriveSubkey(m1, "current", STATELESS_PURPOSES.CLIENT_ID).toString("hex"),
      deriveSubkey(m2, "current", STATELESS_PURPOSES.CLIENT_ID).toString("hex")
    );
  });

  test("deriveSubkeys returns [current] when no previous", () => {
    const m = buildMaterial();
    const ks = deriveSubkeys(m, STATELESS_PURPOSES.CLIENT_ID);
    assert.equal(ks.length, 1);
    assert.equal(ks[0].slot, "current");
  });

  test("deriveSubkeys returns [current, previous] when rotated", () => {
    const m = buildMaterial(genSecret(), genSecret());
    const ks = deriveSubkeys(m, STATELESS_PURPOSES.CLIENT_ID);
    assert.equal(ks.length, 2);
    assert.equal(ks[0].slot, "current");
    assert.equal(ks[1].slot, "previous");
    assert.notEqual(ks[0].key.toString("hex"), ks[1].key.toString("hex"));
  });
});

// ---------------------------------------------------------------------------
// sign / verify (CLIENT_ID purpose)
// ---------------------------------------------------------------------------

describe("sign / verify", () => {
  test("happy-path roundtrip", () => {
    const m = buildMaterial();
    const p = dummyPayload();
    const token = sign(m, STATELESS_PURPOSES.CLIENT_ID, p);
    const { payload, slot } = verify<DummyPayload>(m, STATELESS_PURPOSES.CLIENT_ID, token, {
      ttlSeconds: 3600,
    });
    assert.deepEqual(payload, p);
    assert.equal(slot, "current");
    assert.match(token, /^v1\.cid\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  test("tampered payload fails verify", () => {
    const m = buildMaterial();
    const token = sign(m, STATELESS_PURPOSES.CLIENT_ID, dummyPayload());
    const parts = token.split(".");
    const tampered = Buffer.from('{"v":1,"iat":1,"hello":"EVIL"}').toString("base64url");
    parts[2] = tampered;
    const bad = parts.join(".");
    assert.throws(
      () => verify(m, STATELESS_PURPOSES.CLIENT_ID, bad, { ttlSeconds: 3600 }),
      (err) => err instanceof StatelessCodecError && err.reason === "bad_signature"
    );
  });

  test("tampered signature fails verify", () => {
    const m = buildMaterial();
    const token = sign(m, STATELESS_PURPOSES.CLIENT_ID, dummyPayload());
    const parts = token.split(".");
    const evilMac = Buffer.alloc(32, 7).toString("base64url");
    parts[3] = evilMac;
    const bad = parts.join(".");
    assert.throws(
      () => verify(m, STATELESS_PURPOSES.CLIENT_ID, bad, { ttlSeconds: 3600 }),
      (err) => err instanceof StatelessCodecError && err.reason === "bad_signature"
    );
  });

  test("wrong purpose on verify is rejected", () => {
    const m = buildMaterial();
    const token = sign(m, STATELESS_PURPOSES.CLIENT_ID, dummyPayload());
    assert.throws(
      () => verify(m, STATELESS_PURPOSES.SESSION_ID, token, { ttlSeconds: 3600 }),
      (err) => err instanceof StatelessCodecError && err.reason === "purpose_mismatch"
    );
  });

  test("expired token is rejected", () => {
    const m = buildMaterial();
    const longAgo = Math.floor(Date.now() / 1000) - 10_000;
    const token = sign(m, STATELESS_PURPOSES.CLIENT_ID, dummyPayload(longAgo));
    assert.throws(
      () => verify(m, STATELESS_PURPOSES.CLIENT_ID, token, { ttlSeconds: 60 }),
      (err) => err instanceof StatelessCodecError && err.reason === "expired"
    );
  });

  test("future iat beyond skew rejected", () => {
    const m = buildMaterial();
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = sign(m, STATELESS_PURPOSES.CLIENT_ID, dummyPayload(future));
    assert.throws(
      () => verify(m, STATELESS_PURPOSES.CLIENT_ID, token, { ttlSeconds: 60 }),
      (err) => err instanceof StatelessCodecError && err.reason === "future_iat"
    );
  });

  test("malformed prefix rejected", () => {
    const m = buildMaterial();
    assert.throws(
      () => verify(m, STATELESS_PURPOSES.CLIENT_ID, "not-a-token", { ttlSeconds: 60 }),
      (err) => err instanceof StatelessCodecError && err.reason === "malformed"
    );
  });

  test("wrong version rejected", () => {
    const m = buildMaterial();
    const token = sign(m, STATELESS_PURPOSES.CLIENT_ID, dummyPayload());
    const bad = token.replace(/^v1\./, "v9.");
    assert.throws(
      () => verify(m, STATELESS_PURPOSES.CLIENT_ID, bad, { ttlSeconds: 60 }),
      (err) => err instanceof StatelessCodecError && err.reason === "unknown_version"
    );
  });

  test("rotation: verify with previous secret succeeds", () => {
    const oldSecret = genSecret();
    const newSecret = genSecret();
    const minter = buildMaterial(oldSecret); // minted under old
    const token = sign(minter, STATELESS_PURPOSES.CLIENT_ID, dummyPayload());

    // Verifier has rotated: new is current, old is previous.
    const verifier = buildMaterial(newSecret, oldSecret);
    const { slot } = verify(verifier, STATELESS_PURPOSES.CLIENT_ID, token, {
      ttlSeconds: 3600,
    });
    assert.equal(slot, "previous");
  });

  test("cross-pod: two independently-loaded materials with same secret agree", () => {
    const secret = genSecret();
    const podA = buildMaterial(secret);
    const podB = buildMaterial(secret);
    const token = sign(podA, STATELESS_PURPOSES.CLIENT_ID, dummyPayload());
    const { payload } = verify<DummyPayload>(podB, STATELESS_PURPOSES.CLIENT_ID, token, {
      ttlSeconds: 3600,
    });
    assert.equal(payload.hello, "world");
  });
});

// ---------------------------------------------------------------------------
// seal / open (SESSION_ID purpose)
// ---------------------------------------------------------------------------

describe("seal / open", () => {
  test("happy-path roundtrip", () => {
    const m = buildMaterial();
    const p = dummyPayload();
    const token = seal(m, STATELESS_PURPOSES.SESSION_ID, p);
    const { payload, slot } = open<DummyPayload>(m, STATELESS_PURPOSES.SESSION_ID, token, {
      ttlSeconds: 3600,
    });
    assert.deepEqual(payload, p);
    assert.equal(slot, "current");
    assert.match(token, /^v1\.sid\.[A-Za-z0-9_-]+$/);
  });

  test("each seal uses a fresh nonce (different ciphertexts)", () => {
    const m = buildMaterial();
    const p = dummyPayload();
    const t1 = seal(m, STATELESS_PURPOSES.SESSION_ID, p);
    const t2 = seal(m, STATELESS_PURPOSES.SESSION_ID, p);
    assert.notEqual(t1, t2);
  });

  test("tampered ciphertext fails open", () => {
    const m = buildMaterial();
    const token = seal(m, STATELESS_PURPOSES.SESSION_ID, dummyPayload());
    // Flip a bit in the middle of the blob.
    const parts = token.split(".");
    const blob = Buffer.from(parts[2], "base64url");
    const midIndex = Math.floor(blob.length / 2);
    blob[midIndex] ^= 0xff;
    parts[2] = blob.toString("base64url");
    const bad = parts.join(".");
    assert.throws(
      () => open(m, STATELESS_PURPOSES.SESSION_ID, bad, { ttlSeconds: 3600 }),
      (err) => err instanceof StatelessCodecError && err.reason === "bad_ciphertext"
    );
  });

  test("wrong purpose rejected at parse", () => {
    const m = buildMaterial();
    const token = seal(m, STATELESS_PURPOSES.SESSION_ID, dummyPayload());
    assert.throws(
      () => open(m, STATELESS_PURPOSES.CLIENT_ID, token, { ttlSeconds: 3600 }),
      (err) => err instanceof StatelessCodecError && err.reason === "purpose_mismatch"
    );
  });

  test("forging a sealed value for wrong purpose fails AAD check", () => {
    // Build a token under SESSION_ID but then relabel as PENDING_AUTH.
    const m = buildMaterial();
    const token = seal(m, STATELESS_PURPOSES.SESSION_ID, dummyPayload());
    const relabeled = token.replace(/^v1\.sid\./, "v1.ps.");
    assert.throws(
      () => open(m, STATELESS_PURPOSES.PENDING_AUTH, relabeled, { ttlSeconds: 3600 }),
      // AAD mismatch surfaces as bad_ciphertext (AEAD integrity failure).
      (err) => err instanceof StatelessCodecError && err.reason === "bad_ciphertext"
    );
  });

  test("expired sealed value rejected", () => {
    const m = buildMaterial();
    const longAgo = Math.floor(Date.now() / 1000) - 10_000;
    const token = seal(m, STATELESS_PURPOSES.SESSION_ID, dummyPayload(longAgo));
    assert.throws(
      () => open(m, STATELESS_PURPOSES.SESSION_ID, token, { ttlSeconds: 60 }),
      (err) => err instanceof StatelessCodecError && err.reason === "expired"
    );
  });

  test("malformed blob (too short) rejected", () => {
    const m = buildMaterial();
    const tooShort = "v1.sid." + Buffer.alloc(4).toString("base64url");
    assert.throws(
      () => open(m, STATELESS_PURPOSES.SESSION_ID, tooShort, { ttlSeconds: 60 }),
      (err) =>
        err instanceof StatelessCodecError &&
        (err.reason === "malformed" || err.reason === "bad_ciphertext")
    );
  });

  test("rotation: sealed value minted under previous secret still opens", () => {
    const oldSecret = genSecret();
    const newSecret = genSecret();
    const minter = buildMaterial(oldSecret);
    const token = seal(minter, STATELESS_PURPOSES.SESSION_ID, dummyPayload());
    const verifier = buildMaterial(newSecret, oldSecret);
    const { slot } = open(verifier, STATELESS_PURPOSES.SESSION_ID, token, {
      ttlSeconds: 3600,
    });
    assert.equal(slot, "previous");
  });

  test("two pods sharing secret interop", () => {
    const secret = genSecret();
    const podA = buildMaterial(secret);
    const podB = buildMaterial(secret);
    const token = seal(podA, STATELESS_PURPOSES.SESSION_ID, dummyPayload());
    const { payload } = open<DummyPayload>(podB, STATELESS_PURPOSES.SESSION_ID, token, {
      ttlSeconds: 3600,
    });
    assert.equal(payload.hello, "world");
  });
});

// ---------------------------------------------------------------------------
// Mixed purpose / payload-shape validation
// ---------------------------------------------------------------------------

describe("payload schema validation", () => {
  test("payload without v rejected", () => {
    const m = buildMaterial();
    // Hand-craft a signed token with bogus shape.
    const badPayload = Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000) }));
    // Compute matching HMAC so we reach the shape check, not the sig check.
    const [{ key }] = deriveSubkeys(m, STATELESS_PURPOSES.CLIENT_ID).filter(
      (k) => k.slot === "current"
    );
    const mac = createHmac("sha256", key)
      .update(Buffer.concat([Buffer.from("cid"), Buffer.from([0]), badPayload]))
      .digest();
    const token = `v1.cid.${badPayload.toString("base64url")}.${mac.toString("base64url")}`;
    assert.throws(
      () => verify(m, STATELESS_PURPOSES.CLIENT_ID, token, { ttlSeconds: 3600 }),
      (err) => err instanceof StatelessCodecError && err.reason === "bad_schema"
    );
  });
});
