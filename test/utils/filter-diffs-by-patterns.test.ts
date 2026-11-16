import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { filterDiffsByPatterns } from "../../utils/helpers.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HELPERS_URL = pathToFileURL(path.join(REPO_ROOT, "utils", "helpers.ts")).href;

// Hard cap on the child process. A backtracking engine never returns on the
// payload below, so the cap is what turns a hang into a failure.
const CHILD_TIMEOUT_MS = 10_000;
// Time measured inside the child, around filterDiffsByPatterns only.
const FILTER_BUDGET_MS = 500;

// A 32-character path that the pattern does not match. Against a backtracking
// engine, the cost of ^(.+)+Q$ doubles with each added character.
const BACKTRACKING_PATH = `${"a".repeat(29)}.ts`;
const BACKTRACKING_PATTERN = "^(.+)+Q$";

const CHILD_SCRIPT = [
  "const { filterDiffsByPatterns } = await import(process.argv[1]);",
  "const input = JSON.parse(process.argv[2]);",
  "const started = performance.now();",
  "const kept = filterDiffsByPatterns(input.diffs, input.patterns);",
  "const elapsedMs = performance.now() - started;",
  "console.log(JSON.stringify({ elapsedMs, kept: kept.map(diff => diff.new_path) }));",
].join("\n");

interface ChildFilterResult {
  readonly elapsedMs: number;
  readonly kept: string[];
}

// Runs filterDiffsByPatterns in a child process so a regex that never finishes
// fails this test instead of hanging the test runner.
function filterInChild(paths: string[], patterns: string[]): ChildFilterResult {
  const payload = JSON.stringify({
    diffs: paths.map(new_path => ({ new_path })),
    patterns,
  });
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx/esm", "--input-type=module", "-e", CHILD_SCRIPT, HELPERS_URL, payload],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: CHILD_TIMEOUT_MS }
  );
  if (child.error || child.signal !== null) {
    assert.fail(
      `filterDiffsByPatterns did not finish within ${CHILD_TIMEOUT_MS} ms ` +
        `(signal: ${child.signal ?? "none"}, error: ${child.error?.message ?? "none"})`
    );
  }
  assert.strictEqual(child.status, 0, `child exited with ${child.status}: ${child.stderr}`);
  return JSON.parse(child.stdout.trim()) as ChildFilterResult;
}

function keptPaths(paths: string[], patterns: string[] | undefined): string[] {
  return filterDiffsByPatterns(
    paths.map(new_path => ({ new_path })),
    patterns
  ).map(diff => diff.new_path);
}

describe("filterDiffsByPatterns backtracking safety", () => {
  it("finishes quickly on a backtracking-prone pattern and keeps the non-matching path", () => {
    const result = filterInChild([BACKTRACKING_PATH], [BACKTRACKING_PATTERN]);

    assert.ok(
      result.elapsedMs < FILTER_BUDGET_MS,
      `filter took ${result.elapsedMs.toFixed(1)} ms, budget is ${FILTER_BUDGET_MS} ms`
    );
    assert.deepStrictEqual(result.kept, [BACKTRACKING_PATH]);
  });

  it("still excludes a matching path under the same backtracking-prone pattern", () => {
    const matchingPath = `${"a".repeat(31)}Q`;
    const result = filterInChild([BACKTRACKING_PATH, matchingPath], [BACKTRACKING_PATTERN]);

    assert.ok(result.elapsedMs < FILTER_BUDGET_MS);
    assert.deepStrictEqual(result.kept, [BACKTRACKING_PATH]);
  });
});

