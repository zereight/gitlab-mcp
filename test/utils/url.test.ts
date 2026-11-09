import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { splitCommaSeparatedUrls } from "../../utils/redact-url.js";
import {
  ambiguousApiUrlCommaError,
  ambiguousApiUrlCommas,
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
        hostnamesForLog: ["gitlab.example.com"],
      });
    });
  });

  describe("with an encoded comma in the password", () => {
    test("should keep one URL and drop the userinfo", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls("https://alice:p%2Cw@gitlab.example.com/api/v4"),
        {
          urls: ["https://gitlab.example.com/api/v4"],
          hadUserinfo: true,
          hostnamesForLog: ["gitlab.example.com"],
        }
      );
    });
  });

  // Startup rejects this value (#876); see "When configuredApiUrlErrors runs".
  // The list is parsed at module load, before that check, so parsing must stay safe.
  describe("with a literal comma in the password", () => {
    test("should keep one URL and drop the userinfo", () => {
      assert.deepEqual(parseConfiguredGitLabApiUrls("https://alice:p,w@gitlab.example.com"), {
        urls: ["https://gitlab.example.com/api/v4"],
        hadUserinfo: true,
        hostnamesForLog: ["gitlab.example.com"],
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
        {
          urls: ["https://a.example/api/v4", "https://b.example/api/v4"],
          hadUserinfo: true,
          hostnamesForLog: ["a.example", "b.example"],
        }
      );
    });
  });

  // The first URL could be the start of a password that a comma cut off.
  describe("with userinfo in the second URL of a list", () => {
    test("should split the list, drop it, and not log the first host", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls("https://a.example/api/v4,https://bob:pw@b.example"),
        {
          urls: ["https://a.example/api/v4", "https://b.example/api/v4"],
          hadUserinfo: true,
          hostnamesForLog: ["<invalid>", "b.example"],
        }
      );
    });
  });

  describe("with no userinfo", () => {
    test("should report none", () => {
      assert.deepEqual(parseConfiguredGitLabApiUrls("https://a.example,https://b.example"), {
        urls: ["https://a.example/api/v4", "https://b.example/api/v4"],
        hadUserinfo: false,
        hostnamesForLog: ["a.example", "b.example"],
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
          hostnamesForLog: ["gitlab.example.com", "[::1]"],
        }
      );
    });
  });

  // The password "12,http://password:34,http://tail" has two literal commas.
  // Startup rejects this value (#876); the log masking stays as a second guard.
  describe("with a password split into three URLs", () => {
    const value = "http://alice:12,http://password:34,http://tail@gitlab.example/api/v4";

    test("should log only the host of the URL with the @", () => {
      assert.deepEqual(parseConfiguredGitLabApiUrls(value).hostnamesForLog, [
        "<invalid>",
        "<invalid>",
        "gitlab.example",
      ]);
    });

    test("should still send requests to each URL as split", () => {
      assert.deepEqual(parseConfiguredGitLabApiUrls(value).urls, [
        "http://alice:12/api/v4",
        "http://password:34/api/v4",
        "http://gitlab.example/api/v4",
      ]);
    });
  });

  describe("with a password split into two URLs", () => {
    test("should not log the user name read as the first host", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls("http://alice:12,http://w@host").hostnamesForLog,
        ["<invalid>", "host"]
      );
    });
  });

  describe("with an @ in the path of a later URL", () => {
    test("should log none of the hosts up to it", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls("https://a.example/api/v4,https://b.example/gl@team")
          .hostnamesForLog,
        ["<invalid>", "<invalid>"]
      );
    });
  });

  describe("with URLs after the last @", () => {
    test("should log their hosts", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls("http://alice:12,http://w@host,https://b.example:8443/api/v4")
          .hostnamesForLog,
        ["<invalid>", "host", "b.example"]
      );
    });
  });

  describe("with ports and an IPv6 host and no @", () => {
    test("should log the host of each URL", () => {
      assert.deepEqual(
        parseConfiguredGitLabApiUrls(
          "https://[2001:db8::1]:8443/api/v4,https://gitlab.example:8443/api/v4,https://other.example/api/v4"
        ).hostnamesForLog,
        ["[2001:db8::1]", "gitlab.example", "other.example"]
      );
    });
  });
});

