/**
 * Classify fetch failures that never produced an HTTP response.
 * health_check must report these as a normal tool result: the caller is
 * already asking whether the connection works, so a JSON-RPC -32603 hides the
 * only signal they came for.
 *
 * node-fetch puts the OS code on `code` / `errno`. undici leaves `code` empty
 * on the TypeError and stores it on `cause.code` (errno there is numeric).
 */

import { redactGitLabUrlCredentials, redactUrlSecretsInText } from "./redact-url.js";

export { redactGitLabUrlCredentials };

export type HealthCheckTransportErrorKind = "tls" | "dns" | "timeout" | "network";

export interface HealthCheckTransportError {
  kind: HealthCheckTransportErrorKind;
  code: string | null;
  message: string;
  hint?: string;
}

const TLS_CODES: ReadonlySet<string> = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

const TLS_CODE_PREFIXES = ["CERT_", "ERR_TLS_", "ERR_SSL_"] as const;
const DNS_CODES: ReadonlySet<string> = new Set(["ENOTFOUND", "EAI_AGAIN"]);
const TIMEOUT_CODES: ReadonlySet<string> = new Set(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"]);
const TIMEOUT_ERROR_NAMES: ReadonlySet<string> = new Set(["AbortError", "TimeoutError"]);
const REQUEST_TIMEOUT_TYPE = "request-timeout";

const TLS_CA_HINT =
  "Make sure NODE_EXTRA_CA_CERTS or GITLAB_CA_CERT_PATH contains the full certificate chain, including intermediate CAs.";

const FALLBACK_MESSAGE = "GitLab request failed before an HTTP response";

export function classifyHealthCheckTransportError(error: unknown): HealthCheckTransportError {
  const code = readTransportCode(error);
  const kind = classifyKind(error, code);
  const failure: HealthCheckTransportError = {
    kind,
    code,
    message: readTransportMessage(error),
  };
  if (kind === "tls") {
    failure.hint = TLS_CA_HINT;
  }
  return failure;
}

function classifyKind(error: unknown, code: string | null): HealthCheckTransportErrorKind {
  if (code !== null) {
    return kindFromCode(code);
  }
  if (isTimeoutSignal(error) || isTimeoutSignal(readCause(error))) {
    return "timeout";
  }
  return "network";
}

function kindFromCode(code: string): HealthCheckTransportErrorKind {
  if (isTlsCode(code)) return "tls";
  if (DNS_CODES.has(code)) return "dns";
  if (TIMEOUT_CODES.has(code)) return "timeout";
  return "network";
}

function isTlsCode(code: string): boolean {
  if (TLS_CODES.has(code)) return true;
  return TLS_CODE_PREFIXES.some(prefix => code.startsWith(prefix));
}

function readTransportCode(error: unknown): string | null {
  const cause = readCause(error);
  return (
    readStringField(error, "code") ??
    readStringField(error, "errno") ??
    readStringField(cause, "code") ??
    readStringField(cause, "errno")
  );
}

function isTimeoutSignal(value: unknown): boolean {
  const name = readStringField(value, "name");
  if (name !== null && TIMEOUT_ERROR_NAMES.has(name)) return true;
  return readStringField(value, "type") === REQUEST_TIMEOUT_TYPE;
}

function readTransportMessage(error: unknown): string {
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed.length > 0 ? redactCredentials(trimmed) : FALLBACK_MESSAGE;
  }
  const combined = combineMessages(
    readStringField(error, "message"),
    readStringField(readCause(error), "message")
  );
  if (combined.length === 0) return FALLBACK_MESSAGE;
  return redactCredentials(combined);
}

function combineMessages(outer: string | null, inner: string | null): string {
  if (outer && inner && !outer.includes(inner)) {
    return `${outer}: ${inner}`;
  }
  return outer ?? inner ?? "";
}

function redactCredentials(message: string): string {
  return redactUrlSecretsInText(message)
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b((?:private|job)-token|authorization)\b\s*[:=]\s*\S+/gi, "$1: [REDACTED]")
    .replace(/\bgl(?:pat|dt|rt|pt|ft|oas|soat)-[A-Za-z0-9._-]+/gi, "[REDACTED]");
}

function readCause(value: unknown): unknown {
  if (!isRecord(value)) return undefined;
  return value.cause;
}

function readStringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  if (typeof field !== "string") return null;
  const trimmed = field.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
