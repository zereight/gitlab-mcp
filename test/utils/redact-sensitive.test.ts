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

  describe("with a runner response that nests project credentials", () => {
    test("should remove token and runners_token at every level", () => {
      const data = {
        id: 8,
        tag_list: ["docker"],
        token: "glrt-secret",
        token_expires_at: "2025-01-01T00:00:00.000Z",
        projects: [{ id: 1, name: "demo", runners_token: "GR1348941secret", token: "nested-auth" }],
      };

      const result = redactSensitiveGitLabFields(data);
      const serialized = JSON.stringify(result);

      assert.equal(serialized.includes("glrt-secret"), false);
      assert.equal(serialized.includes("GR1348941secret"), false);
      assert.equal(serialized.includes("nested-auth"), false);
      assert.equal(result.token_expires_at, "2025-01-01T00:00:00.000Z");
      assert.deepEqual(result.tag_list, ["docker"]);
      assert.equal(result.projects[0].name, "demo");
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
