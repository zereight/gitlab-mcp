#!/usr/bin/env tsx
/**
 * Verify skills/gitlab-mcp/ stays in sync with tools/registry.ts.
 *
 * Run with: npm run check:skill-sync
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TOOLSET_DEFINITIONS,
  allTools,
  destructiveTools,
  DEFAULT_TOOLSET_IDS,
} from "../tools/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SKILL_PATH = join(REPO_ROOT, "skills", "gitlab-mcp", "SKILL.md");
const REF_DIR = join(REPO_ROOT, "skills", "gitlab-mcp", "reference");

// Response field names in reference docs — not MCP tools.
const REFERENCE_FIELD_ALLOWLIST = new Set([
  "allow_multiple",
  "deleted_file",
  "excluded_file_patterns",
  "group_id",
  "new_file",
  "new_path",
  "old_path",
  "project_id",
  "renamed_file",
]);

function fail(message: string): never {
  console.error(`::error::${message}`);
  process.exit(1);
}

function parseToolsetTable(skill: string) {
  const rows = new Map<string, { count: number; isDefault: boolean }>();
  const rowRe = /^\| ([a-z_]+) \((\d+) tools?\) \| (yes|no) \|/gm;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(skill)) !== null) {
    rows.set(match[1], {
      count: Number(match[2]),
      isDefault: match[3] === "yes",
    });
  }
  return rows;
}

function parseIntroCounts(skill: string) {
  const match = skill.match(/providing (\d+) tools: (\d+) tools across (\d+) toolsets/);
  if (!match) {
    fail("skills/gitlab-mcp/SKILL.md intro line is missing or malformed");
  }
  return {
    totalTools: Number(match[1]),
    uniqueInToolsets: Number(match[2]),
    toolsetCount: Number(match[3]),
  };
}

function parseDestructiveTools(skill: string) {
  const section = skill.match(/## Destructive Tools[^\n]*\n\n(`[^`]+`(?:, `[^`]+`)*)$/m);
  if (!section) {
    fail("skills/gitlab-mcp/SKILL.md destructive tools section is missing or malformed");
  }
  return new Set([...section[1].matchAll(/`([a-z_]+)`/g)].map((m) => m[1]));
}

function collectReferenceToolNames() {
  const toolNames = new Set<string>();
  for (const file of readdirSync(REF_DIR).filter((name) => name.endsWith(".md"))) {
    const text = readFileSync(join(REF_DIR, file), "utf8");
    for (const match of text.matchAll(/`([a-z][a-z0-9_]*)`/g)) {
      const name = match[1];
      if (!REFERENCE_FIELD_ALLOWLIST.has(name)) {
        toolNames.add(name);
      }
    }
  }
  return toolNames;
}

const skill = readFileSync(SKILL_PATH, "utf8");
const errors: string[] = [];

const registryCounts = Object.fromEntries(
  TOOLSET_DEFINITIONS.map((definition) => [definition.id, definition.tools.size]),
);
const skillRows = parseToolsetTable(skill);

if (skillRows.size !== TOOLSET_DEFINITIONS.length) {
  errors.push(
    `toolset table has ${skillRows.size} rows; registry has ${TOOLSET_DEFINITIONS.length}`,
  );
}

for (const definition of TOOLSET_DEFINITIONS) {
  const row = skillRows.get(definition.id);
  if (!row) {
    errors.push(`missing toolset row for ${definition.id}`);
    continue;
  }
  const actualCount = registryCounts[definition.id];
  if (row.count !== actualCount) {
    errors.push(`${definition.id}: skill says ${row.count}, registry has ${actualCount}`);
  }
  const expectedDefault = DEFAULT_TOOLSET_IDS.has(definition.id);
  if (row.isDefault !== expectedDefault) {
    errors.push(
      `${definition.id}: skill default=${row.isDefault}, registry default=${expectedDefault}`,
    );
  }
}

for (const id of skillRows.keys()) {
  if (!registryCounts[id]) {
    errors.push(`unknown toolset in skill table: ${id}`);
  }
}

const uniqueInToolsets = new Set(TOOLSET_DEFINITIONS.flatMap((definition) => [...definition.tools]))
  .size;
const intro = parseIntroCounts(skill);
if (intro.totalTools !== allTools.length) {
  errors.push(`intro total tools: skill says ${intro.totalTools}, registry has ${allTools.length}`);
}
if (intro.uniqueInToolsets !== uniqueInToolsets) {
  errors.push(
    `intro unique toolset tools: skill says ${intro.uniqueInToolsets}, registry has ${uniqueInToolsets}`,
  );
}
if (intro.toolsetCount !== TOOLSET_DEFINITIONS.length) {
  errors.push(
    `intro toolset count: skill says ${intro.toolsetCount}, registry has ${TOOLSET_DEFINITIONS.length}`,
  );
}

const skillDestructive = parseDestructiveTools(skill);
for (const tool of skillDestructive) {
  if (!destructiveTools.has(tool)) {
    errors.push(`destructive list includes non-destructive tool: ${tool}`);
  }
}
for (const tool of destructiveTools) {
  if (!skillDestructive.has(tool)) {
    errors.push(`destructive list missing registry tool: ${tool}`);
  }
}

const registryToolNames = new Set(allTools.map((tool) => tool.name));
for (const tool of collectReferenceToolNames()) {
  if (!registryToolNames.has(tool)) {
    errors.push(`reference mentions unknown tool: ${tool}`);
  }
}

if (errors.length > 0) {
  console.error("skills/gitlab-mcp/ is out of sync with tools/registry.ts:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("skills/gitlab-mcp/ is in sync with tools/registry.ts");
