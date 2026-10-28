import { createRequire } from "node:module";
import {
  pino,
  destination,
  stdSerializers,
  type DestinationStream,
  type LogFn,
  type Logger,
} from "pino";
import { redactUrlSecretsInError, redactUrlSecretsInLogLine } from "./redact-url.js";

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

function createAsyncStderr(): ReturnType<typeof destination> {
  return destination({
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
 * pino's error serializer, run on the redacted error. It copies the error's own
 * fields, and the `input` of an ERR_INVALID_URL can be the start of a password
 * that the line redaction cannot recognize.
 */
export function serializeLoggedError(error: unknown): unknown {
  return stdSerializers.err(redactUrlSecretsInError(error) as Error);
}

// Keys whose error pino or pino-pretty prints even though no serializer runs on it.
const LOGGED_ERROR_KEYS = ["err", "error"] as const;

/**
 * Redacts a logged error before pino reads it. Without a message argument pino
 * takes `msg` from the error's own message, and an error under `error` is
 * copied as it is.
 */
function redactLoggedErrors(this: Logger, args: Parameters<LogFn>, method: LogFn): void {
  const first: unknown = args[0];
  if (first instanceof Error) {
    redactUrlSecretsInError(first);
  } else if (typeof first === "object" && first !== null) {
    for (const key of LOGGED_ERROR_KEYS) {
      if (key in first) {
        redactUrlSecretsInError((first as Record<string, unknown>)[key]);
      }
    }
  }
  method.apply(this, args);
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
 * - Every line, in either format, has URL userinfo and token query values
 *   redacted, including text from thrown fetch/URL errors and their causes.
 * - A logged error, as the first argument or under `err` or `error`, is
 *   redacted before pino copies its fields or its message.
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
    serializers: {
      err: serializeLoggedError,
    },
    hooks: {
      logMethod: redactLoggedErrors,
      streamWrite: redactUrlSecretsInLogLine,
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
