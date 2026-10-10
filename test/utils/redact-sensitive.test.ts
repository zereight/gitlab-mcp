import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  redactSensitiveGitLabFields,
  redactSensitiveGitLabText,
} from "../../utils/redact-sensitive.js";

describe("When redactSensitiveGitLabFields runs", () => {
  describe("with a project response containing credentials", () => {
    test("should remove runners_token and import_url while keeping other fields", () => {
      const data = {
        id: 42,
        name: "demo",
        runners_token: "GR1348941secret",
        import_url: "https://user:pass@example.com/repo.git",
      };

      const result = redactSensitiveGitLabFields(data);

      assert.equal("runners_token" in result, false);
      assert.equal("import_url" in result, false);
      assert.equal(result.id, 42);
      assert.equal(result.name, "demo");
    });
  });

  describe("with a response that has no sensitive fields", () => {
    test("should return the object unchanged", () => {
      const data = { id: 1, name: "safe" };

      assert.deepEqual(redactSensitiveGitLabFields(data), { id: 1, name: "safe" });
    });
  });

  describe("with a non-object value", () => {
    test("should return the value as-is", () => {
      assert.equal(redactSensitiveGitLabFields(null), null);
      assert.equal(redactSensitiveGitLabFields("raw"), "raw");
    });
  });
});

describe("When redactSensitiveGitLabText runs", () => {
  describe("with a token assignment", () => {
    test("should redact the assigned value", () => {
      assert.equal(redactSensitiveGitLabText("token: plain-secret"), "token: [REDACTED]");
    });
  });

  describe("with an import_url assignment", () => {
    test("should redact the URL value", () => {
      assert.equal(
        redactSensitiveGitLabText("import_url=https://user:pass@example.com/repo.git"),
        "import_url=[REDACTED]"
      );
    });
  });

  describe("with a GitLab token prefix and no field name", () => {
    test("should redact the token", () => {
      assert.equal(
        redactSensitiveGitLabText("see glpat-abcdefghijklmnopqrstuvwxyz"),
        "see [REDACTED]"
      );
    });
  });

  describe("with an escaped quote inside a quoted token", () => {
    test("should redact the whole quoted value", () => {
      assert.equal(redactSensitiveGitLabText('token: "ab\\"cd"'), "token: [REDACTED]");
    });
  });

  describe("with ordinary text", () => {
    test("should leave the text unchanged", () => {
      assert.equal(
        redactSensitiveGitLabText("token is not a secret here"),
        "token is not a secret here"
      );
    });
  });
});
