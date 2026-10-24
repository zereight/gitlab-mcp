import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface DownloadTokenResource {
  type: string;
  params: Record<string, string>;
}

export interface DecryptedDownloadToken {
  header: string;
  token: string;
  /** Project allowlist in effect at issuance; empty when none applied. */
  allowedProjectIds: string[];
  apiUrl?: string;
  resourceType?: string;
  resourceParams?: Record<string, string>;
}

/**
 * Encryption key for download tokens. When DOWNLOAD_TOKEN_SECRET is set
 * (recommended for HA deployments behind a load balancer) the key is
 * derived from that value so all replicas share the same key. Otherwise
 * a random key is generated per process (tokens are not portable across
 * restarts or replicas).
 */
const DOWNLOAD_TOKEN_KEY: Buffer = (() => {
  const secret = process.env.DOWNLOAD_TOKEN_SECRET;
  if (secret) {
    return createHash("sha256").update(secret).digest();
  }
  return randomBytes(32);
})();

/** Download token TTL in seconds (default 5 minutes). */
const DEFAULT_DOWNLOAD_TOKEN_TTL = 300;
const parsedDownloadTokenTtl = Number.parseInt(process.env.DOWNLOAD_TOKEN_TTL || "", 10);
const DOWNLOAD_TOKEN_TTL =
  Number.isFinite(parsedDownloadTokenTtl) && parsedDownloadTokenTtl > 0
    ? parsedDownloadTokenTtl
    : DEFAULT_DOWNLOAD_TOKEN_TTL;

/**
 * Create a self-contained encrypted download token for a specific GitLab resource.
 * `allowedProjectIds` is the project allowlist of the issuing request (session scope
 * or GITLAB_ALLOWED_PROJECT_IDS), because the download proxy runs outside that request.
 */
export function createDownloadToken(
  header: string,
  token: string,
  allowedProjectIds: readonly string[],
  apiUrl?: string,
  resource?: DownloadTokenResource
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", DOWNLOAD_TOKEN_KEY, iv);
  const payload = JSON.stringify({
    h: header,
    t: token,
    e: Math.floor(Date.now() / 1000) + DOWNLOAD_TOKEN_TTL,
    s: allowedProjectIds,
    ...(apiUrl ? { u: apiUrl } : {}),
    ...(resource ? { r: resource.type, p: resource.params } : {}),
  });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

/**
 * Decrypt and validate a download token, returning null when it is invalid or expired.
 * A token without a sealed project allowlist was issued by an older release, which
 * did not check the session scope, so it is invalid too.
 */
export function decryptDownloadToken(tokenStr: string): DecryptedDownloadToken | null {
  try {
    const buf = Buffer.from(tokenStr, "base64url");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", DOWNLOAD_TOKEN_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const payload = JSON.parse(decrypted.toString("utf8"));
    if (payload.e && Math.floor(Date.now() / 1000) > payload.e) {
      return null;
    }
    if (typeof payload.h !== "string" || payload.h.length === 0) return null;
    if (typeof payload.t !== "string" || payload.t.length === 0) return null;
    if (!isStringArray(payload.s)) return null;
    return {
      header: payload.h,
      token: payload.t,
      allowedProjectIds: payload.s,
      ...(payload.u ? { apiUrl: payload.u } : {}),
      ...(payload.r ? { resourceType: payload.r, resourceParams: payload.p } : {}),
    };
  } catch {
    return null;
  }
}
