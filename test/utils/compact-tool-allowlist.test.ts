import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCompactToolAllowlist,
  shouldCompactToolResult,
} from "../../utils/compact-tool-allowlist.js";

describe("When parsing GITLAB_MCP_COMPACT_TOOLS", () => {
  describe("with no value", () => {
    it("should compact nothing extra", () => {
      assert.equal(parseCompactToolAllowlist(undefined).size, 0);
    });
  });

  describe("with a comma-separated list", () => {
    it("should keep the named tools", () => {
      const names = parseCompactToolAllowlist(" get_file_contents, get_merge_request_diffs ");

      assert.equal(names.has("get_file_contents"), true);
      assert.equal(names.has("get_merge_request_diffs"), true);
    });
  });
});

describe("When deciding whether a tool result compacts", () => {
  describe("with global compact off and the tool unnamed", () => {
    it("should leave the result intact", () => {
      assert.equal(
        shouldCompactToolResult("get_issue", false, new Set(["get_file_contents"])),
        false
      );
    });
  });

  describe("with global compact off and the tool named", () => {
    it("should compact that tool", () => {
      assert.equal(
        shouldCompactToolResult("get_file_contents", false, new Set(["get_file_contents"])),
        true
      );
    });
  });

  describe("with global compact on", () => {
    it("should compact tools that are not on the allowlist", () => {
      assert.equal(shouldCompactToolResult("get_issue", true, new Set()), true);
    });
  });
});
