import { GITLAB_PERMISSION_MODE, type GitLabPermissionMode } from "../config.js";
import { allTools, deleteTools, destructiveTools, readOnlyTools } from "../tools/registry.js";
import { getPositionalCliCommand } from "../cli-command.js";
import {
  applyFlagAliases,
  argvHasHelp,
  CliUsageError,
  parseArgv,
  parseToolArgs,
  type OutputMode,
} from "./args.js";
import {
  canonicalGroup,
  findCuratedCommand,
  isKnownCliCommand,
  resolveScopedTool,
  type TableSpec,
} from "./curated.js";
import {
  curatedHelpText,
  globalHelpText,
  groupHelpText,
  toolHelpText,
  toolIndexHelpText,
} from "./help.js";

export type CliResolution =
  | { readonly kind: "server" }
  | { readonly kind: "auth" }
  | { readonly kind: "help"; readonly text: string }
  | { readonly kind: "usage"; readonly message: string }
  | { readonly kind: "refused"; readonly message: string }
  | {
      readonly kind: "run";
      readonly toolName: string;
      readonly args: Readonly<Record<string, unknown>>;
      readonly output: OutputMode;
      readonly tableSpec: TableSpec | undefined;
    };

export function isCliInvocation(argv: readonly string[]): boolean {
  if (argvHasHelp(argv)) {
    return true;
  }
  const positional = getPositionalCliCommand(argv);
  if (positional === undefined) {
    return false;
  }
  return isKnownCliCommand(positional);
}

export function resolveCli(
  argv: readonly string[],
  options: { permissionMode?: GitLabPermissionMode } = {}
): CliResolution {
  try {
    return resolveCliUnsafe(argv, options.permissionMode ?? GITLAB_PERMISSION_MODE);
  } catch (error) {
    if (error instanceof CliUsageError) {
      return { kind: "usage", message: error.message };
    }
    throw error;
  }
}

function resolveCliUnsafe(argv: readonly string[], permissionMode: GitLabPermissionMode): CliResolution {
  const parsed = parseArgv(argv);
  const [head, action, extra] = parsed.positionals;

  if (head === undefined) {
    if (parsed.help) {
      return { kind: "help", text: globalHelpText() };
    }
    return { kind: "server" };
  }

  if (head === "auth") {
    return { kind: "auth" };
  }

  if (head === "tool") {
    if (extra !== undefined) {
      return { kind: "usage", message: `Unexpected extra arguments: ${parsed.positionals.slice(2).join(" ")}` };
    }
    if (action === undefined) {
      if (parsed.help) {
        return { kind: "help", text: toolIndexHelpText() };
      }
      return { kind: "usage", message: `Usage: zereight-mcp-gitlab tool <tool-name> [options]` };
    }
    if (parsed.help) {
      return { kind: "help", text: toolHelpText(action) };
    }
    return buildRun({
      toolName: action,
      flags: parsed.toolFlags,
      argsJson: parsed.argsJson,
      extraArgs: undefined,
      output: parsed.output ?? "json",
      yes: parsed.yes,
      permissionMode,
      tableSpec: undefined,
    });
  }

  const group = canonicalGroup(head);
  if (group === undefined) {
    if (parsed.help) {
      return { kind: "help", text: globalHelpText() };
    }
    return { kind: "server" };
  }

  if (extra !== undefined) {
    return { kind: "usage", message: `Unexpected extra arguments: ${parsed.positionals.slice(2).join(" ")}` };
  }

  if (action === undefined) {
    return { kind: "help", text: groupHelpText(group) };
  }
  if (parsed.help) {
    return { kind: "help", text: curatedHelpText(group, action) };
  }

  const command = findCuratedCommand(group, action);
  if (command === undefined) {
    return { kind: "usage", message: `Unknown command: ${head} ${action}` };
  }

  const aliased = applyFlagAliases(parsed.toolFlags, command.flagAliases);
  const scopeArgs = {
    ...(parsed.argsJson ?? {}),
    ...aliased,
    ...(command.extraArgs ?? {}),
  };
  const toolName = resolveScopedTool(command, scopeArgs);
  return buildRun({
    toolName,
    flags: aliased,
    argsJson: parsed.argsJson,
    extraArgs: command.extraArgs,
    output: parsed.output ?? "table",
    yes: parsed.yes,
    permissionMode,
    tableSpec: command.table,
  });
}

function buildRun(input: {
  toolName: string;
  flags: Readonly<Record<string, string>>;
  argsJson: Readonly<Record<string, unknown>> | undefined;
  extraArgs: Readonly<Record<string, unknown>> | undefined;
  output: OutputMode;
  yes: boolean;
  permissionMode: GitLabPermissionMode;
  tableSpec: TableSpec | undefined;
}): CliResolution {
  if (input.toolName === "discover_tools") {
    return { kind: "usage", message: "discover_tools is MCP-only; every registry tool is available via `tool <name>`" };
  }
  const tool = allTools.find(entry => entry.name === input.toolName);
  if (tool === undefined) {
    return { kind: "usage", message: `Unknown tool: ${input.toolName}` };
  }

  const args = parseToolArgs({
    schema: tool.inputSchema,
    flags: input.flags,
    argsJson: input.argsJson,
    extraArgs: input.extraArgs,
  });

  const permissionMessage = permissionRefusal(input.toolName, input.permissionMode);
  if (permissionMessage !== undefined) {
    return { kind: "refused", message: permissionMessage };
  }

  if (destructiveTools.has(input.toolName) && !input.yes) {
    return {
      kind: "refused",
      message: `Would run ${input.toolName} with arguments [${Object.keys(args).join(", ")}]. Re-run with --yes to proceed.`,
    };
  }

  return {
    kind: "run",
    toolName: input.toolName,
    args,
    output: input.output,
    tableSpec: input.tableSpec,
  };
}

function permissionRefusal(toolName: string, permissionMode: GitLabPermissionMode): string | undefined {
  if (permissionMode === "readonly" && !readOnlyTools.has(toolName)) {
    return `${toolName} is not allowed in read-only mode`;
  }
  if (permissionMode === "modify" && deleteTools.has(toolName)) {
    return `${toolName} is not allowed in modify mode (delete operations are disabled)`;
  }
  return undefined;
}
