/**
 * Portable pure logic for MCP `tools/call` coverage detection.
 *
 * A tool counts as invoked when test source sends that name through MCP, in one
 * of these syntax-scoped positions only:
 *
 * - `callTool("name")`, `callToolJson("name")`, `client.callTool("name")`,
 *   `callTool(envOrUrl, "name")` — the name is a string literal directly in the
 *   argument list of a `callTool*` callee (identifier or property access).
 * - `client.callTool({ name: "name", arguments })` — SDK shape: the name is the
 *   `name` property of an object literal passed as the FIRST argument.
 * - `{ method: "tools/call", params: { name: "name" } }` — the `name` property of
 *   a `params` object inside the SAME object literal that carries the method.
 * - `send(proc, "tools/call", { name: "name" })` — the `name` property of an
 *   object literal passed as the argument right after a `"tools/call"` method
 *   argument (request-helper shape, any callee).
 *
 * Deliberately not counted:
 *
 * - `callTool(toolName, { name: "other" })` — object past the first argument is
 *   tool input, not the invoked name.
 * - `name: "tool"` properties outside a `tools/call` payload (fixtures, `tools/list`
 *   mocks, tool arguments) in files that merely mention `tools/call`.
 * - variable names (`callTool(env, toolName)`) — not statically resolvable.
 *
 * No filesystem or registry access here; the caller supplies file texts and the
 * tool-name set. The only dependency is the TypeScript parser (devDependency).
 */

import ts from "typescript";

export const SKIP_FILES = new Set(["tool-description-quality.test.ts"]);

export const GROUP_ORDER = [
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
];

export const GROUP_TITLE: Record<string, string> = {
  merge_requests: "Merge Requests",
  issues: "Issues",
  repositories: "Projects & Files",
  branches: "Branches & Commits",
  projects: "Projects & Namespaces",
  labels: "Labels",
  ci: "CI Lint",
  groups: "Groups",
  pipelines: "Pipelines, Jobs & Deployments",
  milestones: "Milestones",
  wiki: "Wiki",
  releases: "Releases",
  tags: "Tags",
  users: "Users & Events",
  workitems: "Work Items",
  webhooks: "Webhooks",
  search: "Search",
  variables: "Variables",
  dependency_proxy: "Dependency Proxy",
  vulnerabilities: "Vulnerabilities",
  orbit: "GitLab Orbit",
  snippets: "Snippets",
  meta: "Meta & GraphQL",
};

export const CANARY_INVOKED = [
  "list_project_variables",
  "orbit_query",
  "list_pipeline_schedules",
  "search_code",
];

export const MIN_INVOKED = 146;

export interface ToolGroup {
  id: string;
  tools: string[];
}

export interface ToolsetDefinition {
  id: string;
  tools: Iterable<string>;
}

export interface ScannedFile {
  path: string;
  text: string;
}

const CALL_TOOL_CALLEE = /^callTool[A-Za-z]*$/;

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function stringValue(expression: ts.Expression): string | undefined {
  const inner = unwrap(expression);
  if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) {
    return inner.text;
  }
  return undefined;
}

function propertyKey(prop: ts.PropertyAssignment): string | undefined {
  const key = prop.name;
  if (ts.isIdentifier(key) || ts.isStringLiteral(key)) {
    return key.text;
  }
  return undefined;
}

function namePropertyOf(object: ts.ObjectLiteralExpression): string | undefined {
  for (const prop of object.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      continue;
    }
    if (propertyKey(prop) !== "name") {
      continue;
    }
    return stringValue(prop.initializer);
  }
  return undefined;
}

function callToolCalleeName(callee: ts.Expression): string | undefined {
  if (ts.isIdentifier(callee)) {
    return callee.text;
  }
  if (ts.isPropertyAccessExpression(callee)) {
    return callee.name.text;
  }
  return undefined;
}

function collectCallHits(node: ts.CallExpression, toolNames: ReadonlySet<string>): string[] {
  const calleeName = callToolCalleeName(node.expression);
  if (!calleeName || !CALL_TOOL_CALLEE.test(calleeName)) {
    return [];
  }
  const hits: string[] = [];
  node.arguments.forEach((arg, index) => {
    const direct = stringValue(arg);
    if (direct && toolNames.has(direct)) {
      hits.push(direct);
      return;
    }
    // SDK shape only: client.callTool({ name, arguments }) — the object must be
    // the first argument. Objects in later positions are tool input.
    if (index === 0 && ts.isObjectLiteralExpression(unwrap(arg))) {
      const named = namePropertyOf(unwrap(arg) as ts.ObjectLiteralExpression);
      if (named && toolNames.has(named)) {
        hits.push(named);
      }
    }
  });
  return hits;
}

function collectMethodArgHit(
  node: ts.CallExpression,
  toolNames: ReadonlySet<string>
): string | undefined {
  const args = node.arguments;
  for (let index = 0; index + 1 < args.length; index++) {
    if (stringValue(args[index]) !== "tools/call") {
      continue;
    }
    const params = unwrap(args[index + 1]);
    if (!ts.isObjectLiteralExpression(params)) {
      continue;
    }
    const named = namePropertyOf(params);
    if (named && toolNames.has(named)) {
      return named;
    }
  }
  return undefined;
}

function collectPayloadHit(
  node: ts.ObjectLiteralExpression,
  toolNames: ReadonlySet<string>
): string | undefined {
  let isToolsCall = false;
  let paramsName: string | undefined;
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      continue;
    }
    const key = propertyKey(prop);
    if (key === "method" && stringValue(prop.initializer) === "tools/call") {
      isToolsCall = true;
    }
    if (key === "params") {
      const params = unwrap(prop.initializer);
      if (ts.isObjectLiteralExpression(params)) {
        paramsName = namePropertyOf(params);
      }
    }
  }
  if (isToolsCall && paramsName && toolNames.has(paramsName)) {
    return paramsName;
  }
  return undefined;
}

