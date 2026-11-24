// Upper bound for lines returned by one get_file_contents range request.
export const FILE_CONTENTS_MAX_LINES = 1000;

export interface FileLineRange {
  readonly offset?: number;
  readonly limit?: number;
}

export interface FileLineSlice {
  /** The selected lines, each with its original line terminator. */
  readonly content: string;
  /** Zero-based index of the first returned line. */
  readonly offset: number;
  readonly returned_lines: number;
  readonly total_lines: number;
}

// A line is its text plus its "\n" terminator; a last line without one still counts.
const LINE_PATTERN = /[^\n]*\n|[^\n]+$/g;

/**
 * Select `limit` lines starting at zero-based `offset`. Line terminators are
 * kept, so the content of consecutive ranges joins back into the original text.
 */
export function sliceFileLines(text: string, range: FileLineRange): FileLineSlice {
  const lines = text.match(LINE_PATTERN) ?? [];
  const offset = range.offset ?? 0;
  const limit = Math.min(range.limit ?? FILE_CONTENTS_MAX_LINES, FILE_CONTENTS_MAX_LINES);
  const selected = lines.slice(offset, offset + limit);
  return {
    content: selected.join(""),
    offset,
    returned_lines: selected.length,
    total_lines: lines.length,
  };
}
