/**
 * Wire-format codec for stateless tokens.
 *
 * Two formats:
 *   signed:  v1.<purpose>.<b64url(payload)>.<b64url(hmac)>
 *   sealed:  v1.<purpose>.<b64url(nonce || ciphertext || tag)>
 *
 * The "signed" form is used when the payload is not confidential (DCR
 * client_id). The "sealed" form is used whenever the payload contains secrets
 * (proxy code verifier, GitLab access token, etc.).
 *
 * Verification is rotation-aware: a value minted under the previous secret
 * still opens/verifies until the operator removes OAUTH_STATELESS_SECRET_PREVIOUS.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

import { StatelessCodecError } from "./errors.js";
import { deriveSubkeys, hmacSha256 } from "./secret.js";
import {
  STATELESS_PURPOSES,
  STATELESS_VERSION,
  type StatelessBasePayload,
  type StatelessKeyMaterial,
  type StatelessKeySlot,
  type StatelessPurpose,
} from "./types.js";

const AES_ALG = "aes-256-gcm" as const;
const NONCE_LEN = 12;
const TAG_LEN = 16;

// Hard cap on accepted token length — prevents pathological inputs. 64 KiB is
// far larger than any legitimate payload we mint (session tokens are ≤2 KiB).
const MAX_INPUT_LEN = 64 * 1024;

// Allowance for clock skew when checking `iat` against "now". If a minter's
// clock is a few seconds ahead of the verifier's, refuse only when the skew
// is meaningful.
const IAT_FUTURE_SKEW_SEC = 60;

// ──────────────────────────────────────────────────────────────────────────
// Base64url helpers — Node's Buffer handles base64url natively, but we add a
// tiny wrapper so the call sites read cleanly and errors are captured.
// ──────────────────────────────────────────────────────────────────────────

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64urlDecode(s: string, purpose: StatelessPurpose): Buffer {
  try {
    // base64url accepts unpadded input; reject anything outside [A-Za-z0-9_-]
    // to keep the surface tight.
    if (!/^[A-Za-z0-9_-]*$/.test(s)) {
      throw new StatelessCodecError("bad_base64", purpose);
    }
    return Buffer.from(s, "base64url");
  } catch (err) {
    if (err instanceof StatelessCodecError) throw err;
    throw new StatelessCodecError("bad_base64", purpose);
  }
}

function canonicalJson(value: unknown): Buffer {
  // JSON.stringify is stable for the narrow payload shapes we use (fixed keys,
  // no Maps/Sets). Keeping it simple is safer than introducing a canonicaliser
  // dependency; all sign/verify happens within this process family.
  return Buffer.from(JSON.stringify(value));
}

function parseJson<T>(buf: Buffer, purpose: StatelessPurpose): T {
  try {
    return JSON.parse(buf.toString("utf8")) as T;
  } catch {
    throw new StatelessCodecError("bad_json", purpose);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Versioning & purpose tags
// ──────────────────────────────────────────────────────────────────────────

function splitToken(token: string, purpose: StatelessPurpose): string[] {
  if (!token || token.length > MAX_INPUT_LEN) {
    throw new StatelessCodecError("malformed", purpose);
  }
  const parts = token.split(".");
  if (parts.length < 3) {
    throw new StatelessCodecError("malformed", purpose);
  }
  if (parts[0] !== STATELESS_VERSION) {
    throw new StatelessCodecError("unknown_version", purpose);
  }
  if (parts[1] !== purpose) {
    throw new StatelessCodecError("purpose_mismatch", purpose);
  }
  return parts;
}

// ──────────────────────────────────────────────────────────────────────────
// Signed (HMAC) format
// ──────────────────────────────────────────────────────────────────────────

export interface SignedVerifyOptions {
  /** Max age in seconds from `iat` to now. */
  ttlSeconds: number;
  /** Current time in epoch seconds (override for testing). */
  now?: () => number;
}

function nowSec(override?: () => number): number {
  return override ? override() : Math.floor(Date.now() / 1000);
}

/**
 * Mint a signed token. Payload must carry `iat` (the mint helper sets it).
 */
export function sign<P extends StatelessBasePayload>(
  material: StatelessKeyMaterial,
  purpose: StatelessPurpose,
  payload: P
): string {
  const [{ key }] = deriveSubkeys(material, purpose).filter(k => k.slot === "current");
  const payloadBuf = canonicalJson(payload);
  const mac = hmacSha256(key, Buffer.concat([Buffer.from(purpose), Buffer.from([0]), payloadBuf]));
  return `${STATELESS_VERSION}.${purpose}.${b64urlEncode(payloadBuf)}.${b64urlEncode(mac)}`;
}

/**
 * Verify a signed token and return the decoded payload.
 *
 * Result is augmented with the key slot that accepted the MAC, for metrics.
 */
