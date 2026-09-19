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
    assert.equal(
      normalizeGitLabApiUrl("https://gitlab.example.com"),
      "https://gitlab.example.com/api/v4"
    );
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

    test("should encode a project path as one segment", () => {
      assert.equal(encodeGitLabPathSegment("group/project"), "group%2Fproject");
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

  describe("with payloads that are not visible after one decode", () => {
    // One decode is not enough to recognize these: "%252E" only becomes "." on the
    // second pass, so a single-decode guard passes the payload through and the
    // receiving server sees a traversal sequence.
    const payloads = [
      "..%252Fuser",
      "%252E%252E%252Fuser",
      "%252E%252E%252F%252E%252E%252Fuser",
      "..%25252Fuser",
      "..%252F..%252F..%252Fuser",
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

  describe("with control characters", () => {
    const payloads = ["..%00", "%00../user", "a%0Ab", "%7F..%2Fuser"];

    for (const payload of payloads) {
      test(`should reject ${JSON.stringify(payload)}`, () => {
        assert.throws(
          () => encodeGitLabPathSegment(payload),
          /Cannot use value as a GitLab URL path segment/
        );
      });
    }
  });

  describe("with a value that cannot be decoded", () => {
    test("should reject a malformed escape sequence instead of passing it through", () => {
      // "%2E%2E%2F%ZZ" must not be treated as safe just because decodeURIComponent
      // threw: the guard cannot inspect the value it hands to the server.
      assert.throws(
        () => encodeGitLabPathSegment("%2E%2E%2F%ZZ"),
        /Cannot use value as a GitLab URL path segment/
      );
      assert.throws(
        () => encodeGitLabPathSegment("bad%zz/path"),
        /Cannot use value as a GitLab URL path segment/
      );
      assert.throws(
        () => encodeGitLabPathSegment("100%"),
        /Cannot use value as a GitLab URL path segment/
      );
    });

    test("should reject a value with more encoding layers than it will unwrap", () => {
      assert.throws(
        () => encodeGitLabPathSegment("%25252525252F"),
        /Cannot use value as a GitLab URL path segment/
      );
    });
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
      "a/..%252F..%252Fb",
    ]) {
      assert.throws(
        () => encodeGitLabPath(payload),
        /Cannot use value as a GitLab URL path segment/,
        payload
      );
    }
  });

  test("should reject an absolute path instead of collapsing the leading segment", () => {
    for (const payload of ["/etc/passwd", "/", "/project/-/raw/main/x"]) {
      assert.throws(
        () => encodeGitLabPath(payload),
        /Cannot use value as a GitLab URL path/,
        payload
      );
    }
  });

  test("should reject empty and empty-segment paths", () => {
    for (const payload of ["", "a//b", "a/"]) {
      assert.throws(
        () => encodeGitLabPath(payload),
        /Cannot use value as a GitLab URL path/,
        payload
      );
    }
  });
});
