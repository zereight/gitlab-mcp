import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatJobLogSearch,
  JOB_LOG_MAX_LINE_LENGTH,
  JOB_LOG_MAX_PATTERN_LENGTH,
  JobLogSearchError,
  searchJobLog,
} from "../../utils/job-log-search.js";

function numberedLog(lines: readonly string[]): string {
  return lines.join("\n");
}

describe("When searching a job log", () => {
  describe("with a case-insensitive substring", () => {
    it("should report the 1-based line number from the start of the log", () => {
      const result = searchJobLog(numberedLog(["ok", "Error: failed", "done"]), {
        pattern: "error",
        contextLines: 0,
      });

      assert.deepEqual(result.fragments[0]?.matchLines, [2]);
      assert.equal(result.totalLines, 3);
    });
  });

  describe("with a case-sensitive substring", () => {
    it("should skip a different-case line", () => {
      const result = searchJobLog("error: failed", {
        pattern: "ERROR",
        caseSensitive: true,
        contextLines: 0,
      });

      assert.equal(result.totalMatches, 0);
    });
  });

  describe("with a dot in substring mode", () => {
    it("should match the dot literally", () => {
      const result = searchJobLog(numberedLog(["a", "file.js", "b"]), {
        pattern: ".",
        contextLines: 0,
      });

      assert.deepEqual(result.fragments[0]?.matchLines, [2]);
    });
  });

  describe("with a regular expression", () => {
    it("should match the pattern ignoring case by default", () => {
      const result = searchJobLog(numberedLog(["ok", "ERR42 boom", "done"]), {
        pattern: "err\\d+",
        regex: true,
        contextLines: 0,
      });

      assert.deepEqual(result.fragments[0]?.matchLines, [2]);
    });
  });

  describe("with an invalid regular expression", () => {
    it("should throw a job log search error", () => {
      assert.throws(
        () => searchJobLog("log", { pattern: "(", regex: true }),
        (error: unknown) =>
          error instanceof JobLogSearchError &&
          error.message.startsWith("Invalid regular expression:")
      );
    });
  });

  describe("with a pattern longer than the cap", () => {
    it("should throw a job log search error", () => {
      assert.throws(
        () => searchJobLog("log", { pattern: "a".repeat(JOB_LOG_MAX_PATTERN_LENGTH + 1) }),
        (error: unknown) => error instanceof JobLogSearchError && /exceeds 500/.test(error.message)
      );
    });
  });

  describe("with ANSI color codes", () => {
    it("should match and return the visible text", () => {
      const result = searchJobLog("\u001b[31mERROR\u001b[0m: boom", {
        pattern: "ERROR",
        contextLines: 0,
      });

      assert.equal(result.fragments[0]?.lines[0]?.text, "ERROR: boom");
    });
  });

  describe("with a GitLab section marker", () => {
    it("should drop the marker and keep the header text", () => {
      const log = numberedLog([
        "\u001b[0Ksection_start:1700000000:step_script\r\u001b[0KRunning tests",
        "\u001b[0Ksection_end:1700000001:step_script\r\u001b[0K",
        "ERROR failed",
      ]);
      const result = searchJobLog(log, { pattern: "Running tests", contextLines: 0 });

      assert.equal(result.fragments[0]?.lines[0]?.text, "Running tests");
      assert.equal(result.fragments[0]?.matchLines[0], 1);
    });
  });

  describe("with a section marker used as the pattern", () => {
    it("should not match the stripped marker", () => {
      const log = "\u001b[0Ksection_start:1700000000:step_script\r\u001b[0KRunning tests";
      const result = searchJobLog(log, { pattern: "section_start", contextLines: 0 });

      assert.equal(result.totalMatches, 0);
    });
  });

  describe("with overlapping context windows", () => {
    it("should merge the overlapping windows and keep the distant match separate", () => {
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
      const result = searchJobLog(log, { pattern: "ERROR", contextLines: 1 });

      assert.equal(result.fragments.length, 2);
      assert.deepEqual(result.fragments[0]?.matchLines, [3, 5]);
      assert.equal(result.fragments[0]?.startLine, 2);
      assert.equal(result.fragments[0]?.endLine, 6);
    });
  });

  describe("with max_matches below the hit count", () => {
    it("should truncate returned matches and keep the total", () => {
      const log = numberedLog(["hit", "hit", "hit", "hit"]);
      const result = searchJobLog(log, { pattern: "hit", contextLines: 0, maxMatches: 2 });

      assert.equal(result.totalMatches, 4);
      assert.equal(result.shownMatches, 2);
      assert.equal(result.truncated, true);
      assert.deepEqual(
        result.fragments.flatMap(fragment => [...fragment.matchLines]),
        [1, 2]
      );
    });
  });

  describe("with a match away from the start", () => {
    it("should number lines from the start of the log", () => {
      const log = numberedLog(["a", "b", "c", "ERROR here", "e"]);
      const result = searchJobLog(log, { pattern: "ERROR", contextLines: 1 });
      const fragment = result.fragments[0];

      assert.equal(fragment?.startLine, 3);
      assert.deepEqual(
        fragment?.lines.map(line => line.lineNumber),
        [3, 4, 5]
      );
    });
  });

  describe("with a line longer than the match cap", () => {
    it("should truncate the line before matching", () => {
      const visible = "x".repeat(JOB_LOG_MAX_LINE_LENGTH);
      const result = searchJobLog(`${visible}NEEDLE`, { pattern: "NEEDLE", contextLines: 0 });

      assert.equal(result.totalMatches, 0);
      assert.equal(result.linesTruncated, true);
    });
  });
});

describe("When formatting a job log search", () => {
  describe("with one match", () => {
    it("should include the 1-based line prefix and match totals", () => {
      const result = searchJobLog(numberedLog(["a", "b", "c", "ERROR here", "e"]), {
        pattern: "ERROR",
        contextLines: 0,
      });
      const text = formatJobLogSearch(result, { pattern: "ERROR" });

      assert.match(text, /total_lines=5; total_matches=1; shown_matches=1; truncated=false/);
      assert.match(text, /4\|ERROR here/);
    });
  });
});
