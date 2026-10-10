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

describe("When the stdio server starts", () => {
  describe("with credentials in GITLAB_API_URL", () => {
    it("should redact the configured URL log", async () => {
      const logs = await captureStartupLogsAsync();

      assert.equal(
        logs.stderr.includes(
          "Configured GitLab API URLs: https://[REDACTED]@gitlab.example.com/api/v4?private_token=[REDACTED]"
        ),
        true
      );
    });

    it("should redact the default URL log", async () => {
      const logs = await captureStartupLogsAsync();

      assert.equal(
        logs.stderr.includes(
          "Default GitLab API URL: https://[REDACTED]@gitlab.example.com/api/v4?private_token=[REDACTED]"
        ),
        true
      );
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
    it("should redact each configured URL", async () => {
      const logs = await captureStartupLogsAsync(SLASHLESS_LIST_API_URL);

      assert.equal(
        logs.stderr.includes(
          "Configured GitLab API URLs: https://gitlab.example/api/v4, https:[REDACTED]@other.example/api/v4"
        ),
        true
      );
    });

    it("should omit the slashless password from stderr", async () => {
      const logs = await captureStartupLogsAsync(SLASHLESS_LIST_API_URL);

      assert.equal(logs.stderr.includes(SLASHLESS_PASSWORD), false);
    });
  });
});
