import { Worker } from "node:worker_threads";

export const JOB_LOG_MAX_PATTERN_LENGTH = 500;
export const JOB_LOG_DEFAULT_CONTEXT_LINES = 5;
export const JOB_LOG_MAX_CONTEXT_LINES = 50;
export const JOB_LOG_DEFAULT_MAX_MATCHES = 20;
export const JOB_LOG_MAX_MATCHES = 100;
export const JOB_LOG_MAX_LINE_LENGTH = 4000;
export const JOB_LOG_SEARCH_BUDGET_MS = 1000;
// Per-IP rate limits do not cap workers. This does, for the whole process.
export const JOB_LOG_MAX_ACTIVE_SEARCHES = 2;

// Headroom for a ~100MB trace and its cleaned copies, still a hard heap cap.
const JOB_LOG_WORKER_MAX_OLD_GENERATION_MB = 1024;
const ANSI_ESCAPE_CHARACTER = String.fromCharCode(0x1b);
const ANSI_ESCAPE_PATTERN = new RegExp(
  `${ANSI_ESCAPE_CHARACTER}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "g"
);
const SECTION_MARKER_PATTERN = /\r?section_(?:start|end):[^\r\n]*\r?/g;
const SEARCH_BUDGET_MESSAGE =
  "Job log search exceeded the time limit. Use a simpler pattern or turn regex off.";
const SEARCH_CAPACITY_MESSAGE = "Job log search is already running at capacity. Retry shortly.";
const SEARCH_FAILED_MESSAGE = "Job log search failed.";

// The parent is ESM, so this program is ESM too. Pattern and log arrive in
// workerData and are never interpolated into the source.
const SEARCH_WORKER_SOURCE = [
  'import { parentPort, workerData } from "node:worker_threads";',
  "if (parentPort === null) {",
  '  throw new Error("job log search worker has no parent port");',
  "}",
  "const ansiPattern = new RegExp(workerData.ansiSource, workerData.ansiFlags);",
  "const sectionPattern = new RegExp(workerData.sectionSource, workerData.sectionFlags);",
  "const trailingCarriageReturn = /\\r+$/g;",
  "function cleanLine(line, maxLineLength) {",
  "  ansiPattern.lastIndex = 0;",
  "  sectionPattern.lastIndex = 0;",
  "  trailingCarriageReturn.lastIndex = 0;",
  '  const withoutAnsi = line.replace(ansiPattern, "");',
  '  const withoutMarkers = withoutAnsi.replace(sectionPattern, "");',
  '  const normalized = withoutMarkers.replace(trailingCarriageReturn, "");',
  "  if (normalized.length <= maxLineLength) {",
  "    return { text: normalized, truncated: false };",
  "  }",
  "  return { text: normalized.slice(0, maxLineLength), truncated: true };",
  "}",
  "function overBudget(startedAt, budgetMs) {",
  "  return Date.now() - startedAt > budgetMs;",
  "}",
  "function mergeWindows(matchIndexes, contextLines, lineCount, maxMatches) {",
  "  const limited = matchIndexes.slice(0, maxMatches);",
  "  const windows = [];",
  "  for (const index of limited) {",
  "    const start = Math.max(0, index - contextLines);",
  "    const end = Math.min(lineCount - 1, index + contextLines);",
  "    const lineNumber = index + 1;",
  "    const previous = windows[windows.length - 1];",
  "    if (previous !== undefined && start <= previous.end) {",
  "      previous.end = Math.max(previous.end, end);",
  "      previous.matchLines.push(lineNumber);",
  "      continue;",
  "    }",
  "    windows.push({ start, end, matchLines: [lineNumber] });",
  "  }",
  "  return { windows, shownMatches: limited.length };",
  "}",
  "function runSearch(data) {",
  "  const startedAt = Date.now();",
  '  const rawLines = data.log.split("\\n");',
  "  const cleaned = [];",
  "  let linesTruncated = false;",
  "  for (let index = 0; index < rawLines.length; index += 1) {",
  "    if (overBudget(startedAt, data.budgetMs)) {",
  "      return { timeout: true };",
  "    }",
  "    const line = cleanLine(rawLines[index], data.maxLineLength);",
  "    if (line.truncated) {",
  "      linesTruncated = true;",
  "    }",
  "    cleaned.push(line.text);",
  "  }",
  "  const expression = data.regex ? new RegExp(data.pattern, data.flags) : null;",
  "  const needle = data.caseSensitive ? data.pattern : data.pattern.toLowerCase();",
  "  const matchIndexes = [];",
  "  for (let index = 0; index < cleaned.length; index += 1) {",
  "    if (overBudget(startedAt, data.budgetMs)) {",
  "      return { timeout: true };",
  "    }",
  "    const line = cleaned[index];",
  "    let matched = false;",
  "    if (expression !== null) {",
  "      expression.lastIndex = 0;",
  "      matched = expression.test(line);",
  "    } else {",
  "      const haystack = data.caseSensitive ? line : line.toLowerCase();",
  "      matched = haystack.includes(needle);",
  "    }",
  "    if (matched) {",
  "      matchIndexes.push(index);",
  "    }",
  "  }",
  "  const merged = mergeWindows(matchIndexes, data.contextLines, cleaned.length, data.maxMatches);",
  "  const fragments = merged.windows.map(matchWindow => {",
  "    const lines = [];",
  "    for (let offset = matchWindow.start; offset <= matchWindow.end; offset += 1) {",
  "      lines.push({ lineNumber: offset + 1, text: cleaned[offset] });",
  "    }",
  "    return {",
  "      startLine: matchWindow.start + 1,",
  "      endLine: matchWindow.end + 1,",
  "      matchLines: matchWindow.matchLines,",
  "      lines,",
  "    };",
  "  });",
  "  return {",
  "    result: {",
  "      totalLines: cleaned.length,",
  "      totalMatches: matchIndexes.length,",
  "      shownMatches: merged.shownMatches,",
  "      truncated: matchIndexes.length > merged.shownMatches,",
  "      contextLines: data.contextLines,",
  "      linesTruncated,",
  "      fragments,",
  "    },",
  "  };",
  "}",
  "try {",
  "  parentPort.postMessage(runSearch(workerData));",
  "} catch {",
  "  parentPort.postMessage({ failed: true });",
  "}",
].join("\n");

export class JobLogSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobLogSearchError";
  }
}

export interface JobLogSearchInput {
  readonly pattern: string;
  readonly regex?: boolean;
  readonly caseSensitive?: boolean;
  readonly contextLines?: number;
  readonly maxMatches?: number;
}

export interface JobLogFragmentLine {
  readonly lineNumber: number;
  readonly text: string;
}

export interface JobLogFragment {
  readonly startLine: number;
  readonly endLine: number;
  readonly matchLines: readonly number[];
  readonly lines: readonly JobLogFragmentLine[];
}

export interface JobLogSearchResult {
  readonly totalLines: number;
  readonly totalMatches: number;
  readonly shownMatches: number;
  readonly truncated: boolean;
  readonly contextLines: number;
  readonly linesTruncated: boolean;
  readonly fragments: readonly JobLogFragment[];
}

let activeSearchWorkers = 0;

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const truncated = Math.trunc(value);
  if (truncated < min) {
    return min;
  }
  if (truncated > max) {
    return max;
  }
  return truncated;
}

function assertPatternLength(pattern: string): void {
  if (pattern.length > JOB_LOG_MAX_PATTERN_LENGTH) {
    throw new JobLogSearchError(`pattern exceeds ${JOB_LOG_MAX_PATTERN_LENGTH} characters`);
  }
}

function compileRegExp(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new JobLogSearchError(`Invalid regular expression: ${detail}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimeoutMessage(value: unknown): value is { timeout: true } {
  return isRecord(value) && value.timeout === true;
}

function isFragmentLine(value: unknown): value is JobLogFragmentLine {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.lineNumber === "number" && typeof value.text === "string";
}

function isFragment(value: unknown): value is JobLogFragment {
  if (!isRecord(value)) {
    return false;
  }
  const matchLines = value.matchLines;
  const lines = value.lines;
  return (
    typeof value.startLine === "number" &&
    typeof value.endLine === "number" &&
    Array.isArray(matchLines) &&
    matchLines.every(item => typeof item === "number") &&
    Array.isArray(lines) &&
    lines.every(isFragmentLine)
  );
}

function isSearchResult(value: unknown): value is JobLogSearchResult {
  if (!isRecord(value)) {
    return false;
  }
  const fragments = value.fragments;
  return (
    typeof value.totalLines === "number" &&
    typeof value.totalMatches === "number" &&
    typeof value.shownMatches === "number" &&
    typeof value.truncated === "boolean" &&
    typeof value.contextLines === "number" &&
    typeof value.linesTruncated === "boolean" &&
    Array.isArray(fragments) &&
    fragments.every(isFragment)
  );
}

function isResultMessage(value: unknown): value is { result: JobLogSearchResult } {
  return isRecord(value) && isSearchResult(value.result);
}

function acquireSearchWorkerSlot(): void {
  if (activeSearchWorkers >= JOB_LOG_MAX_ACTIVE_SEARCHES) {
    throw new JobLogSearchError(SEARCH_CAPACITY_MESSAGE);
  }
  activeSearchWorkers += 1;
}

function releaseSearchWorkerSlot(): void {
  activeSearchWorkers -= 1;
}

interface JobLogWorkerInput {
  readonly log: string;
  readonly pattern: string;
  readonly regex: boolean;
  readonly caseSensitive: boolean;
  readonly flags: string;
  readonly contextLines: number;
  readonly maxMatches: number;
}

function executeJobLogSearch(input: JobLogWorkerInput): Promise<JobLogSearchResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(SEARCH_WORKER_SOURCE, {
      eval: true,
      resourceLimits: {
        maxOldGenerationSizeMb: JOB_LOG_WORKER_MAX_OLD_GENERATION_MB,
      },
      workerData: {
        log: input.log,
        pattern: input.pattern,
        regex: input.regex,
        caseSensitive: input.caseSensitive,
        flags: input.flags,
        contextLines: input.contextLines,
        maxMatches: input.maxMatches,
        budgetMs: JOB_LOG_SEARCH_BUDGET_MS,
        maxLineLength: JOB_LOG_MAX_LINE_LENGTH,
        ansiSource: ANSI_ESCAPE_PATTERN.source,
        ansiFlags: ANSI_ESCAPE_PATTERN.flags,
        sectionSource: SECTION_MARKER_PATTERN.source,
        sectionFlags: SECTION_MARKER_PATTERN.flags,
      },
    });
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        worker.terminate().then(action, action);
      } catch {
        action();
      }
    };
    const timer = setTimeout(() => {
      finish(() => {
        reject(new JobLogSearchError(SEARCH_BUDGET_MESSAGE));
      });
    }, JOB_LOG_SEARCH_BUDGET_MS);
    worker.once("message", (message: unknown) => {
      if (isTimeoutMessage(message)) {
        finish(() => {
          reject(new JobLogSearchError(SEARCH_BUDGET_MESSAGE));
        });
        return;
      }
      if (isResultMessage(message)) {
        finish(() => {
          resolve(message.result);
        });
        return;
      }
      finish(() => {
        reject(new JobLogSearchError(SEARCH_FAILED_MESSAGE));
      });
    });
    worker.once("error", () => {
      finish(() => {
        reject(new JobLogSearchError(SEARCH_FAILED_MESSAGE));
      });
    });
    worker.once("exit", () => {
      // Message delivery can be queued behind exit. Yield once so a result
      // posted before the worker stopped is not reported as a failure.
      setImmediate(() => {
        finish(() => {
          reject(new JobLogSearchError(SEARCH_FAILED_MESSAGE));
        });
      });
    });
  });
}

