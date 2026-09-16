#!/usr/bin/env tsx
/**
 * Generate docs/reference/tool-coverage.md from tools/registry.ts + test/ MCP calls.
 *
 * Detection rules live in ./tool-coverage/coverage.ts (AST-scoped): a tool is
 * invoked when test source sends that name as a `callTool*` argument, as the
 * `name` of a first-argument params object (`client.callTool({ name })`), or as
 * the `name` of a `params` object inside a `tools/call` payload literal.
 *
 * Name-only mentions (toolset tables, description-quality) do not count.
 * callTool(variable) loops are missed unless the name is also a literal in that call.
 *
 * Run with: npm run docs:tools
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { allTools, TOOLSET_DEFINITIONS } from "../tools/registry.js";
import {
  assertDetectorHealthy,
  buildCoverageMarkdown,
  collectInvocations,
  countInvoked,
  groupToolsByToolset,
  percent,
  SKIP_FILES,
  type ScannedFile,
} from "./tool-coverage/coverage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const TEST_DIR = join(REPO_ROOT, "test");
const OUT_PATH = join(REPO_ROOT, "docs", "reference", "tool-coverage.md");

function walkTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTestFiles(full));
      continue;
    }
    if (/\.(ts|js)$/.test(name) && !SKIP_FILES.has(name)) {
      out.push(full);
    }
  }
  return out;
}

function repoPath(abs: string): string {
  return relative(REPO_ROOT, abs).split("\\").join("/");
}

function readScannedFiles(): ScannedFile[] {
  return walkTestFiles(TEST_DIR).map(abs => ({
    path: repoPath(abs),
    text: readFileSync(abs, "utf8"),
  }));
}

function main(): void {
  const toolNames = allTools.map(tool => tool.name);
  const toolNameSet = new Set(toolNames);
  const hits = collectInvocations(readScannedFiles(), toolNameSet);
  const invokedCount = countInvoked(toolNames, hits);
  assertDetectorHealthy(hits, invokedCount);

  const grouped = groupToolsByToolset(toolNames, TOOLSET_DEFINITIONS);

  writeFileSync(OUT_PATH, buildCoverageMarkdown(toolNames, hits, grouped));
  console.log(
    `generated docs/reference/tool-coverage.md — ${invokedCount}/${toolNames.length} (${percent(invokedCount, toolNames.length)})`
  );
}

main();
