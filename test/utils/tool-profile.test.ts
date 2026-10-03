import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isExcludedBySlimProfile,
  isToolsetFullyActive,
  parseToolProfile,
  shouldApplySlimToolProfile,
  SLIM_PROFILE_EXCLUDED_TOOLS,
} from "../../tools/tool-profile.js";

describe("When parsing GITLAB_TOOL_PROFILE", () => {
  describe("with no value", () => {
    it("should keep the full profile", () => {
      assert.equal(parseToolProfile(undefined), "full");
    });
  });

  describe("with slim", () => {
    it("should select the slim profile", () => {
      assert.equal(parseToolProfile(" slim "), "slim");
    });
  });

  describe("with an unknown value", () => {
    it("should reject startup configuration", () => {
      assert.throws(() => parseToolProfile("tiny"), /GITLAB_TOOL_PROFILE/);
    });
  });
});

describe("When deciding whether slim filtering applies", () => {
  describe("with slim and no toolset override", () => {
    it("should apply the slim list", () => {
      assert.equal(shouldApplySlimToolProfile("slim", undefined), true);
    });
  });

  describe("with slim and GITLAB_TOOLSETS set", () => {
    it("should leave the explicit toolsets alone", () => {
      assert.equal(shouldApplySlimToolProfile("slim", "labels"), false);
    });
  });

  describe("with the full profile", () => {
    it("should not apply slim filtering", () => {
      assert.equal(shouldApplySlimToolProfile("full", undefined), false);
    });
  });
});

describe("When a slim session checks a tool", () => {
  describe("with a draft-note tool", () => {
    it("should exclude it", () => {
      assert.equal(isExcludedBySlimProfile("list_draft_notes", true, new Set()), true);
    });
  });

  describe("with that tool named in GITLAB_TOOLS", () => {
    it("should keep it", () => {
      assert.equal(
        isExcludedBySlimProfile("list_draft_notes", true, new Set(["list_draft_notes"])),
        false
      );
    });
  });
});

describe("When discover_tools checks a toolset", () => {
  describe("with slim exclusions still missing from the active list", () => {
    it("should treat the toolset as already active", () => {
      const active = isToolsetFullyActive(
        ["list_labels", "get_issue"],
        new Set(["get_issue"]),
        toolName => SLIM_PROFILE_EXCLUDED_TOOLS.has(toolName)
      );

      assert.equal(active, true);
    });
  });

  describe("with a non-excluded tool missing", () => {
    it("should treat the toolset as inactive", () => {
      const active = isToolsetFullyActive(
        ["list_labels", "get_issue"],
        new Set(["list_labels"]),
        toolName => toolName === "list_labels"
      );

      assert.equal(active, false);
    });
  });
});
