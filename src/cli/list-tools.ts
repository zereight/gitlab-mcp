#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-non-null-assertion, no-case-declarations */
import * as fs from "fs";
import * as path from "path";
import { RegistryManager } from "../registry-manager";
import { ToolAvailability } from "../services/ToolAvailability";
import { EnhancedToolDefinition } from "../types";

interface JsonSchemaProperty {
  type?: string;
  $ref?: string;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  enum?: unknown[];
  oneOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  description?: string;
  required?: string[];
  _def?: {
    schema?: {
      _def?: {
        checks?: Array<{ message?: string }>;
      };
    };
  };
  [key: string]: unknown;
}

interface CliOptions {
  format: "markdown" | "json" | "simple" | "export";
  entity?: string;
  tool?: string;
  showEnv?: boolean;
  showEnvGates?: boolean;
  verbose?: boolean;
  detail?: boolean;
  noExamples?: boolean;
  toc?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    format: "markdown",
    showEnv: false,
    showEnvGates: false,
    verbose: false,
    detail: false,
    noExamples: false,
    toc: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--json":
        options.format = "json";
        break;
      case "--simple":
        options.format = "simple";
        break;
      case "--export":
        options.format = "export";
        break;
      case "--entity":
        if (i + 1 >= args.length) {
          console.error("Error: --entity flag requires a value.");
          console.error("Usage: yarn list-tools --entity <entity_name>");
          process.exit(1);
        }
        options.entity = args[++i];
        break;
      case "--tool":
        if (i + 1 >= args.length) {
          console.error("Error: --tool flag requires a value.");
          console.error("Usage: yarn list-tools --tool <tool_name>");
          process.exit(1);
        }
        options.tool = args[++i];
        break;
      case "--env":
        options.showEnv = true;
        break;
      case "--env-gates":
        options.showEnvGates = true;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--detail":
        options.detail = true;
        break;
      case "--no-examples":
        options.noExamples = true;
        break;
      case "--toc":
        options.toc = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Error: Unrecognized option '${arg}'.`);
          console.error("Use '--help' to see available options.");
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
GitLab MCP Tool Lister

Usage: yarn list-tools [options]

Options:
  --json              Output in JSON format
  --simple            Simple list of tool names
  --export            Generate complete TOOLS.md documentation
  --env-gates         Show USE_* environment variable gates
  --entity <name>     Filter by entity (e.g., workitems, labels, mrs)
  --tool <name>       Show details for specific tool
  --env               Show environment configuration
  --verbose, -v       Show additional details
  --detail            Show all tools with their input schemas
  --no-examples       Skip example JSON blocks (for --export)
  --toc               Include table of contents (for --export)
  --help, -h          Show this help

Examples:
  yarn list-tools                                # List all tools in markdown
  yarn list-tools --json                         # JSON output
  yarn list-tools --export                       # Generate TOOLS.md to stdout
  yarn list-tools --export > docs/TOOLS.md       # Generate TOOLS.md to file
  yarn list-tools --export --toc                 # With table of contents
  yarn list-tools --export --no-examples         # Skip example JSON blocks
  yarn list-tools --env-gates                    # Show USE_* variable gates
  yarn list-tools --env-gates --json             # JSON output of gates
  yarn list-tools --entity workitems             # Only work items tools
  yarn list-tools --tool list_work_items         # Specific tool details
  GITLAB_READONLY=true yarn list-tools           # Show read-only tools
  GITLAB_DENIED_TOOLS_REGEX="^create" yarn list-tools  # Test filtering

Environment Variables:
  GITLAB_READONLY              Show only read-only tools
  GITLAB_DENIED_TOOLS_REGEX    Regex pattern to exclude tools
  GITLAB_ALLOWED_TOOLS_REGEX   Regex pattern to include tools
  `);
}