export function verify<P extends StatelessBasePayload>(
  material: StatelessKeyMaterial,
  purpose: StatelessPurpose,
  token: string,
  opts: SignedVerifyOptions
): { payload: P; slot: StatelessKeySlot } {
  const parts = splitToken(token, purpose);
  if (parts.length !== 4) {
    throw new StatelessCodecError("malformed", purpose);
  }
  const payloadBuf = b64urlDecode(parts[2], purpose);
  const macBuf = b64urlDecode(parts[3], purpose);

  const keys = deriveSubkeys(material, purpose);
  if (keys.length === 0) {
    throw new StatelessCodecError("no_key", purpose);
  }

  let acceptedSlot: StatelessKeySlot | null = null;
  const toSign = Buffer.concat([Buffer.from(purpose), Buffer.from([0]), payloadBuf]);
  for (const { slot, key } of keys) {
    const expected = hmacSha256(key, toSign);
    if (expected.length === macBuf.length && timingSafeEqual(expected, macBuf)) {
      acceptedSlot = slot;
      break;
    }
  }
  if (!acceptedSlot) {
    throw new StatelessCodecError("bad_signature", purpose);
  }

  const payload = parseJson<P>(payloadBuf, purpose);
  checkIat(payload, opts.ttlSeconds, opts.now, purpose);
  return { payload, slot: acceptedSlot };
}

// ──────────────────────────────────────────────────────────────────────────
// Sealed (AEAD) format
// ──────────────────────────────────────────────────────────────────────────

export interface SealedVerifyOptions extends SignedVerifyOptions {}

/**
 * Mint a sealed (AES-256-GCM) token. The purpose tag becomes the AEAD AAD so
 * that a sealed value minted for one purpose cannot be "opened" as another.
 */
export function seal<P extends StatelessBasePayload>(
  material: StatelessKeyMaterial,
  purpose: StatelessPurpose,
  payload: P
): string {
  const [{ key }] = deriveSubkeys(material, purpose).filter(k => k.slot === "current");
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv(AES_ALG, key, nonce);
  cipher.setAAD(Buffer.from(purpose));
  const payloadBuf = canonicalJson(payload);
  const ciphertext = Buffer.concat([cipher.update(payloadBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([nonce, ciphertext, tag]);
  return `${STATELESS_VERSION}.${purpose}.${b64urlEncode(blob)}`;
}

/**
 * Open a sealed token and return the decoded payload.
 */
export function open<P extends StatelessBasePayload>(
  material: StatelessKeyMaterial,
  purpose: StatelessPurpose,
  token: string,
  opts: SealedVerifyOptions
): { payload: P; slot: StatelessKeySlot } {
  const parts = splitToken(token, purpose);
  if (parts.length !== 3) {
    throw new StatelessCodecError("malformed", purpose);
  }
  const blob = b64urlDecode(parts[2], purpose);
  if (blob.length < NONCE_LEN + TAG_LEN) {
    throw new StatelessCodecError("malformed", purpose);
  }
  const nonce = blob.subarray(0, NONCE_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ciphertext = blob.subarray(NONCE_LEN, blob.length - TAG_LEN);

  const keys = deriveSubkeys(material, purpose);
  if (keys.length === 0) {
    throw new StatelessCodecError("no_key", purpose);
  }

  let acceptedSlot: StatelessKeySlot | null = null;
  let plaintext: Buffer | null = null;
  for (const { slot, key } of keys) {
    try {
      const decipher = createDecipheriv(AES_ALG, key, nonce);
      decipher.setAAD(Buffer.from(purpose));
      decipher.setAuthTag(tag);
      const p = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      plaintext = p;
      acceptedSlot = slot;
      break;
    } catch {
      // Try the next slot; only throw bad_ciphertext after all slots fail.
    }
  }
  if (!acceptedSlot || !plaintext) {
    throw new StatelessCodecError("bad_ciphertext", purpose);
  }

  const payload = parseJson<P>(plaintext, purpose);
  checkIat(payload, opts.ttlSeconds, opts.now, purpose);
  return { payload, slot: acceptedSlot };
}

// ──────────────────────────────────────────────────────────────────────────
// Shared TTL check
// ──────────────────────────────────────────────────────────────────────────

function checkIat(
  payload: unknown,
  ttlSec: number,
  now: (() => number) | undefined,
  purpose: StatelessPurpose
): void {
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as { iat?: unknown }).iat !== "number" ||
    typeof (payload as { v?: unknown }).v !== "number"
  ) {
    throw new StatelessCodecError("bad_schema", purpose);
  }
  const iat = (payload as StatelessBasePayload).iat;
  const t = nowSec(now);
  if (iat > t + IAT_FUTURE_SKEW_SEC) {
    throw new StatelessCodecError("future_iat", purpose);
  }
  if (ttlSec > 0 && t - iat > ttlSec) {
    throw new StatelessCodecError("expired", purpose);
  }
}

// Re-export purposes so callers have one import point.
export { STATELESS_PURPOSES };
