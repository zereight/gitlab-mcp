/**
 * S4 — sealed `Mcp-Session-Id` for the Streamable HTTP transport.
 *
 * The MCP Streamable HTTP transport identifies sessions by the
 * `Mcp-Session-Id` header, which the server mints on the initialization
 * response and the client echoes back on every subsequent request.
 *
 * Today's code stores `{header, token, apiUrl, lastUsed}` in a
 * `Record<sid, AuthData>` on the pod that created the session, which breaks
 * when a subsequent request is routed to a different pod.
 *
 * Stateless mode replaces the server-minted UUID with an AEAD-sealed value
 * that carries the auth data directly. Any pod sharing
 * OAUTH_STATELESS_SECRET can open the sid and rebuild the auth context
 * on the fly, without consulting any shared store.
 *
 * Uses AEAD (AES-256-GCM) because the payload contains the bearer token /
 * PAT / job token. Because the sid is presented on every request, an
 * attacker who captures one session_id effectively captures the bearer
 * token behind it — the same security boundary as a stolen Authorization
 * header. TLS is mandatory; log redaction is recommended (phase 6).
 */

import { open, seal } from "./codec.js";
import { StatelessCodecError } from "./errors.js";
import {
  STATELESS_PURPOSES,
  type StatelessBasePayload,
  type StatelessKeyMaterial,
} from "./types.js";

export type SessionAuthHeader = "Authorization" | "Private-Token" | "JOB-TOKEN";

export interface SessionIdPayload extends StatelessBasePayload {
  v: 1;
  iat: number;
  /** Which HTTP header the token came from. */
  h: SessionAuthHeader;
  /** The raw token value (bearer, PAT, or CI job token). */
  t: string;
  /** Effective GitLab API URL for this session (supports dynamic routing). */
  u: string;
}

export interface MintSessionIdInput {
  header: SessionAuthHeader;
  token: string;
  apiUrl: string;
  now?: () => number;
}

/**
 * Mint a sealed session id. The resulting string is returned via the
 * `Mcp-Session-Id` response header on the initialization response.
 */
export function mintSessionId(
  material: StatelessKeyMaterial,
  input: MintSessionIdInput
): string {
  const iat = input.now ? input.now() : Math.floor(Date.now() / 1000);
  const payload: SessionIdPayload = {
    v: 1,
    iat,
    h: input.header,
    t: input.token,
    u: input.apiUrl,
  };
  return seal(material, STATELESS_PURPOSES.SESSION_ID, payload);
}

/**
 * Open a sealed session id and return the embedded auth context.
 *
 * Returns null on any failure (malformed, tampered, expired, wrong secret).
 */
export function openSessionId(
  material: StatelessKeyMaterial,
  sid: string,
  ttlSeconds: number,
  now?: () => number
): SessionIdPayload | null {
  try {
    const { payload } = open<SessionIdPayload>(
      material,
      STATELESS_PURPOSES.SESSION_ID,
      sid,
      { ttlSeconds, now }
    );
    if (
      (payload.h !== "Authorization" &&
        payload.h !== "Private-Token" &&
        payload.h !== "JOB-TOKEN") ||
      typeof payload.t !== "string" ||
      payload.t.length === 0 ||
      typeof payload.u !== "string"
    ) {
      return null;
    }
    return payload;
  } catch (err) {
    if (err instanceof StatelessCodecError) return null;
    throw err;
  }
}

/** Heuristic check: does the header value look like a stateless sid? */
export function looksLikeStatelessSessionId(value: string): boolean {
  return value.startsWith("v1.sid.");
}
