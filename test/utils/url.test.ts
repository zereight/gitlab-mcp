import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  apiUrlError,
  apiUrlHostnameForLog,
  apiUrlUserinfoWarning,
  configuredApiUrlErrors,
  encodeGitLabPath,
  encodeGitLabPathSegment,
  isCleartextRemoteUrl,
  normalizeGitLabApiUrl,
  parseConfiguredGitLabApiUrls,
} from "../../utils/url.js";

describe("When isCleartextRemoteUrl runs", () => {
  test("should flag http to a remote host", () => {
    assert.equal(isCleartextRemoteUrl("http://gitlab.example.com/api/v4"), true);
  });

  test("should allow https", () => {
    assert.equal(isCleartextRemoteUrl("https://gitlab.example.com/api/v4"), false);
  });

  test("should allow http to loopback hosts", () => {
    assert.equal(isCleartextRemoteUrl("http://127.0.0.1:8080/api/v4"), false);
    assert.equal(isCleartextRemoteUrl("http://localhost/api/v4"), false);
    assert.equal(isCleartextRemoteUrl("http://[::1]:3000/api/v4"), false);
  });
});

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

describe("When parseConfiguredGitLabApiUrls runs", () => {
  describe("with userinfo in a single URL", () => {
    test("should drop it", () => {
      assert.deepEqual(parseConfiguredGitLabApiUrls("https://alice:pw@gitlab.example.com"), {
        urls: ["https://gitlab.example.com/api/v4"],
        hadUserinfo: true,
      });
    });
  });

  describe("with an encoded comma in the password", () => {
    test("should keep one URL and drop the userinfo", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls("https://alice:p%2Cw@gitlab.example.com/api/v4"),
        { urls: ["https://gitlab.example.com/api/v4"], hadUserinfo: true }
      );
    });
  });

  describe("with a literal comma in the password", () => {
    test("should keep one URL and drop the userinfo", () => {
      assert.deepEqual(parseConfiguredGitLabApiUrls("https://alice:p,w@gitlab.example.com"), {
        urls: ["https://gitlab.example.com/api/v4"],
        hadUserinfo: true,
      });
    });
  });

  // A literal "123,https:" here would start a second URL (#876).
  describe("with an encoded comma before an http-looking tail in a list", () => {
    test("should keep each URL whole and drop the userinfo", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls(
          "https://alice:123%2Chttps:word@a.example/api/v4,https://b.example/api/v4"
        ),
        { urls: ["https://a.example/api/v4", "https://b.example/api/v4"], hadUserinfo: true }
      );
    });
  });

  describe("with userinfo in the second URL of a list", () => {
    test("should split the list and drop it", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls("https://a.example/api/v4,https://bob:pw@b.example"),
        { urls: ["https://a.example/api/v4", "https://b.example/api/v4"], hadUserinfo: true }
      );
    });
  });

  describe("with no userinfo", () => {
    test("should report none", () => {
      assert.deepEqual(parseConfiguredGitLabApiUrls("https://a.example,https://b.example"), {
        urls: ["https://a.example/api/v4", "https://b.example/api/v4"],
        hadUserinfo: false,
      });
    });
  });

  describe("with an upper-case scheme, an IPv6 host, and trailing slashes", () => {
    test("should keep both URLs and drop the trailing slashes", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls(
          "HTTPS://GITLAB.EXAMPLE.COM/api/v4/,http://[::1]:8080/api/v4/"
        ),
        {
          urls: ["HTTPS://GITLAB.EXAMPLE.COM/api/v4", "http://[::1]:8080/api/v4"],
          hadUserinfo: false,
        }
      );
    });
  });
});

// "alice", "Pw7x", and "Qz9" are parts of a username or password; none may
// appear in an error. ("p" alone would match "http".)
const CREDENTIAL_PART = /alice|Pw7x|Qz9/;
const COMMA_HINT =
  "GITLAB_API_URL is split at commas: write a comma inside a username or password as %2C";

