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

import { allTools, TOOLSET_DEFINITIONS, type ToolsetId } from "../tools/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "docs", "tools");

// --- Configuration --------------------------------------------------------

interface GroupMeta {
  title: string;
  blurb: string;
  toggleNote?: string;
}

const GROUP_META: Record<ToolsetId, GroupMeta> = {
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
      "Pipeline + job control (trigger, retry, cancel, play manual jobs, fetch logs/artifacts), and the deployments/environments view.",
    toggleNote:
      "Gated by `USE_PIPELINE=true`. Disabled by default; enable to expose this entire group.",
  },
  milestones: {
    title: "Milestones",
    blurb: "Project milestone CRUD plus associated issues/MRs and burndown events.",
    toggleNote:
      "Gated by `USE_MILESTONE=true`. Disabled by default; enable to expose this entire group.",
  },
  wiki: {
    title: "Wiki",
    blurb: "Project and group wiki page CRUD. Attachment uploads where supported.",
    toggleNote:
      "Gated by `USE_GITLAB_WIKI=true`. Disabled by default; enable to expose this entire group.",
  },
  releases: {
    title: "Releases",
    blurb: "Release lifecycle, release evidence, and asset download.",
  },
  tags: {
    title: "Tags",
    blurb: "Tag listing, creation, deletion, and signature inspection.",
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
    blurb: "List webhooks configured on projects or groups, and inspect recent webhook events.",
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
};

const GROUP_ORDER: ToolsetId[] = [
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

const READ_PREFIXES = [
  "list_",
  "get_",
  "search_",
  "validate_",
  "verify_",
  "download_",
  "discover_",
  "my_",
];
const READ_EXACT = new Set(["whoami", "health_check", "mr_discussions"]);

function classify(name: string): "read" | "write" {
  if (READ_EXACT.has(name)) return "read";
  if (READ_PREFIXES.some(p => name.startsWith(p))) return "read";
  return "write";
}

function rwBadge(name: string): string {
  return classify(name) === "read" ? "📖 Read-only" : "✏️ Writes";
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
  if (meta.toggleNote) {
    lines.push(`!!! note "Feature toggle"`);
    lines.push(`    ${meta.toggleNote}`);
    lines.push("");
  }

  // Quick index
  lines.push("## Tools in this group");
  lines.push("");
  for (const name of toolNames) {
    lines.push(`- [\`${name}\`](#${name.replace(/_/g, "_")}) — ${rwBadge(name)}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const name of toolNames) {
    const tool = allTools.find(t => t.name === name);
    if (!tool) {
      console.warn(`Tool ${name} listed in toolset ${id} but missing from allTools`);
      continue;
    }
    lines.push(toolSection(name, tool.description, tool.inputSchema as JsonSchema));
  }

  return lines.join("\n");
}

function buildIndexPage(groupedToolsList: Array<[ToolsetId, string[]]>): string {
  const lines: string[] = [
    "# Tools Reference",
    "",
    "Complete catalog of every tool the GitLab MCP server exposes.",
    "",
    "> **Setup first** — if you haven't connected your Personal Access Token or",
    "> OAuth credentials yet, follow one of the [client setup guides](../clients/claude-code.md)",
    "> or read [Getting Started](../getting-started/index.md). Tools listed below",
    "> will be unavailable until the server is authenticated.",
    "",
    "## Feature toggles",
    "",
    "The server groups tools into an always-on **core** and three optional",
    "feature toggles. By default only the core groups are exposed — turn the",
    "toggles on to enable the rest.",
    "",
    "| Toggle | Default | Groups |",
    "|---|---|---|",
    "| _(core)_ | enabled | Projects & Namespaces, Projects & Files, Branches & Commits, Groups, Merge Requests, Issues, Labels, Work Items, CI Lint, Releases, Tags, Users & Events, Variables, Webhooks, Search, Dependency Proxy |",
    "| `USE_PIPELINE` | off | Pipelines, Jobs & Deployments |",
    "| `USE_MILESTONE` | off | Milestones |",
    "| `USE_GITLAB_WIKI` | off | Wiki |",
    "",
    "Read-only mode (`GITLAB_READ_ONLY_MODE=true`) hides every write tool",
    "regardless of toggles. See [Environment Variables](../configuration/environment-variables.md)",
    "and [CLI Arguments](../getting-started/cli-arguments.md) for the full list.",
    "",
    "## Legend",
    "",
    "| Marker | Meaning |",
    "|---|---|",
    "| 📖 | **Read-only** — fetches data, does not modify GitLab state. Safe to invoke freely. |",
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
    if (meta.toggleNote) {
      lines.push(`> ${meta.toggleNote}`);
      lines.push("");
    }
    lines.push("| Tool | What it does | R/W |");
    lines.push("|---|---|:-:|");
    for (const name of tools) {
      const tool = allTools.find(t => t.name === name);
      if (!tool) continue;
      const desc = escapePipe(tool.description);
      const marker = classify(name) === "read" ? "📖" : "✏️";
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
  lines.push("For runtime schema inspection from a connected MCP client, call the");
  lines.push("`discover_tools` tool.");
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
      console.warn(`Toolset ${id} not found in TOOLSET_DEFINITIONS`);
      continue;
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
    const lines: string[] = [
      `# Meta & GraphQL`,
      "",
      "Tools the MCP exposes that aren't tied to a specific GitLab feature group — server diagnostics and the GraphQL escape hatch.",
      "",
      "## Tools in this group",
      "",
    ];
    for (const name of uncategorized) {
      lines.push(`- [\`${name}\`](#${name}) — ${rwBadge(name)}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
    for (const name of uncategorized) {
      const tool = allTools.find(t => t.name === name)!;
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