function resolveJsonSchemaType(prop: JsonSchemaProperty, schema: JsonSchemaProperty): string {
  // Handle $ref references
  if (prop.$ref) {
    const refPath = prop.$ref.replace("#/properties/", "");
    const referencedProp = schema.properties?.[refPath];
    if (referencedProp) {
      return resolveJsonSchemaType(referencedProp, schema);
    }
    return "reference";
  }

  // Handle direct type
  if (prop.type) {
    if (prop.type === "array" && prop.items) {
      const itemType = resolveJsonSchemaType(prop.items, schema);
      return `${itemType}[]`;
    }
    return prop.type;
  }

  // Handle enum without explicit type (usually string)
  if (prop.enum) {
    return "enum";
  }

  // Handle union types
  if (prop.oneOf ?? prop.anyOf) {
    const unionTypes =
      (prop.oneOf ?? prop.anyOf)?.map(option => resolveJsonSchemaType(option, schema)) ?? [];
    return unionTypes.join(" | ");
  }

  return "unknown";
}

function getParameterDescription(schema: JsonSchemaProperty): string[] {
  const params: string[] = [];

  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const prop = value;
      const required = schema.required?.includes(key) ?? false;
      const type = resolveJsonSchemaType(prop, schema);
      const description = prop.description ?? "";

      let paramStr = `  - \`${key}\` (${type}${required ? ", required" : ", optional"})`;
      if (description) {
        paramStr += `: ${description}`;
      }
      params.push(paramStr);
    }
  }

  // Handle refinements (like list_work_items with exactly one of groupPath/projectPath)
  if (schema._def?.schema?._def?.checks) {
    const checks = schema._def.schema._def.checks;
    for (const check of checks) {
      if (check.message) {
        params.push(`  - **Validation**: ${check.message}`);
      }
    }
  }

  return params;
}

function printEnvironmentInfo(): void {
  console.log("=== Environment Configuration ===\n");
  console.log(`GITLAB_READONLY: ${process.env.GITLAB_READONLY ?? "false"}`);
  console.log(`GITLAB_DENIED_TOOLS_REGEX: ${process.env.GITLAB_DENIED_TOOLS_REGEX ?? "(not set)"}`);
  console.log(
    `GITLAB_ALLOWED_TOOLS_REGEX: ${process.env.GITLAB_ALLOWED_TOOLS_REGEX ?? "(not set)"}`
  );
  console.log(`GITLAB_API_URL: ${process.env.GITLAB_API_URL ?? "https://gitlab.com"}`);
  console.log();
}

function getToolTierInfo(toolName: string): string {
  const requirement = ToolAvailability.getToolRequirement(toolName);
  if (!requirement) return "";

  const tierBadge =
    {
      free: "Free",
      premium: "Premium",
      ultimate: "Ultimate",
    }[requirement.requiredTier] ?? requirement.requiredTier;

  return `[tier: ${tierBadge}]`;
}

/**
 * Map of entity names to their CQRS tool names.
 * Organization notes:
 * - Core: Project/namespace/commit/event tools (consolidated from 18 to ~11 tools)
 * - Todos: Separate category for list_todos and manage_todos (originally part of core registry
 *   but categorized separately for documentation clarity)
 * - Each entity maps to browse_ and manage_ prefixed tools (or legacy list_ and get_ prefixed)
 */
const ENTITY_TOOLS: Record<string, string[]> = {
  Core: [
    "browse_projects",
    "browse_namespaces",
    "browse_commits",
    "browse_events",
    "create_branch",
    "create_group",
    "manage_repository",
    "list_project_members",
    "list_group_iterations",
    "download_attachment",
    "get_users",
  ],
  "Work Items": ["browse_work_items", "manage_work_item"],
  "Merge Requests": [
    "browse_merge_requests",
    "browse_mr_discussions",
    "manage_merge_request",
    "manage_mr_discussion",
    "manage_draft_notes",
  ],
  Labels: ["browse_labels", "manage_label"],
  Wiki: ["browse_wiki", "manage_wiki"],
  Pipelines: ["browse_pipelines", "manage_pipeline", "manage_pipeline_job"],
  Variables: ["browse_variables", "manage_variable"],
  Milestones: ["browse_milestones", "manage_milestone"],
  Files: ["browse_files", "manage_files"],
  Snippets: ["browse_snippets", "manage_snippet"],
  Webhooks: ["list_webhooks", "manage_webhook"],
  Integrations: ["list_integrations", "manage_integration"],
  Todos: ["list_todos", "manage_todos"],
};