describe("filterDiffsByPatterns matching", () => {
  const PATHS = [
    "src/index.ts",
    "vendor/a.js",
    "src/vendor/b.js",
    "yarn.lock",
    "packages/x/Cargo.lock",
    "dist/app.js",
    "public/app.min.js",
    "public/app.js",
    "api/gen.pb.go",
    "src/user.spec.ts",
    "test/mocks/x.ts",
    "README.md",
  ];

  const CASES: Array<[string, string[]]> = [
    ["^vendor/", ["vendor/a.js"]],
    ["\\.lock$", ["yarn.lock", "packages/x/Cargo.lock"]],
    ["^dist/", ["dist/app.js"]],
    [".*\\.min\\.js", ["public/app.min.js"]],
    ["\\.pb\\.go$", ["api/gen.pb.go"]],
    ["\\.spec\\.ts$", ["src/user.spec.ts"]],
    ["^test/mocks/", ["test/mocks/x.ts"]],
    ["package-lock\\.json", []],
    ["readme", []],
    ["^README", ["README.md"]],
  ];

  for (const [pattern, removed] of CASES) {
    it(`pattern ${JSON.stringify(pattern)} removes ${JSON.stringify(removed)}`, () => {
      const kept = keptPaths(PATHS, [pattern]);
      assert.deepStrictEqual(
        kept,
        PATHS.filter(p => !removed.includes(p))
      );
    });
  }

  it("applies several patterns together", () => {
    assert.deepStrictEqual(keptPaths(PATHS, ["^vendor/", "\\.lock$"]), [
      "src/index.ts",
      "src/vendor/b.js",
      "dist/app.js",
      "public/app.min.js",
      "public/app.js",
      "api/gen.pb.go",
      "src/user.spec.ts",
      "test/mocks/x.ts",
      "README.md",
    ]);
  });

  it("returns the input array unchanged when there are no patterns", () => {
    const diffs = [{ new_path: "a.ts" }];
    assert.strictEqual(filterDiffsByPatterns(diffs, undefined), diffs);
    assert.strictEqual(filterDiffsByPatterns(diffs, []), diffs);
  });

  it("keeps a diff with an empty path", () => {
    assert.deepStrictEqual(keptPaths(["", "a.ts"], ["\\.ts$"]), [""]);
  });
});

describe("filterDiffsByPatterns invalid and oversized patterns", () => {
  it("ignores patterns RE2 cannot compile and applies the rest", t => {
    const warn = t.mock.method(console, "warn", () => {});
    const kept = keptPaths(["vendor/a.js", "src/a.ts"], ["^vendor/(?=.)", "^src/"]);

    assert.deepStrictEqual(kept, ["vendor/a.js"]);
    assert.strictEqual(warn.mock.callCount(), 1);
    assert.match(
      String(warn.mock.calls[0].arguments[0]),
      /Invalid regex pattern ignored: \^vendor\/\(\?=\.\)/
    );
  });

  it("treats lookbehind, backreferences, and JS unicode escapes as not supported", t => {
    const warn = t.mock.method(console, "warn", () => {});
    const unsupported = ["(?<=a)b", "(a)\\1", "\\u0041", "\\cA"];
    const kept = keptPaths(["Ab", "a.ts"], unsupported);

    assert.deepStrictEqual(kept, ["Ab", "a.ts"]);
    assert.strictEqual(warn.mock.callCount(), unsupported.length);
  });

  it("accepts RE2 syntax that JavaScript rejects, such as inline flags", () => {
    assert.deepStrictEqual(keptPaths(["README.md", "a.ts"], ["(?i)^readme"]), ["a.ts"]);
  });

  it("ignores a pattern whose compiled program exceeds the size limit", t => {
    const warn = t.mock.method(console, "warn", () => {});
    const kept = keptPaths(["x.ts"], [".{1000}.{1000}"]);

    assert.deepStrictEqual(kept, ["x.ts"]);
    assert.match(String(warn.mock.calls[0].arguments[0]), /compiled size \d+ exceeds 1000/);
  });

  it("ignores a pattern longer than 200 characters and keeps one of exactly 200", t => {
    const warn = t.mock.method(console, "warn", () => {});
    const tooLong = "a".repeat(201);
    const atLimit = `${"a".repeat(199)}$`;
    const kept = keptPaths(["x.ts"], [tooLong]);

    assert.deepStrictEqual(kept, ["x.ts"]);
    assert.strictEqual(warn.mock.callCount(), 1);

    warn.mock.resetCalls();
    assert.deepStrictEqual(keptPaths(["x.ts"], [atLimit]), ["x.ts"]);
    assert.strictEqual(warn.mock.callCount(), 0);
  });

  it("applies only the first 50 patterns and warns about the rest", t => {
    const warn = t.mock.method(console, "warn", () => {});
    const patterns = [...Array(50).fill("^nomatch/"), "^src/"];
    const kept = keptPaths(["src/a.ts", "lib/b.ts"], patterns);

    assert.deepStrictEqual(kept, ["src/a.ts", "lib/b.ts"]);
    assert.strictEqual(warn.mock.callCount(), 1);
    assert.match(
      String(warn.mock.calls[0].arguments[0]),
      /after the first 50 ignored \(51 given\)/
    );
  });
});
