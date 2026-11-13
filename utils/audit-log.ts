/**
 * Opt-in NDJSON audit log of MCP tool calls for SIEM ingestion.
 *
 * Disabled by default. When enabled, one JSON object is written per tool call
 * using an allowlist of fields. Argument bodies, response bodies, tokens,
 * headers, and free-text error messages are never copied into the record.
 *
 * This is a logging building block. Retention, access control, and any
 * compliance mapping are the operator's responsibility.
 */
import fs from "node:fs";
import {
  GITLAB_AUDIT_LOG,
  GITLAB_AUDIT_LOG_FILE,
  GITLAB_AUTH_COOKIE_PATH,
  GITLAB_JOB_TOKEN,
  GITLAB_MCP_OAUTH,
  GITLAB_PERSONAL_ACCESS_TOKEN,
  REMOTE_AUTHORIZATION,
  USE_OAUTH,
} from "../config.js";
import { TransportMode, determineTransportMode } from "../server/transport-mode.js";
import { createLogger } from "./logger.js";

export const AUDIT_EVENT_TYPE = "tool_call";

export type AuditField =
  | "timestamp"
  | "event"
  | "transport"
  | "sessionId"
  | "authMethod"
  | "gitlabUserId"
  | "gitlabUsername"
  | "tool"
  | "projectId"
  | "groupId"
  | "outcome"
  | "errorClass"
  | "httpStatus"
  | "durationMs";

export const AUDIT_FIELD_ALLOWLIST: readonly AuditField[] = [
  "timestamp",
  "event",
  "transport",
  "sessionId",
  "authMethod",
  "gitlabUserId",
  "gitlabUsername",
  "tool",
  "projectId",
  "groupId",
  "outcome",
  "errorClass",
  "httpStatus",
  "durationMs",
];
export type AuditOutcome = "success" | "error";
export type AuditAuthMethod = "pat" | "job-token" | "oauth" | "remote-header" | "cookie";
export type AuditTransport = "stdio" | "sse" | "streamable-http";

const SAFE_ERROR_CLASS = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const DEFAULT_ERROR_CLASS = "Error";
const TOOL_ERROR_CLASS = "ToolError";
const STDOUT_PATHS = new Set(["/dev/stdout", "stdout", "1"]);

export interface AuditResourceIds {
  readonly projectId?: string;
  readonly groupId?: string;
}

export interface AuditFailure {
  readonly errorClass: string;
  readonly httpStatus?: number;
}

export interface AuditAuthMethodInput {
  readonly remoteAuthorization: boolean;
  readonly mcpOAuth: boolean;
  readonly useOAuth: boolean;
  readonly hasPat: boolean;
  readonly hasJobToken: boolean;
  readonly hasCookie: boolean;
}

export interface ToolCallAuditFields {
  readonly timestamp: string;
  readonly transport: AuditTransport;
  readonly sessionId?: string;
  readonly authMethod?: AuditAuthMethod;
  readonly gitlabUserId?: number;
  readonly gitlabUsername?: string;
  readonly tool: string;
  readonly projectId?: string;
  readonly groupId?: string;
  readonly outcome: AuditOutcome;
  readonly errorClass?: string;
  readonly httpStatus?: number;
  readonly durationMs: number;
}

export interface RecordToolCallAuditInput {
  readonly toolName: unknown;
  readonly sessionId?: unknown;
  readonly args?: unknown;
  readonly gitlabUserId?: unknown;
  readonly gitlabUsername?: unknown;
  readonly outcome: AuditOutcome;
  readonly error?: unknown;
  readonly startedAtMs: number;
}

export interface RecordToolCallAuditDeps {
  readonly enabled?: boolean;
  readonly filePath?: string;
  readonly now?: () => Date;
  readonly writeLine?: (line: string) => void;
  readonly warn?: (error: unknown) => void;
}

export interface ToolCallAuditor {
  recordResult(result: unknown): void;
  recordError(error: unknown): void;
}

let writeFailureWarned = false;
let warningLogger: ReturnType<typeof createLogger> | undefined;

export function resetAuditLogWriteWarningForTests(): void {
  writeFailureWarned = false;
}

export function isAuditLogEnabled(enabled: boolean = GITLAB_AUDIT_LOG): boolean {
  return enabled === true;
}

