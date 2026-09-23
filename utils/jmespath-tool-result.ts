import jmespath from "jmespath";

/** MCP-only argument; stripped before GitLab handlers run (issue #766). */
export const JMESPATH_TOOL_ARGUMENT = "jmespath";

export const JMESPATH_TOOL_ARGUMENT_DESCRIPTION =
  "Optional JMESPath expression filtering the JSON result before return.";

export function readJmespathExpression(args: Record<string, unknown> | undefined): string | undefined {
  if (!args) return undefined;
  const raw = args[JMESPATH_TOOL_ARGUMENT];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

/** When false, return the tool result unchanged (masking still runs afterward). */
export function shouldApplyJmespathFilter(
  result: ToolResultLike,
  expression: string | undefined,
  options?: JmespathApplyOptions
): boolean {
  return Boolean(expression && !options?.skipJmespath && !result.isError);
}

/** Apply JMESPath to JSON serialized in text content blocks (and structuredContent when present). */
export function applyJmespathToToolResult<T extends ToolResultLike>(
  result: T,
  expression: string | undefined,
  options?: JmespathApplyOptions
): T {
  if (!shouldApplyJmespathFilter(result, expression, options)) return result;
  const expr = expression as string;
  const { maskValue } = options ?? {};

  try {
    const output: ToolResultLike = { ...result };

    if (Array.isArray(output.content)) {
      output.content = output.content.map(block => {
        if (!isContentBlock(block) || block.type !== "text" || typeof block.text !== "string") {
          return block;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(block.text);
        } catch {
          throw new Error(
            "jmespath was provided but tool result is not JSON text; omit jmespath or use a JSON-returning tool"
          );
        }
        const filtered = applyJmespathFilter(prepareDataForJmespath(parsed, maskValue), expr);
        return { ...block, text: JSON.stringify(filtered) };
      });
    }

    if (output.structuredContent !== undefined) {
      output.structuredContent = applyJmespathFilter(
        prepareDataForJmespath(output.structuredContent, maskValue),
        expr
      );
    }

    return output as T;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply jmespath filter to tool result";
    return {
      content: [{ type: "text", text: message }],
      isError: true,
    } as T;
  }
}
