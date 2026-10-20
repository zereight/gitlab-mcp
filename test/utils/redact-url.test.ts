import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  redactGitLabUrlCredentials,
  redactUrlSecretsInError,
  redactUrlSecretsInErrorMessage,
  redactUrlSecretsInLogLine,
  redactUrlSecretsInText,
  splitCommaSeparatedUrls,
  stripUrlUserinfo,
} from "../../utils/redact-url.js";

describe("When redactUrlSecretsInText runs", () => {
  describe("with userinfo", () => {
    it("should replace the user and password", () => {
      assert.equal(
        redactUrlSecretsInText("https://user:pass@gitlab.example/api/v4"),
        "https://[REDACTED]@gitlab.example/api/v4"
      );
    });
  });

  describe("with user-only userinfo", () => {
    it("should replace the username", () => {
      assert.equal(
        redactUrlSecretsInText("https://onlyuser@gitlab.example/api/v4"),
        "https://[REDACTED]@gitlab.example/api/v4"
      );
    });
  });

  describe("with query tokens", () => {
    it("should redact each sensitive parameter and keep the rest", () => {
      assert.equal(
        redactUrlSecretsInText(
          "https://gitlab.example/api/v4?access_token=a&private_token=b&job_token=c&password=d&token=e&page=1"
        ),
        "https://gitlab.example/api/v4?access_token=[REDACTED]&private_token=[REDACTED]&job_token=[REDACTED]&password=[REDACTED]&token=[REDACTED]&page=1"
      );
    });
  });

  describe("with multiple URLs", () => {
    it("should redact credentials in every URL", () => {
      assert.equal(
        redactUrlSecretsInText(
          "https://user:pass@a.example/api/v4, https://b.example/api/v4?token=sekrit"
        ),
        "https://[REDACTED]@a.example/api/v4, https://b.example/api/v4?token=[REDACTED]"
      );
    });
  });

  describe("with a URL that has no secrets", () => {
    it("should leave the URL unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example/api/v4"),
        "https://gitlab.example/api/v4"
      );
    });
  });

  describe("with a percent-encoded query name", () => {
    it("should redact the value and keep the encoded name", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example/api/v4?access%5Ftoken=sekrit&page=1"),
        "https://gitlab.example/api/v4?access%5Ftoken=[REDACTED]&page=1"
      );
    });
  });

  describe("with a fully encoded token name", () => {
    it("should redact the value and keep the encoded name", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example/api/v4?%74oken=sekrit"),
        "https://gitlab.example/api/v4?%74oken=[REDACTED]"
      );
    });
  });

  describe("with an encoded name that is not sensitive", () => {
    it("should leave the query unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example/api/v4?not%5Ftoken=keep"),
        "https://gitlab.example/api/v4?not%5Ftoken=keep"
      );
    });
  });

  describe("with whitespace inside userinfo", () => {
    it("should redact the user and password", () => {
      assert.equal(
        redactUrlSecretsInText(
          "GITLAB_API_URL contains an invalid URL: https://user:pa ss@gitlab.example:bad/api/v4"
        ),
        "GITLAB_API_URL contains an invalid URL: https://[REDACTED]@gitlab.example:bad/api/v4"
      );
    });
  });

  describe("with a host and a later email", () => {
    it("should leave a numeric port untouched", () => {
      assert.equal(
        redactUrlSecretsInText("see https://registry:5000 a@b.com"),
        "see https://registry:5000 a@b.com"
      );
    });

    it("should leave a localhost port untouched", () => {
      assert.equal(
        redactUrlSecretsInText("see https://localhost:bad a@b.com"),
        "see https://localhost:bad a@b.com"
      );
    });

    it("should leave a dotted host untouched", () => {
      assert.equal(
        redactUrlSecretsInText("see https://gitlab.example:443 a@b.com"),
        "see https://gitlab.example:443 a@b.com"
      );
    });
  });

  describe("with prose after a URL", () => {
    it("should leave the mention unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("see https://gitlab.example/api failed, ping @oncall"),
        "see https://gitlab.example/api failed, ping @oncall"
      );
    });
  });

  describe("with a space in the username", () => {
    it("should redact the userinfo", () => {
      assert.equal(
        redactUrlSecretsInText("https://my user:s3cret@gitlab.example/api/v4"),
        "https://[REDACTED]@gitlab.example/api/v4"
      );
    });
  });

  describe("with a space inside the password", () => {
    it("should redact the userinfo", () => {
      assert.equal(
        redactUrlSecretsInText("https://admin:1234 secret@gitlab.example/api/v4"),
        "https://[REDACTED]@gitlab.example/api/v4"
      );
    });

    it("should redact the userinfo when the URL has no path", () => {
      assert.equal(
        redactUrlSecretsInText("https://admin:1234 secret@gitlab.example"),
        "https://[REDACTED]@gitlab.example"
      );
    });
  });

  describe("with a numeric prefix before the rest of the password", () => {
    it("should redact the userinfo", () => {
      assert.equal(
        redactUrlSecretsInText("https://admin:12345 678@host:bad/api"),
        "https://[REDACTED]@host:bad/api"
      );
    });
  });

  describe("with a host, a port, and an email", () => {
    it("should leave the text unchanged", () => {
      assert.equal(redactUrlSecretsInText("localhost:3000 a@b.com"), "localhost:3000 a@b.com");
    });
  });

  describe("with a special scheme and no slashes", () => {
    it("should redact the userinfo", () => {
      assert.equal(
        redactUrlSecretsInText("https:user:pass@gitlab.example"),
        "https:[REDACTED]@gitlab.example"
      );
    });
  });

  describe("with a special scheme, no slashes, and a path", () => {
    it("should redact the userinfo and keep the path", () => {
      assert.equal(redactUrlSecretsInText("http:u:p@host/path"), "http:[REDACTED]@host/path");
    });
  });

  describe("with a single slash after the scheme", () => {
    it("should redact the userinfo", () => {
      assert.equal(redactUrlSecretsInText("https:/user:pass@host"), "https:/[REDACTED]@host");
    });
  });

  describe("with a sensitive fragment", () => {
    it("should redact private_token and access_token", () => {
      assert.equal(
        redactUrlSecretsInText("https://host/path#private_token=sekrit&access_token=other"),
        "https://host/path#private_token=[REDACTED]&access_token=[REDACTED]"
      );
    });
  });

  describe("with a non-sensitive fragment", () => {
    it("should leave the fragment unchanged", () => {
      assert.equal(redactUrlSecretsInText("https://host/path#page=1"), "https://host/path#page=1");
    });
  });

  describe("with a URL in surrounding prose", () => {
    it("should redact standard userinfo", () => {
      assert.equal(
        redactUrlSecretsInText("see https://user:pass@host later"),
        "see https://[REDACTED]@host later"
      );
    });

    it("should redact a slashless scheme", () => {
      assert.equal(
        redactUrlSecretsInText("see https:user:pass@host later"),
        "see https:[REDACTED]@host later"
      );
    });

    it("should redact a single-slash scheme", () => {
      assert.equal(
        redactUrlSecretsInText("see https:/user:pass@host later"),
        "see https:/[REDACTED]@host later"
      );
    });
  });

  describe("with an undici credentials error", () => {
    it("should redact a password with an encoded comma", () => {
      assert.equal(
        redactUrlSecretsInText(
          "Request cannot be constructed from a URL that includes credentials: http://alice:p%2Cw@127.0.0.1:9/api/v4/projects/1"
        ),
        "Request cannot be constructed from a URL that includes credentials: http://[REDACTED]@127.0.0.1:9/api/v4/projects/1"
      );
    });

    it("should redact a password without a comma", () => {
      assert.equal(
        redactUrlSecretsInText(
          "Request cannot be constructed from a URL that includes credentials: https://alice:pw@host/api/v4"
        ),
        "Request cannot be constructed from a URL that includes credentials: https://[REDACTED]@host/api/v4"
      );
    });
  });

  describe("with an encoded @ in the password", () => {
    it("should redact up to the host", () => {
      assert.equal(
        redactUrlSecretsInText("https://alice:p%40ss@host/x"),
        "https://[REDACTED]@host/x"
      );
    });
  });

  describe("with several credentialed URLs in prose", () => {
    it("should redact each one", () => {
      assert.equal(
        redactUrlSecretsInText(
          "fetch https://alice:pw@host failed; see https://host/a,b and https://c:d@e/f."
        ),
        "fetch https://[REDACTED]@host failed; see https://host/a,b and https://[REDACTED]@e/f."
      );
    });
  });

  describe("with a comma list where only the second URL has userinfo", () => {
    it("should redact the second URL", () => {
      assert.equal(
        redactUrlSecretsInText("https://a.example/api/v4,https://bob:pw@b.example/api/v4"),
        "https://a.example/api/v4,https://[REDACTED]@b.example/api/v4"
      );
    });
  });

  describe("with a credentialed URL inside another URL", () => {
    it("should redact the inner userinfo", () => {
      assert.equal(
        redactUrlSecretsInText("https://host/login?next=https://u:p@h/x"),
        "https://host/login?next=https://[REDACTED]@h/x"
      );
    });
  });

  describe("with a long token of nested scheme segments", () => {
    it("should redact the innermost userinfo", () => {
      // Each "x://" starts one more URL nested in the previous one's path.
      const outer = "x://".repeat(50_000);

      assert.equal(
        redactUrlSecretsInText(`fetch failed: ${outer}https://alice:pw-5e0d@host/api`),
        `fetch failed: ${outer}https://[REDACTED]@host/api`
      );
    });
  });

  describe("with a long path of letters", () => {
    it("should return it unchanged", { timeout: 5000 }, () => {
      const url = `https://host/${"a".repeat(200_000)}`;

      assert.equal(redactUrlSecretsInText(url), url);
    });
  });

  describe("with a long token of repeated separators", () => {
    // Each input took seconds when every "," or "?" started a new scan of the rest.
    const inputs: Record<string, string> = {
      '"x:a," repeated': "x:a,".repeat(40_000),
      "commas before a final @": `x:${"a,".repeat(40_000)}a@h`,
      '"?" repeated': "?".repeat(40_000),
      "http-looking entries after a comma in the password": `x://a:${"b,http:c".repeat(20_000)}@h`,
    };

    for (const [name, text] of Object.entries(inputs)) {
      it(`should finish quickly for ${name}`, () => {
        const start = performance.now();
        redactUrlSecretsInText(text);

        assert.ok(performance.now() - start < 500);
      });
    }

    it("should finish quickly for a log line with a long tool name", () => {
      const message = `Tool "${"x:a,".repeat(40_000)}@" is not available`;
      const start = performance.now();
      redactUrlSecretsInLogLine(`${JSON.stringify({ msg: message, err: { stack: message } })}\n`);

      assert.ok(performance.now() - start < 500);
    });
  });

  describe("with a password of digits and then a slash, ? or #", () => {
    // WHATWG reads "u:12" as a host and port, so only the text scan finds the userinfo.
    it("should redact a password with a slash", () => {
      assert.equal(
        redactUrlSecretsInText("https://u:12/ab@host/api/v4"),
        "https://[REDACTED]@host/api/v4"
      );
    });

    it("should redact a password with a ?", () => {
      assert.equal(redactUrlSecretsInText("https://u:123?x@host"), "https://[REDACTED]@host");
    });

    it("should redact a password with a #", () => {
      assert.equal(redactUrlSecretsInText("https://u:123#x@host"), "https://[REDACTED]@host");
    });
  });

  describe("with an @ after the host", () => {
    it("should leave a query value unchanged", () => {
      assert.equal(redactUrlSecretsInText("https://host/a?x=1@2"), "https://host/a?x=1@2");
    });

    it("should leave an npm scope path unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.com/api/v4/projects/1/packages/npm/@scope/pkg"),
        "https://gitlab.com/api/v4/projects/1/packages/npm/@scope/pkg"
      );
    });

    it("should leave an npm scope path after a port unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("https://gitlab.example:8443/api/v4/packages/npm/@scope/pkg"),
        "https://gitlab.example:8443/api/v4/packages/npm/@scope/pkg"
      );
    });
  });

  describe("with a mailto link", () => {
    it("should leave the address unchanged", () => {
      assert.equal(redactUrlSecretsInText("mailto:alice@example.com"), "mailto:alice@example.com");
    });
  });

  describe("with a URL inside JSON text", () => {
    it("should stop at the closing quote", () => {
      assert.equal(
        redactUrlSecretsInText('{"err":"https://alice:pw@host/api","m":"x@y"}'),
        '{"err":"https://[REDACTED]@host/api","m":"x@y"}'
      );
    });
  });

  describe("with text that is already redacted", () => {
    it("should leave it unchanged", () => {
      assert.equal(
        redactUrlSecretsInText("https://[REDACTED]@host/api"),
        "https://[REDACTED]@host/api"
      );
    });
  });
});