describe("When configuredApiUrlErrors runs", () => {
  // A comma in the password splits the list where the text after it reaches
  // "/" before "@", so each value below gives an entry that is part of a credential.
  const credentialFragments: Record<string, string> = {
    "a password prefix before a comma": "http://alice:Pw7x,http://w@host/api/v4",
    "a username-only fragment": "http://alice,:Pw7x/x@host/api/v4",
    "a username and password without a scheme": "alice:Pw7x,https://gitlab.example/api/v4",
    "a whole URL without a scheme": "alice:Pw7x,w@host",
    "several commas in the password": "http://alice:Pw7x,Qz9,,http://w@host/api/v4",
    "whitespace around the entries": " http://alice:Pw7x , http://w@host/api/v4 ",
    "whitespace inside the password": "http://alice:Pw7x Qz9,http://w@host/api/v4",
  };

  for (const [name, value] of Object.entries(credentialFragments)) {
    describe(`with ${name}`, () => {
      test("should report an error", () => {
        assert.notEqual(configuredApiUrlErrors("GITLAB_API_URL", value).length, 0);
      });

      test("should not print any part of the credential", () => {
        const text = configuredApiUrlErrors("GITLAB_API_URL", value).join("\n");

        assert.equal(CREDENTIAL_PART.test(text), false);
      });
    });
  }

  describe("with a password prefix before a comma", () => {
    test("should name the entry by its position and add the %2C hint", () => {
      assert.deepEqual(
        configuredApiUrlErrors("GITLAB_API_URL", "http://alice:Pw7x,http://w@host/api/v4"),
        [
          "GITLAB_API_URL entry 1 of 2 is not a valid URL (value not shown: it may contain a password)",
          COMMA_HINT,
        ]
      );
    });
  });

  describe("with an empty entry", () => {
    test("should report it as empty without the %2C hint", () => {
      assert.deepEqual(
        configuredApiUrlErrors("GITLAB_API_URL", "https://a.example,,https://b.example"),
        ["GITLAB_API_URL entry 2 of 3 is empty"]
      );
    });
  });

  describe("with a trailing comma", () => {
    test("should report the last entry as empty without the %2C hint", () => {
      assert.deepEqual(configuredApiUrlErrors("GITLAB_API_URL", "https://a.example/api/v4,"), [
        "GITLAB_API_URL entry 2 of 2 is empty",
      ]);
    });
  });

  describe("with an empty entry and a password prefix before a comma", () => {
    test("should add the %2C hint", () => {
      assert.deepEqual(
        configuredApiUrlErrors("GITLAB_API_URL", "http://alice:Pw7x,,http://w@host/api/v4"),
        [
          "GITLAB_API_URL entry 1 of 3 is not a valid URL (value not shown: it may contain a password)",
          "GITLAB_API_URL entry 2 of 3 is empty",
          COMMA_HINT,
        ]
      );
    });
  });

  describe("with a scheme typo", () => {
    test("should say the entry needs http or https", () => {
      assert.deepEqual(configuredApiUrlErrors("GITLAB_API_URL", "htp:/gitlab.example"), [
        "GITLAB_API_URL entry 1 of 1 is not an http or https URL (value not shown: it may contain a password)",
      ]);
    });
  });

  describe("with an invalid port in one URL", () => {
    test("should not add the comma hint", () => {
      assert.deepEqual(configuredApiUrlErrors("--api-url", "https://gitlab.example:bad/api/v4"), [
        "--api-url entry 1 of 1 is not a valid URL (value not shown: it may contain a password)",
      ]);
    });
  });

  const validConfigs: Record<string, string> = {
    "one URL": "https://gitlab.example/api/v4",
    "two URLs": "https://a.example/api/v4,https://b.example/api/v4",
    "two URLs with a space": "https://a.example/api/v4, https://b.example",
    "a loopback URL on a port": "http://localhost:8080/api/v4",
    "an upper-case scheme and host": "HTTPS://GITLAB.EXAMPLE.COM/api/v4",
    "an IPv6 loopback URL on a port": "http://[::1]:8080/api/v4",
    "a trailing slash": "https://gitlab.example/api/v4/",
    "two URLs with trailing slashes": "https://a.example/api/v4/,https://b.example/",
    "a comma inside the password": "https://user:pass,word@gitlab.example/api/v4",
    "an encoded comma inside the password": "https://user:pass%2Cword@gitlab.example/api/v4",
    "a later slashless URL with userinfo":
      "https://gitlab.example/api/v4,https:slashless-user:pw@other.example",
  };

  for (const [name, value] of Object.entries(validConfigs)) {
    describe(`with ${name}`, () => {
      test("should report no error", () => {
        assert.deepEqual(configuredApiUrlErrors("GITLAB_API_URL", value), []);
      });
    });
  }

  describe("with a long list of password fragments", () => {
    test("should finish quickly", () => {
      const value = "http://a:p,".repeat(4_546);
      const start = performance.now();
      const errors = configuredApiUrlErrors("GITLAB_API_URL", value);

      assert.ok(performance.now() - start < 500);
      assert.equal(errors.length, 4_548);
    });
  });
});

