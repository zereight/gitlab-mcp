import { describe, test } from "node:test";
import assert from "node:assert";
import { createDownloadToken, decryptDownloadToken } from "../../utils/download-token.js";

describe("download token helpers", () => {
  test("round-trips auth, api URL, and resource binding", () => {
    const token = createDownloadToken(
      "Authorization",
      "Bearer glpat-example-token",
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
      apiUrl: "https://gitlab.example.com/api/v4",
      resourceType: "attachment",
      resourceParams: { project_id: "group/project", secret: "abc", filename: "file.txt" },
    });
  });

  test("returns null for invalid tokens", () => {
    assert.strictEqual(decryptDownloadToken("not-a-valid-token"), null);
  });

  test("returns null for expired tokens", () => {
    const originalNow = Date.now;
    const issuedAt = 1_700_000_000_000;

    try {
      Date.now = () => issuedAt;
      const token = createDownloadToken("Private-Token", "glpat-example-token");

      Date.now = () => issuedAt + 301_000;
      assert.strictEqual(decryptDownloadToken(token), null);
    } finally {
      Date.now = originalNow;
    }
  });
});
