import { describe, test } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import {
  buildSummaryMarkdown,
  type CoverageSummary,
  type FileSummary,
  formatMetric,
  groupSummary,
  NOTE,
  OTHER_ROOT_FILES_LABEL,
} from "./code-coverage-summary.js";

const ROOT = join("/repo", "gitlab-mcp");

function counts(lines: [number, number], branches: [number, number] = [0, 0]): FileSummary {
  return {
    lines: { covered: lines[0], total: lines[1] },
    statements: { covered: lines[0], total: lines[1] },
    branches: { covered: branches[0], total: branches[1] },
    functions: { covered: 1, total: 2 },
  };
}

function summary(files: Record<string, FileSummary>, total: FileSummary): CoverageSummary {
  const entries = Object.entries(files).map(([rel, value]) => [join(ROOT, rel), value]);
  return { total, ...Object.fromEntries(entries) } as CoverageSummary;
}

describe("formatMetric", () => {
  test("prints the percentage with covered/total counts", () => {
    assert.strictEqual(formatMetric({ covered: 1234, total: 2015 }), "61.24% (1,234/2,015)");
  });

  test("truncates like istanbul instead of rounding up", () => {
    assert.strictEqual(formatMetric({ covered: 2, total: 3 }), "66.66% (2/3)");
  });

  test("reports n/a when there is nothing to cover", () => {
    assert.strictEqual(formatMetric({ covered: 0, total: 0 }), "n/a");
  });
});

describe("groupSummary", () => {
  const input = summary(
    {
      "index.ts": counts([50, 100], [5, 10]),
      "utils/a.ts": counts([1, 2]),
      "utils/nested/b.ts": counts([3, 4]),
      "cli/args.ts": counts([0, 10]),
      "config.ts": counts([2, 2]),
      "oauth.ts": counts([1, 8]),
    },
    counts([57, 126])
  );

  test("puts index.ts first, then directories alphabetically, then other root files", () => {
    assert.deepStrictEqual(
      groupSummary(input, ROOT).map(row => row.label),
      ["index.ts", "cli/", "utils/", OTHER_ROOT_FILES_LABEL]
    );
  });

  test("sums nested files into their top-level directory", () => {
    const utils = groupSummary(input, ROOT).find(row => row.label === "utils/");
    assert.ok(utils);
    assert.strictEqual(utils.files, 2);
    assert.deepStrictEqual(utils.counts.lines, { covered: 4, total: 6 });
    assert.deepStrictEqual(utils.counts.functions, { covered: 2, total: 4 });
  });

  test("aggregates root files other than index.ts into one row", () => {
    const other = groupSummary(input, ROOT).at(-1);
    assert.ok(other);
    assert.strictEqual(other.label, OTHER_ROOT_FILES_LABEL);
    assert.strictEqual(other.files, 2);
    assert.deepStrictEqual(other.counts.lines, { covered: 3, total: 10 });
  });

  test("omits rows that have no files", () => {
    const onlyDir = summary({ "tools/x.ts": counts([1, 1]) }, counts([1, 1]));
    assert.deepStrictEqual(
      groupSummary(onlyDir, ROOT).map(row => row.label),
      ["tools/"]
    );
  });
});

describe("buildSummaryMarkdown", () => {
  test("renders a total row plus one row per group", () => {
    const markdown = buildSummaryMarkdown(
      summary(
        { "index.ts": counts([50, 100], [5, 10]), "utils/a.ts": counts([1, 2]) },
        counts([51, 102], [5, 10])
      ),
      ROOT
    );
    const lines = markdown.split("\n");
    assert.strictEqual(lines[0], "## Code coverage (mock/unit suite)");
    assert.ok(lines.includes("| Scope | Files | Lines | Branches | Functions | Statements |"));
    assert.ok(
      lines.includes(
        "| **Total** | 2 | 50.00% (51/102) | 50.00% (5/10) | 50.00% (1/2) | 50.00% (51/102) |"
      )
    );
    assert.ok(
      lines.includes(
        "| `index.ts` | 1 | 50.00% (50/100) | 50.00% (5/10) | 50.00% (1/2) | 50.00% (50/100) |"
      )
    );
    assert.ok(
      lines.includes("| `utils/` | 1 | 50.00% (1/2) | n/a | 50.00% (1/2) | 50.00% (1/2) |")
    );
    assert.ok(lines.includes(`_${NOTE}_`));
  });
});
