import { describe, test } from "node:test";
import assert from "node:assert";
import { createCipheriv, createHash, randomBytes } from "node:crypto";

// The token key is derived at module load, so the secret must be set before importing it.
const DOWNLOAD_TOKEN_SECRET = "download-token-test-secret";
process.env.DOWNLOAD_TOKEN_SECRET = DOWNLOAD_TOKEN_SECRET;
const { createDownloadToken, decryptDownloadToken } = await import("../../utils/download-token.js");

function sealPayload(payload: Record<string, unknown>): string {
  const key = createHash("sha256").update(DOWNLOAD_TOKEN_SECRET).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

describe("download token helpers", () => {
  test("round-trips auth, project allowlist, api URL, and resource binding", () => {
    const token = createDownloadToken(
      "Authorization",
      "Bearer glpat-example-token",
      ["group/project"],
      "https://gitlab.example.com/api/v4",
      {
        type: "attachment",
        params: { project_id: "group/project", secret: "abc", filename: "file.txt" },
      }
    );

    const decrypted = decryptDownloadToken(token);

    assert.deepStrictEqual(decrypted, {
      header: "Authorization",
      token: "Bearer glpat-example-token",
      allowedProjectIds: ["group/project"],
      apiUrl: "https://gitlab.example.com/api/v4",
      resourceType: "attachment",
      resourceParams: { project_id: "group/project", secret: "abc", filename: "file.txt" },
    });
  });

  test("returns null for invalid tokens", () => {
    assert.strictEqual(decryptDownloadToken("not-a-valid-token"), null);
  });

  test("returns null for tokens without a sealed project allowlist", () => {
    const token = sealPayload({
      h: "Private-Token",
      t: "glpat-example-token",
      e: Math.floor(Date.now() / 1000) + 300,
      r: "job-artifacts",
      p: { project_id: "2", job_id: "20" },
    });

    assert.strictEqual(decryptDownloadToken(token), null);
  });

  test("returns null for expired tokens", () => {
    const originalNow = Date.now;
    const issuedAt = 1_700_000_000_000;

    try {
      Date.now = () => issuedAt;
      const token = createDownloadToken("Private-Token", "glpat-example-token", []);

      Date.now = () => issuedAt + 301_000;
      assert.strictEqual(decryptDownloadToken(token), null);
    } finally {
      Date.now = originalNow;
    }
  });
});