describe("When redactGitLabUrlCredentials runs", () => {
  describe("with a percent-encoded query name", () => {
    it("should redact the value and keep the encoded name", () => {
      assert.equal(
        redactGitLabUrlCredentials("https://gitlab.example/api/v4?access%5Ftoken=sekrit"),
        "https://gitlab.example/api/v4?access%5Ftoken=[REDACTED]"
      );
    });
  });

  describe("with whitespace inside userinfo", () => {
    it("should redact the user and password", () => {
      assert.equal(
        redactGitLabUrlCredentials("https://user:pa ss@gitlab.example:bad/api/v4"),
        "https://[REDACTED]@gitlab.example:bad/api/v4"
      );
    });
  });

  describe("with a special scheme and no slashes", () => {
    it("should strip the userinfo", () => {
      assert.equal(
        redactGitLabUrlCredentials("https:user:pass@gitlab.example"),
        "https://gitlab.example/"
      );
    });
  });

  describe("with a special scheme, no slashes, and a path", () => {
    it("should strip the userinfo and keep the path", () => {
      assert.equal(redactGitLabUrlCredentials("http:u:p@host/path"), "http://host/path");
    });
  });

  describe("with a single slash after the scheme", () => {
    it("should strip the userinfo", () => {
      assert.equal(redactGitLabUrlCredentials("https:/user:pass@host"), "https://host/");
    });
  });

  describe("with a password of digits and then a slash", () => {
    it("should redact the userinfo", () => {
      assert.equal(
        redactGitLabUrlCredentials("https://u:12/ab@host/api/v4"),
        "https://[REDACTED]@host/api/v4"
      );
    });
  });

  describe("with a sensitive fragment", () => {
    it("should redact private_token", () => {
      assert.equal(
        redactGitLabUrlCredentials("https://gitlab.example/api/v4#private_token=sekrit"),
        "https://gitlab.example/api/v4#private_token=[REDACTED]"
      );
    });
  });
});

