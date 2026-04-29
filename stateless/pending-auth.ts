/**
 * S2 — sealed OAuth `state` for callback-proxy mode.
 *
 * `authorize()` normally stores a PendingAuthTransaction in an in-memory
 * BoundedLRUMap keyed by a random `state` parameter. The `/callback` handler
 * looks it up when GitLab redirects the user back. Under HPA this breaks if
 * /authorize lands on pod A and /callback on pod B.
 *
 * Stateless mode replaces the random `state` with a sealed token that itself
 * carries the PendingAuthTransaction. No server-side storage; any pod that
 * holds the shared secret can open it.
 *
 * Uses AEAD (AES-256-GCM) because the payload contains `proxyCodeVerifier`,
 * which is a PKCE secret until the token exchange completes.
 */

import { open, seal } from "./codec.js";
import { StatelessCodecError } from "./errors.js";
import {
  STATELESS_PURPOSES,
  type StatelessBasePayload,
  type StatelessKeyMaterial,
} from "./types.js";

/**
 * Sealed payload carried in the OAuth `state` parameter during the
 * callback-proxy flow.
 *
 * Field names are terse to keep the resulting token short on the wire —
 * these values are quoted inside a URL that the user's browser follows.
 */
export interface PendingAuthPayload extends StatelessBasePayload {
  v: 1;
  iat: number;
  /** MCP client's (possibly itself stateless) client_id. */
  cid: string;
  /** MCP client's redirect_uri, echoed back on /callback. */
  cru: string;
  /** MCP client's state, passed through to the final redirect. */
  cs?: string;
  /** MCP client's PKCE code_challenge (verified at /token). */
  ccc: string;
  /** Proxy code_verifier (secret) used to complete the token exchange
   *  with GitLab. */
  pcv: string;
}

export interface MintPendingAuthInput {
  clientId: string;
  clientRedirectUri: string;
  clientState?: string;
  clientCodeChallenge: string;
  proxyCodeVerifier: string;
  now?: () => number;
}

/**
 * Mint a sealed state parameter. The returned string is safe to place in a
 * URL query string; it uses only base64url characters plus dots.
 */
export function mintPendingAuthState(
  material: StatelessKeyMaterial,
  input: MintPendingAuthInput
): string {
  const iat = input.now ? input.now() : Math.floor(Date.now() / 1000);
  const payload: PendingAuthPayload = {
    v: 1,
    iat,
    cid: input.clientId,
    cru: input.clientRedirectUri,
    ccc: input.clientCodeChallenge,
    pcv: input.proxyCodeVerifier,
  };
  if (input.clientState !== undefined) payload.cs = input.clientState;
  return seal(material, STATELESS_PURPOSES.PENDING_AUTH, payload);
}

/**
 * Open a sealed state parameter. Returns null on any failure.
 *
 * NOTE on replay: stateless mode cannot enforce one-time-use without a shared
 * store. Replaying a `state` value is useless on its own because GitLab's
 * authorization code is single-use; an attacker who replays just `state`
 * without a matching unredeemed GitLab code cannot extract tokens.
 */
export function openPendingAuthState(
  material: StatelessKeyMaterial,
  state: string,
  ttlSeconds: number,
  now?: () => number
): PendingAuthPayload | null {
  try {
    const { payload } = open<PendingAuthPayload>(
      material,
      STATELESS_PURPOSES.PENDING_AUTH,
      state,
      { ttlSeconds, now }
    );
    if (
      typeof payload.cid !== "string" ||
      typeof payload.cru !== "string" ||
      typeof payload.ccc !== "string" ||
      typeof payload.pcv !== "string"
    ) {
      return null;
    }
    return payload;
  } catch (err) {
    if (err instanceof StatelessCodecError) return null;
    throw err;
  }
}

/** Heuristic for distinguishing stateless state from legacy UUIDs. */
export function looksLikeStatelessState(value: string): boolean {
  return value.startsWith("v1.ps.");
}
