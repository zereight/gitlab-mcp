export class CliUsageError extends Error {
  readonly exitCode = 2;

  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export type OutputMode = "json" | "table";

export interface ParsedArgv {
  readonly positionals: readonly string[];
  readonly toolFlags: Readonly<Record<string, string>>;
  readonly help: boolean;
  readonly yes: boolean;
  readonly output: OutputMode | undefined;
  readonly argsJson: Readonly<Record<string, unknown>> | undefined;
}

const SCRIPT_PATH_PATTERN = /\.(cjs|mjs|js|cts|mts|ts)$/;
const FLAGS_WITHOUT_VALUE = new Set(["help", "yes"]);

const GLOBAL_FLAG_NAMES = new Set([
  "help",
  "yes",
  "output",
  "args-json",
  "client-id",
  "token-path",
  "token",
  "job-token",
  "cookie-path",
  "use-oauth",
  "is-old",
  "read-only",
  "masking-enabled",
  "masking-config",
  "masking-policy-file",
  "masking-workspace-dir",
  "permission-mode",
  "use-wiki",
  "use-milestone",
  "use-pipeline",
  "disable-version-check",
  "toolsets",
  "tools",
  "tool-policy-approve",
  "tool-policy-hidden",
  "sse",
  "streamable-http",
  "remote-auth",
  "mcp-oauth",
  "allow-unauthenticated-tool-discovery",
  "mcp-trust-proxy",
  "mcp-server-url",
  "oauth-app-id",
  "oauth-scopes",
  "oauth-callback-proxy",
  "allowed-groups",
  "oauth-allowed-groups",
  "enable-dynamic-api-url",
  "enable-dynamic-project-scope",
  "enable-strict-project-scope",
  "oauth-stateless-mode",
  "oauth-stateless-client-ttl",
  "oauth-stateless-pending-ttl",
  "oauth-stateless-stored-ttl",
  "session-timeout",
  "oauth-stateless-session-ttl",
  "host",
  "port",
  "http-proxy",
  "https-proxy",
  "no-proxy",
  "tls-reject-unauthorized",
  "ca-cert-path",
  "pool-max-size",
  "api-url",
  "denied-tools-regex",
]);

interface JsonSchemaProperty {
  readonly type?: unknown;
  readonly description?: unknown;
}

export interface JsonObjectSchema {
  readonly type?: unknown;
  readonly properties?: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required?: readonly string[];
  readonly description?: unknown;
}

interface FlagToken {
  readonly name: string;
  readonly inline: string | undefined;
}

export function kebabToSnake(value: string): string {
  return value.replace(/-/g, "_");
}

export function snakeToKebab(value: string): string {
  return value.replace(/_/g, "-");
}

export function argvHasHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export function parseArgv(argv: readonly string[]): ParsedArgv {
  const userArgs = userArgv(argv);
  const positionals: string[] = [];
  const toolFlags: Record<string, string> = {};
  let help = false;
  let yes = false;
  let output: OutputMode | undefined;
  let argsJson: Readonly<Record<string, unknown>> | undefined;

  for (let i = 0; i < userArgs.length; i += 1) {
    const current = userArgs[i];
    const flag = readFlag(current);
    if (flag === undefined) {
      if (current.startsWith("-")) {
        throw new CliUsageError(`Unknown flag: ${current}`);
      }
      positionals.push(current);
      continue;
    }

    if (flag.name === "help") {
      help = true;
      continue;
    }
    if (flag.name === "yes") {
      yes = true;
      continue;
    }

    const value = flag.inline ?? takeFlagValue(userArgs, i, flag.name);
    if (flag.inline === undefined && !FLAGS_WITHOUT_VALUE.has(flag.name)) {
      i += 1;
    }

    if (flag.name === "output") {
      output = parseOutputMode(value);
      continue;
    }
    if (flag.name === "args-json") {
      argsJson = parseArgsJson(value);
      continue;
    }
    if (GLOBAL_FLAG_NAMES.has(flag.name)) {
      continue;
    }
    toolFlags[kebabToSnake(flag.name)] = value;
  }

  return { positionals, toolFlags, help, yes, output, argsJson };
}

export function applyFlagAliases(
  flags: Readonly<Record<string, string>>,
  aliases: Readonly<Record<string, string>> | undefined
): Record<string, string> {
  if (aliases === undefined) {
    return { ...flags };
  }
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(flags)) {
    const target = aliases[key] ?? key;
    mapped[target] = value;
  }
  return mapped;
}