function groupToolsByEntity(tools: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();

  // Build reverse lookup: tool name -> entity
  const toolToEntity = new Map<string, string>();
  for (const [entity, toolNames] of Object.entries(ENTITY_TOOLS)) {
    for (const toolName of toolNames) {
      toolToEntity.set(toolName, entity);
    }
  }

  for (const tool of tools) {
    const entity = toolToEntity.get(tool.name) ?? "Other";

    if (!grouped.has(entity)) {
      grouped.set(entity, []);
    }
    grouped.get(entity)!.push(tool);
  }

  // Sort entities in a logical order
  const entityOrder = [
    "Core",
    "Work Items",
    "Merge Requests",
    "Labels",
    "Milestones",
    "Pipelines",
    "Variables",
    "Files",
    "Wiki",
    "Snippets",
    "Webhooks",
    "Integrations",
    "Todos",
    "Other",
  ];

  const sortedGrouped = new Map<string, any[]>();
  for (const entity of entityOrder) {
    if (grouped.has(entity)) {
      sortedGrouped.set(entity, grouped.get(entity)!);
    }
  }

  return sortedGrouped;
}

interface ActionInfo {
  name: string;
  description: string;
}

interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface ActionParameter extends ParameterInfo {
  requiredForAction: boolean; // Required specifically for this action
}

interface GroupedParameters {
  common: ParameterInfo[]; // Shared across all actions
  byAction: Map<string, ActionParameter[]>; // Action-specific parameters
}

// Action descriptions for documentation generation
const ACTION_DESCRIPTIONS: Record<string, string> = {
  list: "List items with filtering and pagination",
  get: "Get a single item by ID",
  create: "Create a new item",
  update: "Update an existing item",
  delete: "Delete an item",
  search: "Search for items",
  diffs: "Get file changes/diffs",
  compare: "Compare two branches or commits",
  merge: "Merge a merge request",
  approve: "Approve a merge request",
  unapprove: "Remove approval from a merge request",
  rebase: "Rebase a merge request",
  cancel: "Cancel a running operation",
  retry: "Retry a failed operation",
  play: "Run a manual job",
  publish: "Publish draft notes",
  drafts: "List draft notes",
  draft: "Get a single draft note",
  resolve: "Resolve a discussion thread",
  unresolve: "Unresolve a discussion thread",
  note: "Add a note/comment",
  mark_done: "Mark as done",
  mark_pending: "Mark as pending",
  disable: "Disable the integration",
  test: "Test a webhook",
  read: "Read item details",
};

/**
 * Extract actions from a CQRS schema.
 * Tries oneOf branches first (discriminated union), falls back to action.enum (flat schema)
 */
function extractActions(schema: JsonSchemaProperty): ActionInfo[] {
  const actions: ActionInfo[] = [];

  // Try discriminated union (oneOf) first - has richer descriptions
  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    for (const branch of schema.oneOf) {
      const actionProp = branch.properties?.action;
      // In discriminated union, action has "const" instead of "enum"
      const actionName = actionProp?.const as string | undefined;
      if (actionName) {
        // Use description from schema, fallback to ACTION_DESCRIPTIONS
        const description =
          (actionProp?.description as string) ??
          ACTION_DESCRIPTIONS[actionName] ??
          `Perform ${actionName} operation`;
        actions.push({ name: actionName, description });
      }
    }
    return actions;
  }

  // Fallback: flat schema with action enum
  const actionProp = schema.properties?.action;
  if (actionProp?.enum && Array.isArray(actionProp.enum)) {
    for (const actionName of actionProp.enum) {
      if (typeof actionName === "string") {
        const description = ACTION_DESCRIPTIONS[actionName] ?? `Perform ${actionName} operation`;
        actions.push({ name: actionName, description });
      }
    }
  }

  return actions;
}

/**
 * Extract parameters from flat schema.
 * Only called for schemas without oneOf (flat schemas).
 * For oneOf schemas, use extractParametersGrouped which handles them directly.
 */
function extractParameters(schema: JsonSchemaProperty): ParameterInfo[] {
  if (!schema.properties) return [];

  const requiredFields = schema.required ?? [];
  const params: ParameterInfo[] = [];

  for (const [name, prop] of Object.entries(schema.properties)) {
    params.push({
      name,
      type: resolveJsonSchemaType(prop, schema),
      required: requiredFields.includes(name),
      description: prop.description ?? "",
    });
  }

  return sortParameters(params);
}

