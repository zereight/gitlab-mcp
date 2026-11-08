#!/usr/bin/env tsx
/**
 * Generate per-group tool reference pages under docs/tools/ from the
 * authoritative tool registry (tools/registry.ts).
 *
 * Run with: npx tsx scripts/generate-tool-docs.ts
 * Or via:   make tools-docs
 */

import { writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  advertisesReadOnly,
  allTools,
  readOnlyTools,
  TOOLSET_DEFINITIONS,
  type ToolsetId,
} from "../tools/registry.js";
import { SLIM_PROFILE_EXCLUDED_TOOLS } from "../tools/tool-profile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "docs", "tools");

// --- Configuration --------------------------------------------------------

interface GroupMeta {
  title: string;
  blurb: string;
}

function isDefaultToolset(id: ToolsetId): boolean {
  return TOOLSET_DEFINITIONS.find(d => d.id === id)?.isDefault ?? false;
}

function isExplicitOnlyToolset(id: ToolsetId): boolean {
  return TOOLSET_DEFINITIONS.find(definition => definition.id === id)?.explicitOnly === true;
}

/** Tools of this group that are already exposed by a default toolset (e.g. `core`). */
function findDefaultOverlap(toolNames: readonly string[]): string[] {
  const defaults = TOOLSET_DEFINITIONS.filter(d => d.isDefault);
  return toolNames.filter(name => defaults.some(d => d.tools.has(name)));
}

function formatDefaultOverlapNote(toolNames: readonly string[]): string {
  const overlap = findDefaultOverlap(toolNames);
  if (overlap.length === 0) return "";
  const list = overlap.map(name => `\`${name}\``).join(", ");
  return ` ${overlap.length} of these tools (${list}) are already enabled by default via \`core\`; the toggle applies to the rest.`;
}

function formatSlimOverlapNote(toolNames: readonly string[]): string {
  const excluded = toolNames.filter(name => SLIM_PROFILE_EXCLUDED_TOOLS.has(name));
  if (excluded.length === 0) return "";
  const skipped =
    excluded.length === toolNames.length
      ? "every tool in this group"
      : `${excluded.length} of these tools (${excluded.map(name => `\`${name}\``).join(", ")})`;
  return ` With \`GITLAB_TOOL_PROFILE=slim\` and \`GITLAB_TOOLSETS\` unset, \`discover_tools\` skips ${skipped}; add a tool name to \`GITLAB_TOOLS\` to expose it. Setting \`GITLAB_TOOLSETS\` disables the slim profile.`;
}

/** The removed USE_PIPELINE also exposed two `ci` tools that the `pipelines` toolset does not include. */
function formatLegacyPipelineNote(id: ToolsetId): string {
  if (id !== "pipelines") return "";
  return " The removed `USE_PIPELINE=true` also exposed `validate_ci_lint` and `validate_project_ci_lint` (toolset `ci`): to keep them, append both to an existing `GITLAB_TOOLS` list, or set `GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint` if it is unset.";
}

/** Returns the availability note for a toolset group, or undefined when it is on by default. */
function computeToggleNote(id: ToolsetId, toolNames: readonly string[] = []): string | undefined {
  if (isDefaultToolset(id)) return undefined;
  if (isExplicitOnlyToolset(id)) {
    return `Explicit opt-in only. Enable by listing \`${id}\` in \`GITLAB_TOOLSETS\` (for example \`GITLAB_TOOLSETS=${id}\` or \`GITLAB_TOOLSETS=core,${id}\`). \`GITLAB_TOOLSETS=all\`, \`discover_tools\`, \`GITLAB_TOOLS\`, and \`GITLAB_TOOL_PROFILE\` do not enable it.`;
  }
  // Synthetic group for tools not in any TOOLSET_DEFINITIONS entry.
  // discover_tools and help are always exposed; execute_graphql is opt-in via GITLAB_TOOLS.
  if ((id as string) === "meta") {
    return "Mixed availability. `discover_tools` and `help` are always exposed (the server re-adds them after every toolset filter). `execute_graphql` is not part of any toolset — enable it explicitly with `GITLAB_TOOLS=execute_graphql`. Tools excluded from the list (toolset / `GITLAB_TOOLS` / `GITLAB_DENIED_TOOLS_REGEX`) are also rejected on direct calls; `GITLAB_TOOL_POLICY_HIDDEN` tools stay callable only while they are otherwise enabled (toolset / `GITLAB_TOOLS` / permission mode) and do not match `GITLAB_DENIED_TOOLS_REGEX`; hiding a tool does not enable it.";
  }
  const overlapNotes = formatDefaultOverlapNote(toolNames) + formatSlimOverlapNote(toolNames);
  return `Opt-in. Prefer \`discover_tools\` at runtime, or persist with \`GITLAB_TOOLSETS=core,${id}\`. An explicit GITLAB_TOOLSETS list replaces core; include core to keep the default set. If you already set \`GITLAB_TOOLSETS\`, append \`${id}\` to your existing list instead of replacing it (leave \`GITLAB_TOOLSETS=all\` unchanged). Avoid \`GITLAB_TOOLSETS=all\` (loads ~all schemas into tools/list).${formatLegacyPipelineNote(id)}${overlapNotes}`;
}

