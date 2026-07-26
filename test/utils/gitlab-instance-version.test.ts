import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseGitLabVersionApiResponse } from "../../utils/gitlab-instance-version.js";

describe("When parseGitLabVersionApiResponse runs", () => {
  describe("with a full GitLab /version payload", () => {
    test("should return version, revision, and enterprise", () => {
      assert.deepEqual(
        parseGitLabVersionApiResponse({
          version: "18.3.1-ee",
          revision: "abc1234",
          enterprise: true,
        }),
        {
          version: "18.3.1-ee",
          revision: "abc1234",
          enterprise: true,
        }
      );
    });
  });

  describe("with only a version field", () => {
    test("should return version without optional fields", () => {
      assert.deepEqual(parseGitLabVersionApiResponse({ version: "17.5.0" }), {
        version: "17.5.0",
      });
    });
  });

  describe("with invalid payloads", () => {
    test("should return null", () => {
      assert.equal(parseGitLabVersionApiResponse(null), null);
      assert.equal(parseGitLabVersionApiResponse({}), null);
      assert.equal(parseGitLabVersionApiResponse({ version: 18 }), null);
    });
  });
});
