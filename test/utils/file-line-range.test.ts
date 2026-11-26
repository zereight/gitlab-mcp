import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FILE_CONTENTS_MAX_LINES, sliceFileLines } from "../../utils/file-line-range.js";

describe("When sliceFileLines runs", () => {
  const text = "one\ntwo\r\nthree\nfour\n";

  test("should return the requested lines with their terminators and the total", () => {
    assert.deepEqual(sliceFileLines(text, { offset: 1, limit: 2 }), {
      content: "two\r\nthree\n",
      offset: 1,
      returned_lines: 2,
      total_lines: 4,
    });
  });

  test("should start at the first line when only limit is set", () => {
    assert.deepEqual(sliceFileLines(text, { limit: 1 }), {
      content: "one\n",
      offset: 0,
      returned_lines: 1,
      total_lines: 4,
    });
  });

  test("should return the rest of the file when only offset is set", () => {
    assert.equal(sliceFileLines(text, { offset: 2 }).content, "three\nfour\n");
  });

  test("should count a last line without a terminator", () => {
    const slice = sliceFileLines("a\nb", { offset: 1 });
    assert.equal(slice.content, "b");
    assert.equal(slice.total_lines, 2);
  });

  test("should count blank lines", () => {
    assert.equal(sliceFileLines("\n\n", {}).total_lines, 2);
  });

  test("should return no lines for an empty file", () => {
    assert.deepEqual(sliceFileLines("", { offset: 0 }), {
      content: "",
      offset: 0,
      returned_lines: 0,
      total_lines: 0,
    });
  });

  test("should return no lines when offset is past the end", () => {
    const slice = sliceFileLines(text, { offset: 10, limit: 5 });
    assert.equal(slice.content, "");
    assert.equal(slice.returned_lines, 0);
    assert.equal(slice.total_lines, 4);
  });

  test("should rebuild the original text from consecutive ranges", () => {
    const first = sliceFileLines(text, { offset: 0, limit: 3 });
    const second = sliceFileLines(text, { offset: first.offset + first.returned_lines, limit: 3 });
    assert.equal(first.content + second.content, text);
  });

  test("should cap a range at FILE_CONTENTS_MAX_LINES", () => {
    const long = "x\n".repeat(FILE_CONTENTS_MAX_LINES + 5);
    const slice = sliceFileLines(long, {});
    assert.equal(slice.returned_lines, FILE_CONTENTS_MAX_LINES);
    assert.equal(slice.total_lines, FILE_CONTENTS_MAX_LINES + 5);
  });
});