const META_GROUP_ID = "meta";

const GROUP_META: Record<ToolsetId, GroupMeta> = {
  core: {
    title: "Core",
    blurb:
      "Lean default starter set for common MR, issue, repository, branch, project, label, and identity workflows.",
  },
  merge_requests: {
    title: "Merge Requests",
    blurb:
      "MR lifecycle — create, update, merge, approve, plus diff/conflict inspection and the full discussion/note/draft API.",
  },
  issues: {
    title: "Issues",
    blurb: "Issue CRUD, links, discussions and notes, todos, and emoji reactions.",
  },
  repositories: {
    title: "Projects & Files",
    blurb:
      "Project search/creation/fork plus the Files API for reading and writing repository content without shelling out to git.",
  },
  branches: {
    title: "Branches & Commits",
    blurb:
      "Branch management, commit listing/inspection, file blame, and CI commit-status manipulation.",
  },
  projects: {
    title: "Projects & Namespaces",
    blurb: "Project/namespace listing, member queries, group iterations, and server health.",
  },
  labels: {
    title: "Labels",
    blurb: "Project label CRUD.",
  },
  ci: {
    title: "CI Lint",
    blurb: "Validate `.gitlab-ci.yml` snippets and project pipeline configs.",
  },
  groups: {
    title: "Groups",
    blurb: "Create new groups and subgroups.",
  },
  pipelines: {
    title: "Pipelines, Jobs & Deployments",
    blurb:
      "Pipeline + job control (trigger, retry, cancel, play manual jobs, fetch logs/artifacts), project runners, and the deployments/environments view.",
  },
  milestones: {
    title: "Milestones",
    blurb: "Project and group milestone CRUD plus associated issues/MRs and burndown events.",
  },
  wiki: {
    title: "Wiki",
    blurb: "Project and group wiki page CRUD. Attachment uploads where supported.",
  },
  releases: {
    title: "Releases",
    blurb: "Release lifecycle, release evidence, and asset download.",
  },
  tags: {
    title: "Tags",
    blurb: "Tag listing, creation, deletion, signature inspection, and protected tag rules.",
  },
  users: {
    title: "Users & Events",
    blurb:
      "User lookup, the authenticated user (`whoami`), event streams, and markdown attachment upload/download.",
  },
  workitems: {
    title: "Work Items",
    blurb:
      "Modern unified API for issues, tasks, incidents, and other typed work items — including notes, emoji reactions, and incident timeline events.",
  },
  webhooks: {
    title: "Webhooks",
    blurb:
      "Create, update, and delete project or group webhooks, and inspect recent webhook events.",
  },
  search: {
    title: "Search",
    blurb: "Code search across all visible projects, a specific project, or a specific group.",
  },
  variables: {
    title: "Variables",
    blurb: "Project and group CI/CD variable CRUD.",
  },
  dependency_proxy: {
    title: "Dependency Proxy",
    blurb:
      "Inspect and manage the GitLab dependency proxy cache settings, blob storage, and purge operations.",
  },
  vulnerabilities: {
    title: "Vulnerabilities",
    blurb:
      "AI-assisted vulnerability triage — list findings, inspect details, dismiss with reason, or confirm for remediation. Backed by the GitLab GraphQL API; requires GitLab Ultimate.",
  },
  orbit: {
    title: "GitLab Orbit",
    blurb:
      "Query the Orbit SDLC knowledge graph (Beta; Premium/Ultimate). Graph queries consume GitLab credits; schema, status, and tool listing are free.",
  },
  snippets: {
    title: "Snippets",
    blurb:
      "Snippet CRUD — list, get (with optional file content), create, update, and delete personal or project snippets.",
  },
  api: {
    title: "Raw API",
    blurb:
      "Explicit opt-in escape hatch for one GitLab REST call under /api/v4. Not part of core, not enabled by GITLAB_TOOLSETS=all, and not activatable with discover_tools.",
  },
};

