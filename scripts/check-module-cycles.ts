#!/usr/bin/env tsx
/**
 * Fail when production modules form a cycle between module groups.
 *
 * Run with: npm run check:module-cycles
 *
 * Module groups (first matching rule wins):
 *   auth    = oauth*.ts, auth-*.ts, stateless/
 *   config  = config.ts, deprecated-env.ts, cli-boolean-flags.ts, removed-config.ts,
 *             config-tool-profile.ts, config-personal-access-token.ts
 *   tools   = tools/
 *   schemas = schemas.ts, customSchemas.ts
 *   utils   = utils/
 *   server  = server/
 *   cli     = cli/
 *   masking = masking/
 *   other root and other files: each file is its own group (named by its path)
 *
 * Edges come from static `import` / `export ... from` (including `import type`),
 * literal `import("...")` and `import x = require("...")`, and `typeof import("...")`.
 * Only relative specifiers are resolved. Edges inside one group are ignored.
 *
 * Scanned: non-test production .ts files. Excluded: test/, docs/, scripts/,
 * build/, mcp-server/, dot-directories, node_modules, *.test.ts, *.d.ts.
 *
 * Exit code: 1 when any group-level cycle exists, otherwise 0.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export interface SourceFile {
  /** Repo-relative path with forward slashes, e.g. "utils/logger.ts". */
  readonly path: string;
  readonly text: string;
}

export interface EdgeEvidence {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
}

export interface GroupEdge {
  readonly from: string;
  readonly to: string;
  readonly evidence: readonly EdgeEvidence[];
}

export interface GroupCycle {
  /** Groups in the strongly connected component, sorted. */
  readonly groups: readonly string[];
  /** Every group edge that stays inside the component (the edges that close the cycle). */
  readonly edges: readonly GroupEdge[];
}

const CONFIG_ROOT_FILES: ReadonlySet<string> = new Set([
  "config.ts",
  "deprecated-env.ts",
  "cli-boolean-flags.ts",
  "removed-config.ts",
  "config-tool-profile.ts",
  "config-personal-access-token.ts",
]);
const SCHEMA_ROOT_FILES: ReadonlySet<string> = new Set(["schemas.ts", "customSchemas.ts"]);
const DIRECTORY_GROUPS: ReadonlySet<string> = new Set([
  "tools",
  "utils",
  "server",
  "cli",
  "masking",
]);
const EXCLUDED_DIRECTORIES: ReadonlySet<string> = new Set([
  "test",
  "docs",
  "scripts",
  "build",
  "mcp-server",
  "node_modules",
]);

/** Map a repo-relative file path to its module group. */
export function groupOf(file: string): string {
  if (file.startsWith("stateless/")) return "auth";
  if (/^(oauth[^/]*|auth-[^/]*)\.ts$/.test(file)) return "auth";
  if (CONFIG_ROOT_FILES.has(file)) return "config";
  if (SCHEMA_ROOT_FILES.has(file)) return "schemas";
  const [top] = file.split("/");
  if (file.includes("/") && DIRECTORY_GROUPS.has(top)) return top;
  return file;
}

interface RawSpecifier {
  readonly specifier: string;
  readonly line: number;
}

