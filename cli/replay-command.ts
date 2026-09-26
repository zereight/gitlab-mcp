import { snakeToKebab } from "./args.js";

const BINARY = "zereight-mcp-gitlab";
const SIMPLE_SHELL_TOKEN = /^[A-Za-z0-9._:/=+-]+$/;
const SECRET_ARGUMENT_NAMES = new Set([
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

export function buildToolReplayCommand(
  toolName: string,
  args: Readonly<Record<string, unknown>> | undefined
): string {
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
      if (isScalarReplayValue(value)) {
        parts.push(`--${snakeToKebab(key)}`, shellToken(String(value)));
        continue;
      }
      nested[key] = value;
    }
  }
  if (Object.keys(nested).length > 0) {
    parts.push("--args-json", shellToken(JSON.stringify(nested)));
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

function shellToken(value: string): string {
  if (SIMPLE_SHELL_TOKEN.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}