const GROUP_ORDER: ToolsetId[] = [
  "core",
  "projects",
  "repositories",
  "branches",
  "groups",
  "merge_requests",
  "issues",
  "labels",
  "workitems",
  "ci",
  "pipelines",
  "milestones",
  "wiki",
  "releases",
  "tags",
  "users",
  "variables",
  "webhooks",
  "search",
  "dependency_proxy",
  "vulnerabilities",
  "orbit",
  "snippets",
  "api",
];

// --- Helpers --------------------------------------------------------------

type JsonSchemaProp = {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  items?: JsonSchemaProp;
  $ref?: string;
  anyOf?: JsonSchemaProp[];
  oneOf?: JsonSchemaProp[];
  format?: string;
};

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
  description?: string;
};

// Authoritative classification — uses the `readOnlyTools` set from
// tools/registry.ts. That set is what the server itself consults to decide
// which tools survive `GITLAB_PERMISSION_MODE=readonly`. `execute_graphql`
// stays in that set so queries still work, but it can mutate in other modes,
// so it is labeled mixed instead of read-only.
function classify(name: string): "read" | "write" | "mixed" {
  if (readOnlyTools.has(name) && !advertisesReadOnly(name)) {
    return "mixed";
  }
  return readOnlyTools.has(name) ? "read" : "write";
}

function rwBadge(name: string): string {
  const kind = classify(name);
  if (kind === "mixed") {
    return "📖✏️ Reads and writes";
  }
  if (kind === "read") {
    return "📖 Read-only";
  }
  return "✏️ Writes";
}

function rwMarker(name: string): string {
  const kind = classify(name);
  if (kind === "mixed") {
    return "📖✏️";
  }
  if (kind === "read") {
    return "📖";
  }
  return "✏️";
}

function describeType(prop: JsonSchemaProp): string {
  if (prop.enum) {
    return `enum (\`${prop.enum.map(String).join("` \\| `")}\`)`;
  }
  if (prop.anyOf || prop.oneOf) {
    const variants = (prop.anyOf || prop.oneOf || []).map(describeType).filter(Boolean);
    return variants.join(" \\| ") || "any";
  }
  if (Array.isArray(prop.type)) {
    return prop.type.join(" \\| ");
  }
  if (prop.type === "array") {
    return `array<${prop.items ? describeType(prop.items) : "any"}>`;
  }
  if (prop.format && prop.type) {
    return `${prop.type} (${prop.format})`;
  }
  return prop.type || "any";
}

function escapePipe(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function paramTable(schema: JsonSchema | undefined): string {
  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return "_No parameters._";
  }
  const required = new Set(schema.required || []);
  const rows: string[] = ["| Parameter | Type | Required | Description |", "|---|---|:-:|---|"];
  for (const [name, prop] of Object.entries(schema.properties)) {
    const type = describeType(prop);
    const req = required.has(name) ? "✓" : "";
    const desc = escapePipe(prop.description || "");
    rows.push(`| \`${name}\` | ${type} | ${req} | ${desc} |`);
  }
  return rows.join("\n");
}

function toolSection(name: string, description: string, schema: JsonSchema | undefined): string {
  return [
    `### \`${name}\``,
    "",
    `*${rwBadge(name)}*`,
    "",
    description,
    "",
    "**Parameters**",
    "",
    paramTable(schema),
    "",
  ].join("\n");
}

