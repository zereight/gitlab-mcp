/**
 * Shared types for the stateless token codec.
 *
 * Purposes are string constants, each mapping one-to-one to a derived subkey.
 * They appear in the wire format and in HKDF info to guarantee that a token
 * minted for one purpose cannot be successfully verified as another.
 */

export const STATELESS_VERSION = "v1" as const;

export const STATELESS_PURPOSES = {
  /** Signed client_id issued at DCR. */
  CLIENT_ID: "cid",
  /** Sealed OAuth state, carried through the GitLab consent screen. */
  PENDING_AUTH: "ps",
  /** Sealed proxy authorization code, returned to the MCP client. */
  STORED_TOKENS: "pc",
  /** Sealed Mcp-Session-Id, carries session auth across pod hops. */
  SESSION_ID: "sid",
} as const;

export type StatelessPurpose =
  (typeof STATELESS_PURPOSES)[keyof typeof STATELESS_PURPOSES];

/** All token payloads include an `iat` for TTL enforcement. */
export interface StatelessBasePayload {
  /** Schema version inside the payload (distinct from the wire version). */
  v: 1;
  /** Issued-at, epoch seconds (UTC). */
  iat: number;
}

/** Keyring entries as loaded from the environment. */
export interface StatelessKeyMaterial {
  /** Raw 32-byte master secret (current). */
  current: Buffer;
  /** Raw 32-byte master secret (previous); optional, for rotation. */
  previous?: Buffer;
}

/** Key-slot labels used in metrics and structured logs. */
export type StatelessKeySlot = "current" | "previous";
