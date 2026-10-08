import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TOOLSET_DEFINITIONS,
  isToolsetFullyActive,
  listDiscoverableCategories,
  type ToolsetId,
} from "../../tools/registry.js";

function toolsetTools(id: ToolsetId): ReadonlySet<string> {
  const definition = TOOLSET_DEFINITIONS.find(item => item.id === id);
  if (!definition) {
    throw new Error(`Missing toolset ${id}`);
  }
  return definition.tools;
}

function coreToolNames(): ReadonlySet<string> {
  return new Set(toolsetTools("core"));
}

function isInactiveDespiteOverlap(id: ToolsetId, missingTool: string): boolean {
  const listed = coreToolNames();
  const tools = toolsetTools(id);
  const category = listDiscoverableCategories(listed).find(item => item.id === id);
  const sharesListedTool = [...tools].some(name => listed.has(name));
  return (
    category?.active === false &&
    sharesListedTool &&
    tools.has(missingTool) &&
    !listed.has(missingTool)
  );
}

describe("When listing discover_tools categories", () => {
  describe("with only the core toolset exposed", () => {
    it("should mark core active", () => {
      const core = listDiscoverableCategories(coreToolNames()).find(item => item.id === "core");

      assert.equal(core?.active, true);
    });

    it("should leave merge_requests inactive while merge_merge_request is absent", () => {
      assert.equal(isInactiveDespiteOverlap("merge_requests", "merge_merge_request"), true);
    });

    it("should leave issues inactive while delete_issue is absent", () => {
      assert.equal(isInactiveDespiteOverlap("issues", "delete_issue"), true);
    });

    it("should leave repositories inactive while push_files is absent", () => {
      assert.equal(isInactiveDespiteOverlap("repositories", "push_files"), true);
    });

    it("should leave branches inactive while delete_branch is absent", () => {
      assert.equal(isInactiveDespiteOverlap("branches", "delete_branch"), true);
    });

    it("should leave projects inactive while update_project is absent", () => {
      assert.equal(isInactiveDespiteOverlap("projects", "update_project"), true);
    });

    it("should leave labels inactive while create_label is absent", () => {
      assert.equal(isInactiveDespiteOverlap("labels", "create_label"), true);
    });

    it("should leave users inactive while get_users is absent", () => {
      assert.equal(isInactiveDespiteOverlap("users", "get_users"), true);
    });
  });

  describe("with a slim-excluded tool omitted", () => {
    it("should mark the category active when every other tool is listed", () => {
      const excluded = "list_labels";
      const listed = new Set([...toolsetTools("core")].filter(name => name !== excluded));
      const category = listDiscoverableCategories(listed, toolName => toolName === excluded).find(
        item => item.id === "core"
      );

      assert.equal(category?.active, true);
    });
  });

  describe("with every tool in the category already listed", () => {
    it("should mark that category active", () => {
      const tools = toolsetTools("merge_requests");
      const listed = new Set(tools);
      const category = listDiscoverableCategories(listed).find(
        item => item.id === "merge_requests"
      );

      assert.equal(isToolsetFullyActive(tools, listed), true);
      assert.equal(category?.active, true);
    });
  });
});