function sortParameters(params: ParameterInfo[]): ParameterInfo[] {
  return params.sort((a, b) => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    if (a.name === "action") return -1;
    if (b.name === "action") return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Extract parameters grouped by common (all actions) vs action-specific.
 * Returns structured data for human-readable documentation.
 */
function extractParametersGrouped(schema: JsonSchemaProperty): GroupedParameters {
  const result: GroupedParameters = {
    common: [],
    byAction: new Map(),
  };

  // Only works with discriminated unions (oneOf)
  if (!schema.oneOf || !Array.isArray(schema.oneOf)) {
    // Flat schema - all params are "common"
    result.common = extractParameters(schema);
    return result;
  }

  const totalActions = schema.oneOf.length;

  // Track parameter occurrences across actions
  const paramOccurrences = new Map<
    string,
    {
      actions: Map<string, { required: boolean; type: string; description: string }>;
      type: string;
      description: string;
    }
  >();

  // Collect all parameters from all action branches
  for (const branch of schema.oneOf) {
    const actionName = branch.properties?.action?.const as string | undefined;
    if (!actionName || !branch.properties) continue;

    const requiredFields = branch.required ?? [];

    for (const [name, prop] of Object.entries(branch.properties)) {
      if (name === "action") continue; // Skip action field itself

      const type = resolveJsonSchemaType(prop, branch);
      const required = requiredFields.includes(name);
      const description = prop.description ?? "";

      if (!paramOccurrences.has(name)) {
        paramOccurrences.set(name, {
          actions: new Map(),
          type,
          description,
        });
      }

      const occurrence = paramOccurrences.get(name)!;
      occurrence.actions.set(actionName, { required, type, description });
      // Use longer description
      if (description.length > occurrence.description.length) {
        occurrence.description = description;
      }
    }
  }

  // Separate into common vs action-specific
  for (const [name, data] of paramOccurrences) {
    if (data.actions.size === totalActions) {
      // Parameter appears in ALL actions - it's common
      // Required only if required in all actions
      const requiredInAll = Array.from(data.actions.values()).every(a => a.required);
      result.common.push({
        name,
        type: data.type,
        required: requiredInAll,
        description: data.description,
      });
    } else {
      // Parameter is action-specific
      for (const [actionName, actionData] of data.actions) {
        if (!result.byAction.has(actionName)) {
          result.byAction.set(actionName, []);
        }
        result.byAction.get(actionName)!.push({
          name,
          type: actionData.type,
          required: actionData.required,
          requiredForAction: actionData.required,
          description: actionData.description || data.description,
        });
      }
    }
  }

  // Sort parameters
  result.common = sortParameters(result.common);
  for (const [action, params] of result.byAction) {
    result.byAction.set(
      action,
      params.sort((a, b) => {
        if (a.requiredForAction && !b.requiredForAction) return -1;
        if (!a.requiredForAction && b.requiredForAction) return 1;
        return a.name.localeCompare(b.name);
      })
    );
  }

  return result;
}

/**
 * Generate example JSON for a tool based on its schema
 */
function generateExample(schema: JsonSchemaProperty): Record<string, unknown> {
  const example: Record<string, unknown> = {};
  const actions = extractActions(schema);

  // Use first action as default
  if (actions.length > 0) {
    example.action = actions[0].name;
  }

  // For oneOf, use first branch for example
  let targetSchema = schema;
  let requiredFields: string[] = [];

  if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    targetSchema = schema.oneOf[0];
    requiredFields = targetSchema.required ?? [];
  } else if (schema.properties) {
    requiredFields = schema.required ?? [];
  } else {
    return example;
  }

  if (!targetSchema.properties) return example;

  for (const [name, prop] of Object.entries(targetSchema.properties)) {
    if (name === "action") continue; // Already handled

    const isRequired = requiredFields.includes(name);
    const description = (prop.description ?? "").toLowerCase();

    // Only include required fields and some common optional ones
    if (!isRequired) continue;

    // Generate example values based on type and name
    if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
      example[name] = prop.enum[0];
    } else if (name.includes("project_id") || name === "projectId") {
      example[name] = "my-group/my-project";
    } else if (name.includes("group_id") || name === "groupId") {
      example[name] = "my-group";
    } else if (name.includes("namespace")) {
      example[name] = "my-group/my-project";
    } else if (name.includes("_iid") || name === "iid") {
      example[name] = "1";
    } else if (name.includes("_id") || name === "id") {
      example[name] = "123";
    } else if (name === "title") {
      example[name] = "Example title";
    } else if (name === "description") {
      example[name] = "Example description";
    } else if (name === "url") {
      example[name] = "https://example.com/webhook";
    } else if (name === "content") {
      example[name] = "File content here";
    } else if (name === "file_path" || name === "path") {
      example[name] = "path/to/file.txt";
    } else if (name === "ref" || name === "branch") {
      example[name] = "main";
    } else if (name === "from" || name === "to") {
      example[name] = name === "from" ? "main" : "feature-branch";
    } else if (description.includes("boolean") || prop.type === "boolean") {
      example[name] = true;
    } else if (prop.type === "number" || prop.type === "integer") {
      example[name] = 10;
    } else if (prop.type === "array") {
      example[name] = [];
    } else {
      example[name] = `example_${name}`;
    }
  }

  return example;
}

