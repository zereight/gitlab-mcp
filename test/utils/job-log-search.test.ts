import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatJobLogSearch,
  JOB_LOG_CUT_MARKER,
  JOB_LOG_MAX_ACTIVE_SEARCHES,
  JOB_LOG_MAX_CONTEXT_LINES,
  JOB_LOG_MAX_LINE_LENGTH,
  JOB_LOG_MAX_MATCHES,
  JOB_LOG_MAX_OUTPUT_CHARS,
  JOB_LOG_MAX_PATTERN_LENGTH,
  JOB_LOG_MAX_REGEX_PROGRAM_SIZE,
  JOB_LOG_MAX_SEARCH_CHARS,
  JOB_LOG_MIN_CHUNK_CHARS,
  JOB_LOG_SEARCH_BUDGET_MS,
  JobLogSearchError,
  readJobLogTail,
  searchJobLog,
} from "../../utils/job-log-search.js";

// A backtracking engine never finishes these on a line this long.
const BACKTRACKING_LINE_LENGTH = 100_000;

function numberedLog(lines: readonly string[]): string {
  return lines.join("\n");
}

function pseudoRandomAb(length: number): string {
  const characters: string[] = [];
  let state = 1;
  for (let index = 0; index < length; index += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    characters.push(state & 65536 ? "a" : "b");
  }
  return characters.join("");
}

// RE2's DFA gives up on this pattern over varied text, and its NFA then tracks
// hundreds of threads per character, so the search runs past the time budget.
const SLOW_REGEX_PATTERN = "a.{900}$";
const SLOW_REGEX_LOG = pseudoRandomAb(1_000_000);

function slowRegexSearch() {
  return searchJobLog(SLOW_REGEX_LOG, { pattern: SLOW_REGEX_PATTERN, regex: true });
}

// "NEEDLE early", then 100-character filler lines worth exactly the search
// limit, then "NEEDLE late". Line 1 falls before the searched end, which
// starts partway through line 2.
const OVERSIZED_LOG_LINES = JOB_LOG_MAX_SEARCH_CHARS / 100 + 2;

function oversizedLog(): string {
  const filler = `${"x".repeat(99)}\n`.repeat(JOB_LOG_MAX_SEARCH_CHARS / 100);
  return `NEEDLE early\n${filler}NEEDLE late`;
}

// The searched end starts partway through line 2, before that line's NEEDLE.
function logCutBeforeMatchInItsLine(): string {
  const searched = `xxNEEDLE\n${"z".repeat(JOB_LOG_MAX_SEARCH_CHARS - "xxNEEDLE\n".length)}`;
  return `head\n${"x".repeat(10)}${searched}`;
}

// oversizedLog() behind multi-byte lines worth several 64 KiB chunks, so whole
// chunks are dropped while the stream is read.
function streamedOversizedLog(): string {
  return `${"✓ dropped\n".repeat(50_000)}${oversizedLog()}`;
}

// Chunks that decode to well under JOB_LOG_MIN_CHUNK_CHARS, so they are merged while read.
const SMALL_CHUNK_BYTES = JOB_LOG_MIN_CHUNK_CHARS / 4;

// Cuts the UTF-8 bytes without regard to character boundaries, like a network body.
async function* byteChunks(text: string, chunkBytes = 65_536): AsyncGenerator<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  for (let start = 0; start < bytes.length; start += chunkBytes) {
    yield bytes.subarray(start, start + chunkBytes);
  }
}

const FULL_LENGTH_MATCH_LINE = `NEEDLE${"x".repeat(JOB_LOG_MAX_LINE_LENGTH - "NEEDLE".length)}`;
const MATCH_LINES_WITHIN_OUTPUT_LIMIT = Math.floor(
  JOB_LOG_MAX_OUTPUT_CHARS / JOB_LOG_MAX_LINE_LENGTH
);
const MATCH_LINES_PAST_OUTPUT_LIMIT = MATCH_LINES_WITHIN_OUTPUT_LIMIT + 5;

function searchPastOutputLimit() {
  const log = numberedLog(
    Array.from({ length: MATCH_LINES_PAST_OUTPUT_LIMIT }, () => FULL_LENGTH_MATCH_LINE)
  );
  return searchJobLog(log, {
    pattern: "NEEDLE",
    contextLines: 0,
    maxMatches: JOB_LOG_MAX_MATCHES,
  });
}