describe("When splitCommaSeparatedUrls runs", () => {
  describe("with a comma inside the password", () => {
    it("should keep the URL in one piece", () => {
      assert.deepEqual(splitCommaSeparatedUrls("https://user:pass,word@host"), [
        "https://user:pass,word@host",
      ]);
    });
  });

  describe("with a comma inside the password and a later URL", () => {
    it("should split only between URLs", () => {
      assert.deepEqual(
        splitCommaSeparatedUrls("https://user:pass,word@host,https://b.example/api/v4"),
        ["https://user:pass,word@host", "https://b.example/api/v4"]
      );
    });
  });

  describe("with several commas inside the password", () => {
    it("should split only between URLs", () => {
      assert.deepEqual(splitCommaSeparatedUrls("https://user:p,a,ss@host,https://b.example"), [
        "https://user:p,a,ss@host",
        "https://b.example",
      ]);
    });
  });

  describe("with a comma-separated list and no userinfo", () => {
    it("should split on the comma", () => {
      assert.deepEqual(
        splitCommaSeparatedUrls("https://a.example/api/v4, https://b.example/api/v4"),
        ["https://a.example/api/v4", "https://b.example/api/v4"]
      );
    });
  });

  describe("with a port and a later URL", () => {
    it("should split on the comma", () => {
      assert.deepEqual(
        splitCommaSeparatedUrls("https://gitlab.example:443,https://other.example"),
        ["https://gitlab.example:443", "https://other.example"]
      );
    });
  });

  describe("with a slashless scheme and a comma inside the password", () => {
    it("should keep the URL in one piece", () => {
      assert.deepEqual(splitCommaSeparatedUrls("https:user:pass,word@host"), [
        "https:user:pass,word@host",
      ]);
    });
  });

  describe("with a root URL and a later slashless URL with userinfo", () => {
    it("should split on the comma", () => {
      assert.deepEqual(splitCommaSeparatedUrls("https://a.example,https:user:pass@b.example"), [
        "https://a.example",
        "https:user:pass@b.example",
      ]);
    });
  });

  describe("with a comma and an http-looking tail inside the password", () => {
    it("should keep the URL in one piece", () => {
      assert.deepEqual(splitCommaSeparatedUrls("https://alice:supersecret,https:word@host"), [
        "https://alice:supersecret,https:word@host",
      ]);
    });
  });

  describe("with a single-slash scheme and a comma inside the password", () => {
    it("should split only between URLs", () => {
      assert.deepEqual(splitCommaSeparatedUrls("https:/user:pass,word@host,https://b.example"), [
        "https:/user:pass,word@host",
        "https://b.example",
      ]);
    });
  });

  describe("with a comma inside the password", () => {
    it("should redact the intact URL", () => {
      assert.deepEqual(
        splitCommaSeparatedUrls("https://user:pass,word@host").map(redactUrlSecretsInText),
        ["https://[REDACTED]@host"]
      );
    });
  });
});