export function parseToolArgs(input: {
  schema: unknown;
  flags: Readonly<Record<string, string>>;
  argsJson: Readonly<Record<string, unknown>> | undefined;
  extraArgs: Readonly<Record<string, unknown>> | undefined;
}): Record<string, unknown> {
  const schema = readObjectSchema(input.schema);
  const propertyNames = schema.properties === undefined ? new Set<string>() : new Set(Object.keys(schema.properties));
  const unknownFlags = Object.keys(input.flags).filter(name => !propertyNames.has(name));
  if (unknownFlags.length > 0) {
    throw new CliUsageError(
      `Unknown flag: --${snakeToKebab(unknownFlags[0] ?? "")}`
    );
  }

  const args: Record<string, unknown> = {};
  assignOwn(args, input.argsJson);
  for (const [key, value] of Object.entries(input.flags)) {
    args[key] = value;
  }
  assignOwn(args, input.extraArgs);

  const required = schema.required ?? [];
  const missing = required.filter(name => args[name] === undefined);
  if (missing.length === 1) {
    throw new CliUsageError(`Missing required flag: --${snakeToKebab(missing[0] ?? "")}`);
  }
  if (missing.length > 1) {
    throw new CliUsageError(
      `Missing required flags: ${missing.map(name => `--${snakeToKebab(name)}`).join(", ")}`
    );
  }

  return args;
}

export function readObjectSchema(schema: unknown): JsonObjectSchema {
  if (!isObject(schema)) {
    return {};
  }
  const propertiesValue = schema.properties;
  const requiredValue = schema.required;
  const properties = isObject(propertiesValue)
    ? Object.fromEntries(
        Object.entries(propertiesValue).flatMap(([key, value]) =>
          isObject(value) ? [[key, value]] : []
        )
      )
    : undefined;
  const required = Array.isArray(requiredValue)
    ? requiredValue.filter((item): item is string => typeof item === "string")
    : undefined;
  return {
    type: schema.type,
    properties,
    required,
    description: schema.description,
  };
}

export function isCliOutputMode(value: string): value is OutputMode {
  return value === "json" || value === "table";
}

function userArgv(argv: readonly string[]): readonly string[] {
  const args = argv.slice(2);
  const start = args.findIndex(arg => !arg.startsWith("-") && SCRIPT_PATH_PATTERN.test(arg));
  if (start >= 0) {
    return args.slice(start + 1);
  }
  return args;
}

function readFlag(arg: string): FlagToken | undefined {
  if (arg === "-h") {
    return { name: "help", inline: undefined };
  }
  if (!arg.startsWith("--") || arg === "--") {
    return undefined;
  }
  const body = arg.slice(2);
  const separator = body.indexOf("=");
  if (separator === -1) {
    return { name: body, inline: undefined };
  }
  return {
    name: body.slice(0, separator),
    inline: body.slice(separator + 1),
  };
}

function takeFlagValue(args: readonly string[], index: number, flagName: string): string {
  if (FLAGS_WITHOUT_VALUE.has(flagName)) {
    return "true";
  }
  const next = args[index + 1];
  if (next === undefined || next.startsWith("-")) {
    throw new CliUsageError(`Missing value for --${flagName}`);
  }
  return next;
}

function parseOutputMode(value: string): OutputMode {
  if (isCliOutputMode(value)) {
    return value;
  }
  throw new CliUsageError("--output must be table or json");
}

function parseArgsJson(raw: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) {
      throw new CliUsageError("--args-json must be a JSON object");
    }
    const copy: Record<string, unknown> = {};
    assignOwn(copy, parsed);
    return copy;
  } catch (error) {
    if (error instanceof CliUsageError) {
      throw error;
    }
    throw new CliUsageError("Invalid --args-json");
  }
}

function assignOwn(
  target: Record<string, unknown>,
  source: Readonly<Record<string, unknown>> | object | undefined
): void {
  if (source === undefined) {
    return;
  }
  for (const key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    target[key] = Reflect.get(source, key);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
