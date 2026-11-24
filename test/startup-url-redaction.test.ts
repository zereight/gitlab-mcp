import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { apiUrlUserinfoWarning } from "../utils/url.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECRET_USER = "fakeuser";
const SECRET_PASSWORD = "fakepass";
const SECRET_QUERY = "fakesecret123";
const SLASHLESS_PASSWORD = "slashless-pass";
const DEFAULT_STARTUP_API_URL = `https://${SECRET_USER}:${SECRET_PASSWORD}@gitlab.example.com/api/v4?private_token=${SECRET_QUERY}`;
const SLASHLESS_LIST_API_URL = `https://gitlab.example/api/v4,https:slashless-user:${SLASHLESS_PASSWORD}@other.example`;
// A literal comma in the password: refused at startup since v3 (#876).
const COMMA_PASSWORD = "pass,word";
const COMMA_API_URL = `https://comma-user:${COMMA_PASSWORD}@gitlab.example.com/api/v4`;
const ENCODED_COMMA_PASSWORD = "pass%2Cword";
const ENCODED_COMMA_API_URL = `https://comma-user:${ENCODED_COMMA_PASSWORD}@gitlab.example.com/api/v4`;
const HTTP_TAIL_PASSWORD_HEAD = "supersecret";
const HTTP_TAIL_API_URL = `https://alice:${HTTP_TAIL_PASSWORD_HEAD},https:word@gitlab.example.com/api/v4`;
// The example from #876: one URL whose password is "123,https:<secret>", or
// "https://alice:123" (host alice, port 123) and "https:<secret>@host".
const ISSUE_876_SECRET = "pw-secret-876";
const ISSUE_876_API_URL = `https://alice:123,https:${ISSUE_876_SECRET}@host`;
const ISSUE_876_CREDENTIAL_PART = /alice|123|pw-secret-876/;
const AMBIGUOUS_COMMA_ERROR =
  /GITLAB_API_URL comma 1 of 1 may be inside a username or password, so the value cannot be split into URLs safely \(value not shown: it may contain a password\)\. Write a comma inside a username or password as %2C/;
// Accepted: the "/" after "https:" comes before the "@", and no ":" precedes the comma.
const LATER_USERINFO_API_URL = "http://first.example,https://bob:Qz9w@b.example";
const LATER_USERINFO_CREDENTIAL_PART = /bob|Qz9w/;
const DIGIT_PASSWORD_TAIL = "digit-pass-9f2a";
// WHATWG reads "alice:12" as a host and port, so the URL is not stripped.
const DIGIT_PASSWORD_API_URL = `https://alice:12/${DIGIT_PASSWORD_TAIL}@gitlab.example.com/api/v4`;
// The comma may be inside the password "Pw7x,http://w", so the value is refused.
const SPLIT_PASSWORD_API_URL = "http://alice:Pw7x,http://w@host/api/v4";
// Parses as a URL whose scheme is "alice:".
const SCHEMELESS_CREDENTIAL_API_URL = "alice:Pw7x@host";
const CREDENTIAL_PART = /alice|Pw7x/;
// v2 split this value and read "12" as a port; since v3 it is refused.
const SPLIT_PORT_API_URL = "http://alice:12,http://w@host";
const SPLIT_PORT_HOST_AND_PORT = "alice:12";
// v2 split this into "http://alice:12" and "http://sec/ret@host", whose host "sec" is part of the password.
const SPLIT_PORT_SLASH_API_URL = "http://alice:12,http://sec/ret@host";
const SPLIT_PORT_CREDENTIAL_PART = /alice|12/;
// Two commas in the password "7351,http://pw8y:9573,http://tl3x" give three URLs
// that all parse; the host of the middle one, "pw8y", is part of the password.
const THREE_PIECE_API_URL = "http://alice:7351,http://pw8y:9573,http://tl3x@gitlab.example/api/v4";
const THREE_PIECE_CREDENTIAL_PART = /alice|pw8y|7351|9573|tl3x/;
const OAUTH_ENV = { GITLAB_USE_OAUTH: "true", GITLAB_OAUTH_CLIENT_ID: "fake-client-id" };
const OAUTH_CLEARTEXT_ERROR = "Refusing to send OAuth tokens over cleartext HTTP";
const OAUTH_USERINFO_API_URL = "http://carol:Qm4v8@gitlab.example/api/v4";
const OAUTH_USERINFO_CREDENTIAL_PART = /carol|Qm4v8/;
const PORTS_AND_IPV6_API_URL =
  "https://[2001:db8::1]:8443/api/v4,https://gitlab.example:8443/api/v4,https://other.example/api/v4";
