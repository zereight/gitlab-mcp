import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECRET_USER = "fakeuser";
const SECRET_PASSWORD = "fakepass";
const SECRET_QUERY = "fakesecret123";
const SLASHLESS_PASSWORD = "slashless-pass";
const DEFAULT_STARTUP_API_URL = `https://${SECRET_USER}:${SECRET_PASSWORD}@gitlab.example.com/api/v4?private_token=${SECRET_QUERY}`;
const SLASHLESS_LIST_API_URL = `https://gitlab.example/api/v4,https:slashless-user:${SLASHLESS_PASSWORD}@other.example`;
const COMMA_PASSWORD = "pass,word";
const COMMA_API_URL = `https://comma-user:${COMMA_PASSWORD}@gitlab.example.com/api/v4`;
const ENCODED_COMMA_PASSWORD = "pass%2Cword";
const ENCODED_COMMA_API_URL = `https://comma-user:${ENCODED_COMMA_PASSWORD}@gitlab.example.com/api/v4`;
const HTTP_TAIL_PASSWORD_HEAD = "supersecret";
const HTTP_TAIL_API_URL = `https://alice:${HTTP_TAIL_PASSWORD_HEAD},https:word@gitlab.example.com/api/v4`;
const DIGIT_PASSWORD_TAIL = "digit-pass-9f2a";
// WHATWG reads "alice:12" as a host and port, so the URL is not stripped.
const DIGIT_PASSWORD_API_URL = `https://alice:12/${DIGIT_PASSWORD_TAIL}@gitlab.example.com/api/v4`;
// The text after the comma reaches "/" before "@", so the list is split inside
// the password and the first entry, "http://alice:Pw7x", does not parse.
const SPLIT_PASSWORD_API_URL = "http://alice:Pw7x,http://w@host/api/v4";
// Parses as a URL whose scheme is "alice:".
const SCHEMELESS_CREDENTIAL_API_URL = "alice:Pw7x,w@host";
const CREDENTIAL_PART = /alice|Pw7x/;
// Both pieces of "alice:12,http://w" parse, so the list splits and "12" reads as a port.
const SPLIT_PORT_API_URL = "http://alice:12,http://w@host";
const SPLIT_PORT_HEAD = "12";
const PORTS_AND_IPV6_API_URL =
  "https://[2001:db8::1]:8443/api/v4,https://gitlab.example:8443/api/v4,https://other.example/api/v4";
const PLAIN_API_URL = "https://gitlab.example.com/api/v4";
const USERINFO_WARNING = "GITLAB_API_URL contains a username or password before the host";
const CONFIGURED_URLS_PREFIX = "Configured GitLab API URLs: ";
const DEFAULT_URL_PREFIX = "Default GitLab API URL: ";

interface StartupLogs {
  readonly stdout: string;
  readonly stderr: string;
}

function startupEnv(apiUrl: string): Record<string, string> {
  const env: Record<string, string> = {
    GITLAB_PERSONAL_ACCESS_TOKEN: "glpat-fakefakefake",
    GITLAB_API_URL: apiUrl,
    GITLAB_DISABLE_VERSION_CHECK: "true",
    LOG_LEVEL: "info",
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
  apiUrl: string = DEFAULT_STARTUP_API_URL
): Promise<StartupLogs> {
  const child = spawn(process.execPath, [path.join(REPO_ROOT, "build/index.js")], {
    cwd: REPO_ROOT,
    env: startupEnv(apiUrl),
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
      finish(new Error(`timed out waiting for startup URL log\n${stderr}`));
    }, 20000);
    child.stderr?.on("data", () => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (stderr.includes("Default GitLab API URL:")) {
        finish();
      }
    });
    child.once("exit", code => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (stderr.includes("Default GitLab API URL:")) {
        finish();
        return;
      }
      finish(new Error(`server exited (${String(code)}) before the startup URL log\n${stderr}`));
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
  const stderrChunks: Buffer[] = [];
  child.stderr?.on("data", chunk => {
    stderrChunks.push(Buffer.from(chunk));
  });
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, 20000);
  try {
    const [code] = await once(child, "close");
    return { code: code as number | null, stderr: Buffer.concat(stderrChunks).toString("utf8") };
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
    it("should log only the host name of each configured URL", async () => {
      const logs = await captureStartupLogsAsync(SLASHLESS_LIST_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: gitlab.example, other.example"
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
    it("should log the host name of one URL", async () => {
      const logs = await captureStartupLogsAsync(COMMA_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: gitlab.example.com"
      );
    });

    it("should omit the password from stderr", async () => {
      const logs = await captureStartupLogsAsync(COMMA_API_URL);

      assert.equal(logs.stderr.includes(COMMA_PASSWORD), false);
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
    it("should log the host name of one URL", async () => {
      const logs = await captureStartupLogsAsync(HTTP_TAIL_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: gitlab.example.com"
      );
    });

    it("should omit the password from stderr", async () => {
      const logs = await captureStartupLogsAsync(HTTP_TAIL_API_URL);

      assert.equal(logs.stderr.includes(HTTP_TAIL_PASSWORD_HEAD), false);
    });
  });

  describe("with a password of digits and then a slash", () => {
    // Requests go to the host WHATWG reads, "alice", so that is the host logged.
    it("should log only the host name WHATWG reads", async () => {
      const logs = await captureStartupLogsAsync(DIGIT_PASSWORD_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: alice"
      );
    });

    it("should omit the password from stderr", async () => {
      const logs = await captureStartupLogsAsync(DIGIT_PASSWORD_API_URL);

      assert.equal(logs.stderr.includes(DIGIT_PASSWORD_TAIL), false);
    });
  });

  describe("with a comma that splits the password before an http URL", () => {
    it("should fail validation and name the entry by its position", async () => {
      const startup = await captureFailedStartupAsync(SPLIT_PASSWORD_API_URL);

      assert.equal(startup.code, 1);
      assert.match(startup.stderr, /GITLAB_API_URL entry 1 of 2 is not a valid URL/);
    });

    it("should tell the user to write the comma as %2C", async () => {
      const startup = await captureFailedStartupAsync(SPLIT_PASSWORD_API_URL);

      assert.match(startup.stderr, /write a comma inside a username or password as %2C/);
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

  describe("with a password comma that splits the value into two URLs", () => {
    // "alice" is the host of the first URL, so it is logged; the port is not.
    it("should log only the host name of each URL", async () => {
      const logs = await captureStartupLogsAsync(SPLIT_PORT_API_URL);

      assert.equal(
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        "Configured GitLab API URLs: alice, host"
      );
    });

    it("should log only the host name of the default URL", async () => {
      const logs = await captureStartupLogsAsync(SPLIT_PORT_API_URL);

      assert.equal(logMessage(logs.stderr, DEFAULT_URL_PREFIX), "Default GitLab API URL: alice");
    });

    it("should omit the start of the password from the URL logs", async () => {
      const logs = await captureStartupLogsAsync(SPLIT_PORT_API_URL);
      const urlLogs = [
        logMessage(logs.stderr, CONFIGURED_URLS_PREFIX),
        logMessage(logs.stderr, DEFAULT_URL_PREFIX),
      ];

      assert.equal(
        urlLogs.some(message => message.includes(SPLIT_PORT_HEAD)),
        false
      );
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
      assert.match(startup.stderr, /GITLAB_API_URL entry 1 of 2 is not a valid URL/);
      assert.equal(CREDENTIAL_PART.test(startup.stderr), false);
    });
  });
});
