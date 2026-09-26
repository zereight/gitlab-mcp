import jmespath from "jmespath";

declare module "jmespath" {
  export function compile(expression: string): unknown;
}

/** MCP-only argument; stripped before GitLab handlers run (issue #766). */
export const JMESPATH_TOOL_ARGUMENT = "jmespath";

export const JMESPATH_TOOL_ARGUMENT_DESCRIPTION =
  "Optional JMESPath expression filtering the JSON result before return.";

export function readJmespathExpression(
  args: Record<string, unknown> | undefined
): string | undefined {
  if (!args) return undefined;
  const raw = args[JMESPATH_TOOL_ARGUMENT];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Syntax check before the handler runs, so side-effecting tools never execute with a bad expression. */
export function getJmespathSyntaxError(expression: string): string | undefined {
  try {
    jmespath.compile(expression);
    return undefined;
  } catch (error) {
    return `Invalid jmespath expression: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function omitJmespathArgument(args: Record<string, unknown>): Record<string, unknown> {
  if (!(JMESPATH_TOOL_ARGUMENT in args)) return args;
  const { [JMESPATH_TOOL_ARGUMENT]: _omit, ...rest } = args;
  return rest;
}

export function applyJmespathFilter(data: unknown, expression: string): unknown {
  return jmespath.search(data, expression);
}

export interface ToolResultLike {
  content?: unknown;
  isError?: boolean;
  structuredContent?: unknown;
}

export interface JmespathApplyOptions {
  skipJmespath?: boolean;
  /** When set, applied to parsed JSON before JMESPath (mask-then-filter for response masking). */
  maskValue?: (value: unknown) => unknown;
}

function isContentBlock(value: unknown): value is { type?: unknown; text?: unknown } {
  return Boolean(value && typeof value === "object");
}

function prepareDataForJmespath(data: unknown, maskValue?: (value: unknown) => unknown): unknown {
  return maskValue ? maskValue(data) : data;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** When false, return the tool result unchanged (masking still runs afterward). */
export function shouldApplyJmespathFilter(
  result: ToolResultLike,
  expression: string | undefined,
  options?: JmespathApplyOptions
): boolean {
  return Boolean(expression && !options?.skipJmespath && !result.isError);
}

/**
 * Apply JMESPath to JSON serialized in text content blocks (and structuredContent when present).
 * The handler has already run, so this never turns a result into an error: non-JSON text and
 * evaluation failures return the original result.
 */
export function applyJmespathToToolResult<T extends ToolResultLike>(
  result: T,
  expression: string | undefined,
  options?: JmespathApplyOptions
): T {
  if (!expression || !shouldApplyJmespathFilter(result, expression, options)) return result;
  const maskValue = options?.maskValue;
  const filter = (data: unknown) =>
    applyJmespathFilter(prepareDataForJmespath(data, maskValue), expression);

  try {
    const content = Array.isArray(result.content)
      ? result.content.map(block => {
          if (!isContentBlock(block) || block.type !== "text" || typeof block.text !== "string") {
            return block;
          }
          const parsed = parseJson(block.text);
          return parsed.ok ? { ...block, text: JSON.stringify(filter(parsed.value)) } : block;
        })
      : result.content;
    return result.structuredContent === undefined
      ? { ...result, content }
      : { ...result, content, structuredContent: filter(result.structuredContent) };
  } catch {
    return result;
  }
}
