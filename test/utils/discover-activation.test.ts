import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildUnavailableToolMessage,
  isSkippedByDiscoverActivation,
  type DiscoverActivationSkip,
} from "../../tools/discover-activation.js";
import {
  TOOLSET_DEFINITIONS,
  listDiscoverableCategories,
  type ToolsetId,
} from "../../tools/registry.js";

function openTool(): DiscoverActivationSkip {
  return {
    allowedByPermissionMode: true,
    deniedByRegex: false,
    hidden: false,
    excludedBySlimProfile: false,
  };
}

function toolsetHas(id: ToolsetId, toolName: string): boolean {
  const definition = TOOLSET_DEFINITIONS.find(item => item.id === id);
  if (!definition) {
    throw new Error(`Missing toolset ${id}`);
  }
  return definition.tools.has(toolName);
}

describe("When deciding whether discover_tools can activate a tool", () => {
  describe("with no policy block", () => {
    it("should allow activation", () => {
      assert.equal(isSkippedByDiscoverActivation(openTool()), false);
    });
  });

  describe("with a regex denial", () => {
    it("should skip the tool", () => {
      assert.equal(isSkippedByDiscoverActivation({ ...openTool(), deniedByRegex: true }), true);
    });
  });

  describe("with permission mode blocking the tool", () => {
    it("should skip the tool", () => {
      assert.equal(
        isSkippedByDiscoverActivation({ ...openTool(), allowedByPermissionMode: false }),
        true
      );
    });
  });

  describe("with a hidden tool", () => {
    it("should skip the tool", () => {
      assert.equal(isSkippedByDiscoverActivation({ ...openTool(), hidden: true }), true);
    });
  });

  describe("with a slim exclusion", () => {
    it("should skip the tool", () => {
      assert.equal(
        isSkippedByDiscoverActivation({ ...openTool(), excludedBySlimProfile: true }),
        true
      );
    });
  });
});

const BLOCKED_LABEL_WRITES = new Set(["create_label", "update_label", "delete_label"]);

function labelsListed(names: readonly string[]): Set<string> {
  for (const name of [...names, ...BLOCKED_LABEL_WRITES]) {
    if (!toolsetHas("labels", name)) {
      throw new Error(`${name} is not in the labels toolset`);
    }
  }
  return new Set(names);
}

function skipBlockedLabelWrites(name: string): boolean {
  return isSkippedByDiscoverActivation({
    ...openTool(),
    allowedByPermissionMode: !BLOCKED_LABEL_WRITES.has(name),
  });
}

describe("When listing discover_tools categories", () => {
  describe("with write tools blocked and the readable labels already listed", () => {
    it("should mark labels active", () => {
      const listed = labelsListed(["list_labels", "get_label"]);
      const active = listDiscoverableCategories(listed, skipBlockedLabelWrites).find(
        item => item.id === "labels"
      )?.active;

      assert.equal(active, true);
    });
  });

  describe("with a readable label still absent", () => {
    it("should leave labels inactive", () => {
      const listed = labelsListed(["list_labels"]);
      const active = listDiscoverableCategories(listed, skipBlockedLabelWrites).find(
        item => item.id === "labels"
      )?.active;

      assert.equal(active, false);
    });
  });
});

describe("When explaining an unavailable tool", () => {
  describe("with a slim-excluded tool the current toolsets already include", () => {
    it("should point at the slim profile instead of discover_tools", () => {
      assert.equal(
        buildUnavailableToolMessage({
          toolName: "list_labels",
          toolset: "labels",
          deniedByRegex: false,
          excludedBySlimProfile: true,
          enabledByCurrentToolsets: true,
        }),
        'Tool "list_labels" is not available on this server. The slim tool profile excludes it. Add "list_labels" to GITLAB_TOOLS, set GITLAB_TOOL_PROFILE=full, or add "labels" to GITLAB_TOOLSETS (setting GITLAB_TOOLSETS disables the slim profile).'
      );
    });
  });

  describe("with a slim-excluded tool outside the current toolsets", () => {
    it("should require GITLAB_TOOLS or GITLAB_TOOLSETS", () => {
      assert.equal(
        buildUnavailableToolMessage({
          toolName: "create_label",
          toolset: "labels",
          deniedByRegex: false,
          excludedBySlimProfile: true,
          enabledByCurrentToolsets: false,
        }),
        'Tool "create_label" is not available on this server. The slim tool profile excludes it. Add "create_label" to GITLAB_TOOLS, or add "labels" to GITLAB_TOOLSETS (setting GITLAB_TOOLSETS disables the slim profile).'
      );
    });
  });

  describe("with a tool in a disabled toolset", () => {
    it("should suggest discover_tools", () => {
      assert.equal(
        buildUnavailableToolMessage({
          toolName: "list_pipelines",
          toolset: "pipelines",
          deniedByRegex: false,
          excludedBySlimProfile: false,
          enabledByCurrentToolsets: false,
        }),
        'Tool "list_pipelines" is not available on this server. It belongs to the "pipelines" toolset, which is not enabled: call discover_tools with category "pipelines" or add "pipelines" to GITLAB_TOOLSETS.'
      );
    });
  });

  describe("with a regex denial on a slim-excluded tool", () => {
    it("should omit activation guidance", () => {
      assert.equal(
        buildUnavailableToolMessage({
          toolName: "list_labels",
          toolset: "labels",
          deniedByRegex: true,
          excludedBySlimProfile: true,
          enabledByCurrentToolsets: true,
        }),
        'Tool "list_labels" is not available on this server'
      );
    });
  });

  describe("with a tool outside every toolset", () => {
    it("should omit activation guidance", () => {
      assert.equal(
        buildUnavailableToolMessage({
          toolName: "execute_graphql",
          toolset: undefined,
          deniedByRegex: false,
          excludedBySlimProfile: false,
          enabledByCurrentToolsets: false,
        }),
        'Tool "execute_graphql" is not available on this server'
      );
    });
  });
});