export function extractAuditResourceIds(args: unknown): AuditResourceIds {
  if (!isPlainRecord(args)) {
    return {};
  }
  const projectId = readResourceId(ownProperty(args, "project_id"));
  const groupId = readResourceId(ownProperty(args, "group_id"));
  const ids: { projectId?: string; groupId?: string } = {};
  if (projectId !== undefined) {
    ids.projectId = projectId;
  }
  if (groupId !== undefined) {
    ids.groupId = groupId;
  }
  return ids;
}

export function classifyAuditFailure(error: unknown): AuditFailure {
  if (error === undefined) {
    return { errorClass: TOOL_ERROR_CLASS };
  }
  const failure: { errorClass: string; httpStatus?: number } = {
    errorClass: readErrorClass(error),
  };
  const httpStatus = readHttpStatus(error);
  if (httpStatus !== undefined) {
    failure.httpStatus = httpStatus;
  }
  return failure;
}

export function resolveAuditAuthMethod(input: AuditAuthMethodInput): AuditAuthMethod | undefined {
  if (input.mcpOAuth) {
    return "oauth";
  }
  if (input.remoteAuthorization) {
    return "remote-header";
  }
  if (input.useOAuth) {
    return "oauth";
  }
  if (input.hasPat) {
    return "pat";
  }
  if (input.hasJobToken) {
    return "job-token";
  }
  if (input.hasCookie) {
    return "cookie";
  }
  return undefined;
}

export function sanitizeAuditSessionId(sessionId: unknown): string | undefined {
  if (typeof sessionId !== "string") {
    return undefined;
  }
  const trimmed = sessionId.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  // Sealed stateless sids are bearer tokens. Correlate without emitting ciphertext.
  if (trimmed.startsWith("v1.sid.")) {
    return "v1.sid.<redacted>";
  }
  return trimmed;
}

export function readKnownGitLabUserId(extra: unknown): number | undefined {
  if (!isPlainRecord(extra)) {
    return undefined;
  }
  const value = ownProperty(extra, "resourceOwnerId");
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

export function readKnownGitLabUsername(extra: unknown): string | undefined {
  if (!isPlainRecord(extra)) {
    return undefined;
  }
  const value = ownProperty(extra, "username");
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildAuditRecord(fields: ToolCallAuditFields): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const field of AUDIT_FIELD_ALLOWLIST) {
    const value = readAuditField(fields, field);
    if (value !== undefined) {
      record[field] = value;
    }
  }
  return record;
}

export function recordToolCallAudit(
  input: RecordToolCallAuditInput,
  deps: RecordToolCallAuditDeps = {}
): void {
  if (!isAuditLogEnabled(deps.enabled ?? GITLAB_AUDIT_LOG)) {
    return;
  }

  try {
    const now = deps.now ?? defaultNow;
    const resources = extractAuditResourceIds(input.args);
    const outcome = input.outcome;
    const failure = outcome === "error" ? classifyAuditFailure(input.error) : undefined;
    const fields: ToolCallAuditFields = {
      timestamp: now().toISOString(),
      transport: auditTransport(determineTransportMode()),
      sessionId: sanitizeAuditSessionId(input.sessionId),
      authMethod: currentAuditAuthMethod(),
      gitlabUserId: readPositiveInteger(input.gitlabUserId),
      gitlabUsername: readOptionalName(input.gitlabUsername),
      tool: readToolName(input.toolName),
      projectId: resources.projectId,
      groupId: resources.groupId,
      outcome,
      errorClass: failure?.errorClass,
      httpStatus: failure?.httpStatus,
      durationMs: readDurationMs(input.startedAtMs, now()),
    };
    const line = JSON.stringify(buildAuditRecord(fields));
    const writeLine = deps.writeLine ?? defaultWriteLine(deps.filePath ?? GITLAB_AUDIT_LOG_FILE);
    writeLine(line);
  } catch (error) {
    warnAuditWriteFailure(error, deps.warn);
  }
}

export function createToolCallAuditor(
  input: {
    readonly toolName: unknown;
    readonly sessionId?: unknown;
    readonly args?: unknown;
    readonly startedAtMs: number;
    readonly gitlabUserId?: unknown;
    readonly gitlabUsername?: unknown;
  },
  deps?: RecordToolCallAuditDeps
): ToolCallAuditor {
  const state = { recorded: false };

  function record(outcome: AuditOutcome, error?: unknown): void {
    if (state.recorded) {
      return;
    }
    state.recorded = true;
    recordToolCallAudit(
      {
        toolName: input.toolName,
        sessionId: input.sessionId,
        args: input.args,
        gitlabUserId: input.gitlabUserId,
        gitlabUsername: input.gitlabUsername,
        outcome,
        error,
        startedAtMs: input.startedAtMs,
      },
      deps
    );
  }

  return {
    recordResult(result: unknown): void {
      if (isErrorToolResult(result)) {
        record("error");
        return;
      }
      record("success");
    },
    recordError(error: unknown): void {
      record("error", error);
    },
  };
}

