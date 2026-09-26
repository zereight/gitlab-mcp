import { renderTable } from "./tables.js";
import type { TableSpec } from "./curated.js";
import type { OutputMode } from "./args.js";

export interface ToolCallResult {
  readonly content?: unknown;
  readonly isError?: unknown;
}

export interface FormattedOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly isError: boolean;
}

export function formatToolOutput(input: {
  result: unknown;
  mode: OutputMode;
  tableSpec: TableSpec | undefined;
}): FormattedOutput {
  const isError = resultIsError(input.result);
  const text = unwrapToolText(input.result);
  if (input.mode === "json") {
    return { stdout: ensureTrailingNewline(jsonOrRaw(text)), stderr: "", isError };
  }
  const parsed = parseJsonValue(text);
  if (parsed === undefined && input.tableSpec?.kind !== "text") {
    return {
      stdout: ensureTrailingNewline(text),
      stderr: "No table renderer for this result; printed raw output.\n",
      isError,
    };
  }
  const rendered = renderTable(parsed ?? text, input.tableSpec);
  return { stdout: rendered.stdout, stderr: rendered.stderr, isError };
}

export function formatCliError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${redactSecrets(message)}\n`;
}

export function resultIsError(result: unknown): boolean {
  return isRecord(result) && result.isError === true;
}

function unwrapToolText(result: unknown): string {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    return stringifyUnknown(result);
  }
  const first = result.content[0];
  if (!isRecord(first) || typeof first.text !== "string") {
    return stringifyUnknown(result);
  }
  return first.text;
}

function jsonOrRaw(text: string): string {
  const parsed = parseJsonValue(text);
  if (parsed === undefined) {
    return JSON.stringify(text);
  }
  return JSON.stringify(parsed);
}

function parseJsonValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function redactSecrets(message: string): string {
  return message.replace(/glpat-[A-Za-z0-9_-]+/g, "[REDACTED]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
