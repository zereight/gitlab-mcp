import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

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
