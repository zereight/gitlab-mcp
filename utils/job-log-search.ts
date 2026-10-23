import { Worker } from "node:worker_threads";

export const JOB_LOG_MAX_PATTERN_LENGTH = 500;
export const JOB_LOG_DEFAULT_CONTEXT_LINES = 5;
export const JOB_LOG_MAX_CONTEXT_LINES = 50;
export const JOB_LOG_DEFAULT_MAX_MATCHES = 20;
export const JOB_LOG_MAX_MATCHES = 100;
export const JOB_LOG_MAX_LINE_LENGTH = 4000;
// Marks where text was cut from a returned line that is longer than JOB_LOG_MAX_LINE_LENGTH.
export const JOB_LOG_CUT_MARKER = "…";
// Total text of all returned lines, so a broad pattern cannot return most of the searched log.
export const JOB_LOG_MAX_OUTPUT_CHARS = 100_000;
export const JOB_LOG_SEARCH_BUDGET_MS = 1000;
// Per-IP rate limits do not cap workers. This does, for the whole process.
export const JOB_LOG_MAX_ACTIVE_SEARCHES = 2;
// GitLab Runner cuts traces at output_limit (4 MiB by default), so most logs
// fit. GitLab accepts logs up to 100 MB; only the end of a longer log is
// handed to the worker.
export const JOB_LOG_MAX_SEARCH_CHARS = 10_000_000;

// Headroom for a JOB_LOG_MAX_SEARCH_CHARS trace and its cleaned copies.
const JOB_LOG_WORKER_MAX_OLD_GENERATION_MB = 256;
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

