import { Worker } from "node:worker_threads";

export const JOB_LOG_MAX_PATTERN_LENGTH = 500;
export const JOB_LOG_DEFAULT_CONTEXT_LINES = 5;
export const JOB_LOG_MAX_CONTEXT_LINES = 50;
export const JOB_LOG_DEFAULT_MAX_MATCHES = 20;
export const JOB_LOG_MAX_MATCHES = 100;
export const JOB_LOG_MAX_LINE_LENGTH = 4000;
export const JOB_LOG_SEARCH_BUDGET_MS = 1000;

const ANSI_ESCAPE_CHARACTER = String.fromCharCode(0x1b);
const ANSI_ESCAPE_PATTERN = new RegExp(
  `${ANSI_ESCAPE_CHARACTER}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "g"
);
const SECTION_MARKER_PATTERN = /\r?section_(?:start|end):[^\r\n]*\r?/g;
const SEARCH_BUDGET_MESSAGE =
  "Job log search exceeded the time limit. Use a simpler pattern or turn regex off.";

// Evaluated in a worker so one catastrophic pattern cannot block the server.
// The parent is ESM, so this program is ESM too. The pattern arrives in
// workerData and is never interpolated into the source.
const REGEX_MATCH_WORKER_SOURCE = `
import { parentPort, workerData } from "node:worker_threads";
if (parentPort === null) {
  throw new Error("job log search worker has no parent port");
}
const expression = new RegExp(workerData.pattern, workerData.flags);
const startedAt = Date.now();
const matches = [];
let timedOut = false;
for (let index = 0; index < workerData.lines.length; index += 1) {
  if (Date.now() - startedAt > workerData.budgetMs) {
    timedOut = true;
    break;
  }
  expression.lastIndex = 0;
  if (expression.test(workerData.lines[index])) {
    matches.push(index);
  }
}
parentPort.postMessage(timedOut ? { timeout: true } : { matches });
`;

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

interface CleanedLine {
  readonly text: string;
  readonly truncated: boolean;
}

interface MatchWindow {
  start: number;
  end: number;
  matchLines: number[];
}

export function cleanJobLogLine(line: string): CleanedLine {
  const withoutAnsi = line.replace(ANSI_ESCAPE_PATTERN, "");
  const withoutMarkers = withoutAnsi.replace(SECTION_MARKER_PATTERN, "");
  const normalized = withoutMarkers.replace(/\r+$/g, "");
  if (normalized.length <= JOB_LOG_MAX_LINE_LENGTH) {
    return { text: normalized, truncated: false };
  }
  return { text: normalized.slice(0, JOB_LOG_MAX_LINE_LENGTH), truncated: true };
}

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

function matchSubstringLines(
  lines: readonly string[],
  pattern: string,
  caseSensitive: boolean
): number[] {
  const needle = caseSensitive ? pattern : pattern.toLowerCase();
  const matchIndexes: number[] = [];
  const startedAt = Date.now();
  for (const [index, line] of lines.entries()) {
    if (Date.now() - startedAt > JOB_LOG_SEARCH_BUDGET_MS) {
      throw new JobLogSearchError(SEARCH_BUDGET_MESSAGE);
    }
    const haystack = caseSensitive ? line : line.toLowerCase();
    if (haystack.includes(needle)) {
      matchIndexes.push(index);
    }
  }
  return matchIndexes;
}

function isTimeoutMessage(value: unknown): value is { timeout: true } {
  return (
    typeof value === "object" && value !== null && "timeout" in value && value.timeout === true
  );
}

function isMatchesMessage(value: unknown): value is { matches: number[] } {
  if (typeof value !== "object" || value === null || !("matches" in value)) {
    return false;
  }
  const matches = value.matches;
  return Array.isArray(matches) && matches.every(item => typeof item === "number");
}

function matchRegexLinesAsync(
  lines: readonly string[],
  pattern: string,
  flags: string
): Promise<number[]> {
  if (lines.length === 0) {
    return Promise.resolve([]);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(REGEX_MATCH_WORKER_SOURCE, {
      eval: true,
      workerData: {
        lines,
        pattern,
        flags,
        budgetMs: JOB_LOG_SEARCH_BUDGET_MS,
      },
    });
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      action();
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
      if (isMatchesMessage(message)) {
        finish(() => {
          resolve(message.matches);
        });
        return;
      }
      finish(() => {
        reject(new JobLogSearchError("Job log search failed."));
      });
    });
    worker.once("error", () => {
      finish(() => {
        reject(new JobLogSearchError("Job log search failed."));
      });
    });
  });
}

function compileRegExp(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new JobLogSearchError(`Invalid regular expression: ${detail}`);
  }
}

function mergeMatchWindows(
  matchIndexes: readonly number[],
  contextLines: number,
  lineCount: number,
  maxMatches: number
): { readonly windows: readonly MatchWindow[]; readonly shownMatches: number } {
  const limited = matchIndexes.slice(0, maxMatches);
  const windows: MatchWindow[] = [];

  for (const index of limited) {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(lineCount - 1, index + contextLines);
    const lineNumber = index + 1;
    const previous = windows[windows.length - 1];
    if (previous !== undefined && start <= previous.end) {
      previous.end = Math.max(previous.end, end);
      previous.matchLines.push(lineNumber);
      continue;
    }
    windows.push({ start, end, matchLines: [lineNumber] });
  }

  return { windows, shownMatches: limited.length };
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
  const rawLines = log.split("\n");
  const cleaned = rawLines.map(line => cleanJobLogLine(line));
  const linesTruncated = cleaned.some(line => line.truncated);
  const texts = cleaned.map(line => line.text);
  const flags = caseSensitive ? "" : "i";
  if (regex) {
    compileRegExp(input.pattern, flags);
  }
  const matchIndexes = regex
    ? await matchRegexLinesAsync(texts, input.pattern, flags)
    : matchSubstringLines(texts, input.pattern, caseSensitive);

  const { windows, shownMatches } = mergeMatchWindows(
    matchIndexes,
    contextLines,
    cleaned.length,
    maxMatches
  );
  const fragments = windows.map(window => ({
    startLine: window.start + 1,
    endLine: window.end + 1,
    matchLines: window.matchLines,
    lines: cleaned.slice(window.start, window.end + 1).map((line, offset) => ({
      lineNumber: window.start + offset + 1,
      text: line.text,
    })),
  }));

  return {
    totalLines: cleaned.length,
    totalMatches: matchIndexes.length,
    shownMatches,
    truncated: matchIndexes.length > shownMatches,
    contextLines,
    linesTruncated,
    fragments,
  };
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
