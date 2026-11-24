import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GetFileContentsSchema } from "../schemas.js";
import { FILE_CONTENTS_MAX_LINES } from "../utils/file-line-range.js";

describe("When GetFileContentsSchema is parsed", () => {
  describe("without a line range", () => {
    it("should leave offset and limit unset", () => {
      const parsed = GetFileContentsSchema.parse({ project_id: "1", file_path: "a.yaml" });

      assert.equal(parsed.offset, undefined);
      assert.equal(parsed.limit, undefined);
    });
  });

  describe("with a line range given as strings", () => {
    it("should coerce offset and limit to numbers", () => {
      const parsed = GetFileContentsSchema.parse({
        file_path: "a.yaml",
        offset: "200",
        limit: "50",
      });

      assert.equal(parsed.offset, 200);
      assert.equal(parsed.limit, 50);
    });
  });

  describe("with an out-of-bounds line range", () => {
    for (const range of [
      { offset: -1 },
      { offset: 1.5 },
      { limit: 0 },
      { limit: FILE_CONTENTS_MAX_LINES + 1 },
    ]) {
      it(`should reject ${JSON.stringify(range)}`, () => {
        const parsed = GetFileContentsSchema.safeParse({ file_path: "a.yaml", ...range });

        assert.equal(parsed.success, false);
      });
    }
  });
});
