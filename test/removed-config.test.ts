import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNoRemovedConfig,
  getRemovedConfigErrors,
  MIGRATION_GUIDE_URL,
  REMOVED_CONFIG_ISSUE_URL,
} from "../removed-config.js";

describe("When removed configuration is detected", () => {
  describe("with no removed settings", () => {
    it("should report nothing", () => {
      assert.deepEqual(getRemovedConfigErrors({}, []), []);
    });
  });

  describe("with GITLAB_READ_ONLY_MODE=true", () => {
    it("should point to GITLAB_PERMISSION_MODE=readonly", () => {
      const [error] = getRemovedConfigErrors({ GITLAB_READ_ONLY_MODE: "true" }, []);
      assert.match(error, /GITLAB_PERMISSION_MODE=readonly/);
    });
  });

  describe("with GITLAB_READ_ONLY_MODE empty or false", () => {
    it("should accept an empty value from templated configs", () => {
      assert.deepEqual(getRemovedConfigErrors({ GITLAB_READ_ONLY_MODE: "" }, []), []);
    });

    it("should accept false", () => {
      assert.deepEqual(getRemovedConfigErrors({ GITLAB_READ_ONLY_MODE: "false" }, []), []);
    });
  });

  describe("with a bare --read-only flag", () => {
    it("should be rejected so access is never silently widened", () => {
      assert.equal(getRemovedConfigErrors({}, ["--read-only"]).length, 1);
    });
  });

  describe("with --read-only false", () => {
    it("should be accepted", () => {
      assert.deepEqual(getRemovedConfigErrors({}, ["--read-only", "false"]), []);
    });
  });

  describe("with a repeated removed flag after a false value", () => {
    it("should reject an active occurrence rather than checking only the first", () => {
      assert.equal(getRemovedConfigErrors({}, ["--read-only=false", "--read-only=true"]).length, 1);
      assert.equal(
        getRemovedConfigErrors({}, ["--allowed-groups=", "--allowed-groups=team"]).length,
        1
      );
    });
  });

  describe("with GITLAB_ALLOWED_GROUPS set", () => {
    it("should point to GITLAB_OAUTH_ALLOWED_GROUPS and its GITLAB_MCP_OAUTH prerequisite", () => {
      const [error] = getRemovedConfigErrors({ GITLAB_ALLOWED_GROUPS: "team" }, []);
      assert.match(error, /GITLAB_OAUTH_ALLOWED_GROUPS/);
      assert.match(error, /GITLAB_MCP_OAUTH=true/);
    });
  });

  describe("with legacy toolset flags", () => {
    it("should report each with its GITLAB_TOOLSETS replacement", () => {
      const errors = getRemovedConfigErrors(
        { USE_GITLAB_WIKI: "true", USE_MILESTONE: "true", USE_PIPELINE: "true" },
        []
      );
      assert.equal(errors.length, 3);
      ["wiki", "milestones", "pipelines"].forEach((toolset, index) => {
        const error = errors[index];
        assert.ok(error.includes(`Use ${toolset} in GITLAB_TOOLSETS (or --toolsets) instead.`));
        assert.ok(
          error.includes(
            `Append ${toolset} to your existing toolset list (--toolsets when set, otherwise GITLAB_TOOLSETS) and keep its other toolsets, without adding core.`
          )
        );
        assert.ok(
          error.includes(
            `Use core,${toolset} only if that list was unset or had no valid toolset name (v2 then exposed core).`
          )
        );
        assert.ok(error.includes("See the migration guide."));
      });
      assert.ok(
        errors[2].includes(
          "If you use CI lint, also append validate_ci_lint,validate_project_ci_lint to GITLAB_TOOLS."
        )
      );
    });

    it("should not tell users with an explicit toolset list to add core", () => {
      const [error] = getRemovedConfigErrors({ USE_GITLAB_WIKI: "true" }, []);
      // The only core,<toolset> suggestion is the conditional one for an unset/invalid list.
      assert.equal(error.split("core,wiki").length - 1, 1);
      assert.doesNotMatch(error, /Use GITLAB_TOOLSETS=core/);
    });

    it("should tell users to leave an exact GITLAB_TOOLSETS=all unchanged, since appending breaks it", () => {
      const errors = getRemovedConfigErrors(
        { USE_GITLAB_WIKI: "true", USE_MILESTONE: "true", USE_PIPELINE: "true" },
        []
      );
      for (const error of errors) {
        assert.match(error, /Leave exactly `all` unchanged\./);
      }
    });
  });

  describe("with each removed CLI flag", () => {
    for (const flag of [
      "read-only",
      "allowed-groups",
      "use-wiki",
      "use-milestone",
      "use-pipeline",
    ]) {
      it(`should reject --${flag} in bare, equals, and split-value forms`, () => {
        assert.equal(getRemovedConfigErrors({}, [`--${flag}`]).length, 1);
        assert.equal(getRemovedConfigErrors({}, [`--${flag}=true`]).length, 1);
        assert.equal(getRemovedConfigErrors({}, [`--${flag}`, "true"]).length, 1);
      });
    }
  });

  describe("with a removed env restriction and a false CLI flag", () => {
    it("should still refuse the removed env restriction", () => {
      assert.equal(
        getRemovedConfigErrors({ GITLAB_READ_ONLY_MODE: "true" }, ["--read-only=false"]).length,
        1
      );
    });
  });

  describe("with assertNoRemovedConfig", () => {
    it("should throw listing the removed settings", () => {
      assert.throws(
        () => assertNoRemovedConfig({ USE_PIPELINE: "true" }, []),
        /Removed configuration detected/
      );
    });

    it("should link the migration guide and tracking issue", () => {
      assert.throws(
        () => assertNoRemovedConfig({ GITLAB_READ_ONLY_MODE: "true" }, []),
        error => {
          assert.ok(error instanceof Error);
          // Exact line match: a substring check would also pass for a longer or altered URL.
          const lines = error.message.split("\n");
          assert.ok(lines.includes(`Migration guide: ${MIGRATION_GUIDE_URL}`));
          assert.ok(lines.includes(`Tracking issue: ${REMOVED_CONFIG_ISSUE_URL}`));
          return true;
        }
      );
    });

    it("should not throw when nothing removed is set", () => {
      assert.doesNotThrow(() => assertNoRemovedConfig({ GITLAB_READ_ONLY_MODE: "false" }, []));
    });
  });
});