function buildGroupPage(id: ToolsetId, toolNames: string[]): string {
  const meta = GROUP_META[id];
  const lines: string[] = [`# ${meta.title}`, "", meta.blurb, ""];
  if (isExplicitOnlyToolset(id)) {
    lines.push(`!!! danger "Raw API escape hatch"`);
    lines.push(
      `    \`gitlab_api_request\` bypasses project allowlists, tool-level restrictions (\`GITLAB_TOOLS\`, \`GITLAB_DENIED_TOOLS_REGEX\` on other tools), and individual tool safety checks. With \`GITLAB_MCP_OAUTH=true\`, the \`GITLAB_OAUTH_ALLOWED_GROUPS\` membership check still decides who may use the server, but an admitted user can request resources outside those groups. The full token permission scope is exposed. Prompt injection in GitLab content can drive this tool. Operators who rely on these restrictions must NOT enable it.`
    );
    lines.push("    ");
    lines.push(
      `    With \`GITLAB_ALLOWED_PROJECT_IDS\` or a session project scope, only \`/projects/:id\` and \`/projects/:id/...\` paths for an allowed project are accepted, on the first request and on every redirect hop that keeps the credentials. Every other path, such as \`/search\`, \`/users\`, \`/groups/:id\`, \`/runners\`, admin endpoints, and the \`/projects\` collection, is rejected. Body and query parameters that name another project (for example \`target_project_id\` or \`from_project_id\`) are not checked. \`GITLAB_PROJECT_ID\` and OAuth group allowlists are not enforced by this tool.`
    );
    lines.push("");
  }
  const toggle = computeToggleNote(id, toolNames);
  if (toggle) {
    lines.push(`!!! note "Feature toggle"`);
    lines.push(`    ${toggle}`);
    lines.push("");
  }

  // Quick index
  lines.push("## Tools in this group");
  lines.push("");
  for (const name of toolNames) {
    lines.push(`- [\`${name}\`](#${name}) — ${rwBadge(name)}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const name of toolNames) {
    const tool = allTools.find(t => t.name === name);
    if (!tool) {
      throw new Error(
        `Tool '${name}' referenced in toolset '${id}' but missing from allTools registry`
      );
    }
    lines.push(toolSection(name, tool.description, tool.inputSchema as JsonSchema));
  }

  return lines.join("\n");
}

function buildToggleSection(groupedToolsList: Array<[ToolsetId, string[]]>): string[] {
  const grouped = groupedToolsList.filter(([id]) => GROUP_META[id]);
  const defaults = grouped.filter(([id]) => isDefaultToolset(id));
  const explicit = grouped.filter(
    ([id]) => isExplicitOnlyToolset(id) && (id as string) !== META_GROUP_ID
  );
  const optins = grouped.filter(
    ([id]) =>
      !isDefaultToolset(id) && !isExplicitOnlyToolset(id) && (id as string) !== META_GROUP_ID
  );
  const meta = grouped.filter(([id]) => (id as string) === META_GROUP_ID);

  const formatList = (items: Array<[ToolsetId, string[]]>): string =>
    items
      .map(([id]) => {
        const slug = id.replace(/_/g, "-");
        return `[${GROUP_META[id].title}](${slug}.md)`;
      })
      .join(", ");

  return [
    "| Status | Groups |",
    "|---|---|",
    `| **Default** — always exposed | ${formatList(defaults)} |`,
    `| **Opt-in** — must be enabled | ${formatList(optins)} |`,
    ...(explicit.length > 0
      ? [
          `| **Explicit opt-in** — not included in \`all\` or \`discover_tools\` | ${formatList(explicit)} |`,
        ]
      : []),
    ...(meta.length > 0
      ? [
          `| **Not a toolset** — \`discover_tools\` and \`help\` are always exposed; \`execute_graphql\` needs \`GITLAB_TOOLS\` | ${formatList(meta)} |`,
        ]
      : []),
    "",
    "**How to enable opt-in groups:**",
    "",
    "- **Preferred (stateful sessions):** call `discover_tools` (omit `category` to list; pass a category to activate for this session). Session-only; with `OAUTH_STATELESS_MODE=true` persist `GITLAB_TOOLSETS=core,<group>` instead. If you already set `GITLAB_TOOLSETS`, append `<group>` to your existing list and keep `core` (leave `GITLAB_TOOLSETS=all` unchanged).",
    "- `GITLAB_TOOLSETS=<group,…>` — persist named toolset IDs. An explicit list replaces `core`; include `core` to keep the default set (for example `GITLAB_TOOLSETS=core,branches`).",
    "- `GITLAB_TOOLS=<tool,…>` — enables individual tools regardless of group, except explicit-only tools such as `gitlab_api_request`.",
    "- `GITLAB_TOOLSETS=all` — loads every discoverable group except `api`. This is expensive (~73k schema tokens). Prefer `discover_tools` (stateful) or a named `GITLAB_TOOLSETS=core,<group>` list.",
    "- `GITLAB_TOOLSETS=merge_requests,issues,repositories,branches,projects,labels,ci,groups,users` — restores the pre-lean default set.",
  ];
}

