/**
 * S3 — sealed proxy authorization code for callback-proxy mode.
 *
 * After `/callback` exchanges the GitLab auth code for tokens, the SDK-style
 * flow requires the MCP server to return a fresh auth code to the MCP client
 * via redirect, and to accept that code on the subsequent POST /token.
 *
 * The legacy implementation stored the GitLab tokens in a per-pod
 * BoundedLRUMap keyed by a random UUID proxy code. Under HPA this breaks when
 * /callback and /token land on different pods.
 *
 * Stateless mode replaces the random UUID proxy code with an AEAD-sealed
 * token that carries the stored tokens and the client PKCE binding directly.
 *
 * Uses AEAD (AES-256-GCM) because the payload contains the GitLab access
 * token and refresh token.
 *
 * Replay: proxyCode replay is defeated by two mitigations:
 *   - short TTL (OAUTH_STATELESS_STORED_TTL_SECONDS, default 600s)
 *   - PKCE binding (the client must still present a matching code_verifier)
 */

import { open, seal } from "./codec.js";
import { StatelessCodecError } from "./errors.js";
import {
  STATELESS_PURPOSES,
  type StatelessBasePayload,
  type StatelessKeyMaterial,
} from "./types.js";

import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

export interface StoredTokensPayload extends StatelessBasePayload {
  v: 1;
  iat: number;
  /** GitLab tokens obtained during /callback. */
  t: OAuthTokens;
  /** MCP client's client_id that started the /authorize flow. */
  cid: string;
  /** MCP client's original redirect_uri. */
  cru: string;
  /** MCP client's PKCE code_challenge — re-verified at /token time. */
  ccc: string;
}

export interface MintStoredTokensInput {
  tokens: OAuthTokens;
  clientId: string;
  clientRedirectUri: string;
  clientCodeChallenge: string;
  now?: () => number;
}

/**
 * Mint a sealed proxy authorization code. The resulting string is used as the
 * `code` query parameter in the redirect to the MCP client's redirect_uri.
 */
export function mintStoredTokensCode(
  material: StatelessKeyMaterial,
  input: MintStoredTokensInput
): string {
  const iat = input.now ? input.now() : Math.floor(Date.now() / 1000);
  const payload: StoredTokensPayload = {
    v: 1,
    iat,
    t: input.tokens,
    cid: input.clientId,
    cru: input.clientRedirectUri,
    ccc: input.clientCodeChallenge,
  };
  return seal(material, STATELESS_PURPOSES.STORED_TOKENS, payload);
}

/**
 * Open a sealed proxy authorization code. Returns null on any failure.
 */
export function openStoredTokensCode(
  material: StatelessKeyMaterial,
  code: string,
  ttlSeconds: number,
  now?: () => number
): StoredTokensPayload | null {
  try {
    const { payload } = open<StoredTokensPayload>(
      material,
      STATELESS_PURPOSES.STORED_TOKENS,
      code,
      { ttlSeconds, now }
    );
    if (
      typeof payload.cid !== "string" ||
      typeof payload.cru !== "string" ||
      typeof payload.ccc !== "string" ||
      typeof payload.t !== "object" ||
      payload.t === null ||
      typeof (payload.t as OAuthTokens).access_token !== "string"
    ) {
      return null;
    }
    return payload;
  } catch (err) {
    if (err instanceof StatelessCodecError) return null;
    throw err;
  }
}

/** Heuristic for distinguishing stateless proxy codes from legacy UUIDs. */
export function looksLikeStatelessStoredTokensCode(value: string): boolean {
  return value.startsWith("v1.pc.");
}