const PLAIN_API_URL = "https://gitlab.example.com/api/v4";
const USERINFO_WARNING = "GITLAB_API_URL contains a username or password before the host";
const USERINFO_WARNING_TEXT = apiUrlUserinfoWarning("GITLAB_API_URL");
const CONFIGURED_URLS_PREFIX = "Configured GitLab API URLs: ";
const DEFAULT_URL_PREFIX = "Default GitLab API URL: ";

interface StartupLogs {
  readonly stdout: string;
  readonly stderr: string;
}

interface CaptureOptions {
  readonly extraEnv?: Readonly<Record<string, string>>;
  /** Wait for the server to exit by itself with this text in stderr, instead of the URL logs. */
  readonly exitMarker?: string;
}

function startupEnv(
  apiUrl: string,
  extraEnv: Readonly<Record<string, string>> = {}
): Record<string, string> {
  const env: Record<string, string> = {
    GITLAB_PERSONAL_ACCESS_TOKEN: "glpat-fakefakefake",
    GITLAB_API_URL: apiUrl,
    GITLAB_DISABLE_VERSION_CHECK: "true",
    LOG_LEVEL: "info",
    ...extraEnv,
  };
  if (process.env.PATH !== undefined) {
    env.PATH = process.env.PATH;
  }
  if (process.env.HOME !== undefined) {
    env.HOME = process.env.HOME;
  }
  return env;
}