function buildIndexPage(groupedToolsList: Array<[ToolsetId, string[]]>): string {
  const lines: string[] = [
    "# Tools Reference",
    "",
    "Complete catalog of every tool the GitLab MCP server exposes.",
    "",
    "Which of these have an MCP `tools/call` test is tracked in",
    "[Tool invocation coverage](../reference/tool-coverage.md).",
    "",
    "> **Setup first** — if you haven't connected your Personal Access Token or",
    "> OAuth credentials yet, follow one of the [client setup guides](../clients/claude-code.md)",
    "> or read [Getting Started](../getting-started/index.md). Tools listed below",
    "> will be unavailable until the server is authenticated.",
    "",
    "## Feature toggles",
    "",
    "Toolsets are split into a **default** set (exposed automatically) and an",
    "**opt-in** set (must be explicitly enabled). The lists below are derived",
    "directly from `TOOLSET_DEFINITIONS` in",
    "[`tools/registry.ts`](https://github.com/zereight/gitlab-mcp/blob/main/tools/registry.ts).",
    "",
    ...buildToggleSection(groupedToolsList),
    "",
    "Permission modes control which tools are exposed:",
    "",
    "- `GITLAB_PERMISSION_MODE=readonly` — hides every write tool regardless of toggles. Mixed tools (`execute_graphql`, `gitlab_api_request`) stay listed; their handlers reject writes.",
    "- `GITLAB_PERMISSION_MODE=modify` — allows create/update but blocks delete and teardown tools: every `delete_*` tool, `erase_pipeline_job`, `purge_dependency_proxy_cache`, the destructive teardown verbs `cancel_pipeline`, `cancel_pipeline_job`, `stop_environment`, `stop_stale_environments`, `unprotect_branch`, `unprotect_tag`, plus `push_files` `delete`/`move` actions.",
    "",
    "The `modify` guard applies to typed tools (`tools/list` and `tools/call`) and to destructive mutations sent through `execute_graphql`: any top-level mutation field whose name contains a deletion verb (`delete`, `destroy`, `remove`, `prune`, `purge`, `erase`) or a teardown verb (`revoke`, `cancel`, `stop`, `terminate`, `unprotect`, `disable`, `deactivate`, `drop`, `unschedule`). See [Environment Variables](../configuration/environment-variables.md#gitlab_permission_mode).",
    "",
    "See [Environment Variables](../configuration/environment-variables.md)",
    "and [CLI Arguments](../getting-started/cli-arguments.md) for the full list.",
    "",
    "## Legend",
    "",
    "| Marker | Meaning |",
    "|---|---|",
    "| 📖 | **Read-only** — fetches data, does not modify GitLab state. Safe to invoke freely. |",
    "| 📖✏️ | **Reads and writes** — can query or mutate. `execute_graphql` and `gitlab_api_request` stay available in readonly mode, which rejects their writes. `download_attachment` and `download_job_artifacts` only read GitLab but save files to the local disk in stdio mode; readonly mode lists them and rejects any call that would write a file. |",
    "| ✏️ | **Writes** — creates, updates, or deletes data on GitLab. Confirm intent before running. |",
    "",
    "## Browse by group",
    "",
    "Each group has its own page with full parameter tables — click any tool name to jump to its details, or click the group title for the per-group view.",
    "",
  ];

  for (const [id, tools] of groupedToolsList) {
    const meta = GROUP_META[id];
    const slug = id.replace(/_/g, "-");
    lines.push(`### [${meta.title}](${slug}.md)`);
    lines.push("");
    lines.push(`${meta.blurb} *(${tools.length} tools)*`);
    lines.push("");
    const toggle = computeToggleNote(id, tools);
    if (toggle) {
      lines.push(`> ${toggle}`);
      lines.push("");
    }
    lines.push("| Tool | What it does | R/W |");
    lines.push("|---|---|:-:|");
    for (const name of tools) {
      const tool = allTools.find(t => t.name === name);
      if (!tool) continue;
      const desc = escapePipe(tool.description);
      const marker = rwMarker(name);
      lines.push(`| [\`${name}\`](${slug}.md#${name}) | ${desc} | ${marker} |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Argument schemas");
  lines.push("");
  lines.push("Each group page includes a parameter table per tool, generated from");
  lines.push("the authoritative Zod schemas in");
  lines.push("[`schemas.ts`](https://github.com/zereight/gitlab-mcp/blob/main/schemas.ts).");
  lines.push("To activate extra toolsets at runtime without `GITLAB_TOOLSETS=all`, call");
  lines.push("`discover_tools`.");
  return lines.join("\n");
}

// --- Main -----------------------------------------------------------------

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  // Clean previously generated per-group files (keep index.md until last)
  for (const file of readdirSync(OUT_DIR)) {
    const full = join(OUT_DIR, file);
    if (statSync(full).isFile() && file.endsWith(".md")) {
      unlinkSync(full);
    }
  }

  const grouped: Array<[ToolsetId, string[]]> = [];
  const allCategorizedNames = new Set<string>();

  for (const id of GROUP_ORDER) {
    const def = TOOLSET_DEFINITIONS.find(d => d.id === id);
    if (!def) {
      throw new Error(
        `Toolset '${id}' listed in GROUP_ORDER but missing from TOOLSET_DEFINITIONS — keep them in sync`
      );
    }
    // Preserve insertion order from TOOLSET_DEFINITIONS
    const tools = [...def.tools];
    for (const t of tools) allCategorizedNames.add(t);
    grouped.push([id, tools]);

    const page = buildGroupPage(id, tools);
    const slug = id.replace(/_/g, "-");
    writeFileSync(join(OUT_DIR, `${slug}.md`), page);
    console.log(`generated docs/tools/${slug}.md — ${tools.length} tools`);
  }

  // Tools NOT in any toolset (e.g., execute_graphql, discover_tools)
  const uncategorized = allTools.map(t => t.name).filter(n => !allCategorizedNames.has(n));

  if (uncategorized.length > 0) {
    const metaToggle = computeToggleNote("meta" as ToolsetId);
    const lines: string[] = [
      `# Meta & GraphQL`,
      "",
      "Tools the MCP exposes that aren't tied to a specific GitLab feature group — server diagnostics and the GraphQL escape hatch.",
      "",
    ];
    if (metaToggle) {
      lines.push(`!!! note "Feature toggle"`);
      lines.push(`    ${metaToggle}`);
      lines.push("");
    }
    lines.push("## Tools in this group");
    lines.push("");
    for (const name of uncategorized) {
      lines.push(`- [\`${name}\`](#${name}) — ${rwBadge(name)}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
    for (const name of uncategorized) {
      const tool = allTools.find(t => t.name === name);
      if (!tool) {
        throw new Error(`Uncategorized tool '${name}' missing from allTools registry`);
      }
      lines.push(toolSection(name, tool.description, tool.inputSchema as JsonSchema));
    }
    writeFileSync(join(OUT_DIR, "meta.md"), lines.join("\n"));
    console.log(`generated docs/tools/meta.md — ${uncategorized.length} tools`);
    grouped.push(["meta" as ToolsetId, uncategorized]);
    GROUP_META["meta" as ToolsetId] = {
      title: "Meta & GraphQL",
      blurb: "Server diagnostics, tool discovery, and the GraphQL escape hatch.",
    };
  }

  writeFileSync(join(OUT_DIR, "index.md"), buildIndexPage(grouped));
  console.log(`generated docs/tools/index.md`);

  // Emit nav fragment so you can paste it into mkdocs.yml if needed
  console.log("\n--- mkdocs.yml nav fragment ---");
  console.log("  - Tools:");
  console.log("      - Overview: tools/index.md");
  for (const [id] of grouped) {
    const meta = GROUP_META[id];
    const slug = id.replace(/_/g, "-");
    console.log(`      - ${meta.title}: tools/${slug}.md`);
  }
}

main();
