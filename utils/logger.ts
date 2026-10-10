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

const STDERR_FD = 2;
// Stay under sonic-boom's minLength so a startup warning is still buffered when
// flushStartupLogs runs. A larger line starts an async write immediately, and
// flushSync cannot pull that in-flight chunk back into order.
const ASYNC_LOG_MIN_LENGTH = 1024 * 1024;
const ASYNC_LOG_MAX_WRITE = ASYNC_LOG_MIN_LENGTH + 1;
const ASYNC_LOG_FLUSH_INTERVAL_MS = 100;

interface PrettyFactoryOptions {
  readonly colorize: boolean;
  readonly levelFirst: boolean;
}

interface Prettifier {
  (inputData: string): string | undefined;
}

interface PrettyModule {
  readonly prettyFactory: (options: PrettyFactoryOptions) => Prettifier;
}

interface FlushableDestination extends DestinationStream {
  flush: (callback?: (error?: Error) => void) => void;
  readonly flushSync: () => void;
}

const startupFlushes = new WeakMap<Logger, () => void>();

function isPrettyModule(value: unknown): value is PrettyModule {
  if (typeof value !== "function" || !("prettyFactory" in value)) {
    return false;
  }
  return typeof value.prettyFactory === "function";
}

function readPrettyModule(value: unknown): PrettyModule | undefined {
  if (isPrettyModule(value)) {
    return value;
  }
  if (typeof value === "object" && value !== null && "default" in value) {
    if (isPrettyModule(value.default)) {
      return value.default;
    }
  }
  return undefined;
}

function loadPrettifier(): Prettifier {
  const loaded: unknown = require("pino-pretty");
  const prettyModule = readPrettyModule(loaded);
  if (prettyModule === undefined) {
    throw new Error("pino-pretty did not export a prettifier");
  }
  return prettyModule.prettyFactory({ colorize: true, levelFirst: true });
}

function createAsyncStderr(): ReturnType<typeof pino.destination> {
  return pino.destination({
    dest: STDERR_FD,
    sync: false,
    minLength: ASYNC_LOG_MIN_LENGTH,
    maxWrite: ASYNC_LOG_MAX_WRITE,
    periodicFlush: ASYNC_LOG_FLUSH_INTERVAL_MS,
  });
}

/**
 * Pretty-print in process. The worker transport has the same text format, but
 * it spawns a thread on every logger, including stdio MCP startup.
 * LOG_FORMAT=json still skips pino-pretty entirely.
 *
 * Steady-state writes stay asynchronous. flushSync is only for startup warnings,
 * so a full stderr pipe cannot block later request logs.
 */
function createPrettyDestination(): FlushableDestination {
  const prettify = loadPrettifier();
  const sonic = createAsyncStderr();
  return {
    write(message: string): void {
      const source = message.endsWith("\n") ? message.slice(0, -1) : message;
      const line = prettify(source);
      if (typeof line !== "string" || line.length === 0) {
        return;
      }
      sonic.write(line);
    },
    flush(callback?: (error?: Error) => void): void {
      sonic.flush(callback);
    },
    flushSync(): void {
      sonic.flushSync();
    },
  };
}

function rememberStartupFlush(logger: Logger, flushSync: () => void): void {
  startupFlushes.set(logger, flushSync);
}

/**
 * Block until startup warnings already passed to this logger reach stderr.
 * Steady-state logs stay buffered and are flushed asynchronously.
 */
function flushDestination(logger: Logger): void {
  const flush = startupFlushes.get(logger);
  if (flush === undefined) {
    return;
  }
  flush();
}

export function flushStartupLogs(logger: Logger): void {
  flushDestination(logger);
}

/** Write buffered lines now. Info logs stay buffered until this or process exit. */
export function flushBufferedLogs(logger: Logger): void {
  flushDestination(logger);
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
    const destination = createAsyncStderr();
    const logger = pino(options, destination);
    rememberStartupFlush(logger, () => {
      destination.flushSync();
    });
    return logger;
  }
  const destination = createPrettyDestination();
  const logger = pino(options, destination);
  rememberStartupFlush(logger, () => {
    destination.flushSync();
  });
  return logger;
}
