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

/**
 * Select `limit` lines starting at zero-based `offset`. A line is its text plus
 * its "\n" terminator; a last line without one still counts. Terminators are
 * kept, so the content of consecutive ranges joins back into the original text.
 * One scan counts the lines and records only where the range starts and ends.
 */
export function sliceFileLines(text: string, range: FileLineRange): FileLineSlice {
  const offset = range.offset ?? 0;
  const limit = Math.min(range.limit ?? FILE_CONTENTS_MAX_LINES, FILE_CONTENTS_MAX_LINES);
  let start = text.length;
  let end = text.length;
  let totalLines = 0;
  let position = 0;
  while (position < text.length) {
    if (totalLines === offset) start = position;
    const newline = text.indexOf("\n", position);
    position = newline === -1 ? text.length : newline + 1;
    totalLines += 1;
    if (totalLines === offset + limit) end = position;
  }
  return {
    content: text.slice(start, end),
    offset,
    returned_lines: Math.max(0, Math.min(limit, totalLines - offset)),
    total_lines: totalLines,
  };
}
