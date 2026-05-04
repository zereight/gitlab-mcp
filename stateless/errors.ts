/**
 * Typed errors for the stateless token codec.
 *
 * Callers should translate these to appropriate OAuth / HTTP errors in their
 * local context. The codec itself never logs token values; it returns errors
 * that carry only the reason and the purpose tag.
 */

export type StatelessErrorReason =
  | "malformed"        // value does not match the v1.<purpose>.<…> shape
  | "unknown_version"  // leading version tag not "v1"
  | "purpose_mismatch" // embedded purpose does not match expected
  | "bad_base64"       // payload segments failed base64url decode
  | "bad_json"         // payload did not parse as JSON
  | "bad_schema"       // payload did not match the expected shape
  | "bad_signature"    // HMAC verification failed (signed values only)
  | "bad_ciphertext"   // AEAD authentication tag failed (sealed values)
  | "expired"          // iat too old per the caller's TTL
  | "future_iat"       // iat is in the future beyond the grace window
  | "no_key";          // no matching key in the keyring (rotation edge case)

export class StatelessCodecError extends Error {
  public readonly reason: StatelessErrorReason;
  public readonly purpose: string;

  constructor(reason: StatelessErrorReason, purpose: string, message?: string) {
    super(message ?? `stateless codec error: ${reason} (purpose=${purpose})`);
    this.name = "StatelessCodecError";
    this.reason = reason;
    this.purpose = purpose;
  }
}

/** Thrown at module init when the configuration is missing or malformed. */
export class StatelessConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatelessConfigError";
  }
}