async function captureStartupLogsAsync(
  apiUrl: string = DEFAULT_STARTUP_API_URL,
  options: CaptureOptions = {}
): Promise<StartupLogs> {
  const marker = options.exitMarker ?? "Default GitLab API URL:";
  const child = spawn(process.execPath, [path.join(REPO_ROOT, "build/index.js")], {
    cwd: REPO_ROOT,
    env: startupEnv(apiUrl, options.extraEnv),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on("data", chunk => {
    stdoutChunks.push(Buffer.from(chunk));
  });
  child.stderr?.on("data", chunk => {
    stderrChunks.push(Buffer.from(chunk));
  });

  const ready = new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const timer = setTimeout(() => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      finish(new Error(`timed out waiting for "${marker}"\n${stderr}`));
    }, 20000);
    child.stderr?.on("data", () => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (options.exitMarker === undefined && stderr.includes(marker)) {
        finish();
      }
    });
    // "close" rather than "exit": output written just before exit is read by then.
    child.once("close", code => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (stderr.includes(marker)) {
        finish();
        return;
      }
      finish(new Error(`server exited (${String(code)}) before "${marker}"\n${stderr}`));
    });
  });

  try {
    await ready;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        once(child, "close"),
        new Promise<void>(resolve => {
          setTimeout(resolve, 2000);
        }),
      ]);
    }
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await once(child, "close");
    }
  }

  return {
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

interface FailedStartup {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

// For a GITLAB_API_URL that fails configuration validation: the server exits
// before it logs the configured URLs.
async function captureFailedStartupAsync(
  apiUrl: string,
  options: { readonly args?: readonly string[]; readonly env?: Record<string, string> } = {}
): Promise<FailedStartup> {
  const child = spawn(
    process.execPath,
    [path.join(REPO_ROOT, "build/index.js"), ...(options.args ?? [])],
    {
      cwd: REPO_ROOT,
      env: { ...startupEnv(apiUrl), ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on("data", chunk => {
    stdoutChunks.push(Buffer.from(chunk));
  });
  child.stderr?.on("data", chunk => {
    stderrChunks.push(Buffer.from(chunk));
  });
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, 20000);
  try {
    const [code] = await once(child, "close");
    return {
      code: code as number | null,
      stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      stderr: Buffer.concat(stderrChunks).toString("utf8"),
    };
  } finally {
    clearTimeout(timer);
  }
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

// The message from `prefix` to the end of its line, without the color reset
// that pino-pretty adds, or "" when no line has it.
function logMessage(stderr: string, prefix: string): string {
  for (const line of stderr.split("\n")) {
    const start = line.indexOf(prefix);
    if (start !== -1) {
      const colorCode = line.indexOf("\u001b[", start);
      return line.slice(start, colorCode === -1 ? line.length : colorCode).trimEnd();
    }
  }
  return "";
}

// eslint-disable-next-line no-control-regex
const COLOR_CODE_PATTERN = /\u001b\[\d+m/g;
const LOG_PREFIX_PATTERN = /^[A-Z]+ \[[\d:.]+\] \(\d+\): /;
const STACK_FRAME_PATTERN = /^\s*at /;

// The text of each stderr line without color codes, level, time, and pid, and
// without stack frames: those hold digits whatever the configured URL is.
function logTexts(stderr: string): string[] {
  return stderr
    .split("\n")
    .map(line => line.replace(COLOR_CODE_PATTERN, "").replace(LOG_PREFIX_PATTERN, ""))
    .filter(text => !STACK_FRAME_PATTERN.test(text));
}

// The texts that match `part`, except the userinfo warning, whose wording has "password".
function textsWithCredentialPart(stderr: string, part: RegExp): string[] {
  return logTexts(stderr).filter(text => text !== USERINFO_WARNING_TEXT && part.test(text));
}

describe("When the stdio server starts", () => {
  describe("with credentials in GITLAB_API_URL", () => {
    it("should log only the host name of the configured URL", async () => {
      const logs = await captureStartupLogsAsync();

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: gitlab.example.com"
      );
    });

    it("should log only the host name of the default URL", async () => {
      const logs = await captureStartupLogsAsync();

      assert.equal(
        logMessage(logs.stderr, DEFAULT_URL_PREFIX),
        "Default GitLab API URL: gitlab.example.com"
      );
    });

    it("should warn once that the userinfo is ignored", async () => {
      const logs = await captureStartupLogsAsync();

      assert.equal(countOccurrences(logs.stderr, USERINFO_WARNING), 1);
    });

    it("should omit the embedded secrets from stderr", async () => {
      const logs = await captureStartupLogsAsync();
      const leaked =
        logs.stderr.includes(SECRET_PASSWORD) ||
        logs.stderr.includes(SECRET_QUERY) ||
        logs.stderr.includes(SECRET_USER);

      assert.equal(leaked, false);
    });

    it("should leave stdout empty", async () => {
      const logs = await captureStartupLogsAsync();

      assert.equal(logs.stdout, "");
    });
  });

  describe("with a later slashless URL in GITLAB_API_URL", () => {
    // A URL before one with an "@" could be the start of a password cut off at a comma.
    it("should log only the host name of the URL with the userinfo", async () => {
      const logs = await captureStartupLogsAsync(SLASHLESS_LIST_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: <invalid>, other.example"
      );
    });

    it("should warn once that the userinfo is ignored", async () => {
      const logs = await captureStartupLogsAsync(SLASHLESS_LIST_API_URL);

      assert.equal(countOccurrences(logs.stderr, USERINFO_WARNING), 1);
    });

    it("should omit the slashless password from stderr", async () => {
      const logs = await captureStartupLogsAsync(SLASHLESS_LIST_API_URL);

      assert.equal(logs.stderr.includes(SLASHLESS_PASSWORD), false);
    });
  });

  describe("with a comma inside the password", () => {
    it("should fail validation and ask for %2C", async () => {
      const startup = await captureFailedStartupAsync(COMMA_API_URL);

      assert.equal(startup.code, 1);
      assert.match(startup.stderr, AMBIGUOUS_COMMA_ERROR);
    });

    it("should omit the password from the output", async () => {
      const startup = await captureFailedStartupAsync(COMMA_API_URL);

      assert.equal(startup.stdout, "");
      assert.deepEqual(textsWithCredentialPart(startup.stderr, /comma-user|pass,|,word/), []);
    });
  });

  describe("with a percent-encoded comma inside the password", () => {
    it("should log the host name of one URL", async () => {
      const logs = await captureStartupLogsAsync(ENCODED_COMMA_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: gitlab.example.com"
      );
    });

    it("should omit the password from stderr", async () => {
      const logs = await captureStartupLogsAsync(ENCODED_COMMA_API_URL);

      assert.equal(logs.stderr.includes(ENCODED_COMMA_PASSWORD), false);
    });
  });

  describe("with a comma and an http-looking tail inside the password", () => {
    it("should fail validation and ask for %2C", async () => {
      const startup = await captureFailedStartupAsync(HTTP_TAIL_API_URL);

      assert.equal(startup.code, 1);
      assert.match(startup.stderr, AMBIGUOUS_COMMA_ERROR);
    });

    it("should omit the password from the output", async () => {
      const startup = await captureFailedStartupAsync(HTTP_TAIL_API_URL);

      assert.equal(`${startup.stdout}\n${startup.stderr}`.includes(HTTP_TAIL_PASSWORD_HEAD), false);
    });
  });

  describe("with the ambiguous value from #876", () => {
    it("should fail validation and ask for %2C", async () => {
      const startup = await captureFailedStartupAsync(ISSUE_876_API_URL);

      assert.equal(startup.code, 1);
      assert.match(startup.stderr, AMBIGUOUS_COMMA_ERROR);
    });

    it("should not log the configured URLs", async () => {
      const startup = await captureFailedStartupAsync(ISSUE_876_API_URL);

      assert.equal(startup.stderr.includes(CONFIGURED_URLS_PREFIX), false);
    });

    it("should omit every part of the credential from the output", async () => {
      const startup = await captureFailedStartupAsync(ISSUE_876_API_URL);

      assert.equal(startup.stdout, "");
      assert.equal(startup.stderr.includes(ISSUE_876_SECRET), false);
      assert.deepEqual(textsWithCredentialPart(startup.stderr, ISSUE_876_CREDENTIAL_PART), []);
    });
  });

  // The first host could still be a user name whose password has an unencoded
  // "/", so it is not logged; the value is not refused.
  describe("with userinfo in a later URL after a root URL", () => {
    it("should log only the host name of the URL with the userinfo", async () => {
      const logs = await captureStartupLogsAsync(LATER_USERINFO_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: <invalid>, b.example"
      );
    });

    it("should omit the userinfo from stderr", async () => {
      const logs = await captureStartupLogsAsync(LATER_USERINFO_API_URL);

      assert.deepEqual(textsWithCredentialPart(logs.stderr, LATER_USERINFO_CREDENTIAL_PART), []);
    });
  });

  describe("with a password of digits and then a slash", () => {
    // WHATWG reads the user name "alice" as the host, and the "@" in the path shows it.
    it("should not log the host name WHATWG reads", async () => {
      const logs = await captureStartupLogsAsync(DIGIT_PASSWORD_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: <invalid>"
      );
    });

    it("should omit the password from stderr", async () => {
      const logs = await captureStartupLogsAsync(DIGIT_PASSWORD_API_URL);

      assert.equal(logs.stderr.includes(DIGIT_PASSWORD_TAIL), false);
    });
  });

  describe("with a comma that splits the password before an http URL", () => {
    it("should fail validation and name the comma by its position", async () => {
      const startup = await captureFailedStartupAsync(SPLIT_PASSWORD_API_URL);

      assert.equal(startup.code, 1);
      assert.match(startup.stderr, AMBIGUOUS_COMMA_ERROR);
    });

    it("should tell the user to write the comma as %2C", async () => {
      const startup = await captureFailedStartupAsync(SPLIT_PASSWORD_API_URL);

      assert.match(startup.stderr, /Write a comma inside a username or password as %2C/);
    });

    it("should omit every part of the credential from stderr", async () => {
      const startup = await captureFailedStartupAsync(SPLIT_PASSWORD_API_URL);

      assert.equal(CREDENTIAL_PART.test(startup.stderr), false);
    });
  });

  describe("with a username and password but no scheme", () => {
    it("should fail validation instead of logging the URL", async () => {
      const startup = await captureFailedStartupAsync(SCHEMELESS_CREDENTIAL_API_URL);

      assert.equal(startup.code, 1);
      assert.match(startup.stderr, /is not an http or https URL/);
    });

    it("should omit every part of the credential from stderr", async () => {
      const startup = await captureFailedStartupAsync(SCHEMELESS_CREDENTIAL_API_URL);

      assert.equal(CREDENTIAL_PART.test(startup.stderr), false);
    });
  });

  describe("with a credential in an invalid GITLAB_ALLOWED_HOSTS entry", () => {
    it("should fail validation without printing the entry", async () => {
      const startup = await captureFailedStartupAsync(PLAIN_API_URL, {
        env: { GITLAB_ALLOWED_HOSTS: "alice:Pw7x@host:bad,https://alice:Pw7x,w@host" },
      });

      assert.equal(startup.code, 1);
      assert.match(startup.stderr, /GITLAB_ALLOWED_HOSTS entry 2 of 3 is not a valid host or URL/);
      assert.equal(CREDENTIAL_PART.test(startup.stderr), false);
    });
  });

  // Each of these used to start, with a host or port from the password in the
  // URL list. Since v3 the comma may be inside a password, so they are refused.
  const splitPasswordValues: Record<string, { value: string; part: RegExp }> = {
    "a password comma that splits the value into two URLs": {
      value: SPLIT_PORT_API_URL,
      part: SPLIT_PORT_CREDENTIAL_PART,
    },
    "a password comma and slash that split the value into two URLs": {
      value: SPLIT_PORT_SLASH_API_URL,
      part: /alice|12|sec|ret/,
    },
    "two password commas that split the value into three URLs": {
      value: THREE_PIECE_API_URL,
      part: THREE_PIECE_CREDENTIAL_PART,
    },
    "a username and a password comma but no scheme": {
      value: "alice:Pw7x,w@host",
      part: CREDENTIAL_PART,
    },
  };

  for (const [name, { value, part }] of Object.entries(splitPasswordValues)) {
    describe(`with ${name}`, () => {
      it("should fail validation before it logs the URLs", async () => {
        const startup = await captureFailedStartupAsync(value);

        assert.equal(startup.code, 1);
        assert.match(startup.stderr, /may be inside a username or password/);
        assert.equal(startup.stderr.includes(CONFIGURED_URLS_PREFIX), false);
      });

      it("should omit every part of the credential from the log lines", async () => {
        const startup = await captureFailedStartupAsync(value);

        assert.equal(startup.stdout, "");
        assert.deepEqual(textsWithCredentialPart(startup.stderr, part), []);
      });
    });
  }

  describe("with OAuth and a password comma that splits the value into two URLs", () => {
    it("should fail validation before the cleartext check", async () => {
      const startup = await captureFailedStartupAsync(SPLIT_PORT_API_URL, { env: OAUTH_ENV });

      assert.equal(startup.code, 1);
      assert.match(startup.stderr, AMBIGUOUS_COMMA_ERROR);
      assert.equal(startup.stderr.includes(OAUTH_CLEARTEXT_ERROR), false);
    });

    it("should omit the user name and the start of the password from the output", async () => {
      const startup = await captureFailedStartupAsync(SPLIT_PORT_API_URL, { env: OAUTH_ENV });

      assert.equal(
        `${startup.stdout}\n${startup.stderr}`.includes(SPLIT_PORT_HOST_AND_PORT),
        false
      );
      assert.deepEqual(textsWithCredentialPart(startup.stderr, SPLIT_PORT_CREDENTIAL_PART), []);
    });
  });

  describe("with OAuth and a cleartext URL before a URL with userinfo", () => {
    const captureOAuthLogsAsync = () =>
      captureStartupLogsAsync(LATER_USERINFO_API_URL, {
        extraEnv: OAUTH_ENV,
        exitMarker: OAUTH_CLEARTEXT_ERROR,
      });

    it("should refuse cleartext HTTP without naming the host", async () => {
      const logs = await captureOAuthLogsAsync();

      assert.equal(
        logs.stderr.includes(`${OAUTH_CLEARTEXT_ERROR} to http://<invalid>. Use an https://`),
        true
      );
    });

    it("should omit the userinfo from the log lines", async () => {
      const logs = await captureOAuthLogsAsync();

      assert.equal(logs.stdout, "");
      assert.deepEqual(textsWithCredentialPart(logs.stderr, LATER_USERINFO_CREDENTIAL_PART), []);
    });
  });

  describe("with OAuth and credentials in a cleartext GITLAB_API_URL", () => {
    const captureOAuthLogsAsync = () =>
      captureStartupLogsAsync(OAUTH_USERINFO_API_URL, {
        extraEnv: OAUTH_ENV,
        exitMarker: OAUTH_CLEARTEXT_ERROR,
      });

    // The only URL has the @, so its host is not part of a password and is shown.
    it("should refuse cleartext HTTP and name the host", async () => {
      const logs = await captureOAuthLogsAsync();

      assert.equal(
        logs.stderr.includes(`${OAUTH_CLEARTEXT_ERROR} to http://gitlab.example. Use an https://`),
        true
      );
    });

    it("should omit the user name and password from the log lines", async () => {
      const logs = await captureOAuthLogsAsync();

      assert.equal(logs.stdout, "");
      assert.deepEqual(textsWithCredentialPart(logs.stderr, OAUTH_USERINFO_CREDENTIAL_PART), []);
    });
  });

  describe("with ports and an IPv6 host in GITLAB_API_URL", () => {
    it("should log only the host name of each URL", async () => {
      const logs = await captureStartupLogsAsync(PORTS_AND_IPV6_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: [2001:db8::1], gitlab.example, other.example"
      );
    });

    it("should log the IPv6 default host in brackets", async () => {
      const logs = await captureStartupLogsAsync(PORTS_AND_IPV6_API_URL);

      assert.equal(
        logMessage(logs.stderr, DEFAULT_URL_PREFIX),
        "Default GitLab API URL: [2001:db8::1]"
      );
    });
  });

  describe("without credentials in GITLAB_API_URL", () => {
    it("should not warn about userinfo", async () => {
      const logs = await captureStartupLogsAsync(PLAIN_API_URL);

      assert.equal(logs.stderr.includes(USERINFO_WARNING), false);
    });
  });
});

// The CLI does not run validateConfiguration; the request URL was printed in
// the error log ("input": "http://alice:Pw7x/api/v4/projects/1").
describe("When the human CLI runs a tool", () => {
  describe("with a comma that splits the password before an http URL", () => {
    it("should exit before the request without printing the credential", async () => {
      const startup = await captureFailedStartupAsync(SPLIT_PASSWORD_API_URL, {
        args: ["tool", "get_project", "--project-id", "1"],
      });

      assert.equal(startup.code, 2);
      assert.match(startup.stderr, AMBIGUOUS_COMMA_ERROR);
      assert.equal(CREDENTIAL_PART.test(startup.stderr), false);
    });
  });

  describe("with the ambiguous value from #876", () => {
    it("should exit before the request without printing the credential", async () => {
      const startup = await captureFailedStartupAsync(ISSUE_876_API_URL, {
        args: ["tool", "get_project", "--project-id", "1"],
      });

      assert.equal(startup.code, 2);
      assert.match(startup.stderr, AMBIGUOUS_COMMA_ERROR);
      assert.equal(ISSUE_876_CREDENTIAL_PART.test(`${startup.stdout}\n${startup.stderr}`), false);
    });
  });
});

// doctor printed the origin of the first URL: "https://alice:123/api/v4" here.
describe("When the human CLI runs doctor", () => {
  describe("with the ambiguous value from #876", () => {
    it("should fail the api_url check without printing the credential", async () => {
      const startup = await captureFailedStartupAsync(ISSUE_876_API_URL, { args: ["doctor"] });

      assert.equal(startup.code, 1);
      assert.match(startup.stdout, /fail {2}api_url: GITLAB_API_URL comma 1 of 1 may be inside/);
      assert.equal(ISSUE_876_CREDENTIAL_PART.test(`${startup.stdout}\n${startup.stderr}`), false);
    });

    it("should not probe GitLab", async () => {
      const startup = await captureFailedStartupAsync(ISSUE_876_API_URL, {
        args: ["doctor", "--probe"],
      });

      assert.equal(startup.code, 1);
      assert.match(startup.stdout, /fail {2}gitlab_user: not probed: fix api_url first/);
      assert.equal(ISSUE_876_CREDENTIAL_PART.test(`${startup.stdout}\n${startup.stderr}`), false);
    });
  });
});
