import { allTools } from "../tools/registry.js";
import { readObjectSchema, snakeToKebab } from "./args.js";
import { CURATED_COMMANDS, listGroupActions, listGroups } from "./curated.js";

const BINARY = "zereight-mcp-gitlab";

export function globalHelpText(): string {
  const groups = listGroups().map(group => `  ${group}`).join("\n");
  return `${BINARY} — GitLab MCP server and human CLI

Usage:
  ${BINARY} auth [options]
  ${BINARY} tool <tool-name> [options]
  ${BINARY} <group> <action> [options]
  ${BINARY} --help

Global flags:
  --output table|json   Output format (table default for curated, json for tool)
  --yes                 Confirm destructive commands
  --args-json '{...}'   Nested/array arguments
  --token TOKEN         GitLab personal access token
  --api-url URL         GitLab API URL
  --permission-mode     readonly | modify | full

Groups:
${groups}

Advanced: ${BINARY} tool <name> covers every registry tool. Curated commands are the daily path.
`;
}

export function groupHelpText(group: string): string {
  const commands = listGroupActions(group);
  if (commands.length === 0) {
    return `Unknown group: ${group}\n`;
  }
  const lines = commands.map(command => `  ${command.group} ${command.action}    ${command.tool}`);
  return `${BINARY} ${group}

Usage:
  ${BINARY} ${group} <action> [options]
  ${BINARY} ${group} <action> --help

Actions:
${lines.join("\n")}
`;
}

export function toolHelpText(toolName: string): string {
  const tool = allTools.find(entry => entry.name === toolName);
  if (tool === undefined || toolName === "discover_tools") {
    return `Unknown tool: ${toolName}\n`;
  }
  const schema = readObjectSchema(tool.inputSchema);
  const description = typeof tool.description === "string" ? tool.description : "";
  const flags = formatSchemaFlags(schema.properties, schema.required ?? []);
  return `${BINARY} tool ${toolName}

${description}

Flags:
${flags}
  --output json|table
  --args-json '{...}'
`;
}

export function curatedHelpText(group: string, action: string): string {
  const command = CURATED_COMMANDS.find(entry => entry.group === group && entry.action === action);
  if (command === undefined) {
    return `Unknown command: ${group} ${action}\n`;
  }
  const tool = allTools.find(entry => entry.name === command.tool);
  const schema = readObjectSchema(tool?.inputSchema);
  const flags = formatSchemaFlags(schema.properties, schema.required ?? [], command.flagAliases);
  return `${BINARY} ${group} ${action}

Maps to ${command.tool}${command.scope ? ` (or ${command.scope.groupTool} with --group-id)` : ""}

Flags:
${flags}
  --output table|json
  --yes
`;
}

export function toolIndexHelpText(): string {
  const names = allTools
    .filter(tool => tool.name !== "discover_tools")
    .map(tool => `  ${tool.name}`)
    .join("\n");
  return `${BINARY} tool <tool-name> [options]

Default output is JSON. Use --help after a tool name for generated flags.

Tools:
${names}
`;
}

function formatSchemaFlags(
  properties: Readonly<Record<string, { readonly description?: unknown }>> | undefined,
  required: readonly string[],
  aliases?: Readonly<Record<string, string>>
): string {
  if (properties === undefined || Object.keys(properties).length === 0) {
    return "  (none)";
  }
  const requiredSet = new Set(required);
  const aliasHints = aliases === undefined ? [] : Object.entries(aliases).map(
    ([shortName, fullName]) => `  --${snakeToKebab(shortName)}    alias for --${snakeToKebab(fullName)}`
  );
  const flags = Object.entries(properties).map(([name, property]) => {
    const suffix = requiredSet.has(name) ? " (required)" : "";
    const description = typeof property.description === "string" ? `  ${property.description}` : "";
    return `  --${snakeToKebab(name)}${suffix}${description}`;
  });
  return [...flags, ...aliasHints].join("\n");
}