// "alice", "Pw7x", and "Qz9" are parts of a username or password; none may
// appear in an error. ("p" alone would match "http".)
const CREDENTIAL_PART = /alice|Pw7x|Qz9/;
const COMMA_HINT =
  "GITLAB_API_URL is split at commas: write a comma inside a username or password as %2C";
const AMBIGUOUS_COMMA_ERROR =
  "GITLAB_API_URL comma 1 of 1 may be inside a username or password, so the value cannot be split into URLs safely (value not shown: it may contain a password). Write a comma inside a username or password as %2C, or leave the username and password out: requests do not use them.";

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
    test("should name the comma by its position and ask for %2C", () => {
      assert.deepEqual(
        configuredApiUrlErrors("GITLAB_API_URL", "http://alice:Pw7x,http://w@host/api/v4"),
        [AMBIGUOUS_COMMA_ERROR]
      );
    });
  });

  describe("with an entry that does not parse after a comma", () => {
    test("should name the entry by its position and add the %2C hint", () => {
      assert.deepEqual(
        configuredApiUrlErrors("GITLAB_API_URL", "https://a.example/api/v4,htp:/b.example"),
        [
          "GITLAB_API_URL entry 2 of 2 is not an http or https URL (value not shown: it may contain a password)",
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
    test("should report only the ambiguous commas", () => {
      assert.deepEqual(
        configuredApiUrlErrors("GITLAB_API_URL", "http://alice:Pw7x,,http://w@host/api/v4"),
        [
          "GITLAB_API_URL commas 1 and 2 of 2 may be inside a username or password, so the value cannot be split into URLs safely (value not shown: it may contain a password). Write a comma inside a username or password as %2C, or leave the username and password out: requests do not use them.",
        ]
      );
    });
  });

  describe("with an empty entry and userinfo after the commas", () => {
    test("should report the empty entry", () => {
      assert.deepEqual(
        configuredApiUrlErrors(
          "GITLAB_API_URL",
          "https://a.example/api/v4,,https://bob:pw@b.example"
        ),
        ["GITLAB_API_URL entry 2 of 3 is empty"]
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
    "an encoded comma inside the password": "https://user:pass%2Cword@gitlab.example/api/v4",
    "a later slashless URL with userinfo":
      "https://gitlab.example/api/v4,https:slashless-user:pw@other.example",
    "two root URLs": "https://a.example,https://b.example",
    "a port in the first of two URLs": "https://gitlab.example:443,https://other.example",
    "an encoded comma in the password of the first URL":
      "https://alice:p%2Cw@a.example,https://b.example",
    "userinfo in the second URL": "https://a.example,https://bob:pw@b.example",
    "userinfo in the second URL after a path": "https://a.example/api/v4,https://bob:pw@b.example",
    "userinfo in both URLs": "https://alice:pw@a.example,https://bob:pw@b.example",
    "an @ in the path of the second URL": "https://a.example:8443/api/v4,https://b.example/gl@team",
    "ports and an IPv6 host":
      "https://[2001:db8::1]:8443/api/v4,https://gitlab.example:8443/api/v4,https://other.example/api/v4",
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

  describe("with a long list of password fragments and an @ at the end", () => {
    test("should finish quickly and report one error", () => {
      const value = `${"http://a:p,".repeat(4_546)}w@host`;
      const start = performance.now();
      const errors = configuredApiUrlErrors("GITLAB_API_URL", value);

      assert.ok(performance.now() - start < 500);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /^GITLAB_API_URL commas 1, 2, .* and 4546 of 4546 may be inside/);
    });
  });

  describe("with many commas inside one open authority", () => {
    test("should finish quickly", () => {
      const value = `https://alice:p${",".repeat(50_000)}w@host`;
      const start = performance.now();
      const errors = configuredApiUrlErrors("GITLAB_API_URL", value);

      assert.ok(performance.now() - start < 500);
      assert.equal(errors.length, 1);
    });
  });
});

// A value with a literal comma that may be inside a username or password (#876).
// "Pw7x", "Qz9", and "alice" stand for credential text: none may be printed.
describe("When a GITLAB_API_URL value has an ambiguous comma", () => {
  const ambiguousValues: Record<string, { value: string; commas: number[] }> = {
    "the example from #876": { value: "https://alice:123,https:Pw7x@host", commas: [1] },
    "the example from #876 with a password that is not a port": {
      value: "https://alice:Pw7x,https:Qz9@host",
      commas: [1],
    },
    "a comma inside the password of one URL": {
      value: "https://alice:Pw7x,Qz9@gitlab.example/api/v4",
      commas: [1],
    },
    "a comma inside the username of one URL": {
      value: "https://alice,Pw7x@gitlab.example/api/v4",
      commas: [1],
    },
    "a password split into two URLs": { value: "http://alice:12,http://Pw7x@host", commas: [1] },
    "a password split into three URLs": {
      value: "http://alice:12,http://Pw7x:34,http://Qz9@gitlab.example/api/v4",
      commas: [1, 2],
    },
    "a password with a slash split into two URLs": {
      value: "http://alice:12,http://Pw7x/Qz9@host",
      commas: [1],
    },
    "several commas inside the password": {
      value: "http://alice:Pw7x,Qz9,,http://w@host/api/v4",
      commas: [1, 2, 3],
    },
    "a later slashless URL with userinfo after a root URL": {
      value: "https://a.example,https:alice:Pw7x@b.example",
      commas: [1],
    },
    "a port before a later URL with userinfo": {
      value: "https://gitlab.example:443,https://alice:Pw7x@b.example",
      commas: [1],
    },
    "a username and password without a scheme": { value: "alice:Pw7x,Qz9@host", commas: [1] },
    "an unambiguous comma before an ambiguous one": {
      value: "https://a.example/api/v4,https://alice:Pw7x,Qz9@b.example",
      commas: [2],
    },
  };

  for (const [name, { value, commas }] of Object.entries(ambiguousValues)) {
    describe(`with ${name}`, () => {
      test("should find the ambiguous commas by position", () => {
        assert.deepEqual(ambiguousApiUrlCommas(value), commas);
      });

      test("should report one startup error that asks for %2C", () => {
        const errors = configuredApiUrlErrors("GITLAB_API_URL", value);

        assert.equal(errors.length, 1);
        assert.match(
          errors[0],
          /^GITLAB_API_URL commas? [\d, and]+ of \d+ may be inside a username or password/
        );
        assert.match(errors[0], /Write a comma inside a username or password as %2C/);
      });

      test("should not print any part of the value", () => {
        const text = configuredApiUrlErrors("GITLAB_API_URL", value).join("\n");

        assert.equal(/alice|Pw7x|Qz9|host|example|123/.test(text), false);
      });
    });
  }

  describe("with the --api-url flag", () => {
    test("should name the flag", () => {
      assert.match(
        ambiguousApiUrlCommaError("--api-url", "https://alice:123,https:Pw7x@host") ?? "",
        /^--api-url comma 1 of 1 may be inside a username or password/
      );
    });
  });

  describe("with no ambiguous comma", () => {
    test("should return null", () => {
      assert.equal(
        ambiguousApiUrlCommaError("GITLAB_API_URL", "https://a.example,https://bob:pw@b.example"),
        null
      );
    });
  });

  // For a value that passes, the list is the same as a plain split at every comma,
  // so the heuristic in splitCommaSeparatedUrls no longer decides anything.
  describe("with random values that have no ambiguous comma", () => {
    test("should split them at every comma", () => {
      const pieces = [
        "https://",
        "https:",
        "https:/",
        "a",
        ":",
        "1",
        "@",
        "@",
        "/",
        ",",
        ",",
        " ",
        "?",
      ];
      let seed = 876;
      const next = (limit: number): number => {
        // Math.imul keeps the low 32 bits of the product exact; `seed * 1_103_515_245`
        // exceeds 2^53 and rounds before the mask is applied.
        seed = (Math.imul(seed, 1_103_515_245) + 12_345) & 0x7fffffff;
        return seed % limit;
      };
      let checked = 0;
      for (let round = 0; round < 20_000; round += 1) {
        let value = "";
        const length = 2 + next(10);
        for (let index = 0; index < length; index += 1) {
          value += pieces[next(pieces.length)];
        }
        if (ambiguousApiUrlCommas(value).length > 0 || !/,.*@/.test(value)) {
          continue;
        }
        checked += 1;
        assert.deepEqual(
          splitCommaSeparatedUrls(value),
          value.split(",").map(piece => piece.trim()),
          value
        );
      }
      assert.ok(checked > 1_000);
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
  // parseConfiguredGitLabApiUrls also hides "alice" there, because a later URL has an "@".
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
