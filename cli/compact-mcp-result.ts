import { buildToolReplayCommand } from "./replay-command.js";

const PREVIEW_ARRAY_ITEMS = 5;
const PREVIEW_TEXT_CHARS = 1500;
const PREVIEW_JSON_CHARS = 2000;

export interface CompactMcpToolResultInput {
  readonly result: unknown;
  readonly enabled: boolean;
  readonly maxChars: number;
  readonly toolName: string;
  readonly args: Readonly<Record<string, unknown>> | undefined;
}

export function readOwnRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    copy[key] = Reflect.get(value, key);
  }
  return copy;
}

export function compactMcpToolResult(input: CompactMcpToolResultInput): Record<string, unknown> {
  if (!input.enabled || input.toolName === "discover_tools") {
    return toolResultRecord(input.result);
  }
  if (!isToolResult(input.result) || input.result.isError === true) {
    return toolResultRecord(input.result);
  }
  const text = unwrapToolText(input.result);
  if (text.length <= input.maxChars) {
    return toolResultRecord(input.result);
  }
  const compact = {
    compact: true,
    tool: input.toolName,
    original_chars: text.length,
    ...buildPreview(text),
    cli: buildToolReplayCommand(input.toolName, input.args),
  };
  return {
    content: [{ type: "text", text: JSON.stringify(compact) }],
    isError: false,
  };
}

function toolResultRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }
  return { content: [{ type: "text", text: stringifyUnknown(value) }] };
}

function buildPreview(text: string): {
  readonly preview: unknown;
  readonly items_total?: number;
} {
  const parsed = parseJsonValue(text);
  if (parsed === undefined) {
    return { preview: text.slice(0, PREVIEW_TEXT_CHARS) };
  }
  if (Array.isArray(parsed)) {
    return { preview: parsed.slice(0, PREVIEW_ARRAY_ITEMS), items_total: parsed.length };
  }
  if (typeof parsed === "string") {
    return { preview: parsed.slice(0, PREVIEW_TEXT_CHARS) };
  }
  const encoded = JSON.stringify(parsed);
  if (encoded.length <= PREVIEW_JSON_CHARS) {
    return { preview: parsed };
  }
  return { preview: encoded.slice(0, PREVIEW_JSON_CHARS) };
}

function unwrapToolText(result: ToolResult): string {
  const textBlock = result.content.find(
    item => isRecord(item) && typeof item.text === "string"
  );
  if (!isRecord(textBlock) || typeof textBlock.text !== "string") {
    return stringifyUnknown(result);
  }
  return textBlock.text;
}

interface ToolResult {
  readonly content: readonly unknown[];
  readonly isError?: unknown;
}

function isToolResult(value: unknown): value is ToolResult {
  return isRecord(value) && Array.isArray(value.content);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
