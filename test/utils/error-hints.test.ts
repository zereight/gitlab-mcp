import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendRecoveryHint, recoveryHintFor } from "../../utils/error-hints.js";

describe("When a GitLab tool error is returned", () => {
  describe("with a 401 unauthorized body", () => {
    it("should tell the caller to set a token or run auth", () => {
      const hint = recoveryHintFor("GitLab API error: 401 Unauthorized");

      assert.match(String(hint), /GITLAB_PERSONAL_ACCESS_TOKEN/);
      assert.match(String(hint), /auth/);
    });
  });

  describe("with a 403 forbidden body", () => {
    it("should tell the caller to check scopes and permission mode", () => {
      const hint = recoveryHintFor("GitLab API error: 403 Forbidden\ninsufficient_scope");

      assert.match(String(hint), /GITLAB_PERMISSION_MODE|read_user/);
    });
  });

  describe("with a 404 not found body", () => {
    it("should tell the caller to check project_id encoding and the iid", () => {
      const hint = recoveryHintFor("GitLab API error: 404 Not Found");

      assert.match(String(hint), /group%2Fproject/);
      assert.match(String(hint), /iid/);
    });
  });

  describe("with a toolset-missing message", () => {
    it("should tell the caller to use discover_tools or GITLAB_TOOLSETS", () => {
      const hint = recoveryHintFor(
        'Tool "list_pipelines" is not available on this server. It belongs to the "pipelines" toolset, which is not enabled: call discover_tools with category "pipelines" or add "pipelines" to GITLAB_TOOLSETS.'
      );

      assert.match(String(hint), /discover_tools/);
      assert.match(String(hint), /GITLAB_TOOLSETS/);
    });
  });

  describe("with a slim-exclusion message", () => {
    it("should not suggest discover_tools", () => {
      const message =
        'Tool "list_labels" is not available on this server. The slim tool profile excludes it. Add "list_labels" to GITLAB_TOOLS, set GITLAB_TOOL_PROFILE=full, or add "labels" to GITLAB_TOOLSETS (setting GITLAB_TOOLSETS disables the slim profile).';

      assert.equal(recoveryHintFor(message), undefined);
      assert.equal(appendRecoveryHint(message), message);
      assert.equal(message.includes("discover_tools"), false);
    });
  });

  describe("with a message that already has a Next line", () => {
    it("should not append a second hint", () => {
      const first = appendRecoveryHint("GitLab API error: 404 Not Found");
      const second = appendRecoveryHint(first);

      assert.equal(second, first);
      assert.equal(second.split("\nNext: ").length, 2);
    });
  });

  describe("with an unrelated 500 body", () => {
    it("should leave the message unchanged", () => {
      const message = "GitLab API error: 500 Internal Server Error";

      assert.equal(appendRecoveryHint(message), message);
    });
  });
});