/**
 * Scan one source text and return the invoked tool names found in supported
 * call positions. `fileName` selects the TS/JS grammar; unknown extensions
 * parse as TypeScript.
 */
export function scanSourceForInvocations(
  sourceText: string,
  fileName: string,
  toolNames: ReadonlySet<string>
): Set<string> {
  const hits = new Set<string>();
  const scriptKind = fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    false,
    scriptKind
  );

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      for (const hit of collectCallHits(node, toolNames)) {
        hits.add(hit);
      }
      const methodHit = collectMethodArgHit(node, toolNames);
      if (methodHit) {
        hits.add(methodHit);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const hit = collectPayloadHit(node, toolNames);
      if (hit) {
        hits.add(hit);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return hits;
}

/**
 * Aggregate per-file scan results into tool -> sorted file list. Every known
 * tool gets an entry so uncovered tools render as `- [ ]`.
 */
export function collectInvocations(
  files: ReadonlyArray<ScannedFile>,
  toolNames: ReadonlySet<string>
): Map<string, string[]> {
  const hits = new Map<string, string[]>();
  for (const name of toolNames) {
    hits.set(name, []);
  }
  for (const file of files) {
    for (const name of scanSourceForInvocations(file.text, file.path, toolNames)) {
      const list = hits.get(name);
      if (list && !list.includes(file.path)) {
        list.push(file.path);
      }
    }
  }
  for (const list of hits.values()) {
    list.sort();
  }
  return hits;
}

export function countInvoked(
  toolNames: ReadonlyArray<string>,
  hits: Map<string, string[]>
): number {
  return toolNames.filter(name => (hits.get(name) ?? []).length > 0).length;
}

export function groupToolsByToolset(
  toolNames: ReadonlyArray<string>,
  definitions: ReadonlyArray<ToolsetDefinition>
): ToolGroup[] {
  const categorized = new Set<string>();
  const grouped: ToolGroup[] = [];
  for (const id of GROUP_ORDER) {
    const definition = definitions.find(item => item.id === id);
    if (!definition) {
      throw new Error(`GROUP_ORDER lists '${id}' but TOOLSET_DEFINITIONS does not`);
    }
    const tools = [...definition.tools];
    for (const name of tools) {
      categorized.add(name);
    }
    grouped.push({ id, tools });
  }
  const meta = toolNames.filter(name => !categorized.has(name));
  if (meta.length > 0) {
    grouped.push({ id: "meta", tools: meta });
  }
  return grouped;
}

export function percent(invoked: number, total: number): string {
  if (total === 0) {
    return "0.0%";
  }
  return `${((invoked / total) * 100).toFixed(1)}%`;
}

export function toolDocsHref(groupId: string, toolName: string): string {
  const slug = groupId.replace(/_/g, "-");
  return `../tools/${slug}.md#${toolName}`;
}

export function formatFiles(files: string[]): string {
  return files.map(file => `\`${file}\``).join(", ");
}

export function buildCoverageMarkdown(
  toolNames: string[],
  hits: Map<string, string[]>,
  grouped: ToolGroup[]
): string {
  const invokedCount = countInvoked(toolNames, hits);
  const lines: string[] = [
    "# Tool invocation coverage",
    "",
    "<!-- Generated by scripts/generate-tool-coverage.ts. Do not edit. -->",
    "",
    "This is **MCP `tools/call` coverage**, not GitLab REST coverage and not line coverage.",
    "",
    'A tool counts as invoked when a test sends that name through MCP (`callTool` / `callToolJson` / `callToolAsync` / `client.callTool`, or a `tools/call` payload with `name: "…"`). Listing a name in a toolset filter or description-quality test does not count. `test:live` (`test/validate-api.js`) is a REST smoke check and is not included.',
    "",
    "| | |",
    "| --- | ---: |",
    `| Tools | ${toolNames.length} |`,
    `| Invoked | ${invokedCount} |`,
    `| Coverage | ${percent(invokedCount, toolNames.length)} |`,
    "",
    "## By toolset",
    "",
    "| Toolset | Invoked | Total | Coverage |",
    "| --- | ---: | ---: | ---: |",
  ];

  for (const group of grouped) {
    const invoked = countInvoked(group.tools, hits);
    const title = GROUP_TITLE[group.id] ?? group.id;
    lines.push(
      `| [${title}](#${group.id}) | ${invoked} | ${group.tools.length} | ${percent(invoked, group.tools.length)} |`
    );
  }

  lines.push("");

  for (const group of grouped) {
    const title = GROUP_TITLE[group.id] ?? group.id;
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(`<a id="${group.id}"></a>`);
    lines.push("");
    for (const name of group.tools) {
      const files = hits.get(name) ?? [];
      const link = `[\`${name}\`](${toolDocsHref(group.id, name)})`;
      if (files.length > 0) {
        lines.push(`- [x] ${link} — ${formatFiles(files)}`);
      } else {
        lines.push(`- [ ] ${link}`);
      }
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function assertDetectorHealthy(hits: Map<string, string[]>, invokedCount: number): void {
  if (invokedCount < MIN_INVOKED) {
    throw new Error(
      `scanner found ${invokedCount} invoked tools; expected at least ${MIN_INVOKED} (detector probably broken)`
    );
  }
  for (const name of CANARY_INVOKED) {
    if ((hits.get(name) ?? []).length === 0) {
      throw new Error(`canary tool ${name} was not detected as invoked (detector probably broken)`);
    }
  }
}