describe("When stripUrlUserinfo runs", () => {
  describe("with a user and password", () => {
    it("should return the URL without them", () => {
      assert.deepEqual(stripUrlUserinfo("https://alice:pw@host/api/v4"), {
        url: "https://host/api/v4",
        hadUserinfo: true,
      });
    });
  });

  describe("with an encoded comma in the password", () => {
    it("should return the URL without it", () => {
      assert.deepEqual(stripUrlUserinfo("https://alice:p%2Cw@host/api/v4"), {
        url: "https://host/api/v4",
        hadUserinfo: true,
      });
    });
  });

  describe("with a username only", () => {
    it("should return the URL without it", () => {
      assert.deepEqual(stripUrlUserinfo("https://alice@host/api/v4"), {
        url: "https://host/api/v4",
        hadUserinfo: true,
      });
    });
  });

  describe("with a root URL", () => {
    it("should not add a trailing slash", () => {
      assert.deepEqual(stripUrlUserinfo("https://alice:pw@host"), {
        url: "https://host",
        hadUserinfo: true,
      });
    });
  });

  describe("with no userinfo", () => {
    it("should return the input unchanged", () => {
      assert.deepEqual(stripUrlUserinfo("https://host:8443/api/v4"), {
        url: "https://host:8443/api/v4",
        hadUserinfo: false,
      });
    });
  });

  describe("with a value that does not parse", () => {
    it("should return the input unchanged", () => {
      assert.deepEqual(stripUrlUserinfo("not a url"), { url: "not a url", hadUserinfo: false });
    });
  });
});