function readAuditField(fields: ToolCallAuditFields, field: AuditField): unknown {
  switch (field) {
    case "timestamp":
      return fields.timestamp;
    case "event":
      return AUDIT_EVENT_TYPE;
    case "transport":
      return fields.transport;
    case "sessionId":
      return fields.sessionId;
    case "authMethod":
      return fields.authMethod;
    case "gitlabUserId":
      return fields.gitlabUserId;
    case "gitlabUsername":
      return fields.gitlabUsername;
    case "tool":
      return fields.tool;
    case "projectId":
      return fields.projectId;
    case "groupId":
      return fields.groupId;
    case "outcome":
      return fields.outcome;
    case "errorClass":
      return fields.errorClass;
    case "httpStatus":
      return fields.httpStatus;
    case "durationMs":
      return fields.durationMs;
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

function auditTransport(mode: TransportMode): AuditTransport {
  switch (mode) {
    case TransportMode.STDIO:
      return "stdio";
    case TransportMode.SSE:
      return "sse";
    case TransportMode.STREAMABLE_HTTP:
      return "streamable-http";
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

function currentAuditAuthMethod(): AuditAuthMethod | undefined {
  return resolveAuditAuthMethod({
    remoteAuthorization: REMOTE_AUTHORIZATION,
    mcpOAuth: GITLAB_MCP_OAUTH,
    useOAuth: USE_OAUTH,
    hasPat: Boolean(GITLAB_PERSONAL_ACCESS_TOKEN),
    hasJobToken: Boolean(GITLAB_JOB_TOKEN),
    hasCookie: Boolean(GITLAB_AUTH_COOKIE_PATH),
  });
}

function defaultNow(): Date {
  return new Date();
}

function defaultWriteLine(filePath: string | undefined): (line: string) => void {
  return function writeAuditLine(line: string): void {
    const payload = `${line}\n`;
    if (!filePath) {
      process.stderr.write(payload);
      return;
    }
    const trimmed = filePath.trim();
    if (trimmed.length === 0) {
      process.stderr.write(payload);
      return;
    }
    if (isStdoutPath(trimmed)) {
      throw new Error("GITLAB_AUDIT_LOG_FILE must not target stdout");
    }
    fs.appendFileSync(trimmed, payload);
  };
}

function warnAuditWriteFailure(error: unknown, warn?: (error: unknown) => void): void {
  if (writeFailureWarned) {
    return;
  }
  writeFailureWarned = true;
  if (warn) {
    warn(error);
    return;
  }
  if (warningLogger === undefined) {
    warningLogger = createLogger("audit-log");
  }
  warningLogger.warn(
    { err: error },
    "Failed to write tool-call audit log; further write failures will be silent"
  );
}

function isStdoutPath(filePath: string): boolean {
  return STDOUT_PATHS.has(filePath) || STDOUT_PATHS.has(filePath.toLowerCase());
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownProperty(record: Record<string, unknown>, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return undefined;
  }
  return Reflect.get(record, key);
}

function readResourceId(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function readErrorClass(error: unknown): string {
  if (error instanceof Error && SAFE_ERROR_CLASS.test(error.name)) {
    return error.name;
  }
  return DEFAULT_ERROR_CLASS;
}

function readHttpStatus(error: unknown): number | undefined {
  if (!isPlainRecord(error) && !(error instanceof Error)) {
    return undefined;
  }
  if (!("status" in error)) {
    return undefined;
  }
  const status = Reflect.get(error, "status");
  if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599) {
    return undefined;
  }
  return status;
}

function readToolName(toolName: unknown): string {
  if (typeof toolName !== "string") {
    return "unknown";
  }
  const trimmed = toolName.trim();
  return trimmed.length > 0 ? trimmed : "unknown";
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function readOptionalName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readDurationMs(startedAtMs: number, now: Date): number {
  const durationMs = now.getTime() - startedAtMs;
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 0;
  }
  return Math.round(durationMs);
}

function isErrorToolResult(result: unknown): boolean {
  if (!isPlainRecord(result)) {
    return false;
  }
  return ownProperty(result, "isError") === true;
}