/**
 * Get package version from package.json
 * Looks for exact package name first, falls back to first package.json found
 */
function getPackageVersion(): string {
  try {
    // Find package.json by looking for it from cwd upwards
    let dir = process.cwd();
    let fallbackVersion: string | null = null;

    for (let i = 0; i < 5; i++) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const content = fs.readFileSync(pkgPath, "utf8");
        const pkg = JSON.parse(content) as { version?: string; name?: string };

        // Store first found version as fallback
        if (fallbackVersion === null && pkg.version) {
          fallbackVersion = pkg.version;
        }

        // Verify it's our package (exact match preferred)
        if (pkg.name === "@structured-world/gitlab-mcp") {
          return pkg.version ?? "unknown";
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    // Use fallback version if exact package not found (dev/testing scenarios)
    return fallbackVersion ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Generate complete TOOLS.md content
 */
function generateExportMarkdown(
  tools: any[],
  options: { noExamples?: boolean; toc?: boolean }
): string {
  const lines: string[] = [];
  const version = getPackageVersion();
  const timestamp = new Date().toISOString().split("T")[0];

  // Header
  lines.push("# GitLab MCP Tools Reference");
  lines.push("");
  lines.push("> Auto-generated from source code. Do not edit manually.");
  lines.push(`> Generated: ${timestamp} | Tools: ${tools.length} | Version: ${version}`);
  lines.push("");

  const grouped = groupToolsByEntity(tools);

  // Table of Contents
  if (options.toc) {
    lines.push("## Table of Contents");
    lines.push("");
    for (const [entity, entityTools] of grouped) {
      const anchor = entity.toLowerCase().replace(/\s+/g, "-");
      lines.push(`- [${entity} (${entityTools.length})](#${anchor})`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Tools by category
  for (const [entity, entityTools] of grouped) {
    lines.push(`## ${entity}`);
    lines.push("");

    for (const tool of entityTools) {
      const tierInfo = getToolTierInfo(tool.name);
      const tierDisplay = tierInfo ? ` ${tierInfo}` : "";

      lines.push(`### ${tool.name}${tierDisplay}`);
      lines.push("");
      lines.push(tool.description);
      lines.push("");

      // Actions table
      const actions = extractActions(tool.inputSchema);
      if (actions.length > 0) {
        lines.push("#### Actions");
        lines.push("");
        lines.push("| Action | Description |");
        lines.push("|--------|-------------|");
        for (const action of actions) {
          lines.push(`| \`${action.name}\` | ${action.description} |`);
        }
        lines.push("");
      }

      // Parameters - grouped by common vs action-specific
      const groupedParams = extractParametersGrouped(tool.inputSchema);
      const hasParams = groupedParams.common.length > 0 || groupedParams.byAction.size > 0;

      if (hasParams) {
        lines.push("#### Parameters");
        lines.push("");

        // Common parameters (shared across all actions)
        if (groupedParams.common.length > 0) {
          if (groupedParams.byAction.size > 0) {
            lines.push("**Common** (all actions):");
            lines.push("");
          }
          lines.push("| Parameter | Type | Required | Description |");
          lines.push("|-----------|------|----------|-------------|");
          for (const param of groupedParams.common) {
            const req = param.required ? "Yes" : "No";
            const desc = param.description || "-";
            lines.push(`| \`${param.name}\` | ${param.type} | ${req} | ${desc} |`);
          }
          lines.push("");
        }

        // Action-specific parameters
        if (groupedParams.byAction.size > 0) {
          const sortedActions = Array.from(groupedParams.byAction.keys()).sort();
          for (const actionName of sortedActions) {
            const actionParams = groupedParams.byAction.get(actionName)!;
            if (actionParams.length === 0) continue;

            lines.push(`**Action \`${actionName}\`**:`);
            lines.push("");
            lines.push("| Parameter | Type | Required | Description |");
            lines.push("|-----------|------|----------|-------------|");
            for (const param of actionParams) {
              const req = param.requiredForAction ? "Yes" : "No";
              const desc = param.description || "-";
              lines.push(`| \`${param.name}\` | ${param.type} | ${req} | ${desc} |`);
            }
            lines.push("");
          }
        }
      }

      // Example
      if (!options.noExamples && tool.inputSchema) {
        const example = generateExample(tool.inputSchema);
        if (Object.keys(example).length > 0) {
          lines.push("#### Example");
          lines.push("");
          lines.push("```json");
          lines.push(JSON.stringify(example, null, 2));
          lines.push("```");
          lines.push("");
        }
      }

      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ============================================================================
// Environment Gates Functions
// ============================================================================

interface EnvGateInfo {
  envVar: string;
  defaultValue: boolean;
  tools: string[];
}

/**
 * Extract environment gate information from tool definitions
 */
function extractEnvGates(tools: EnhancedToolDefinition[]): EnvGateInfo[] {
  const gatesMap = new Map<string, EnvGateInfo>();

  for (const tool of tools) {
    if (tool.gate) {
      const existing = gatesMap.get(tool.gate.envVar);
      if (existing) {
        existing.tools.push(tool.name);
      } else {
        gatesMap.set(tool.gate.envVar, {
          envVar: tool.gate.envVar,
          defaultValue: tool.gate.defaultValue,
          tools: [tool.name],
        });
      }
    }
  }

  // Sort by envVar name and return as array
  return Array.from(gatesMap.values()).sort((a, b) => a.envVar.localeCompare(b.envVar));
}

/**
 * Get tools without any gate (always enabled)
 */
function getUngatedTools(tools: EnhancedToolDefinition[]): string[] {
  return tools.filter(tool => !tool.gate).map(tool => tool.name);
}

/**
 * Print env gates in markdown table format
 */
function printEnvGatesMarkdown(
  gates: EnvGateInfo[],
  ungatedTools: string[],
  format: "markdown" | "json"
): void {
  if (format === "json") {
    const output = {
      gates: gates.map(g => ({
        envVar: g.envVar,
        defaultValue: g.defaultValue,
        tools: g.tools,
      })),
      ungated: {
        description: "Core tools (always enabled)",
        tools: ungatedTools,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Markdown format
  console.log("# Environment Variable Gates\n");
  console.log("This table shows which `USE_*` environment variables control which tools.\n");
  console.log("| Variable | Default | Tools Controlled |");
  console.log("|----------|---------|------------------|");

  for (const gate of gates) {
    const defaultStr = gate.defaultValue ? "`true`" : "`false`";
    const toolsStr = gate.tools.map(t => `\`${t}\``).join(", ");
    console.log(`| \`${gate.envVar}\` | ${defaultStr} | ${toolsStr} |`);
  }

  // Show ungated (core) tools
  if (ungatedTools.length > 0) {
    const toolsStr = ungatedTools.map(t => `\`${t}\``).join(", ");
    console.log(`| *(none - always on)* | - | ${toolsStr} |`);
  }

  console.log("\n## Usage\n");
  console.log("Set environment variables to `false` to disable tool groups:\n");
  console.log("```bash");
  console.log("# Disable wiki tools");
  console.log("USE_GITLAB_WIKI=false");
  console.log("");
  console.log("# Disable pipeline tools");
  console.log("USE_PIPELINE=false");
  console.log("```");
}

export async function main() {
  const options = parseArgs();

  if (options.showEnv) {
    printEnvironmentInfo();
  }

  // Get all tools from registry manager
  const registryManager = RegistryManager.getInstance();

  // Handle --env-gates flag
  if (options.showEnvGates) {
    const allTools = registryManager.getAllToolDefinitionsUnfiltered();
    const gates = extractEnvGates(allTools);
    const ungated = getUngatedTools(allTools);
    printEnvGatesMarkdown(gates, ungated, options.format === "json" ? "json" : "markdown");
    return;
  }

  // For export mode: get ALL tools without filtering (for documentation)
  // For other modes: respect env vars filtering
  const toolDefinitions =
    options.format === "export"
      ? registryManager.getAllToolDefinitionsUnfiltered()
      : registryManager.getAllToolDefinitionsTierless();
  const tools = toolDefinitions.map(def => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
  }));

  // Filter by entity if specified
  let filteredTools = tools;
  if (options.entity) {
    const grouped = groupToolsByEntity(tools);
    const entityKey = Array.from(grouped.keys()).find(
      k => k.toLowerCase().replace(/ /g, "") === options.entity!.toLowerCase().replace(/ /g, "")
    );
    filteredTools = entityKey ? (grouped.get(entityKey) ?? []) : [];

    if (filteredTools.length === 0) {
      console.error(`No tools found for entity: ${options.entity}`);
      process.exit(1);
    }
  }

  // Filter by specific tool if specified
  if (options.tool) {
    filteredTools = filteredTools.filter(t => t.name === options.tool);
    if (filteredTools.length === 0) {
      console.error(`Tool not found: ${options.tool}`);
      process.exit(1);
    }
  }

  // Output based on format
  switch (options.format) {
    case "json":
      const output = filteredTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        tier: ToolAvailability.getToolRequirement(tool.name)?.requiredTier ?? "unknown",
        minVersion: ToolAvailability.getToolRequirement(tool.name)?.minVersion,
        parameters: tool.inputSchema,
      }));
      console.log(JSON.stringify(output, null, 2));
      break;

    case "simple":
      filteredTools.forEach(tool => {
        console.log(tool.name);
      });
      break;

    case "export":
      const markdown = generateExportMarkdown(filteredTools, {
        noExamples: options.noExamples,
        toc: options.toc,
      });
      console.log(markdown);
      break;

    case "markdown":
    default:
      if (!options.entity && !options.tool) {
        console.log("# GitLab MCP Tools\n");
        console.log(`Total tools available: ${filteredTools.length}\n`);

        const grouped = groupToolsByEntity(filteredTools);

        // Show summary
        console.log("## Categories\n");
        for (const [entity, entityTools] of grouped) {
          console.log(`- **${entity}**: ${entityTools.length} tools`);
        }
        console.log();

        // Show tools by category
        for (const [entity, entityTools] of grouped) {
          console.log(`## ${entity}\n`);

          for (const tool of entityTools) {
            const tierInfo = getToolTierInfo(tool.name);
            const tierDisplay = tierInfo ? ` ${tierInfo}` : "";
            console.log(`### ${tool.name}${tierDisplay}`);
            console.log(`**Description**: ${tool.description}\n`);

            if ((options.verbose || options.detail) && tool.inputSchema) {
              console.log("**Parameters**:");
              const params = getParameterDescription(tool.inputSchema);
              if (params.length > 0) {
                params.forEach(p => console.log(p));
              } else {
                console.log("  (no parameters)");
              }
              console.log();
            }
          }
        }
      } else {
        // Detailed view for filtered results
        for (const tool of filteredTools) {
          const tierInfo = getToolTierInfo(tool.name);
          const tierDisplay = tierInfo ? ` ${tierInfo}` : "";
          console.log(`## ${tool.name}${tierDisplay}\n`);
          console.log(`**Description**: ${tool.description}\n`);

          if (tool.inputSchema) {
            console.log("**Parameters**:\n");
            const params = getParameterDescription(tool.inputSchema);
            if (params.length > 0) {
              params.forEach(p => console.log(p));
            } else {
              console.log("(no parameters)");
            }
          }
          console.log();
        }
      }
      break;
  }

  if (options.showEnv && options.format === "markdown") {
    console.log("\n---\n");
    console.log("*Note: Tool availability may be affected by environment variables shown above.*");
  }
}

// Auto-execute when script is run directly
if (!process.env.NODE_ENV || process.env.NODE_ENV !== "test") {
  main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });
}