describe("When redactUrlSecretsInError runs", () => {
  describe("with a credentialed URL in the message and cause", () => {
    it("should redact the message", () => {
      const error = new TypeError("fetch failed: https://alice:pw@host/api/v4", {
        cause: new Error("connect https://alice:pw@host"),
      });

      redactUrlSecretsInError(error);

      assert.equal(error.message, "fetch failed: https://[REDACTED]@host/api/v4");
    });

    it("should redact the cause", () => {
      const cause = new Error("connect https://alice:pw@host");
      const error = new TypeError("fetch failed", { cause });

      redactUrlSecretsInError(error);

      assert.equal(cause.message, "connect https://[REDACTED]@host");
    });

    it("should redact the stack", () => {
      const error = new TypeError("fetch failed: https://alice:pw@host/api/v4");

      redactUrlSecretsInError(error);

      assert.equal(error.stack?.includes("alice:pw"), false);
    });
  });

  describe("with a string cause", () => {
    it("should redact the cause", () => {
      const error = new Error("fetch failed", { cause: "https://alice:pw@host" });

      redactUrlSecretsInError(error);

      assert.equal(error.cause, "https://[REDACTED]@host");
    });
  });

  describe("with a cause cycle", () => {
    it("should redact once and return", () => {
      const error = new Error("https://alice:pw@host");
      error.cause = error;

      redactUrlSecretsInError(error);

      assert.equal(error.message, "https://[REDACTED]@host");
    });
  });

  describe("with a thrown string", () => {
    it("should return the redacted string", () => {
      assert.equal(redactUrlSecretsInError("https://alice:pw@host"), "https://[REDACTED]@host");
    });
  });
});

describe("When redactUrlSecretsInErrorMessage runs", () => {
  describe("with an undici credentials error", () => {
    it("should return the redacted message", () => {
      const error = new TypeError(
        "Request cannot be constructed from a URL that includes credentials: https://alice:p%2Cw@host/api/graphql"
      );

      assert.equal(
        redactUrlSecretsInErrorMessage(error),
        "Request cannot be constructed from a URL that includes credentials: https://[REDACTED]@host/api/graphql"
      );
    });
  });

  describe("with a thrown string", () => {
    it("should return the redacted string", () => {
      assert.equal(redactUrlSecretsInErrorMessage("https://alice:pw@host"), "https://[REDACTED]@host");
    });
  });
});

describe("When redactUrlSecretsInLogLine runs", () => {
  describe("with a JSON line", () => {
    it("should redact a URL in a nested string", () => {
      const line = `${JSON.stringify({ msg: "x", err: { message: "https://alice:pw@host/api" } })}\n`;

      assert.equal(
        redactUrlSecretsInLogLine(line),
        `${JSON.stringify({ msg: "x", err: { message: "https://[REDACTED]@host/api" } })}\n`
      );
    });

    it("should return a line without secrets unchanged", () => {
      const line = `${JSON.stringify({ msg: "mail alice@example.com", url: "https://host/a" })}\n`;

      assert.equal(redactUrlSecretsInLogLine(line), line);
    });
  });

  describe("with a line that is not JSON", () => {
    it("should redact it as text", () => {
      assert.equal(
        redactUrlSecretsInLogLine("failed https://alice:pw@host\n"),
        "failed https://[REDACTED]@host\n"
      );
    });
  });
});
