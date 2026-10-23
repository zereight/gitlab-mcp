import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectCallableHiddenToolNames,
  selectExposedTools,
  type ExposedToolSelection,
} from "../../tools/exposed-tools.js";
import {
  allTools,
  isExplicitToolsetOnlyTool,
  isToolInEnabledToolset,
  parseEnabledToolsets,
} from "../../tools/registry.js";

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
    it("should keep core tools that slim would drop", () => {
      const exposed = new Set(names(defaultExposed(false)));
      const kept = ["list_labels", "discover_tools", "help"].every(name => exposed.has(name));

      assert.equal(kept, true);
    });
  });

  describe("with the slim profile", () => {
    it("should drop only slim-excluded tools that the default list contains", () => {
      const full = defaultExposed(false);
      const slim = defaultExposed(true);
      const removed = full
        .filter(tool => !slim.some(kept => kept.name === tool.name))
        .map(tool => tool.name)
        .sort();

      assert.deepEqual(removed, ["list_labels"]);
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

  describe("with help omitted from toolsets", () => {
    it("should re-add help after filtering", () => {
      const exposed = names(
        selectExposedTools(
          selection({
            tools: [{ name: "help" }, { name: "get_issue" }],
            isInEnabledToolset: toolName => toolName === "get_issue",
          })
        )
      );

      assert.deepEqual(exposed, ["get_issue", "help"]);
    });
  });
});

function callableHidden(
  hiddenToolNames: ReadonlySet<string>,
  overrides: Partial<ExposedToolSelection<(typeof allTools)[number]>> = {}
): string[] {
  const enabledToolsets = parseEnabledToolsets(undefined);
  const callable = selectCallableHiddenToolNames({
    tools: allTools,
    isInEnabledToolset: toolName => isToolInEnabledToolset(toolName, enabledToolsets),
    individuallyEnabledTools: new Set(),
    featureFlagOverrides: new Set(),
    isAllowedByPermissionMode: () => true,
    deniedToolsRegex: undefined,
    hiddenToolNames,
    applySlimProfile: false,
    isAdditiveEnablementAllowed: toolName => !isExplicitToolsetOnlyTool(toolName),
    ...overrides,
  });
  return [...callable].sort();
}

describe("When selecting hidden tools that stay callable", () => {
  describe("with a hidden tool inside an enabled toolset", () => {
    it("should keep the tool callable", () => {
      assert.deepEqual(callableHidden(new Set(["list_issues"])), ["list_issues"]);
    });
  });

  describe("with hidden tools outside the default toolsets", () => {
    it("should not make them callable", () => {
      assert.deepEqual(callableHidden(new Set(["delete_issue", "delete_wiki_page"])), []);
    });
  });

  describe("with a hidden tool whose legacy flag is set", () => {
    it("should keep the tool callable", () => {
      const callable = callableHidden(new Set(["delete_wiki_page"]), {
        featureFlagOverrides: new Set(["delete_wiki_page"]),
      });

      assert.deepEqual(callable, ["delete_wiki_page"]);
    });
  });

  describe("with hidden execute_graphql", () => {
    it("should not make it callable without a GITLAB_TOOLS entry", () => {
      assert.deepEqual(callableHidden(new Set(["execute_graphql"])), []);
    });

    it("should keep it callable with a GITLAB_TOOLS entry", () => {
      const callable = callableHidden(new Set(["execute_graphql"]), {
        individuallyEnabledTools: new Set(["execute_graphql"]),
      });

      assert.deepEqual(callable, ["execute_graphql"]);
    });
  });

  describe("with hidden gitlab_api_request", () => {
    it("should not make it callable under GITLAB_TOOLSETS=all and GITLAB_TOOLS", () => {
      const enabledToolsets = parseEnabledToolsets("all");
      const callable = callableHidden(new Set(["gitlab_api_request"]), {
        isInEnabledToolset: toolName => isToolInEnabledToolset(toolName, enabledToolsets),
        individuallyEnabledTools: new Set(["gitlab_api_request"]),
      });

      assert.deepEqual(callable, []);
    });

    it("should keep it callable when the api toolset is listed", () => {
      const enabledToolsets = parseEnabledToolsets("core,api");
      const callable = callableHidden(new Set(["gitlab_api_request"]), {
        isInEnabledToolset: toolName => isToolInEnabledToolset(toolName, enabledToolsets),
      });

      assert.deepEqual(callable, ["gitlab_api_request"]);
    });
  });

  describe("with a hidden tool the regex denies", () => {
    it("should not make it callable", () => {
      const callable = callableHidden(new Set(["list_issues"]), {
        deniedToolsRegex: /^list_issues$/,
      });

      assert.deepEqual(callable, []);
    });
  });

  describe("with a hidden tool the permission mode blocks", () => {
    it("should not make it callable", () => {
      const callable = callableHidden(new Set(["create_issue"]), {
        isAllowedByPermissionMode: toolName => toolName !== "create_issue",
      });

      assert.deepEqual(callable, []);
    });
  });

  describe("with a hidden tool the slim profile excludes", () => {
    it("should not make it callable", () => {
      const callable = callableHidden(new Set(["list_labels"]), { applySlimProfile: true });

      assert.deepEqual(callable, []);
    });
  });
});
