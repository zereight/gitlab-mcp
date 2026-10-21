import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { pino } from "pino";
import { serializeLoggedError } from "../../utils/logger.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRETTY_MARKER = "PRETTY_PROBE_7f3a9c";
const JSON_MARKER = "JSON_PROBE_7f3a9c";

const PROBE_SOURCE = `
import { createLogger } from "./utils/logger.ts";

const marker = process.env.PROBE_MARKER ?? "";
const logger = createLogger("probe");
logger.info(marker);
logger.flush(() => {
  process.exit(0);
});
`;

const STARTUP_PROBE_SOURCE = `
import { createLogger, flushStartupLogs } from "./utils/logger.ts";

const marker = process.env.PROBE_MARKER ?? "";
const logger = createLogger("probe");
logger.warn(marker);
flushStartupLogs(logger);
process.stderr.write("AFTER_STARTUP_WARNING\\n");
process.exit(0);
`;

const ASYNC_PROBE_SOURCE = `
import { createLogger } from "./utils/logger.ts";

const marker = process.env.PROBE_MARKER ?? "";
const logger = createLogger("probe");
logger.info(marker);
process.stderr.write("BEFORE_BUFFERED_LOG\\n");
process.exit(0);
`;

const FATAL_PROBE_SOURCE = `
import { createLogger, flushBufferedLogs } from "./utils/logger.ts";

const marker = process.env.PROBE_MARKER ?? "";
const logger = createLogger("probe");
logger.error(marker);
flushBufferedLogs(logger);
process.stderr.write("AFTER_FATAL_LOG\\n");
process.exit(1);
`;

const URL_PASSWORD = "p%2Cw0rd-7f3a9c";

const URL_ERROR_PROBE_SOURCE = `
import { createLogger } from "./utils/logger.ts";

const marker = process.env.PROBE_MARKER ?? "";
const url = "http://alice:${URL_PASSWORD}@127.0.0.1:9/api/v4/projects/1";
const err = new TypeError("Request cannot be constructed from a URL that includes credentials: " + url, {
  cause: new Error("connect " + url),
});
const logger = createLogger("probe");
logger.error({ err, url }, marker + " " + url);
logger.flush(() => {
  process.exit(0);
});
`;

// A password split at a comma, a fetch of a URL cut there, and a credentialed base.
const INVALID_URL_ERROR_PROBE_SOURCE = `
import { createLogger } from "./utils/logger.ts";

function invalidUrlError(input, base) {
  try {
    return new Error("parsed as " + new URL(input, base).href);
  } catch (error) {
    return error;
  }
}

const marker = process.env.PROBE_MARKER ?? "";
const fetchError = await fetch("http://alice:Pw7x/api/v4/projects/1").catch(error => error);
const logger = createLogger("probe");
logger.error({ err: invalidUrlError("http://alice:Pw7x,http://w@host/api/v4") }, marker);
logger.error({ err: fetchError }, marker);
logger.error(invalidUrlError("/projects/1", "http://alice:Pw7x/api/v4"), marker);
logger.flush(() => {
  process.exit(0);
});
`;

// The same errors with no message argument, and one under `error`, which no
// serializer handles. The marker is the logger name, the only text in every line.
const UNNAMED_INVALID_URL_ERROR_PROBE_SOURCE = `
import { createLogger } from "./utils/logger.ts";

function invalidUrlError(input, base) {
  try {
    return new Error("parsed as " + new URL(input, base).href);
  } catch (error) {
    return error;
  }
}

const fetchError = await fetch("http://alice:Pw7x/api/v4/projects/1").catch(error => error);
const logger = createLogger(process.env.PROBE_MARKER ?? "");
logger.error(fetchError);
logger.error({ err: invalidUrlError("http://alice:Pw7x,http://w@host/api/v4") });
logger.error({ error: invalidUrlError("/projects/1", "http://alice:Pw7x/api/v4") });
logger.flush(() => {
  process.exit(0);
});
`;

