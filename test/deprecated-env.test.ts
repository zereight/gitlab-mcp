import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getDeprecatedEnvWarnings, type DeprecatedEnvInput } from "../deprecated-env.js";

function warningsFor(overrides: Partial<DeprecatedEnvInput>): string[] {
  return getDeprecatedEnvWarnings({
    readOnlyMode: false,
    permissionModeRaw: undefined,
    allowedGroupsRaw: undefined,
    oauthAllowedGroupsRaw: undefined,
    useWiki: false,
    useMilestone: false,
    usePipeline: false,
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
      const warnings = warningsFor({ useWiki: true, useMilestone: true, usePipeline: true });
      assert.equal(warnings.length, 3);
      assert.match(warnings[0], /USE_GITLAB_WIKI.*GITLAB_TOOLSETS=wiki/);
      assert.match(warnings[1], /USE_MILESTONE.*GITLAB_TOOLSETS=milestones/);
      assert.match(warnings[2], /USE_PIPELINE.*GITLAB_TOOLSETS=pipelines/);
    });
  });
});
