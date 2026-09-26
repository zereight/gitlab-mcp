import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allTools, TOOLSET_DEFINITIONS } from "../tools/registry.js";

function getExposedTool(name: string) {
  const tool = allTools.find(candidate => candidate.name === name);
  assert.ok(tool);
  return tool;
}

function getDefaultToolNames(): ReadonlySet<string> {
  return new Set(
    TOOLSET_DEFINITIONS.filter(definition => definition.isDefault).flatMap(definition => [
      ...definition.tools,
    ])
  );
}

describe("When MCP tool descriptions are exposed", () => {
  describe("with the default toolsets", () => {
    it("should provide enough context for first-attempt tool selection", () => {
      const defaultToolNames = getDefaultToolNames();
      const defaultTools = allTools.filter(tool => defaultToolNames.has(tool.name));

      assert.ok(defaultTools.length > 0);
      assert.ok(defaultTools.every(tool => tool.description.length >= 120));
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
});