function extractSpecifiers(file: SourceFile): RawSpecifier[] {
  const sourceFile = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true);
  const found: RawSpecifier[] = [];

  const visit = (node: ts.Node): void => {
    let specifierNode: ts.Node | undefined;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      specifierNode = node.moduleSpecifier;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      specifierNode = node.arguments[0];
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      specifierNode = node.moduleReference.expression;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifierNode = node.argument.literal;
    }
    if (specifierNode && ts.isStringLiteralLike(specifierNode)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(specifierNode.getStart(sourceFile));
      found.push({ specifier: specifierNode.text, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function resolveRelativeSpecifier(
  fromFile: string,
  specifier: string,
  known: ReadonlySet<string>
): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [
    base.endsWith(".js") ? `${base.slice(0, -".js".length)}.ts` : undefined,
    `${base}.ts`,
    `${base}/index.ts`,
  ];
  return candidates.find(
    (candidate): candidate is string => candidate !== undefined && known.has(candidate)
  );
}

/** All group-to-group edges with file:line evidence, sorted by "from" then "to". */
export function findGroupEdges(files: readonly SourceFile[]): GroupEdge[] {
  const known = new Set(files.map(file => file.path));
  const edges = new Map<string, { from: string; to: string; evidence: EdgeEvidence[] }>();

  for (const file of files) {
    const from = groupOf(file.path);
    for (const { specifier, line } of extractSpecifiers(file)) {
      const target = resolveRelativeSpecifier(file.path, specifier, known);
      if (target === undefined) continue;
      const to = groupOf(target);
      if (to === from) continue;
      const key = `${from}\u0000${to}`;
      let edge = edges.get(key);
      if (edge === undefined) {
        edge = { from, to, evidence: [] };
        edges.set(key, edge);
      }
      edge.evidence.push({ file: file.path, line, specifier });
    }
  }

  return [...edges.values()].sort((a, b) =>
    a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)
  );
}

/** Strongly connected components with more than one group (Tarjan). */
export function findGroupCycles(edges: readonly GroupEdge[]): GroupCycle[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
  }

  interface NodeState {
    index: number;
    lowlink: number;
  }
  let counter = 0;
  const states = new Map<string, NodeState>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  const strongConnect = (node: string): NodeState => {
    const state: NodeState = { index: counter, lowlink: counter };
    counter += 1;
    states.set(node, state);
    stack.push(node);
    onStack.add(node);

    for (const target of adjacency.get(node) ?? []) {
      const targetState = states.get(target);
      if (targetState === undefined) {
        const visited = strongConnect(target);
        state.lowlink = Math.min(state.lowlink, visited.lowlink);
      } else if (onStack.has(target)) {
        state.lowlink = Math.min(state.lowlink, targetState.index);
      }
    }

    if (state.lowlink === state.index) {
      const component: string[] = [];
      let member = stack.pop();
      while (member !== undefined) {
        onStack.delete(member);
        component.push(member);
        if (member === node) break;
        member = stack.pop();
      }
      if (component.length > 1) components.push(component.sort());
    }
    return state;
  };

  for (const node of [...adjacency.keys()].sort()) {
    if (!states.has(node)) strongConnect(node);
  }

  return components
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(groups => {
      const members = new Set(groups);
      return {
        groups,
        edges: edges.filter(edge => members.has(edge.from) && members.has(edge.to)),
      };
    });
}

export function formatCycles(cycles: readonly GroupCycle[]): string {
  const lines: string[] = [];
  for (const cycle of cycles) {
    lines.push(`cycle between groups: ${cycle.groups.join(" <-> ")}`);
    for (const edge of cycle.edges) {
      lines.push(`  ${edge.from} -> ${edge.to}`);
      for (const item of edge.evidence) {
        lines.push(`    ${item.file}:${item.line}  "${item.specifier}"`);
      }
    }
  }
  return lines.join("\n");
}

function listProductionSources(repoRoot: string): SourceFile[] {
  const sources: SourceFile[] = [];
  const walk = (relativeDir: string): void => {
    const absoluteDir = path.join(repoRoot, relativeDir);
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const relativePath = relativeDir === "" ? entry.name : `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || EXCLUDED_DIRECTORIES.has(entry.name)) continue;
        walk(relativePath);
        continue;
      }
      const isProductionTs =
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".d.ts");
      if (isProductionTs) {
        sources.push({
          path: relativePath,
          text: fs.readFileSync(path.join(repoRoot, relativePath), "utf8"),
        });
      }
    }
  };
  walk("");
  return sources.sort((a, b) => a.path.localeCompare(b.path));
}

function main(): void {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const sources = listProductionSources(repoRoot);
  const edges = findGroupEdges(sources);
  const cycles = findGroupCycles(edges);

  if (cycles.length > 0) {
    process.stderr.write(`${formatCycles(cycles)}\n`);
    process.stderr.write(
      `check-module-cycles: FAILED — ${cycles.length} group cycle(s) across ${sources.length} files.\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `check-module-cycles: OK — ${sources.length} files, ${edges.length} group edges, 0 group cycles.\n`
  );
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
