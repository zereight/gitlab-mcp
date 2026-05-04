/**
 * Secret / keyring loader for stateless mode.
 *
 * Loads the master secret(s) from env vars and derives per-purpose subkeys via
 * HKDF-SHA256. The caller (the codec) supplies a purpose tag when computing
 * or verifying a token; that tag is used both as HKDF info and as AEAD
 * associated data, which gives us domain separation by construction.
 */

import { createHmac, hkdfSync } from "node:crypto";

import { StatelessConfigError } from "./errors.js";
import type {
  StatelessKeyMaterial,
  StatelessKeySlot,
  StatelessPurpose,
} from "./types.js";

const MIN_SECRET_BYTES = 32;
const HKDF_SALT = Buffer.from("gitlab-mcp-stateless-v1");
const HKDF_HASH = "sha256" as const;
const KEY_BYTES = 32;

/**
 * Decode a base64url-encoded secret string into a Buffer of at least
 * MIN_SECRET_BYTES. Also accepts standard base64 for operator convenience.
 */
export function decodeSecret(value: string, label: string): Buffer {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new StatelessConfigError(`${label} is empty`);
  }
  let buf: Buffer;
  try {
    // Node's base64url decoder is forgiving of padding and accepts base64 too,
    // but we still validate the length explicitly below.
    buf = Buffer.from(trimmed, "base64url");
  } catch {
    throw new StatelessConfigError(`${label} is not valid base64url`);
  }
  if (buf.length < MIN_SECRET_BYTES) {
    throw new StatelessConfigError(
      `${label} must decode to at least ${MIN_SECRET_BYTES} bytes (got ${buf.length})`
    );
  }
  return buf;
}

/**
 * Load the keyring from the environment. Returns null when stateless mode is
 * disabled. Throws StatelessConfigError when enabled but misconfigured.
 *
 * `enabled` is an explicit input so the caller can drive enablement from the
 * already-resolved config flag (which honors both env var and CLI flag
 * precedence), rather than re-reading raw env state here. Re-parsing
 * `OAUTH_STATELESS_MODE` from `env` would silently ignore the CLI flag
 * `--oauth-stateless-mode`, leaving `STATELESS_MATERIAL` null and falling back
 * to per-pod state in multi-pod deployments.
 */
export function loadKeyMaterialFromEnv(
  enabled: boolean,
  env: NodeJS.ProcessEnv = process.env
): StatelessKeyMaterial | null {
  if (!enabled) return null;

  const current = env.OAUTH_STATELESS_SECRET;
  if (!current) {
    throw new StatelessConfigError(
      "OAUTH_STATELESS_MODE=true requires OAUTH_STATELESS_SECRET (base64url, ≥32 bytes)"
    );
  }
  const material: StatelessKeyMaterial = {
    current: decodeSecret(current, "OAUTH_STATELESS_SECRET"),
  };
  const previous = env.OAUTH_STATELESS_SECRET_PREVIOUS;
  if (previous) {
    material.previous = decodeSecret(previous, "OAUTH_STATELESS_SECRET_PREVIOUS");
  }
  return material;
}

/**
 * Derive a 32-byte subkey for a given purpose and slot.
 */
export function deriveSubkey(
  material: StatelessKeyMaterial,
  slot: StatelessKeySlot,
  purpose: StatelessPurpose
): Buffer {
  const master = slot === "current" ? material.current : material.previous;
  if (!master) {
    // Callers are expected to check available() before asking for previous.
    throw new StatelessConfigError(`no ${slot} secret configured`);
  }
  const info = Buffer.from(`gitlab-mcp/${purpose}`);
  const derived = hkdfSync(HKDF_HASH, master, HKDF_SALT, info, KEY_BYTES);
  // hkdfSync returns ArrayBuffer; wrap for Buffer ergonomics.
  return Buffer.from(derived);
}

/**
 * Convenience wrapper that returns both available slots' subkeys for a
 * purpose, in order: current first, then previous (if configured).
 */
export function deriveSubkeys(
  material: StatelessKeyMaterial,
  purpose: StatelessPurpose
): Array<{ slot: StatelessKeySlot; key: Buffer }> {
  const out: Array<{ slot: StatelessKeySlot; key: Buffer }> = [
    { slot: "current", key: deriveSubkey(material, "current", purpose) },
  ];
  if (material.previous) {
    out.push({ slot: "previous", key: deriveSubkey(material, "previous", purpose) });
  }
  return out;
}

/**
 * Constant-time HMAC-SHA256. Exposed so the codec module can avoid reimporting
 * createHmac and so rotation-aware verification uses a single helper.
 */
export function hmacSha256(key: Buffer, data: Buffer): Buffer {
  return createHmac("sha256", key).update(data).digest();
}