// Each window is a short context line, a full-length match and another short
// context line. The window that reaches the output limit fits its first
// context line but not its match.
function searchWindowCutBeforeItsMatch() {
  const block = ["z", FULL_LENGTH_MATCH_LINE, "z", "z"];
  const log = numberedLog(
    Array.from({ length: MATCH_LINES_PAST_OUTPUT_LIMIT }, () => block).flat()
  );
  return searchJobLog(log, {
    pattern: "NEEDLE",
    contextLines: 1,
    maxMatches: JOB_LOG_MAX_MATCHES,
  });
}

function isTimeLimitError(error: unknown): boolean {
  return error instanceof JobLogSearchError && error.message.includes("exceeded the time limit");
}

function isUnsupportedSyntaxError(error: unknown): boolean {
  return (
    error instanceof JobLogSearchError &&
    error.message.startsWith("Invalid regular expression:") &&
    error.message.includes("RE2 syntax, which does not support backreferences or lookaround")
  );
}

describe("When searching a job log", () => {
  describe("with a case-insensitive substring", () => {
    it("should report the 1-based line number from the start of the log", async () => {
      const result = await searchJobLog(numberedLog(["ok", "Error: failed", "done"]), {
        pattern: "error",
        contextLines: 0,
      });

      assert.deepEqual(result.fragments[0]?.matchLines, [2]);
      assert.equal(result.totalLines, 3);
    });
  });

  describe("with a case-sensitive substring", () => {
    it("should skip a different-case line", async () => {
      const result = await searchJobLog("error: failed", {
        pattern: "ERROR",
        caseSensitive: true,
        contextLines: 0,
      });

      assert.equal(result.totalMatches, 0);
    });
  });

  describe("with a dot in substring mode", () => {
    it("should match the dot literally", async () => {
      const result = await searchJobLog(numberedLog(["a", "file.js", "b"]), {
        pattern: ".",
        contextLines: 0,
      });

      assert.deepEqual(result.fragments[0]?.matchLines, [2]);
    });
  });

  describe("with a regular expression", () => {
    it("should match the pattern ignoring case by default", async () => {
      const result = await searchJobLog(numberedLog(["ok", "ERR42 boom", "done"]), {
        pattern: "err\\d+",
        regex: true,
        contextLines: 0,
      });

      assert.deepEqual(result.fragments[0]?.matchLines, [2]);
    });
  });

  describe("with a case-sensitive regular expression", () => {
    it("should skip a different-case line", async () => {
      const result = await searchJobLog("err42 boom", {
        pattern: "ERR\\d+",
        regex: true,
        caseSensitive: true,
        contextLines: 0,
      });

      assert.equal(result.totalMatches, 0);
    });
  });

  describe("with a catastrophic backtracking pattern on a long line", () => {
    it("should report no match for a nested quantifier before a trailing character", async () => {
      const line = `${"a".repeat(BACKTRACKING_LINE_LENGTH)}!`;

      const result = await searchJobLog(line, { pattern: "(a+)+$", regex: true });

      assert.equal(result.totalMatches, 0);
    });

    it("should match an overlapping alternation that ends the line", async () => {
      const line = `${"a".repeat(BACKTRACKING_LINE_LENGTH)}b`;

      const result = await searchJobLog(line, { pattern: "(a|aa)+b", regex: true });

      assert.deepEqual(result.fragments[0]?.matchLines, [1]);
    });
  });

  describe("with a regular expression that is slow even in linear time", () => {
    it("should stop within the time budget", async () => {
      const startedAt = Date.now();
      await assert.rejects(slowRegexSearch, isTimeLimitError);
      assert.ok(Date.now() - startedAt < 5000);
    });

    it("should keep the event loop free for a concurrent search", async () => {
      let slowSettled = false;
      const slow = slowRegexSearch().then(
        () => "resolved",
        (error: unknown) => (isTimeLimitError(error) ? "timed out" : "failed")
      );
      void slow.then(() => {
        slowSettled = true;
      });
      try {
        const startedAt = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
        const timerDelay = Date.now() - startedAt;
        const other = await searchJobLog("ready", { pattern: "ready", contextLines: 0 });

        assert.ok(timerDelay < JOB_LOG_SEARCH_BUDGET_MS / 2);
        assert.equal(other.totalMatches, 1);
        assert.equal(slowSettled, false);
      } finally {
        assert.equal(await slow, "timed out");
      }
    });
  });

  describe("with every search worker busy", () => {
    it("should reject before cloning another log", async () => {
      const inFlight = Array.from({ length: JOB_LOG_MAX_ACTIVE_SEARCHES }, slowRegexSearch);
      try {
        const startedAt = Date.now();
        await assert.rejects(
          () => searchJobLog("ready", { pattern: "ready", contextLines: 0 }),
          (error: unknown) =>
            error instanceof JobLogSearchError && error.message.includes("capacity")
        );
        assert.ok(Date.now() - startedAt < JOB_LOG_SEARCH_BUDGET_MS);
      } finally {
        await Promise.allSettled(inFlight);
      }
    });
  });

  describe("with an invalid regular expression", () => {
    it("should throw a job log search error", async () => {
      await assert.rejects(
        () => searchJobLog("log", { pattern: "(", regex: true }),
        (error: unknown) =>
          error instanceof JobLogSearchError &&
          error.message.startsWith("Invalid regular expression:")
      );
    });
  });

  describe("with syntax that RE2 does not support", () => {
    it("should reject a backreference and name the RE2 syntax", async () => {
      await assert.rejects(
        () => searchJobLog("aa", { pattern: "(a)\\1", regex: true }),
        isUnsupportedSyntaxError
      );
    });

    it("should reject a lookahead and name the RE2 syntax", async () => {
      await assert.rejects(
        () => searchJobLog("ab", { pattern: "a(?=b)", regex: true }),
        isUnsupportedSyntaxError
      );
    });
  });

  describe("with a regular expression past the program size limit", () => {
    it("should reject it as too complex", async () => {
      await assert.rejects(
        () =>
          searchJobLog("a", { pattern: `a{${JOB_LOG_MAX_REGEX_PROGRAM_SIZE}}`, regex: true }),
        (error: unknown) =>
          error instanceof JobLogSearchError &&
          error.message.startsWith("Regular expression is too complex:")
      );
    });
  });

  describe("with a pattern longer than the cap", () => {
    it("should throw a job log search error", async () => {
      await assert.rejects(
        () => searchJobLog("log", { pattern: "a".repeat(JOB_LOG_MAX_PATTERN_LENGTH + 1) }),
        (error: unknown) => error instanceof JobLogSearchError && /exceeds 500/.test(error.message)
      );
    });
  });

  describe("with ANSI color codes", () => {
    it("should match and return the visible text", async () => {
      const result = await searchJobLog("\u001b[31mERROR\u001b[0m: boom", {
        pattern: "ERROR",
        contextLines: 0,
      });

      assert.equal(result.fragments[0]?.lines[0]?.text, "ERROR: boom");
    });
  });

  describe("with a GitLab section marker", () => {
    it("should drop the marker and keep the header text", async () => {
      const log = numberedLog([
        "\u001b[0Ksection_start:1700000000:step_script\r\u001b[0KRunning tests",
        "\u001b[0Ksection_end:1700000001:step_script\r\u001b[0K",
        "ERROR failed",
      ]);
      const result = await searchJobLog(log, { pattern: "Running tests", contextLines: 0 });

      assert.equal(result.fragments[0]?.lines[0]?.text, "Running tests");
      assert.equal(result.fragments[0]?.matchLines[0], 1);
    });
  });

  describe("with a section marker used as the pattern", () => {
    it("should not match the stripped marker", async () => {
      const log = "\u001b[0Ksection_start:1700000000:step_script\r\u001b[0KRunning tests";
      const result = await searchJobLog(log, { pattern: "section_start", contextLines: 0 });

      assert.equal(result.totalMatches, 0);
    });
  });

  describe("with overlapping context windows", () => {
    it("should merge the overlapping windows and keep the distant match separate", async () => {
      const log = numberedLog([
        "a",
        "b",
        "ERROR one",
        "c",
        "ERROR two",
        "d",
        "e",
        "f",
        "ERROR three",
      ]);
      const result = await searchJobLog(log, { pattern: "ERROR", contextLines: 1 });

      assert.equal(result.fragments.length, 2);
      assert.deepEqual(result.fragments[0]?.matchLines, [3, 5]);
      assert.equal(result.fragments[0]?.startLine, 2);
      assert.equal(result.fragments[0]?.endLine, 6);
    });
  });

  describe("with max_matches below the hit count", () => {
    it("should truncate returned matches and keep the total", async () => {
      const log = numberedLog(["hit", "hit", "hit", "hit"]);
      const result = await searchJobLog(log, { pattern: "hit", contextLines: 0, maxMatches: 2 });

      assert.equal(result.totalMatches, 4);
      assert.equal(result.shownMatches, 2);
      assert.equal(result.truncated, true);
      assert.deepEqual(
        result.fragments.flatMap(fragment => [...fragment.matchLines]),
        [1, 2]
      );
    });

    it("should not report an output size cut", async () => {
      const log = numberedLog(["hit", "hit", "hit", "hit"]);
      const result = await searchJobLog(log, { pattern: "hit", contextLines: 0, maxMatches: 2 });

      assert.equal(result.outputTruncated, false);
    });
  });

  describe("with matched lines past the output character limit", () => {
    it("should still count every match", async () => {
      const result = await searchPastOutputLimit();

      assert.equal(result.totalMatches, MATCH_LINES_PAST_OUTPUT_LIMIT);
    });

    it("should show only the matches whose lines fit in the limit", async () => {
      const result = await searchPastOutputLimit();

      assert.equal(result.shownMatches, MATCH_LINES_WITHIN_OUTPUT_LIMIT);
      assert.equal(result.fragments.length, MATCH_LINES_WITHIN_OUTPUT_LIMIT);
    });

    it("should report the output size cut as well as the unshown matches", async () => {
      const result = await searchPastOutputLimit();

      assert.equal(result.outputTruncated, true);
      assert.equal(result.truncated, true);
    });
  });

  describe("with a context window that reaches the output limit before its match", () => {
    it("should leave out the context lines without their match", async () => {
      const result = await searchWindowCutBeforeItsMatch();

      assert.equal(result.outputTruncated, true);
      assert.ok(result.fragments.every(fragment => fragment.matchLines.length > 0));
    });
  });

  describe("with a match away from the start", () => {
    it("should number lines from the start of the log", async () => {
      const log = numberedLog(["a", "b", "c", "ERROR here", "e"]);
      const result = await searchJobLog(log, { pattern: "ERROR", contextLines: 1 });
      const fragment = result.fragments[0];

      assert.equal(fragment?.startLine, 3);
      assert.deepEqual(
        fragment?.lines.map(line => line.lineNumber),
        [3, 4, 5]
      );
    });
  });

  describe("with a match past the line length cap", () => {
    it("should return the end of the line with the match and a leading marker", async () => {
      const line = `${"x".repeat(JOB_LOG_MAX_LINE_LENGTH)}NEEDLE`;
      const result = await searchJobLog(line, { pattern: "NEEDLE", contextLines: 0 });
      const text = result.fragments[0]?.lines[0]?.text ?? "";

      assert.equal(result.totalMatches, 1);
      assert.deepEqual(result.fragments[0]?.matchLines, [1]);
      assert.equal(text, `${JOB_LOG_CUT_MARKER}${line.slice(-(JOB_LOG_MAX_LINE_LENGTH - 1))}`);
      assert.ok(text.endsWith("NEEDLE"));
      assert.equal(result.linesTruncated, true);
    });
  });

  describe("with a match in the middle of a long line", () => {
    it("should return an excerpt with the match and markers at both ends", async () => {
      const line = `${"x".repeat(10_000)}NEEDLE${"y".repeat(10_000)}`;
      const result = await searchJobLog(line, { pattern: "NEEDLE", contextLines: 0 });
      const text = result.fragments[0]?.lines[0]?.text ?? "";

      assert.ok(text.includes("NEEDLE"));
      assert.ok(text.startsWith(JOB_LOG_CUT_MARKER));
      assert.ok(text.endsWith(JOB_LOG_CUT_MARKER));
      assert.equal(text.length, JOB_LOG_MAX_LINE_LENGTH);
    });

    it("should position a regular expression match the same way", async () => {
      const line = `${"x".repeat(10_000)}NEEDLE${"y".repeat(10_000)}`;
      const result = await searchJobLog(line, { pattern: "nee+dle", regex: true, contextLines: 0 });
      const text = result.fragments[0]?.lines[0]?.text ?? "";

      assert.ok(text.includes("NEEDLE"));
      assert.equal(text.length, JOB_LOG_MAX_LINE_LENGTH);
    });

    it("should find the match after characters that lengthen when lowercased", async () => {
      const line = `${"İ".repeat(6000)}NEEDLE${"x".repeat(6000)}`;
      const result = await searchJobLog(line, { pattern: "needle", contextLines: 0 });
      const text = result.fragments[0]?.lines[0]?.text ?? "";

      assert.ok(text.includes("NEEDLE"));
      assert.equal(text.length, JOB_LOG_MAX_LINE_LENGTH);
    });
  });

  describe("with a match near the start of a long line", () => {
    it("should keep the start of the line and add a trailing marker", async () => {
      const line = `NEEDLE${"x".repeat(10_000)}`;
      const result = await searchJobLog(line, { pattern: "NEEDLE", contextLines: 0 });

      assert.equal(
        result.fragments[0]?.lines[0]?.text,
        `${line.slice(0, JOB_LOG_MAX_LINE_LENGTH - 1)}${JOB_LOG_CUT_MARKER}`
      );
    });
  });

  describe("with a long context line", () => {
    it("should keep the start of the context line and add a trailing marker", async () => {
      const context = "y".repeat(10_000);
      const result = await searchJobLog(numberedLog(["ERROR", context]), {
        pattern: "ERROR",
        contextLines: 1,
      });

      assert.equal(
        result.fragments[0]?.lines[1]?.text,
        `${context.slice(0, JOB_LOG_MAX_LINE_LENGTH - 1)}${JOB_LOG_CUT_MARKER}`
      );
      assert.equal(result.linesTruncated, true);
    });
  });

  describe("with a log exactly at the search character limit", () => {
    it("should search the whole log", async () => {
      const log = `NEEDLE\n${"x".repeat(JOB_LOG_MAX_SEARCH_CHARS - "NEEDLE\n".length)}`;
      const result = await searchJobLog(log, { pattern: "NEEDLE", contextLines: 0 });

      assert.deepEqual(result.fragments[0]?.matchLines, [1]);
      assert.equal(result.firstSearchedLine, 1);
      assert.equal(result.skippedChars, 0);
    });
  });

  describe("with a log over the search character limit", () => {
    it("should search only the end and keep line numbers from the start of the log", async () => {
      const log = oversizedLog();
      const result = await searchJobLog(log, { pattern: "NEEDLE", contextLines: 0 });

      assert.equal(result.totalMatches, 1);
      assert.deepEqual(result.fragments[0]?.matchLines, [OVERSIZED_LOG_LINES]);
      assert.equal(result.totalLines, OVERSIZED_LOG_LINES);
      assert.equal(result.firstSearchedLine, 2);
      assert.equal(result.skippedChars, log.length - JOB_LOG_MAX_SEARCH_CHARS);
    });

    it("should apply the same limit to a regular expression", async () => {
      const result = await searchJobLog(oversizedLog(), {
        pattern: "^needle",
        regex: true,
        contextLines: 0,
      });

      assert.equal(result.totalMatches, 1);
      assert.deepEqual(result.fragments[0]?.matchLines, [OVERSIZED_LOG_LINES]);
      assert.equal(result.firstSearchedLine, 2);
    });
  });

  describe("with the searched end starting partway through a line before its match", () => {
    it("should find the match in the rest of that line", async () => {
      const result = await searchJobLog(logCutBeforeMatchInItsLine(), {
        pattern: "NEEDLE",
        contextLines: 0,
      });

      assert.deepEqual(result.fragments[0]?.matchLines, [2]);
    });
  });

  describe("with a last line longer than the search character limit", () => {
    it("should start mid-line and keep that line's number", async () => {
      const log = `head\n${"x".repeat(JOB_LOG_MAX_SEARCH_CHARS + 5)}`;
      const result = await searchJobLog(log, { pattern: "x", contextLines: 0 });

      assert.deepEqual(result.fragments[0]?.matchLines, [2]);
      assert.equal(result.totalLines, 2);
      assert.equal(result.firstSearchedLine, 2);
      assert.equal(result.skippedChars, log.length - JOB_LOG_MAX_SEARCH_CHARS);
    });
  });
});

