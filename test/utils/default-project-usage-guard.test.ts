/**
 * Static guard for tools/default-project-usage.ts.
 *
 * Fails when a tool with an optional project_id can reach getEffectiveProjectId but has no
 * entry in DEFAULT_PROJECT_USAGE_BY_TOOL. Such a tool could otherwise pick up the default project
 * silently, or miss it, without anyone deciding that.
 *
 * How it works: parse every production .ts file under the repo root (test/ and scripts/
 * excluded), then build a name-based reach set. A function is in the set if its body
 * contains the identifier getEffectiveProjectId, or an identifier naming a function that is
 * in the set. Then look at the case clauses of the handleToolCall dispatch switch and map
 * each string label to the same test.
 *
 * Limits, so nobody over-trusts it:
 * - It is name-based and does no type resolution. Same-named functions in different
 *   modules are merged, which over-approximates. A false positive means "add an entry", which
 *   is safe.
 * - It cannot tell a "" argument from a real project id. Any reach counts, which is intended.
 * - It cannot see dispatch that does not go through a string-literal case label, such as a
 *   handler looked up in a map. The "every optional tool is a case label" assertion closes
 *   that gap for the tools that matter, and fails if it is ever missed.
 * - Tools with no project_id property are out of scope. getManagedMaskingProjectIds only
 *   injects the default when hasPrimaryProjectField is true (masking/project-scope.ts).
 * - It checks that an entry exists, not that its value is correct. The values are checked
 *   against main by default-project-usage.test.ts.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { DEFAULT_PROJECT_USAGE_BY_TOOL } from "../../tools/default-project-usage.js";
import { allTools } from "../../tools/registry.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TARGET = "getEffectiveProjectId";
const DISPATCH_FUNCTION = "handleToolCall";
const DISPATCH_FILE = path.join(REPO_ROOT, "index.ts");
const SKIP_DIRS = new Set(["node_modules", "test", "scripts", "build", "dist", "docs", "coverage"]);

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function identifiersOf(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n)) names.add(n.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return names;
}

interface DispatchAnalysis {
  /** String-literal case labels in the dispatch switch. */
  readonly dispatchLabels: ReadonlySet<string>;
  /** Labels whose handler can reach getEffectiveProjectId, by name-based reach. */
  readonly reachingLabels: ReadonlySet<string>;
}

function analyzeDispatch(): DispatchAnalysis {
  const sourceFiles = listSourceFiles(REPO_ROOT).map(file =>
    ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true)
  );

  // Bare function name -> identifiers in every body declared under that name, across files.
  const identsByName = new Map<string, Set<string>>();
  const addBody = (name: string, body: ts.Node): void => {
    const merged = identsByName.get(name) ?? new Set<string>();
    for (const id of identifiersOf(body)) merged.add(id);
    identsByName.set(name, merged);
  };
  for (const sf of sourceFiles) {
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        addBody(node.name.text, node.body);
      } else if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        addBody(node.name.text, node.initializer);
      } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.body) {
        addBody(node.name.text, node.body);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  // Fixed point: a name reaches TARGET if its merged body names TARGET or a name that reaches it.
  const reaches = new Set<string>();
  for (const [name, ids] of identsByName) {
    if (ids.has(TARGET)) reaches.add(name);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, ids] of identsByName) {
      if (reaches.has(name)) continue;
      for (const id of ids) {
        if (reaches.has(id)) {
          reaches.add(name);
          changed = true;
          break;
        }
      }
    }
  }

  // The dispatch switch is the one inside handleToolCall with the most string-literal cases.
  const indexFile = sourceFiles.find(sf => sf.fileName === DISPATCH_FILE);
  assert.ok(indexFile, `${DISPATCH_FILE} was not parsed`);
  // A holder object, not a let: TypeScript would narrow a let assigned only in a closure to undefined.
  const best: { node?: ts.SwitchStatement; labelCount: number } = { labelCount: 0 };
  const findSwitches = (node: ts.Node, inDispatch: boolean): void => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === DISPATCH_FUNCTION && node.body) {
      findSwitches(node.body, true);
      return;
    }
    if (inDispatch && ts.isSwitchStatement(node)) {
      const labelCount = node.caseBlock.clauses.filter(
        c => ts.isCaseClause(c) && ts.isStringLiteral(c.expression)
      ).length;
      if (labelCount > best.labelCount) {
        best.labelCount = labelCount;
        best.node = node;
      }
    }
    ts.forEachChild(node, child => findSwitches(child, inDispatch));
  };
  findSwitches(indexFile, false);
  const dispatch = best.node;
  assert.ok(dispatch, `no switch found inside ${DISPATCH_FUNCTION} in index.ts`);

  const dispatchLabels = new Set<string>();
  const reachingLabels = new Set<string>();
  // Consecutive empty clauses fall through to the next clause that has statements.
  let pending: string[] = [];
  for (const clause of dispatch.caseBlock.clauses) {
    if (ts.isCaseClause(clause) && ts.isStringLiteral(clause.expression)) {
      pending.push(clause.expression.text);
    }
    if (clause.statements.length === 0) continue;
    const ids = new Set<string>();
    for (const statement of clause.statements) {
      for (const id of identifiersOf(statement)) ids.add(id);
    }
    const reachesTarget = ids.has(TARGET) || [...ids].some(id => reaches.has(id));
    for (const label of pending) {
      dispatchLabels.add(label);
      if (reachesTarget) reachingLabels.add(label);
    }
    pending = [];
  }
  return { dispatchLabels, reachingLabels };
}

function hasOptionalProjectId(inputSchema: unknown): boolean {
  const schema = inputSchema as
    { properties?: Record<string, unknown>; required?: readonly string[] } | undefined;
  return (
    Object.hasOwn(schema?.properties ?? {}, "project_id") &&
    !(schema?.required ?? []).includes("project_id")
  );
}

describe("default-project usage guard", () => {
  const analysis = analyzeDispatch();
  const optionalProjectTools = allTools
    .filter(tool => hasOptionalProjectId(tool.inputSchema))
    .map(tool => tool.name);

  it("sees the dispatch switch and the known default-project tools reaching the default path", () => {
    assert.ok(analysis.dispatchLabels.size > 100, "dispatch switch looks too small to be real");
    // If the analysis stops seeing these, the guard below would pass vacuously.
    for (const name of ["get_file_contents", "my_issues", "list_issues", "list_merge_requests"]) {
      assert.ok(
        analysis.reachingLabels.has(name),
        `${name} should reach getEffectiveProjectId in the analysis; the guard has gone blind`
      );
    }
  });

  it("finds every optional project_id tool as a string-literal case label", () => {
    const missing = optionalProjectTools.filter(name => !analysis.dispatchLabels.has(name));
    assert.deepEqual(
      missing,
      [],
      "optional project_id tools missing from the handleToolCall switch; the guard cannot analyse them"
    );
  });

  it("requires an entry for every optional project_id tool that can reach getEffectiveProjectId", () => {
    const undeclared = optionalProjectTools.filter(
      name => analysis.reachingLabels.has(name) && !DEFAULT_PROJECT_USAGE_BY_TOOL.has(name)
    );
    assert.deepEqual(
      undeclared,
      [],
      `add these to DEFAULT_PROJECT_USAGE_BY_TOOL in tools/default-project-usage.ts (use "never" if the default must not be masked): ${undeclared.join(", ")}`
    );
  });
});
