import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { redactSensitiveGitLabFields } from "../../utils/redact-sensitive.js";

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
