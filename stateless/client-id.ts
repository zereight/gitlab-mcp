/**
 * S1 — signed `client_id` for Dynamic Client Registration.
 *
 * The DCR entry is serialised into the `client_id` itself so that any pod
 * holding the same OAUTH_STATELESS_SECRET can reconstruct the registered
 * client record without a shared cache.
 *
 * Uses the signed (HMAC) format. The payload is public (redirect URIs,
 * grant types, client name) and does not require encryption.
 */

import { randomBytes } from "node:crypto";

import { sign, verify } from "./codec.js";
import { StatelessCodecError } from "./errors.js";
import {
  STATELESS_PURPOSES,
  type StatelessBasePayload,
  type StatelessKeyMaterial,
} from "./types.js";

/** Payload embedded in a signed client_id. */
export interface ClientIdPayload extends StatelessBasePayload {
  v: 1;
  iat: number;
  /**
   * Per-registration nonce (base64url). Ensures two DCR calls with identical
   * inputs produce distinct client_ids, preserving the OAuth invariant that
   * each registered client has a unique identity.
   */
  n: string;
  /** Redirect URIs registered by the client. */
  ruris: string[];
  /** Requested grant types (defaults to ["authorization_code"]). */
  gt?: string[];
  /** Human-readable client name (optional). */
  cn?: string;
}

export interface MintClientIdInput {
  redirectUris: string[];
  grantTypes?: string[];
  clientName?: string;
  /** Override current time (testing). */
  now?: () => number;
}

/**
 * Mint a signed client_id that carries the DCR registration.
 *
 * The returned string is opaque to the MCP client and can be of any length
 * within standard OAuth bounds. In practice ≤ 2 KB for typical inputs.
 */
export function mintClientId(
  material: StatelessKeyMaterial,
  input: MintClientIdInput
): string {
  const iat = input.now ? input.now() : Math.floor(Date.now() / 1000);
  // 16 bytes of entropy ⇒ negligible collision probability even across
  // arbitrarily many DCR registrations. Kept at 16 to keep the client_id
  // short on the wire.
  const payload: ClientIdPayload = {
    v: 1,
    iat,
    n: randomBytes(16).toString("base64url"),
    ruris: input.redirectUris,
  };
  if (input.grantTypes && input.grantTypes.length > 0) payload.gt = input.grantTypes;
  if (input.clientName) payload.cn = input.clientName;
  return sign(material, STATELESS_PURPOSES.CLIENT_ID, payload);
}

/**
 * Verify a signed client_id and return the decoded payload.
 *
 * Returns null on any verification failure (malformed, bad sig, expired, …).
 * Callers translate `null` to the SDK's InvalidClientError.
 */
export function openClientId(
  material: StatelessKeyMaterial,
  clientId: string,
  ttlSeconds: number,
  now?: () => number
): ClientIdPayload | null {
  try {
    const { payload } = verify<ClientIdPayload>(
      material,
      STATELESS_PURPOSES.CLIENT_ID,
      clientId,
      { ttlSeconds, now }
    );
    if (
      !Array.isArray(payload.ruris) ||
      payload.ruris.some((u) => typeof u !== "string") ||
      typeof payload.n !== "string" ||
      payload.n.length === 0
    ) {
      return null;
    }
    return payload;
  } catch (err) {
    if (err instanceof StatelessCodecError) return null;
    throw err;
  }
}

/**
 * Utility for callers: heuristically detect whether a string looks like a
 * stateless client_id. Used to skip stateless decoding for legacy client_ids
 * that might still be in circulation (e.g. the GitLab app UID).
 */
export function looksLikeStatelessClientId(value: string): boolean {
  return value.startsWith("v1.cid.");
}
