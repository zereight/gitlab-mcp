import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  encodeGitLabPath,
  encodeGitLabPathSegment,
  normalizeGitLabApiUrl,
} from "../../utils/url.js";

describe("When normalizeGitLabApiUrl runs", () => {
  test("should default to gitlab.com", () => {
    assert.equal(normalizeGitLabApiUrl(""), "https://gitlab.com/api/v4");
  });

  test("should append the API path", () => {
    assert.equal(normalizeGitLabApiUrl("https://gitlab.example.com"), "https://gitlab.example.com/api/v4");
  });
});

describe("When encodeGitLabPathSegment runs", () => {
  describe("with ordinary values", () => {
    test("should keep plain segments", () => {
      assert.equal(encodeGitLabPathSegment("feature-branch"), "feature-branch");
    });

    test("should encode spaces and reserved characters", () => {
      assert.equal(encodeGitLabPathSegment("a b"), "a%20b");
      assert.equal(encodeGitLabPathSegment("a?b#c"), "a%3Fb%23c");
    });

    test("should keep an encoded separator inside one segment", () => {
      // GitLab accepts percent-encoded slashes for branch names such as release/1.0
      assert.equal(encodeGitLabPathSegment("release%2F1.0"), "release%2F1.0");
    });

    test("should keep values that only look like dot segments", () => {
      assert.equal(encodeGitLabPathSegment("..."), "...");
      assert.equal(encodeGitLabPathSegment("v1.0.0"), "v1.0.0");
    });
  });

  describe("with traversal payloads", () => {
    const payloads = [
      ".",
      "..",
      "../user",
      "..%2F..%2Fuser",
      "%2E%2E%2Fuser",
      "..%5C..%5Cuser",
      "/etc/passwd",
      "a/../b",
    ];

    for (const payload of payloads) {
      test(`should reject ${JSON.stringify(payload)}`, () => {
        assert.throws(
          () => encodeGitLabPathSegment(payload),
          /Cannot use value as a GitLab URL path segment/
        );
      });
    }
  });
});

describe("When encodeGitLabPath runs", () => {
  test("should encode every slash-separated segment", () => {
    assert.equal(encodeGitLabPath("docs/read me.txt"), "docs/read%20me.txt");
  });

  test("should keep an encoded separator", () => {
    assert.equal(encodeGitLabPath("release%2F1.0"), "release%2F1.0");
  });

  test("should reject a traversal payload", () => {
    for (const payload of [
      "../../../user",
      "1/../../../../admin/ci/variables",
      "..%2F..%2Fuser",
      "a/..%2F..%2Fb",
    ]) {
      assert.throws(
        () => encodeGitLabPath(payload),
        /Cannot use value as a GitLab URL path segment/,
        payload
      );
    }
  });
});