// alice's password and the userinfo of the URL after the comma.
const INVALID_URL_CREDENTIAL = /alice|Pw7x|w@/;

function invalidUrlError(input: string): Error {
  try {
    return new Error(`parsed as ${new URL(input).href}`);
  } catch (error) {
    assert.ok(error instanceof Error);
    return error;
  }
}

interface ProbeResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
}

function probeEnv(logFormat: string | undefined, marker: string): Record<string, string> {
  const env: Record<string, string> = {
    PROBE_MARKER: marker,
    LOG_LEVEL: "info",
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "LOG_FORMAT" && key !== "LOG_LEVEL") {
      env[key] = value;
    }
  }
  if (logFormat !== undefined) {
    env.LOG_FORMAT = logFormat;
  }
  return env;
}

function isJsonLogLine(text: string, marker: string): boolean {
  const line = text.split("\n").find(item => item.includes(marker));
  if (line === undefined) {
    return false;
  }
  try {
    JSON.parse(line);
    return true;
  } catch {
    return false;
  }
}

async function runProbe(
  logFormat: string | undefined,
  marker: string,
  source: string = PROBE_SOURCE
): Promise<ProbeResult> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx/esm", "--input-type=module", "-e", source],
    {
      cwd: REPO_ROOT,
      env: probeEnv(logFormat, marker),
      stdio: ["ignore", "pipe", "pipe"],
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
  const [code] = await once(child, "close");
  return {
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
    code: typeof code === "number" ? code : null,
  };
}

describe("When createLogger writes a record", () => {
  describe("with LOG_FORMAT=json", () => {
    it("should write JSON to stderr and leave stdout empty", async () => {
      const probe = await runProbe("json", JSON_MARKER);

      assert.equal(probe.code, 0);
      assert.equal(probe.stdout, "");
      assert.equal(isJsonLogLine(probe.stderr, JSON_MARKER), true);
    });
  });

  describe("with LOG_FORMAT unset", () => {
    it("should write a human-readable line to stderr and leave stdout empty", async () => {
      const probe = await runProbe(undefined, PRETTY_MARKER);
      const readable =
        probe.stderr.includes(PRETTY_MARKER) && !isJsonLogLine(probe.stderr, PRETTY_MARKER);

      assert.equal(probe.code, 0);
      assert.equal(probe.stdout, "");
      assert.equal(readable, true);
    });
  });
});

describe("When createLogger writes an error with a credentialed URL", () => {
  describe("with LOG_FORMAT=json", () => {
    it("should omit the password", async () => {
      const probe = await runProbe("json", JSON_MARKER, URL_ERROR_PROBE_SOURCE);

      assert.equal(probe.code, 0);
      assert.equal(probe.stderr.includes(JSON_MARKER), true);
      assert.equal(probe.stderr.includes(URL_PASSWORD), false);
    });

    it("should keep the redacted host", async () => {
      const probe = await runProbe("json", JSON_MARKER, URL_ERROR_PROBE_SOURCE);

      assert.equal(probe.stderr.includes("http://[REDACTED]@127.0.0.1:9/api/v4/projects/1"), true);
    });
  });

  describe("with LOG_FORMAT unset", () => {
    it("should omit the password", async () => {
      const probe = await runProbe(undefined, PRETTY_MARKER, URL_ERROR_PROBE_SOURCE);

      assert.equal(probe.code, 0);
      assert.equal(probe.stderr.includes(PRETTY_MARKER), true);
      assert.equal(probe.stderr.includes(URL_PASSWORD), false);
    });

    it("should keep the redacted host", async () => {
      const probe = await runProbe(undefined, PRETTY_MARKER, URL_ERROR_PROBE_SOURCE);

      assert.equal(probe.stderr.includes("http://[REDACTED]@127.0.0.1:9/api/v4/projects/1"), true);
    });
  });
});