describe("When reading a job log stream to search", () => {
  describe("with a log several chunks over the search character limit", () => {
    it("should keep no more than the search limit", async () => {
      const tail = await readJobLogTail(byteChunks(streamedOversizedLog()));

      assert.ok(tail.text.length <= JOB_LOG_MAX_SEARCH_CHARS);
    });

    it("should report the same skipped characters and line numbers as the whole log", async () => {
      const log = streamedOversizedLog();
      const input = { pattern: "NEEDLE", contextLines: 0 };

      const fromStream = await searchJobLog(await readJobLogTail(byteChunks(log)), input);

      assert.deepEqual(fromStream, await searchJobLog(log, input));
    });
  });

  describe("with a log over the search character limit read in small chunks", () => {
    it("should keep no more than the search limit", async () => {
      const tail = await readJobLogTail(byteChunks(streamedOversizedLog(), SMALL_CHUNK_BYTES));

      assert.ok(tail.text.length <= JOB_LOG_MAX_SEARCH_CHARS);
    });

    it("should report the same skipped characters and line numbers as the whole log", async () => {
      const log = streamedOversizedLog();
      const input = { pattern: "NEEDLE", contextLines: 0 };

      const tail = await readJobLogTail(byteChunks(log, SMALL_CHUNK_BYTES));

      assert.deepEqual(await searchJobLog(tail, input), await searchJobLog(log, input));
    });
  });

  describe("with multi-byte characters split across chunks", () => {
    it("should decode the whole log", async () => {
      const log = "ok\nnaïve ✓ done";

      const tail = await readJobLogTail(byteChunks(log, 1));

      assert.deepEqual(tail, { text: log, lineOffset: 0, skippedChars: 0 });
    });
  });
});

