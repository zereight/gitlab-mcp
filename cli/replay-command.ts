import { readObjectSchema, snakeToKebab } from "./args.js";

const BINARY = "zereight-mcp-gitlab";
// The `cli` line must give the same argv in POSIX sh, cmd.exe (including the .cmd
// shim npm installs on Windows) and PowerShell, and they do not agree on quoting:
// cmd and PowerShell do not read single quotes as POSIX does, cmd expands `%` and
// `!` even inside double quotes, and PowerShell reads `$`, backticks, and Unicode
// quote and dash look-alikes. So no value is escaped. A token goes in the line bare
// or in double quotes, made only of characters none of the three treat specially;
// for any other value the reply carries the argv (`cli_argv`) instead.
const BARE_WORD = /^[A-Za-z0-9._:/=+-]+$/;
const DOUBLE_QUOTED_WORD = /^[A-Za-z0-9 ._:/=+,-]+$/;
const PORTABLE_LINE = /^[A-Za-z0-9 ._:/=+,"-]+$/;
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

/** A `cli` line to paste into a shell, or the argv to run without one. Never both. */
export type ToolReplay = { readonly cli: string } | { readonly cli_argv: readonly string[] };

/** One argv entry: a fixed `--flag=` prefix (or "") and the value text after it. */
interface ReplayWord {
  readonly prefix: string;
  readonly value: string;
}

/**
 * Builds the `zereight-mcp-gitlab tool ...` replay for a compacted reply, or returns
 * undefined when the arguments cannot be replayed. Only keys that the tool's input
 * schema declares become flags; the CLI reads any other flag from the same argv, and
 * names such as `api_url` would then change its configuration.
 */
export function buildToolReplay(
  toolName: string,
  args: Readonly<Record<string, unknown>> | undefined,
  inputSchema: unknown
): ToolReplay | undefined {
  const words = buildReplayWords(toolName, args, inputSchema);
  if (words === undefined) {
    return undefined;
  }
  const cli = portableCommand(words);
  if (cli !== undefined) {
    return { cli };
  }
  return { cli_argv: words.map(word => word.prefix + word.value) };
}

function buildReplayWords(
  toolName: string,
  args: Readonly<Record<string, unknown>> | undefined,
  inputSchema: unknown
): ReplayWord[] | undefined {
  if (!TOOL_NAME.test(toolName)) {
    return undefined;
  }
  const declared = new Set(Object.keys(readObjectSchema(inputSchema).properties ?? {}));
  const words = [BINARY, "tool", toolName].map(plainWord);
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
        words.push(...flagWords(snakeToKebab(key), text));
        continue;
      }
      nested[key] = value;
    }
  }
  if (Object.keys(nested).length > 0) {
    words.push(plainWord("--args-json"), plainWord(JSON.stringify(nested)));
  }
  return words;
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

function plainWord(value: string): ReplayWord {
  return { prefix: "", value };
}

function flagWords(flag: string, value: string): ReplayWord[] {
  // The CLI reads `--flag -x` as a missing value, so a value that starts with a
  // dash goes in the `--flag=value` form, which it parses as one token.
  if (value.startsWith("-")) {
    return [{ prefix: `--${flag}=`, value }];
  }
  return [plainWord(`--${flag}`), plainWord(value)];
}

function portableCommand(words: readonly ReplayWord[]): string | undefined {
  const tokens: string[] = [];
  for (const word of words) {
    const text = portableWord(word.value);
    if (text === undefined) {
      return undefined;
    }
    tokens.push(word.prefix + text);
  }
  const line = tokens.join(" ");
  return PORTABLE_LINE.test(line) ? line : undefined;
}

function portableWord(value: string): string | undefined {
  if (BARE_WORD.test(value)) {
    return value;
  }
  if (DOUBLE_QUOTED_WORD.test(value)) {
    return `"${value}"`;
  }
  return undefined;
}