describe("When createLogger writes an ERR_INVALID_URL error", () => {
  describe("with LOG_FORMAT=json", () => {
    it("should omit the credential", async () => {
      const probe = await runProbe("json", JSON_MARKER, INVALID_URL_ERROR_PROBE_SOURCE);

      assert.equal(probe.code, 0);
      assert.equal(probe.stderr.split(JSON_MARKER).length, 4);
      assert.doesNotMatch(probe.stderr, INVALID_URL_CREDENTIAL);
    });

    it("should log the input and base as redacted", async () => {
      const probe = await runProbe("json", JSON_MARKER, INVALID_URL_ERROR_PROBE_SOURCE);
      const errors = probe.stderr
        .split("\n")
        .filter(line => line.includes(JSON_MARKER))
        .map(line => (JSON.parse(line) as { err: Record<string, unknown> }).err);

      assert.deepEqual(
        errors.map(error => [error.message, error.input, error.base]),
        [
          ["Invalid URL", "[REDACTED]", undefined],
          ["Failed to parse URL from [REDACTED]: Invalid URL", undefined, undefined],
          ["Invalid URL", "[REDACTED]", "[REDACTED]"],
        ]
      );
    });
  });

  describe("with LOG_FORMAT unset", () => {
    it("should omit the credential", async () => {
      const probe = await runProbe(undefined, PRETTY_MARKER, INVALID_URL_ERROR_PROBE_SOURCE);

      assert.equal(probe.code, 0);
      assert.equal(probe.stderr.split(PRETTY_MARKER).length, 4);
      assert.doesNotMatch(probe.stderr, INVALID_URL_CREDENTIAL);
    });
  });
});

describe("When createLogger writes an ERR_INVALID_URL error with no message or under `error`", () => {
  describe("with LOG_FORMAT=json", () => {
    it("should omit the credential", async () => {
      const probe = await runProbe("json", JSON_MARKER, UNNAMED_INVALID_URL_ERROR_PROBE_SOURCE);

      assert.equal(probe.code, 0);
      assert.equal(probe.stderr.split(JSON_MARKER).length, 4);
      assert.doesNotMatch(probe.stderr, INVALID_URL_CREDENTIAL);
    });

    it("should log the message, input, and base as redacted", async () => {
      const probe = await runProbe("json", JSON_MARKER, UNNAMED_INVALID_URL_ERROR_PROBE_SOURCE);
      const records = probe.stderr
        .split("\n")
        .filter(line => line.includes(JSON_MARKER))
        .map(
          line =>
            JSON.parse(line) as {
              msg?: string;
              err?: Record<string, unknown>;
              error?: Record<string, unknown>;
            }
        );

      assert.deepEqual(
        records.map(record => [record.msg, record.err?.message, record.err?.input, record.error]),
        [
          [
            "Failed to parse URL from [REDACTED]",
            "Failed to parse URL from [REDACTED]: Invalid URL",
            undefined,
            undefined,
          ],
          ["Invalid URL", "Invalid URL", "[REDACTED]", undefined],
          [
            undefined,
            undefined,
            undefined,
            { code: "ERR_INVALID_URL", input: "[REDACTED]", base: "[REDACTED]" },
          ],
        ]
      );
    });
  });

  describe("with LOG_FORMAT unset", () => {
    it("should omit the credential", async () => {
      const probe = await runProbe(
        undefined,
        PRETTY_MARKER,
        UNNAMED_INVALID_URL_ERROR_PROBE_SOURCE
      );

      assert.equal(probe.code, 0);
      assert.equal(probe.stderr.split(PRETTY_MARKER).length, 4);
      assert.doesNotMatch(probe.stderr, INVALID_URL_CREDENTIAL);
    });
  });
});

