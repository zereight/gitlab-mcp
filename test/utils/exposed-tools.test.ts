import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectExposedTools, type ExposedToolSelection } from "../../tools/exposed-tools.js";
import { allTools, isToolInEnabledToolset, parseEnabledToolsets } from "../../tools/registry.js";
import { SLIM_PROFILE_EXCLUDED_TOOLS } from "../../tools/tool-profile.js";

interface FixtureTool {
  readonly name: string;
}

function selection(
  overrides: Partial<ExposedToolSelection<FixtureTool>> = {}
): ExposedToolSelection<FixtureTool> {
  return {
    tools: [],
    isInEnabledToolset: () => false,
    individuallyEnabledTools: new Set(),
    featureFlagOverrides: new Set(),
    isAllowedByPermissionMode: () => true,
    deniedToolsRegex: undefined,
    hiddenToolNames: new Set(),
    applySlimProfile: false,
    ...overrides,
  };
}

function names(tools: readonly { readonly name: string }[]): string[] {
  return tools.map(tool => tool.name);
}

function defaultExposed(
  applySlimProfile: boolean,
  individuallyEnabledTools: ReadonlySet<string> = new Set()
) {
  const enabledToolsets = parseEnabledToolsets(undefined);
  return selectExposedTools({
    tools: allTools,
    isInEnabledToolset: toolName => isToolInEnabledToolset(toolName, enabledToolsets),
    individuallyEnabledTools,
    featureFlagOverrides: new Set(),
    isAllowedByPermissionMode: () => true,
    deniedToolsRegex: undefined,
    hiddenToolNames: new Set(),
    applySlimProfile,
  });
}

describe("When selecting the default tool list", () => {
  describe("with the full profile", () => {
    it("should keep tools that slim would drop", () => {
      const exposed = new Set(names(defaultExposed(false)));
      const kept = ["list_labels", "create_group", "discover_tools"].every(name =>
        exposed.has(name)
      );

      assert.equal(kept, true);
    });
  });

  describe("with the slim profile", () => {
    it("should drop the slim denylist and nothing else from the default list", () => {
      const full = defaultExposed(false);
      const slim = defaultExposed(true);
      const removed = full.filter(tool => !slim.some(kept => kept.name === tool.name));

      assert.deepEqual(
        removed.map(tool => tool.name).sort(),
        [...SLIM_PROFILE_EXCLUDED_TOOLS].sort()
      );
    });
  });

  describe("with slim and GITLAB_TOOLS=list_labels", () => {
    it("should keep the explicitly enabled tool", () => {
      const exposed = names(defaultExposed(true, new Set(["list_labels"])));

      assert.equal(exposed.includes("list_labels"), true);
      assert.equal(exposed.includes("create_label"), false);
    });
  });
});

describe("When selecting tools outside a toolset", () => {
  describe("with discover_tools denied by regex", () => {
    it("should omit discover_tools", () => {
      const exposed = names(
        selectExposedTools(
          selection({
            tools: [{ name: "discover_tools" }, { name: "get_issue" }],
            isInEnabledToolset: toolName => toolName === "get_issue",
            deniedToolsRegex: /^discover_/,
          })
        )
      );

      assert.deepEqual(exposed, ["get_issue"]);
    });
  });
});
