import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getDeprecatedEnvWarnings, type DeprecatedEnvInput } from "../deprecated-env.js";

function warningsFor(overrides: Partial<DeprecatedEnvInput>): string[] {
  return getDeprecatedEnvWarnings({
    readOnlyMode: false,
    permissionModeRaw: undefined,
    allowedGroupsRaw: undefined,
    oauthAllowedGroupsRaw: undefined,
    useWikiRaw: undefined,
    useMilestoneRaw: undefined,
    usePipelineRaw: undefined,
    ...overrides,
  });
}

describe("When no deprecated env is used", () => {
  describe("with default config", () => {
    test("should emit no warnings", () => {
      assert.deepEqual(warningsFor({}), []);
    });
  });
});

describe("When GITLAB_READ_ONLY_MODE is enabled", () => {
  describe("with no permission mode configured", () => {
    test("should warn about deprecation without an override notice", () => {
      const [warning, ...rest] = warningsFor({ readOnlyMode: true });
      assert.match(warning, /GITLAB_READ_ONLY_MODE is deprecated/);
      assert.doesNotMatch(warning, /OVERRIDES/);
      assert.equal(rest.length, 0);
    });
  });

  describe("with permission mode already readonly", () => {
    test("should not warn about an override", () => {
      const [warning] = warningsFor({ readOnlyMode: true, permissionModeRaw: "readonly" });
      assert.doesNotMatch(warning, /OVERRIDES/);
    });
  });

  describe("with a conflicting permission mode", () => {
    test("should warn that it overrides the configured mode", () => {
      const [warning] = warningsFor({ readOnlyMode: true, permissionModeRaw: "full" });
      assert.match(warning, /OVERRIDES the configured permission mode "full"/);
    });
  });
});

describe("When GITLAB_ALLOWED_GROUPS is set", () => {
  describe("with GITLAB_OAUTH_ALLOWED_GROUPS also set", () => {
    test("should warn that it is ignored", () => {
      const [warning] = warningsFor({ allowedGroupsRaw: "a", oauthAllowedGroupsRaw: "b" });
      assert.match(warning, /ignored/);
    });
  });

  describe("with only the deprecated variable", () => {
    test("should point to GITLAB_OAUTH_ALLOWED_GROUPS", () => {
      const [warning] = warningsFor({ allowedGroupsRaw: "a" });
      assert.match(warning, /Use GITLAB_OAUTH_ALLOWED_GROUPS/);
    });
  });
});

describe("When legacy toolset flags are enabled", () => {
  describe("with all three flags", () => {
    test("should warn once per flag with its GITLAB_TOOLSETS replacement", () => {
      const warnings = warningsFor({
        useWikiRaw: "true",
        useMilestoneRaw: "true",
        usePipelineRaw: "true",
      });
      assert.equal(warnings.length, 3);
      assert.match(warnings[0], /USE_GITLAB_WIKI.*GITLAB_TOOLSETS=core,wiki/);
      assert.match(warnings[1], /USE_MILESTONE.*GITLAB_TOOLSETS=core,milestones/);
      assert.match(warnings[2], /USE_PIPELINE.*GITLAB_TOOLSETS=core,pipelines/);
    });
  });
});

describe("When a legacy toolset flag is explicitly false", () => {
  describe("with USE_GITLAB_WIKI=false", () => {
    test("should warn to remove it without enabling the toolset", () => {
      const [warning, ...rest] = warningsFor({ useWikiRaw: "false" });
      assert.match(warning, /USE_GITLAB_WIKI is set to "false"/);
      assert.match(warning, /does not enable the wiki toolset/);
      assert.match(warning, /GITLAB_TOOLSETS=core,wiki/);
      assert.match(warning, /in addition to core/);
      assert.doesNotMatch(warning, /Use GITLAB_TOOLSETS=core,wiki instead/);
      assert.equal(rest.length, 0);
    });
  });
});
