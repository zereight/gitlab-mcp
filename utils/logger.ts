import { pino, type Logger } from "pino";

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
];

/**
 * Create a pino logger with consistent redaction, level, format, and
 * destination across the entire codebase.
 *
 * - LOG_LEVEL (default "info") controls the minimum severity.
 * - LOG_FORMAT=json disables pino-pretty and outputs newline-delimited JSON
 *   to stderr.
 * - All loggers redact the same set of sensitive fields.
 */
export function createLogger(name?: string): Logger {
  const isJson = process.env.LOG_FORMAT === "json";

  return pino(
    {
      ...(name && { name }),
      level: process.env.LOG_LEVEL || "info",
      redact: {
        paths: REDACT_PATHS,
        censor: "[REDACTED]",
      },
      ...(!isJson && {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            levelFirst: true,
            destination: 2,
          },
        },
      }),
    },
    ...(isJson ? [pino.destination(2)] : []),
  );
}
