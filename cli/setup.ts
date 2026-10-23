import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CliUsageError } from "./args.js";

export type SetupClient = "cursor" | "claude";

export interface SetupOptions {
  readonly client: SetupClient;
  readonly oauth: boolean;
  readonly write: boolean;
  readonly skill: boolean;
  readonly directory: string;
  readonly apiUrl: string;
}

export interface SetupResult {
  readonly text: string;
  readonly writtenPath?: string;
}

const DEFAULT_API_URL = "https://gitlab.com/api/v4";
const SKILL_INSTALL = "npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill";

export function setupHelpText(): string {
  return `zereight-mcp-gitlab setup

Print (or write) a local MCP client config. Tokens stay in the environment.

Usage:
  zereight-mcp-gitlab setup --cursor [--oauth] [--write] [--dir PATH]
  zereight-mcp-gitlab setup --claude [--oauth] [--write]
  zereight-mcp-gitlab setup --help

Flags:
  --cursor    Cursor mcp.json snippet (default path .cursor/mcp.json)
  --claude    Claude Code one-liner (claude mcp add)
  --oauth     Use GITLAB_USE_OAUTH instead of a PAT
  --write     Write the Cursor file or print the Claude command as the install step
  --skill     Also print the Agent Skill install command
  --dir PATH  Directory that contains .cursor/mcp.json (default: cwd)
  --api-url   GitLab API URL (default ${DEFAULT_API_URL})

Dry-run is the default. --write is required to create or merge .cursor/mcp.json.
`;
}

export function readSetupOptions(
  flags: Readonly<Record<string, string>>,
  directory = process.cwd()
): SetupOptions {
  const cursor = flags.cursor === "true";
  const claude = flags.claude === "true";
  if (cursor === claude) {
    throw new CliUsageError("setup requires exactly one of --cursor or --claude");
  }
  return {
    client: cursor ? "cursor" : "claude",
    oauth: flags.oauth === "true" || flags.use_oauth === "true",
    write: flags.write === "true",
    skill: flags.skill === "true",
    directory: flags.dir ?? directory,
    apiUrl: flags.api_url ?? DEFAULT_API_URL,
  };
}

export function cursorMcpConfig(options: SetupOptions): Record<string, unknown> {
  const env: Record<string, string> = {
    GITLAB_API_URL: options.apiUrl,
  };
  if (options.oauth) {
    env.GITLAB_USE_OAUTH = "true";
  } else {
    env.GITLAB_PERSONAL_ACCESS_TOKEN = "${env:GITLAB_PERSONAL_ACCESS_TOKEN}";
  }
  return {
    mcpServers: {
      gitlab: {
        command: "zereight-mcp-gitlab",
        env,
      },
    },
  };
}

export function claudeMcpAddCommand(options: SetupOptions): string {
  const envFlags = options.oauth
    ? `--env GITLAB_USE_OAUTH=true --env GITLAB_API_URL=${options.apiUrl}`
    : `--env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=${options.apiUrl}`;
  return `claude mcp add gitlab --transport stdio --scope local ${envFlags} -- zereight-mcp-gitlab`;
}

export function runSetup(options: SetupOptions): SetupResult {
  switch (options.client) {
    case "cursor":
      return runCursorSetup(options);
    case "claude":
      return runClaudeSetup(options);
    default: {
      const exhaustive: never = options.client;
      throw new Error(`Unhandled setup client: ${String(exhaustive)}`);
    }
  }
}

function runCursorSetup(options: SetupOptions): SetupResult {
  const snippet = cursorMcpConfig(options);
  const target = join(options.directory, ".cursor", "mcp.json");
  const body = `${JSON.stringify(snippet, null, 2)}\n`;
  const skillLine = options.skill ? `\nSkill: ${SKILL_INSTALL}\n` : "";
  if (!options.write) {
    return {
      text: `Dry-run Cursor config (pass --write to merge ${target}):\n${body}` + skillLine,
    };
  }
  const merged = mergeMcpJson(readJsonFile(target), snippet);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`);
  return {
    text: `Wrote ${target}\n${skillLine}`,
    writtenPath: target,
  };
}

function runClaudeSetup(options: SetupOptions): SetupResult {
  const command = claudeMcpAddCommand(options);
  const skillLine = options.skill ? `\nSkill: ${SKILL_INSTALL}\n` : "";
  return {
    text: `${command}\n${skillLine}`,
  };
}

function readJsonFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CliUsageError(`${path} is not a JSON object`);
  }
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    copy[key] = value;
  }
  return copy;
}

function mergeMcpJson(
  existing: Record<string, unknown>,
  snippet: Record<string, unknown>
): Record<string, unknown> {
  const existingServers =
    typeof existing.mcpServers === "object" &&
    existing.mcpServers !== null &&
    !Array.isArray(existing.mcpServers)
      ? existing.mcpServers
      : {};
  const snippetServers =
    typeof snippet.mcpServers === "object" &&
    snippet.mcpServers !== null &&
    !Array.isArray(snippet.mcpServers)
      ? snippet.mcpServers
      : {};
  return {
    ...existing,
    mcpServers: {
      ...existingServers,
      ...snippetServers,
    },
  };
}
