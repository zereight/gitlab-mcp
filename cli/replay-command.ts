import { readObjectSchema, snakeToKebab } from "./args.js";

const BINARY = "zereight-mcp-gitlab";
// Words that POSIX sh passes through unchanged. Anything else is single-quoted.
const SIMPLE_SHELL_WORD = /^[A-Za-z0-9._:/=+-]+$/;
const TOOL_NAME = /^[a-z][a-z0-9_]*$/;
const ARGUMENT_NAME = /^[a-z][a-z0-9_]*$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
export const SECRET_ARGUMENT_NAMES = new Set([
  "token",
  "job_token",
  "private_token",
  "access_token",
  "cookie",
  "cookie_path",
  "password",
  "signing_token",
  "authorization",
]);

/**
 * Builds the `zereight-mcp-gitlab tool ...` line for a compacted reply, or returns
 * undefined when no safe line exists. Every token is either a plain word or
 * single-quoted, so the line is inert when a shell runs it. Only keys that the
 * tool's input schema declares become flags; the CLI reads any other flag from
 * the same argv, and names such as `api_url` would then change its configuration.
 */
export function buildToolReplayCommand(
  toolName: string,
  args: Readonly<Record<string, unknown>> | undefined,
  inputSchema: unknown
): string | undefined {
  if (!TOOL_NAME.test(toolName)) {
    return undefined;
  }
  const declared = new Set(Object.keys(readObjectSchema(inputSchema).properties ?? {}));
  const parts = [BINARY, "tool", toolName];
  const nested: Record<string, unknown> = {};
  if (args !== undefined) {
    for (const key of Object.keys(args)) {
      if (shouldOmitReplayArgument(key)) {
        continue;
      }
      const value = Reflect.get(args, key);
      if (value === undefined) {
        continue;
      }
      if (!ARGUMENT_NAME.test(key) || !declared.has(key)) {
        return undefined;
      }
      if (isScalarReplayValue(value)) {
        const text = String(value);
        // argv cannot carry a NUL byte, and a lone surrogate does not survive UTF-8.
        if (text.includes("\0") || LONE_SURROGATE.test(text)) {
          return undefined;
        }
        parts.push(...flagTokens(snakeToKebab(key), text));
        continue;
      }
      nested[key] = value;
    }
  }
  if (Object.keys(nested).length > 0) {
    parts.push("--args-json", shellWord(JSON.stringify(nested)));
  }
  return parts.join(" ");
}

function shouldOmitReplayArgument(name: string): boolean {
  if (name.startsWith("_")) {
    return true;
  }
  return SECRET_ARGUMENT_NAMES.has(name);
}

function isScalarReplayValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function flagTokens(flag: string, value: string): string[] {
  // The CLI reads `--flag -x` as a missing value, so a value that starts with a
  // dash goes in the `--flag=value` form, which it parses as one token.
  if (value.startsWith("-")) {
    return [`--${flag}=${shellWord(value)}`];
  }
  return [`--${flag}`, shellWord(value)];
}

function shellWord(value: string): string {
  if (SIMPLE_SHELL_WORD.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}