export async function searchJobLog(
  log: string,
  input: JobLogSearchInput
): Promise<JobLogSearchResult> {
  if (input.pattern.length === 0) {
    throw new JobLogSearchError("pattern must not be empty");
  }
  assertPatternLength(input.pattern);

  const contextLines = clampInteger(
    input.contextLines,
    JOB_LOG_DEFAULT_CONTEXT_LINES,
    0,
    JOB_LOG_MAX_CONTEXT_LINES
  );
  const maxMatches = clampInteger(
    input.maxMatches,
    JOB_LOG_DEFAULT_MAX_MATCHES,
    1,
    JOB_LOG_MAX_MATCHES
  );
  const regex = input.regex === true;
  const caseSensitive = input.caseSensitive === true;
  const flags = caseSensitive ? "" : "i";
  if (regex) {
    compileRegExp(input.pattern, flags);
  }

  acquireSearchWorkerSlot();
  try {
    return await executeJobLogSearch({
      log,
      pattern: input.pattern,
      regex,
      caseSensitive,
      flags,
      contextLines,
      maxMatches,
    });
  } finally {
    releaseSearchWorkerSlot();
  }
}

export function formatJobLogSearch(
  result: JobLogSearchResult,
  input: Pick<JobLogSearchInput, "pattern" | "regex" | "caseSensitive">
): string {
  const regex = input.regex === true;
  const caseSensitive = input.caseSensitive === true;
  const header = [
    `[Search pattern=${JSON.stringify(input.pattern)} regex=${regex} case_sensitive=${caseSensitive} context_lines=${result.contextLines}; total_lines=${result.totalLines}; total_matches=${result.totalMatches}; shown_matches=${result.shownMatches}; truncated=${result.truncated}. limit and offset are ignored when pattern is set. Line numbers are 1-based from the start of the log.]`,
  ];
  if (result.linesTruncated) {
    header.push(
      `[Some lines were truncated to ${JOB_LOG_MAX_LINE_LENGTH} characters before matching.]`
    );
  }
  if (result.fragments.length === 0) {
    return `${header.join("\n")}\n\nNo matches.`;
  }

  const blocks = result.fragments.map(fragment => {
    const body = fragment.lines.map(line => `${line.lineNumber}|${line.text}`).join("\n");
    return `--- lines ${fragment.startLine}-${fragment.endLine} (matches: ${fragment.matchLines.join(",")}) ---\n${body}`;
  });
  return `${header.join("\n")}\n\n${blocks.join("\n\n")}`;
}
