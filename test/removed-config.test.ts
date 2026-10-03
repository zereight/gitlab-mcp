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

  describe("with GITLAB_ALLOWED_GROUPS set", () => {
    it("should point to GITLAB_OAUTH_ALLOWED_GROUPS", () => {
      const [error] = getRemovedConfigErrors({ GITLAB_ALLOWED_GROUPS: "team" }, []);
      assert.match(error, /GITLAB_OAUTH_ALLOWED_GROUPS/);
    });
  });

  describe("with legacy toolset flags", () => {
    it("should report each with its GITLAB_TOOLSETS replacement", () => {
      const errors = getRemovedConfigErrors(
        { USE_GITLAB_WIKI: "true", USE_MILESTONE: "true", USE_PIPELINE: "true" },
        []
      );
      assert.equal(errors.length, 3);
      assert.match(errors[0], /GITLAB_TOOLSETS=wiki/);
      assert.match(errors[1], /GITLAB_TOOLSETS=milestones/);
      assert.match(errors[2], /GITLAB_TOOLSETS=pipelines/);
    });
  });

  describe("with assertNoRemovedConfig", () => {
    it("should throw listing the removed settings", () => {
      assert.throws(
        () => assertNoRemovedConfig({ USE_PIPELINE: "true" }, []),
        /Removed configuration detected/
      );
    });
  });
});
