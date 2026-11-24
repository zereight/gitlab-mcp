#!/usr/bin/env tsx
/**
 * Render an istanbul `coverage-summary.json` (c8 `json-summary` reporter) as a
 * Markdown table: overall totals, `index.ts`, then one row per top-level source
 * directory. Used by `npm run coverage:summary` and the Coverage workflow's job
 * summary. Informational only — this never fails on low coverage.
 *
 * Not to be confused with scripts/generate-tool-coverage.ts, which reports
 * which MCP tools the tests invoke, not line/branch coverage.
 *
 * Usage: tsx scripts/code-coverage-summary.ts [coverage/coverage-summary.json]
 */

import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const METRICS = ["lines", "branches", "functions", "statements"] as const;
export type Metric = (typeof METRICS)[number];

export interface MetricCounts {
  total: number;
  covered: number;
}

export type FileSummary = Record<Metric, MetricCounts>;

/** Shape of istanbul's json-summary: `total` plus one entry per absolute file path. */
export type CoverageSummary = { total: FileSummary } & Record<string, FileSummary>;

/** Files at the repository root are reported individually only when listed here. */
export const HIGHLIGHTED_ROOT_FILES = ["index.ts"];
export const OTHER_ROOT_FILES_LABEL = "other root *.ts";

/**
 * In-process unit tests load sources through tsx, spawned servers load the tsc
 * build; the two transpilers place some functions/branches at different
 * columns, so istanbul cannot merge them and lists both.
 */
export const NOTE =
  "Informational only: no coverage threshold is enforced. Files loaded both by " +
  "in-process unit tests (tsx) and by the spawned server (build/) may list some " +
  "functions/branches twice, which understates those percentages; lines are unaffected.";

export interface SummaryRow {
  label: string;
  files: number;
  counts: FileSummary;
}

function emptySummary(): FileSummary {
  return {
    lines: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    statements: { total: 0, covered: 0 },
  };
}

function addInto(target: FileSummary, source: FileSummary): void {
  for (const metric of METRICS) {
    target[metric].total += source[metric]?.total ?? 0;
    target[metric].covered += source[metric]?.covered ?? 0;
  }
}

/** Formats one metric as `61.23% (1,234/2,015)`; `n/a` when there is nothing to cover. */
export function formatMetric({ total, covered }: MetricCounts): string {
  if (total === 0) return "n/a";
  // Same truncation as istanbul-lib-coverage's percent(), so numbers match c8's text output.
  const pct = Math.floor((1000 * 100 * covered) / total / 10) / 100;
  return `${pct.toFixed(2)}% (${covered.toLocaleString("en-US")}/${total.toLocaleString("en-US")})`;
}

/**
 * Groups per-file entries into rows: highlighted root files first, then each
 * top-level directory (alphabetical), then the remaining root files.
 */
export function groupSummary(summary: CoverageSummary, rootDir: string): SummaryRow[] {
  const highlighted = new Map<string, SummaryRow>();
  const dirs = new Map<string, SummaryRow>();
  const otherRoot: SummaryRow = { label: OTHER_ROOT_FILES_LABEL, files: 0, counts: emptySummary() };

  for (const [file, counts] of Object.entries(summary)) {
    if (file === "total") continue;
    const rel = relative(rootDir, file).split(sep).join("/");
    const slash = rel.indexOf("/");
    let row: SummaryRow;
    if (slash === -1) {
      if (HIGHLIGHTED_ROOT_FILES.includes(rel)) {
        row = highlighted.get(rel) ?? { label: rel, files: 0, counts: emptySummary() };
        highlighted.set(rel, row);
      } else {
        row = otherRoot;
      }
    } else {
      const dir = `${rel.slice(0, slash)}/`;
      row = dirs.get(dir) ?? { label: dir, files: 0, counts: emptySummary() };
      dirs.set(dir, row);
    }
    row.files += 1;
    addInto(row.counts, counts);
  }

  const rows = [
    ...HIGHLIGHTED_ROOT_FILES.flatMap(name => {
      const row = highlighted.get(name);
      return row ? [row] : [];
    }),
    ...[...dirs.values()].sort((a, b) => a.label.localeCompare(b.label)),
  ];
  if (otherRoot.files > 0) rows.push(otherRoot);
  return rows;
}

export function buildSummaryMarkdown(summary: CoverageSummary, rootDir: string): string {
  const header = "| Scope | Files | Lines | Branches | Functions | Statements |";
  const divider = "| --- | ---: | ---: | ---: | ---: | ---: |";
  const formatRow = (label: string, files: number | string, counts: FileSummary) =>
    `| ${label} | ${files} | ${METRICS.map(metric => formatMetric(counts[metric])).join(" | ")} |`;

  const rows = groupSummary(summary, rootDir);
  const fileCount = rows.reduce((sum, row) => sum + row.files, 0);
  return [
    "## Code coverage (mock/unit suite)",
    "",
    header,
    divider,
    formatRow("**Total**", fileCount, summary.total),
    ...rows.map(row => formatRow(`\`${row.label}\``, row.files, row.counts)),
    "",
    `_${NOTE}_`,
    "",
  ].join("\n");
}

function main(argv: string[]): void {
  const summaryPath = resolve(argv[0] ?? "coverage/coverage-summary.json");
  let summary: CoverageSummary;
  try {
    summary = JSON.parse(readFileSync(summaryPath, "utf8")) as CoverageSummary;
  } catch (error) {
    process.stderr.write(
      `Cannot read ${summaryPath} (${(error as Error).message}). Run \`npm run test:coverage\` first.\n`
    );
    process.exit(1);
  }
  if (!summary.total) {
    process.stderr.write(`${summaryPath} has no "total" entry; is it a json-summary report?\n`);
    process.exit(1);
  }
  process.stdout.write(buildSummaryMarkdown(summary, process.cwd()));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