// Eval workers run as classic CommonJS unless Node detects module syntax
// (default only from 20.19 / 22.7), so worker_threads is loaded with require.
// Pattern and log arrive in workerData and are never interpolated into the source.
const SEARCH_WORKER_SOURCE = [
  'const { parentPort, workerData } = require("node:worker_threads");',
  "if (parentPort === null) {",
  '  throw new Error("job log search worker has no parent port");',
  "}",
  "const ansiPattern = new RegExp(workerData.ansiSource, workerData.ansiFlags);",
  "const sectionPattern = new RegExp(workerData.sectionSource, workerData.sectionFlags);",
  "const trailingCarriageReturn = /\\r+$/g;",
  "function cleanLine(line) {",
  "  ansiPattern.lastIndex = 0;",
  "  sectionPattern.lastIndex = 0;",
  "  trailingCarriageReturn.lastIndex = 0;",
  '  const withoutAnsi = line.replace(ansiPattern, "");',
  '  const withoutMarkers = withoutAnsi.replace(sectionPattern, "");',
  '  return withoutMarkers.replace(trailingCarriageReturn, "");',
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
  "  return windows;",
  "}",
  // toLowerCase can lengthen a line (U+0130 becomes two code units), so an
  // offset into the lowercased copy is mapped back one code point at a time.
  "function lineOffsetOf(line, lowerOffset) {",
  "  let lowerIndex = 0;",
  "  let lineIndex = 0;",
  "  for (const character of line) {",
  "    lowerIndex += character.toLowerCase().length;",
  "    if (lowerIndex > lowerOffset) {",
  "      return lineIndex;",
  "    }",
  "    lineIndex += character.length;",
  "  }",
  "  return line.length;",
  "}",
  "function firstMatchStart(line, expression, needle, caseSensitive) {",
  "  if (expression !== null) {",
  "    expression.lastIndex = 0;",
  "    const found = expression.exec(line);",
  "    return found === null ? -1 : found.index;",
  "  }",
  "  const haystack = caseSensitive ? line : line.toLowerCase();",
  "  const start = haystack.indexOf(needle);",
  "  if (start === -1 || haystack.length === line.length) {",
  "    return start;",
  "  }",
  "  return lineOffsetOf(line, start);",
  "}",
  // A long line keeps maxLineLength characters, markers included. The excerpt
  // starts a quarter of the way before matchStart (0 for context lines).
  "function excerptLine(line, matchStart, maxLength, marker) {",
  "  if (line.length <= maxLength) {",
  "    return line;",
  "  }",
  "  const room = maxLength - 2 * marker.length;",
  "  const lead = Math.floor(room / 4);",
  "  const from = Math.max(0, Math.min(matchStart - lead, line.length - room));",
  "  if (from === 0) {",
  "    return line.slice(0, maxLength - marker.length) + marker;",
  "  }",
  "  if (from + room >= line.length) {",
  "    return marker + line.slice(line.length - (maxLength - marker.length));",
  "  }",
  "  return marker + line.slice(from, from + room) + marker;",
  "}",
  // Lines are matched in full; only the returned text is cut to maxLineLength.
  // Returned text stops before the line that would pass maxOutputChars, and a
  // window cut before its first match is left out.
  "function collectFragments(cleaned, windows, longLineMatchStarts, data) {",
  "  const collected = { fragments: [], shownMatches: 0, linesTruncated: false, outputTruncated: false };",
  "  let outputChars = 0;",
  "  for (const matchWindow of windows) {",
  "    const lines = [];",
  "    let linesTruncated = false;",
  "    for (let offset = matchWindow.start; offset <= matchWindow.end; offset += 1) {",
  "      const line = cleaned[offset];",
  "      const matchStart = longLineMatchStarts.get(offset) ?? 0;",
  "      const text = excerptLine(line, matchStart, data.maxLineLength, data.cutMarker);",
  "      if (outputChars + text.length > data.maxOutputChars) {",
  "        collected.outputTruncated = true;",
  "        break;",
  "      }",
  "      outputChars += text.length;",
  "      linesTruncated = linesTruncated || line.length > data.maxLineLength;",
  "      lines.push({ lineNumber: data.lineOffset + offset + 1, text });",
  "    }",
  "    const endLine = matchWindow.start + lines.length;",
  "    const matchLines = matchWindow.matchLines.filter(lineNumber => lineNumber <= endLine);",
  "    if (matchLines.length > 0) {",
  "      collected.fragments.push({",
  "        startLine: data.lineOffset + matchWindow.start + 1,",
  "        endLine: data.lineOffset + endLine,",
  "        matchLines: matchLines.map(lineNumber => data.lineOffset + lineNumber),",
  "        lines,",
  "      });",
  "      collected.shownMatches += matchLines.length;",
  "      collected.linesTruncated = collected.linesTruncated || linesTruncated;",
  "    }",
  "    if (collected.outputTruncated) {",
  "      break;",
  "    }",
  "  }",
  "  return collected;",
  "}",
  "function runSearch(data) {",
  "  const startedAt = Date.now();",
  '  const rawLines = data.log.split("\\n");',
  "  const cleaned = [];",
  "  for (let index = 0; index < rawLines.length; index += 1) {",
  "    if (overBudget(startedAt, data.budgetMs)) {",
  "      return { timeout: true };",
  "    }",
  "    cleaned.push(cleanLine(rawLines[index]));",
  "  }",
  "  const expression = data.regex ? new RegExp(data.pattern, data.flags) : null;",
  "  const needle = data.caseSensitive ? data.pattern : data.pattern.toLowerCase();",
  "  const matchIndexes = [];",
  "  const longLineMatchStarts = new Map();",
  "  for (let index = 0; index < cleaned.length; index += 1) {",
  "    if (overBudget(startedAt, data.budgetMs)) {",
  "      return { timeout: true };",
  "    }",
  "    const line = cleaned[index];",
  "    const matchStart = firstMatchStart(line, expression, needle, data.caseSensitive);",
  "    if (matchStart !== -1) {",
  "      matchIndexes.push(index);",
  "      if (line.length > data.maxLineLength) {",
  "        longLineMatchStarts.set(index, matchStart);",
  "      }",
  "    }",
  "  }",
  "  const windows = mergeWindows(matchIndexes, data.contextLines, cleaned.length, data.maxMatches);",
  "  const collected = collectFragments(cleaned, windows, longLineMatchStarts, data);",
  "  return {",
  "    result: {",
  "      totalLines: data.lineOffset + cleaned.length,",
  "      firstSearchedLine: data.lineOffset + 1,",
  "      skippedChars: data.skippedChars,",
  "      totalMatches: matchIndexes.length,",
  "      shownMatches: collected.shownMatches,",
  "      truncated: matchIndexes.length > collected.shownMatches,",
  "      outputTruncated: collected.outputTruncated,",
  "      contextLines: data.contextLines,",
  "      linesTruncated: collected.linesTruncated,",
  "      fragments: collected.fragments,",
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
  // 1 unless the log was over JOB_LOG_MAX_SEARCH_CHARS and only its end was searched.
  readonly firstSearchedLine: number;
  readonly skippedChars: number;
  readonly totalMatches: number;
  readonly shownMatches: number;
  readonly truncated: boolean;
  // Returned lines stopped at JOB_LOG_MAX_OUTPUT_CHARS; truncated still covers every unshown match.
  readonly outputTruncated: boolean;
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
    typeof value.firstSearchedLine === "number" &&
    typeof value.skippedChars === "number" &&
    typeof value.totalMatches === "number" &&
    typeof value.shownMatches === "number" &&
    typeof value.truncated === "boolean" &&
    typeof value.outputTruncated === "boolean" &&
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

interface BoundedJobLog {
  readonly text: string;
  readonly lineOffset: number;
  readonly skippedChars: number;
}

function countNewlines(text: string, end: number): number {
  let count = 0;
  let index = text.indexOf("\n");
  while (index !== -1 && index < end) {
    count += 1;
    index = text.indexOf("\n", index + 1);
  }
  return count;
}

// Keeps at most JOB_LOG_MAX_SEARCH_CHARS from the end, starting at a line
// boundary when there is one, so an oversized trace is never cloned into a
// worker. Skipped lines are counted so line numbers stay absolute.
function boundJobLog(log: string): BoundedJobLog {
  if (log.length <= JOB_LOG_MAX_SEARCH_CHARS) {
    return { text: log, lineOffset: 0, skippedChars: 0 };
  }
  const earliestStart = log.length - JOB_LOG_MAX_SEARCH_CHARS;
  const newline = log.indexOf("\n", earliestStart - 1);
  // Without a newline that leaves text to search, start mid-line instead.
  const start = newline === -1 || newline >= log.length - 1 ? earliestStart : newline + 1;
  return {
    text: log.slice(start),
    lineOffset: countNewlines(log, start),
    skippedChars: start,
  };
}

interface JobLogWorkerInput {
  readonly log: string;
  readonly lineOffset: number;
  readonly skippedChars: number;
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
        lineOffset: input.lineOffset,
        skippedChars: input.skippedChars,
        pattern: input.pattern,
        regex: input.regex,
        caseSensitive: input.caseSensitive,
        flags: input.flags,
        contextLines: input.contextLines,
        maxMatches: input.maxMatches,
        budgetMs: JOB_LOG_SEARCH_BUDGET_MS,
        maxLineLength: JOB_LOG_MAX_LINE_LENGTH,
        maxOutputChars: JOB_LOG_MAX_OUTPUT_CHARS,
        cutMarker: JOB_LOG_CUT_MARKER,
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

  const bounded = boundJobLog(log);
  acquireSearchWorkerSlot();
  try {
    return await executeJobLogSearch({
      log: bounded.text,
      lineOffset: bounded.lineOffset,
      skippedChars: bounded.skippedChars,
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
    `[Search pattern=${JSON.stringify(input.pattern)} regex=${regex} case_sensitive=${caseSensitive} context_lines=${result.contextLines}; total_lines=${result.totalLines}; total_matches=${result.totalMatches}; shown_matches=${result.shownMatches}; truncated=${result.truncated}; output_truncated=${result.outputTruncated}. limit and offset are ignored when pattern is set. Line numbers are 1-based from the start of the log.]`,
  ];
  if (result.skippedChars > 0) {
    header.push(
      `[Log is longer than ${JOB_LOG_MAX_SEARCH_CHARS} characters: only the end was searched, from line ${result.firstSearchedLine}; the first ${result.skippedChars} characters were skipped.]`
    );
  }
  if (result.linesTruncated) {
    header.push(
      `[Some returned lines were cut to ${JOB_LOG_MAX_LINE_LENGTH} characters; ${JOB_LOG_CUT_MARKER} marks omitted text. A matching line is cut around its first match. Matching used the full line.]`
    );
  }
  if (result.outputTruncated) {
    header.push(
      `[Output stopped at ${JOB_LOG_MAX_OUTPUT_CHARS} characters of returned line text, so later lines and matches are not shown even within max_matches. Use a more specific pattern or fewer context_lines.]`
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