describe("When formatting a job log search", () => {
  describe("with a log over the search character limit", () => {
    it("should say where the search started", async () => {
      const result = await searchJobLog(oversizedLog(), { pattern: "NEEDLE", contextLines: 0 });
      const text = formatJobLogSearch(result, { pattern: "NEEDLE" });

      assert.match(text, /only the end was searched, from line 2;/);
      assert.match(text, new RegExp(`${OVERSIZED_LOG_LINES}\\|NEEDLE late`));
    });
  });

  describe("with one match", () => {
    it("should include the 1-based line prefix and match totals", async () => {
      const result = await searchJobLog(numberedLog(["a", "b", "c", "ERROR here", "e"]), {
        pattern: "ERROR",
        contextLines: 0,
      });
      const text = formatJobLogSearch(result, { pattern: "ERROR" });

      assert.match(
        text,
        /total_lines=5; total_matches=1; shown_matches=1; truncated=false; output_truncated=false/
      );
      assert.match(text, /4\|ERROR here/);
    });
  });

  describe("with matched lines past the output character limit", () => {
    it("should say the output was cut by size and how to narrow it", async () => {
      const result = await searchPastOutputLimit();
      const text = formatJobLogSearch(result, { pattern: "NEEDLE" });

      assert.match(text, /truncated=true; output_truncated=true/);
      assert.match(text, /Use a more specific pattern or fewer context_lines/);
    });
  });

  describe("with context lines that reach the output limit before the first match", () => {
    it("should say matches were found but none could be shown", async () => {
      const context = Array.from({ length: JOB_LOG_MAX_CONTEXT_LINES }, () =>
        "y".repeat(JOB_LOG_MAX_LINE_LENGTH)
      );
      const result = await searchJobLog(numberedLog([...context, "NEEDLE"]), {
        pattern: "NEEDLE",
        contextLines: JOB_LOG_MAX_CONTEXT_LINES,
      });
      const text = formatJobLogSearch(result, { pattern: "NEEDLE" });

      assert.match(text, /none could be shown because the output size limit was reached/);
      assert.doesNotMatch(text, /No matches\./);
    });
  });

  describe("with a match past the line length cap", () => {
    it("should show the match after the cut marker and explain the cut", async () => {
      const result = await searchJobLog(`${"x".repeat(JOB_LOG_MAX_LINE_LENGTH)}NEEDLE`, {
        pattern: "NEEDLE",
        contextLines: 0,
      });
      const text = formatJobLogSearch(result, { pattern: "NEEDLE" });

      assert.match(text, new RegExp(`\\n1\\|${JOB_LOG_CUT_MARKER}x+NEEDLE$`));
      assert.match(text, /cut to 4000 characters; … marks omitted text/);
    });
  });
});
