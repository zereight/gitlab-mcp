import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertGitLabVersionAtLeast,
  isGitLabVersionAtLeast,
  parseGitLabVersion,
  type GitLabVersionFetcher,
  type GitLabVersionRequirement,
} from "../../utils/gitlab-version-gate.js";

function versionFetcher(version: string | null): GitLabVersionFetcher {
  return async () => version;
}

function bulkPublishRequirement(): GitLabVersionRequirement {
  return {
    major: 19,
    minor: 2,
    feature: "reviewer_state, note, and internal on bulk_publish_draft_notes",
    retryHint: "Omit reviewer_state, note, and internal, then retry.",
  };
}

describe("When parseGitLabVersion runs", () => {
  describe("with a release suffix", () => {
    test("should parse major.minor.patch from ee builds", () => {
      assert.deepEqual(parseGitLabVersion("19.2.0-ee"), {
        major: 19,
        minor: 2,
        patch: 0,
      });
    });
  });

  describe("with a malformed string", () => {
    test("should return null", () => {
      assert.equal(parseGitLabVersion("unknown"), null);
      assert.equal(parseGitLabVersion(""), null);
    });
  });
});

describe("When isGitLabVersionAtLeast compares versions", () => {
  describe("with a version at or above the floor", () => {
    test("should return true", () => {
      assert.equal(isGitLabVersionAtLeast("19.2.0-ee", 19, 2), true);
      assert.equal(isGitLabVersionAtLeast("19.3.1", 19, 2), true);
      assert.equal(isGitLabVersionAtLeast("20.0.0", 19, 2), true);
    });
  });

  describe("with a version below the floor", () => {
    test("should return false", () => {
      assert.equal(isGitLabVersionAtLeast("19.1.9-ee", 19, 2), false);
      assert.equal(isGitLabVersionAtLeast("17.5.0", 19, 2), false);
    });
  });

  describe("with an unparseable version", () => {
    test("should return null", () => {
      assert.equal(isGitLabVersionAtLeast("not-a-version", 19, 2), null);
    });
  });
});

describe("When assertGitLabVersionAtLeast runs", () => {
  describe("with an older instance version", () => {
    test("should throw a retryable error", async () => {
      await assert.rejects(
        () => assertGitLabVersionAtLeast(bulkPublishRequirement(), versionFetcher("17.5.0-ee")),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /GitLab 19\.2\+/);
          assert.match(error.message, /17\.5\.0-ee/);
          assert.match(error.message, /Omit reviewer_state/);
          return true;
        }
      );
    });
  });

  describe("with a new enough instance version", () => {
    test("should resolve without throwing", async () => {
      await assertGitLabVersionAtLeast(bulkPublishRequirement(), versionFetcher("19.2.0-ee"));
    });
  });

  describe("with an unknown instance version", () => {
    test("should fail open and resolve", async () => {
      await assertGitLabVersionAtLeast(bulkPublishRequirement(), versionFetcher(null));
    });
  });
});