describe("When serializeLoggedError runs", () => {
  describe("with an ERR_INVALID_URL", () => {
    it("should leave no credential in the serialized error", () => {
      const error = invalidUrlError("http://alice:Pw7x/api/v4/projects/1");

      assert.doesNotMatch(JSON.stringify(serializeLoggedError(error)), INVALID_URL_CREDENTIAL);
    });
  });

  describe("with an error that holds no URL", () => {
    it("should serialize it as pino does", () => {
      const error = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:443"), {
        code: "ECONNREFUSED",
      });

      assert.equal(
        JSON.stringify(serializeLoggedError(error)),
        JSON.stringify(pino.stdSerializers.err(error))
      );
    });
  });

  describe("with a value that is not an error", () => {
    it("should return it unchanged", () => {
      assert.equal(serializeLoggedError(42), 42);
    });
  });
});

describe("When startup warnings are flushed", () => {
  describe("with LOG_FORMAT=json", () => {
    it("should write the warning before a later stderr line", async () => {
      const probe = await runProbe("json", JSON_MARKER, STARTUP_PROBE_SOURCE);
      const warningAt = probe.stderr.indexOf(JSON_MARKER);
      const afterAt = probe.stderr.indexOf("AFTER_STARTUP_WARNING");

      assert.equal(probe.code, 0);
      assert.ok(warningAt >= 0);
      assert.ok(afterAt > warningAt);
    });
  });

  describe("with LOG_FORMAT unset", () => {
    it("should write the warning before a later stderr line", async () => {
      const probe = await runProbe(undefined, PRETTY_MARKER, STARTUP_PROBE_SOURCE);
      const warningAt = probe.stderr.indexOf(PRETTY_MARKER);
      const afterAt = probe.stderr.indexOf("AFTER_STARTUP_WARNING");

      assert.equal(probe.code, 0);
      assert.ok(warningAt >= 0);
      assert.ok(afterAt > warningAt);
    });
  });
});

describe("When a fatal log is flushed before exit", () => {
  describe("with LOG_FORMAT=json", () => {
    it("should write the error before a later stderr line", async () => {
      const probe = await runProbe("json", JSON_MARKER, FATAL_PROBE_SOURCE);
      const errorAt = probe.stderr.indexOf(JSON_MARKER);
      const afterAt = probe.stderr.indexOf("AFTER_FATAL_LOG");

      assert.equal(probe.code, 1);
      assert.equal(probe.stdout, "");
      assert.ok(errorAt >= 0);
      assert.ok(afterAt > errorAt);
    });
  });

  describe("with LOG_FORMAT unset", () => {
    it("should write the error before a later stderr line", async () => {
      const probe = await runProbe(undefined, PRETTY_MARKER, FATAL_PROBE_SOURCE);
      const errorAt = probe.stderr.indexOf(PRETTY_MARKER);
      const afterAt = probe.stderr.indexOf("AFTER_FATAL_LOG");

      assert.equal(probe.code, 1);
      assert.equal(probe.stdout, "");
      assert.ok(errorAt >= 0);
      assert.ok(afterAt > errorAt);
    });
  });
});

describe("When a steady-state log is not flushed", () => {
  describe("with LOG_FORMAT=json", () => {
    it("should leave that log behind a direct stderr write", async () => {
      const probe = await runProbe("json", JSON_MARKER, ASYNC_PROBE_SOURCE);
      const logAt = probe.stderr.indexOf(JSON_MARKER);
      const beforeAt = probe.stderr.indexOf("BEFORE_BUFFERED_LOG");

      assert.equal(probe.code, 0);
      assert.ok(beforeAt >= 0);
      assert.ok(logAt > beforeAt);
    });
  });

  describe("with LOG_FORMAT unset", () => {
    it("should leave that log behind a direct stderr write", async () => {
      const probe = await runProbe(undefined, PRETTY_MARKER, ASYNC_PROBE_SOURCE);
      const logAt = probe.stderr.indexOf(PRETTY_MARKER);
      const beforeAt = probe.stderr.indexOf("BEFORE_BUFFERED_LOG");

      assert.equal(probe.code, 0);
      assert.ok(beforeAt >= 0);
      assert.ok(logAt > beforeAt);
    });
  });
});
