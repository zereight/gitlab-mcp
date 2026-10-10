import { createRequire } from "node:module";
import { pino, type DestinationStream, type Logger } from "pino";

const require = createRequire(import.meta.url);

const REDACT_PATHS = [
  "token",
  "*.token",
  "ctx.token",
  "context.token",
  "authData.token",
  "auth.token",
  "headers.authorization",
  "headers.Authorization",
  'headers["private-token"]',
  'headers["Private-Token"]',
  'headers["job-token"]',
  'headers["JOB-TOKEN"]',
  'headers["mcp-session-id"]',
  'headers["Mcp-Session-Id"]',
  "sessionId",
  "*.sessionId",
  "ctx.sessionId",
  "context.sessionId",
  "approval_password",
  "*.approval_password",
  "arguments.approval_password",
  "params.arguments.approval_password",
];

interface PrettyOptions {
  readonly colorize: boolean;
  readonly levelFirst: boolean;
  readonly destination: number;
  readonly sync: boolean;
}

function isPrettyFactory(value: unknown): value is (options: PrettyOptions) => DestinationStream {
  return typeof value === "function";
}

function isPrettyModule(
  value: unknown
): value is { default: (options: PrettyOptions) => DestinationStream } {
  if (typeof value !== "object" || value === null || !("default" in value)) {
    return false;
  }
  return isPrettyFactory(value.default);
}

/**
 * Pretty-print in process. The worker transport has the same text format, but
 * it spawns a thread on every logger, including stdio MCP startup.
 * LOG_FORMAT=json still skips pino-pretty entirely.
 */
function createPrettyStream(): DestinationStream {
  const loaded: unknown = require("pino-pretty");
  // sync: the async destination can flush a later line before an earlier one
  // when the process exits immediately, which hides deprecation warnings
  // behind the fatal error they are supposed to precede.
  const options: PrettyOptions = {
    colorize: true,
    levelFirst: true,
    destination: 2,
    sync: true,
  };
  if (isPrettyFactory(loaded)) {
    return loaded(options);
  }
  if (isPrettyModule(loaded)) {
    return loaded.default(options);
  }
  throw new Error("pino-pretty did not export a stream factory");
}

/**
 * Create a pino logger with consistent redaction, level, format, and
 * destination across the entire codebase.
 *
 * - LOG_LEVEL (default "info") controls the minimum severity.
 * - LOG_FORMAT=json disables pino-pretty and outputs newline-delimited JSON
 *   to stderr.
 * - Any other value, including unset, keeps human-readable pino-pretty output.
 * - All loggers redact the same set of sensitive fields.
 */
export function createLogger(name?: string): Logger {
  const isJson = process.env.LOG_FORMAT === "json";
  const options = {
    ...(name && { name }),
    level: process.env.LOG_LEVEL || "info",
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
  };
  if (isJson) {
    return pino(options, pino.destination({ dest: 2, sync: true }));
  }
  return pino(options, createPrettyStream());
}
