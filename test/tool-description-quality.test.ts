import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allTools, TOOLSET_DEFINITIONS } from "../tools/registry.js";

function getExposedTool(name: string) {
  const tool = allTools.find(candidate => candidate.name === name);
  assert.ok(tool);
  return tool;
}

const DEFAULT_DESCRIPTION_MIN_CHARS = 40;
const DEFAULT_DESCRIPTION_MAX_CHARS = 320;
const LONG_DESCRIPTION_ALLOWLIST = new Set([
  "update_protected_branch",
  "gitlab_api_request",
  "get_runner",
]);

function getDefaultToolNames(): ReadonlySet<string> {
  return new Set(
    TOOLSET_DEFINITIONS.filter(definition => definition.isDefault).flatMap(definition => [
      ...definition.tools,
    ])
  );
}

describe("When MCP tool descriptions are exposed", () => {
  describe("with the default toolsets", () => {
    it("should stay long enough for first-attempt tool selection", () => {
      const defaultToolNames = getDefaultToolNames();
      const defaultTools = allTools.filter(tool => defaultToolNames.has(tool.name));

      assert.ok(defaultTools.length > 0);
      const tooShort = defaultTools.filter(
        tool => tool.description.length < DEFAULT_DESCRIPTION_MIN_CHARS
      );
      assert.deepEqual(
        tooShort.map(tool => `${tool.name}:${tool.description.length}`),
        []
      );
    });

    it("should stay short enough for the tools/list token budget", () => {
      const defaultToolNames = getDefaultToolNames();
      const defaultTools = allTools.filter(tool => defaultToolNames.has(tool.name));
      const tooLong = defaultTools.filter(
        tool =>
          !LONG_DESCRIPTION_ALLOWLIST.has(tool.name) &&
          tool.description.length > DEFAULT_DESCRIPTION_MAX_CHARS
      );
      assert.deepEqual(
        tooLong.map(tool => `${tool.name}:${tool.description.length}`),
        []
      );
    });
  });

  describe("with create_branch", () => {
    it("should explain its source revision and neighboring branch operations", () => {
      const tool = getExposedTool("create_branch");

      assert.match(
        tool.description,
        /source branch|tag|commit[\s\S]*protect_branch[\s\S]*already-exists/i
      );
    });
  });

  describe("with protected branch tools", () => {
    it("should send rule changes to update_protected_branch instead of protect_branch", () => {
      const protect = getExposedTool("protect_branch").description;
      assert.match(protect, /409[\s\S]*update_protected_branch/);
      assert.doesNotMatch(protect, /create or update/i);
      assert.match(getExposedTool("unprotect_branch").description, /update_protected_branch/);
      assert.match(
        getExposedTool("update_protected_branch").description,
        /get_protected_branch[\s\S]*_destroy/
      );
    });
  });

  describe("with list_issues", () => {
    it("should include issue-management guidance and omit group_id", () => {
      const tool = getExposedTool("list_issues");

      assert.match(tool.description, /issue management/i);
      assert.doesNotMatch(tool.description, /group_id/);
    });
  });

  describe("with my_issues", () => {
    it("should include issue-management guidance and omit group_id", () => {
      const tool = getExposedTool("my_issues");

      assert.match(tool.description, /issue management/i);
      assert.doesNotMatch(tool.description, /group_id/);
    });
  });

  describe("with get_issue", () => {
    it("should include issue-management guidance and omit group_id", () => {
      const tool = getExposedTool("get_issue");

      assert.match(tool.description, /issue management/i);
      assert.doesNotMatch(tool.description, /group_id/);
    });
  });

  describe("with get_* tools", () => {
    it("should point to a list or search tool only when one exists", () => {
      assert.match(getExposedTool("get_branch").description, /matching list or search tool/);
      assert.doesNotMatch(
        getExposedTool("get_dependency_proxy_settings").description,
        /matching list or search tool/
      );
    });
  });

  describe("with get_merge_request", () => {
    it("should name the merge request lookup fields exactly as exposed by the schema", () => {
      const tool = getExposedTool("get_merge_request");

      assert.match(tool.description, /merge_request_iid/);
      assert.match(tool.description, /source_branch/);
      assert.doesNotMatch(tool.description, /mergeRequestIid|branchName/);
    });
  });
});
