import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  exposureRefusalMessage,
  isToolExposed,
  parseToolNameSet,
} from "../../cli/exposure.js";
import { compileDeniedToolsRegex } from "../../tools/denied-regex.js";
import { parseEnabledToolsets } from "../../tools/registry.js";

const ISSUES = parseEnabledToolsets("issues");
const EMPTY = new Set<string>();

function exposure(overrides: {
  toolName: string;
  enabledToolsets?: typeof ISSUES;
  individuallyEnabledTools?: ReadonlySet<string>;
  featureFlagOverrides?: ReadonlySet<string>;
  deniedRegex?: RegExp;
  hiddenTools?: ReadonlySet<string>;
}) {
  return {
    toolName: overrides.toolName,
    enabledToolsets: overrides.enabledToolsets ?? ISSUES,
    individuallyEnabledTools: overrides.individuallyEnabledTools ?? EMPTY,
    featureFlagOverrides: overrides.featureFlagOverrides ?? EMPTY,
    deniedRegex: overrides.deniedRegex,
    hiddenTools: overrides.hiddenTools ?? EMPTY,
  };
}

describe("When isToolExposed applies MCP filters", () => {
  describe("with a tool in the enabled toolset", () => {
    it("should expose list_issues", () => {
      assert.equal(isToolExposed(exposure({ toolName: "list_issues" })), true);
    });
  });

  describe("with a tool outside the enabled toolsets", () => {
    it("should hide list_pipelines", () => {
      assert.equal(isToolExposed(exposure({ toolName: "list_pipelines" })), false);
    });
  });

  describe("with GITLAB_TOOLS", () => {
    it("should expose an individually enabled tool", () => {
      assert.equal(
        isToolExposed(
          exposure({
            toolName: "list_pipelines",
            individuallyEnabledTools: new Set(["list_pipelines"]),
          })
        ),
        true
      );
    });
  });

  describe("with a legacy feature-flag override", () => {
    it("should expose the overridden wiki tool", () => {
      assert.equal(
        isToolExposed(
          exposure({
            toolName: "list_wiki_pages",
            featureFlagOverrides: new Set(["list_wiki_pages"]),
          })
        ),
        true
      );
    });
  });

  describe("with GITLAB_DENIED_TOOLS_REGEX", () => {
    it("should hide a matching tool even when the toolset is enabled", () => {
      assert.equal(
        isToolExposed(
          exposure({
            toolName: "list_issues",
            deniedRegex: /^list_/,
          })
        ),
        false
      );
    });
  });

  describe("with GITLAB_TOOL_POLICY_HIDDEN", () => {
    it("should hide the named tool", () => {
      assert.equal(
        isToolExposed(
          exposure({
            toolName: "list_issues",
            hiddenTools: new Set(["list_issues"]),
          })
        ),
        false
      );
    });
  });
});

describe("When exposureRefusalMessage explains a block", () => {
  describe("with a hidden tool", () => {
    it("should mention GITLAB_TOOL_POLICY_HIDDEN", () => {
      const message = exposureRefusalMessage(
        exposure({ toolName: "list_issues", hiddenTools: new Set(["list_issues"]) })
      );
      assert.match(String(message), /GITLAB_TOOL_POLICY_HIDDEN/);
    });
  });

  describe("with a denied regex", () => {
    it("should mention GITLAB_DENIED_TOOLS_REGEX", () => {
      const message = exposureRefusalMessage(
        exposure({ toolName: "list_issues", deniedRegex: /^list_/ })
      );
      assert.match(String(message), /GITLAB_DENIED_TOOLS_REGEX/);
    });
  });

  describe("with a toolset miss", () => {
    it("should mention GITLAB_TOOLSETS", () => {
      const message = exposureRefusalMessage(exposure({ toolName: "list_pipelines" }));
      assert.match(String(message), /GITLAB_TOOLSETS/);
    });
  });
});

describe("When parseToolNameSet reads a policy list", () => {
  describe("with comma-separated names", () => {
    it("should trim and drop empties", () => {
      assert.deepEqual([...parseToolNameSet(" push_files, delete_issue , ")], [
        "push_files",
        "delete_issue",
      ]);
    });
  });
});

describe("When compileDeniedToolsRegex validates a pattern", () => {
  describe("with nested quantifiers", () => {
    it("should ignore the pattern", () => {
      const compiled = compileDeniedToolsRegex("(a+)+");
      assert.equal(compiled.regex, undefined);
      assert.match(String(compiled.error), /nested quantifiers/);
    });
  });
});
