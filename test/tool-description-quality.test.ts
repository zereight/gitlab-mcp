import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allTools, TOOLSET_DEFINITIONS } from "../tools/registry.js";

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
      const tool = allTools.find(candidate => candidate.name === "create_branch");

      assert.ok(tool);
      assert.match(
        tool.description,
        /source branch|tag|commit[\s\S]*protect_branch[\s\S]*already-exists/i
      );
    });
  });
});