describe("When apiUrlError runs", () => {
  describe("with a URL split inside the password by a comma", () => {
    test("should not print any part of the credential", () => {
      const error = apiUrlError("--api-url", "http://alice:Pw7x,http://w@host/api/v4");

      assert.equal(
        error,
        "--api-url is not a valid URL (value not shown: it may contain a password); write a comma inside a username or password as %2C"
      );
    });
  });

  describe("with a non-http scheme", () => {
    test("should say the URL needs http or https", () => {
      assert.equal(
        apiUrlError("GITLAB_API_URL", "alice:Pw7x@host"),
        "GITLAB_API_URL is not an http or https URL (value not shown: it may contain a password)"
      );
    });
  });

  describe("with an https URL", () => {
    test("should return null", () => {
      assert.equal(apiUrlError("GITLAB_API_URL", "https://gitlab.example/api/v4"), null);
    });
  });
});

describe("When apiUrlUserinfoWarning runs", () => {
  test("should name the --api-url flag", () => {
    assert.match(apiUrlUserinfoWarning("--api-url"), /^--api-url contains a username/);
  });

  // Remote-authorization and MCP OAuth deployments refuse a server token.
  test("should not ask for a personal access token", () => {
    assert.equal(
      apiUrlUserinfoWarning("GITLAB_API_URL").includes("GITLAB_PERSONAL_ACCESS_TOKEN"),
      false
    );
  });
});

describe("When apiUrlHostnameForLog runs", () => {
  test("should drop the port, path, and query", () => {
    assert.equal(
      apiUrlHostnameForLog("https://gitlab.example.com:8443/api/v4?private_token=sekrit"),
      "gitlab.example.com"
    );
  });

  test("should drop the userinfo", () => {
    assert.equal(
      apiUrlHostnameForLog("https://alice:pw@gitlab.example.com/api/v4"),
      "gitlab.example.com"
    );
  });

  // The first half of "http://alice:12,http://w@host": the password start reads as a port.
  test("should drop a port that holds the start of a password", () => {
    assert.equal(apiUrlHostnameForLog("http://alice:12/api/v4"), "alice");
  });

  test("should keep the brackets of an IPv6 host", () => {
    assert.equal(apiUrlHostnameForLog("https://[2001:db8::1]:8443/api/v4"), "[2001:db8::1]");
  });

  test("should not print a value that does not parse", () => {
    assert.equal(apiUrlHostnameForLog("https://alice:pa ss@/api/v4"), "<invalid>");
  });

  test("should not print an empty host name", () => {
    assert.equal(apiUrlHostnameForLog("localhost:8080/api/v4"), "<invalid>");
  });

  // The second half of "http://alice:12,http://sec/ret@host": "sec" is part of the password.
  test("should not print a host that is followed by an @ in the path", () => {
    assert.equal(apiUrlHostnameForLog("http://sec/ret@host/api/v4"), "<invalid>");
  });

  test("should not print a host that is followed by an @ in the query or fragment", () => {
    assert.equal(apiUrlHostnameForLog("http://sec?ret@host/api/v4"), "<invalid>");
    assert.equal(apiUrlHostnameForLog("http://sec#ret@host/api/v4"), "<invalid>");
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

  describe("with a literal percent sign", () => {
    test("should encode a percent that starts no escape instead of rejecting it", () => {
      // decodeURIComponent throws for these too, but a percent sign is valid in a
      // file or branch name. Only a broken escape next to a valid one is a payload
      // the guard cannot inspect.
      assert.equal(encodeGitLabPathSegment("report-100%.pdf"), "report-100%25.pdf");
      assert.equal(encodeGitLabPathSegment("100%"), "100%25");
      assert.equal(encodeGitLabPathSegment("bad%zz/path"), "bad%25zz%2Fpath");
      // The encoded form of such a name decodes back to the literal sign.
      assert.equal(encodeGitLabPathSegment("save%20100%25.txt"), "save%20100%25.txt");
    });
  });

  describe("with a value that cannot be decoded", () => {
    test("should reject a malformed escape sequence next to a valid one", () => {
      // These must not be treated as safe just because decodeURIComponent threw:
      // the valid escape may still hide a separator or a dot segment.
      for (const payload of ["%2E%2E%2F%ZZ", "%2E%2E%2F%..", "%2E%GG"]) {
        assert.throws(
          () => encodeGitLabPathSegment(payload),
          /Cannot use value as a GitLab URL path segment/,
          payload
        );
      }
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
