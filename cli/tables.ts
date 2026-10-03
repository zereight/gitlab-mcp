import type { TableSpec } from "./curated.js";

const MAX_CELL = 48;

export interface FormattedTable {
  readonly stdout: string;
  readonly stderr: string;
}

export function renderTable(value: unknown, spec: TableSpec | undefined): FormattedTable {
  if (spec === undefined || spec.kind === "text") {
    return { stdout: stringifyValue(value), stderr: "" };
  }

  const rows = spec.kind === "list" ? asObjectRows(value) : undefined;
  if (spec.kind === "list") {
    if (rows === undefined) {
      return {
        stdout: stringifyValue(value),
        stderr: "No table renderer for this result; printed JSON.\n",
      };
    }
    if (rows.length === 0) {
      return { stdout: "No items.\n", stderr: "" };
    }
    const columns = spec.columns ?? inferColumns(rows);
    return { stdout: formatGrid(rows, columns), stderr: "" };
  }

  const record = asRecord(value);
  if (record === undefined) {
    return {
      stdout: stringifyValue(value),
      stderr: "No table renderer for this result; printed JSON.\n",
    };
  }
  const keys = spec.columns ?? Object.keys(record);
  return { stdout: formatKeyValue(record, keys), stderr: "" };
}

function asObjectRows(value: unknown): Array<Record<string, unknown>> | undefined {
  if (Array.isArray(value)) {
    return value.every(isRecord) ? value : undefined;
  }
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  for (const nested of Object.values(record)) {
    if (Array.isArray(nested) && nested.every(isRecord)) {
      return nested;
    }
  }
  return undefined;
}

function inferColumns(rows: Array<Record<string, unknown>>): readonly string[] {
  const preferred = ["iid", "id", "name", "key", "tag_name", "slug", "short_id", "state", "status", "title", "path_with_namespace"];
  const present = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      present.add(key);
    }
  }
  const columns = preferred.filter(key => present.has(key));
  return columns.length > 0 ? columns : Object.keys(rows[0] ?? {}).slice(0, 4);
}

function formatGrid(rows: Array<Record<string, unknown>>, columns: readonly string[]): string {
  const header = columns.map(key => key.toUpperCase());
  const cells = rows.map(row => columns.map(key => cellText(row[key])));
  const widths = columns.map((_, index) => {
    const longest = cells.reduce(
      (max, row) => Math.max(max, row[index]?.length ?? 0),
      header[index]?.length ?? 0
    );
    return Math.min(longest, MAX_CELL);
  });
  const lines = [
    padRow(header, widths),
    ...cells.map(row => padRow(row, widths)),
  ];
  return `${lines.join("\n")}\n`;
}

function formatKeyValue(record: Record<string, unknown>, keys: readonly string[]): string {
  const lines: string[] = [];
  for (const key of keys) {
    if (record[key] === undefined) {
      continue;
    }
    lines.push(`${key}\t${cellText(record[key])}`);
  }
  if (lines.length === 0) {
    return stringifyValue(record);
  }
  return `${lines.join("\n")}\n`;
}

function padRow(cells: readonly string[], widths: readonly number[]): string {
  return cells
    .map((cell, index) => truncate(cell).padEnd(widths[index] ?? 0))
    .join("  ")
    .trimEnd();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return truncate(String(value));
  }
  return truncate(JSON.stringify(value));
}

function truncate(value: string): string {
  if (value.length <= MAX_CELL) {
    return value;
  }
  return `${value.slice(0, MAX_CELL - 1)}…`;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value.endsWith("\n") ? value : `${value}\n`;
  }
  return `${JSON.stringify(value, null, 2)}\n`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
