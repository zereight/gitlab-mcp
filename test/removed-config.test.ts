import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertNoRemovedConfig, getRemovedConfigErrors } from "../removed-config.js";

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

  describe("with each removed CLI flag", () => {
    for (const flag of ["read-only", "allowed-groups"]) {
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
        () => assertNoRemovedConfig({ GITLAB_READ_ONLY_MODE: "true" }, []),
        /Removed configuration detected/
      );
    });
  });
});
