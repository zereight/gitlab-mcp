import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyListSummaryToToolResult,
  omitListSummaryArgument,
  readListSummaryRequested,
  summarizeListPayload,
  toolAcceptsDecoratedSummary,
  toolUsesListSummaryDefault,
} from "../../utils/list-summary.js";

describe("When deciding whether a tool accepts the decorated summary flag", () => {
  describe("with list_issues", () => {
    it("should accept the decorated flag", () => {
      assert.equal(toolAcceptsDecoratedSummary("list_issues"), true);
    });
  });

  describe("with list_webhook_events", () => {
    it("should keep the native summary argument", () => {
      assert.equal(toolAcceptsDecoratedSummary("list_webhook_events"), false);
    });
  });

  describe("with get_issue", () => {
    it("should not add a summary flag", () => {
      assert.equal(toolAcceptsDecoratedSummary("get_issue"), false);
    });
  });
});

describe("When a list payload is summarized", () => {
  describe("with merge request list items", () => {
    it("should keep high-signal fields and drop descriptions", () => {
      const summarized = summarizeListPayload([
        {
          iid: 12,
          title: "Fix login",
          state: "opened",
          web_url: "https://gitlab.example.com/g/p/-/merge_requests/12",
          description: "a very long body",
        },
      ]);

      assert.deepEqual(summarized, [
        {
          iid: 12,
          title: "Fix login",
          state: "opened",
          web_url: "https://gitlab.example.com/g/p/-/merge_requests/12",
        },
      ]);
    });
  });

  describe("with summary omitted", () => {
    it("should leave the tool result unchanged", () => {
      const result = {
        content: [{ type: "text", text: JSON.stringify([{ iid: 1, description: "keep" }]) }],
      };

      assert.deepEqual(applyListSummaryToToolResult(result, false), result);
    });
  });

  describe("with summary requested", () => {
    it("should rewrite JSON text content", () => {
      const result = applyListSummaryToToolResult(
        {
          content: [
            { type: "text", text: JSON.stringify([{ iid: 1, title: "A", description: "drop" }]) },
          ],
        },
        true
      );
      const block = result.content[0];

      assert.equal(block.type, "text");
      assert.equal(typeof block.text, "string");
      assert.deepEqual(JSON.parse(block.text), [{ iid: 1, title: "A" }]);
    });
  });
});

describe("When reading the summary argument", () => {
  describe("with summary true", () => {
    it("should request a summary and omit the flag before the handler", () => {
      const args = { project_id: "1", summary: true };

      assert.equal(readListSummaryRequested(args), true);
      assert.deepEqual(omitListSummaryArgument(args), { project_id: "1" });
    });
  });

  describe("with summary omitted and no server default", () => {
    it("should not request a summary", () => {
      assert.equal(readListSummaryRequested({ project_id: "1" }), false);
      assert.equal(readListSummaryRequested(undefined), false);
    });
  });

  describe("with summary omitted and the server default on", () => {
    it("should request a summary", () => {
      assert.equal(readListSummaryRequested({ project_id: "1" }, true), true);
      assert.equal(readListSummaryRequested({ project_id: "1", summary: null }, true), true);
      assert.equal(readListSummaryRequested(undefined, true), true);
    });
  });

  describe("with summary false and the server default on", () => {
    it("should keep the full payload", () => {
      assert.equal(readListSummaryRequested({ summary: false }, true), false);
      assert.equal(readListSummaryRequested({ summary: "false" }, true), false);
    });
  });
});

describe("When deciding whether a tool follows the server summary default", () => {
  describe("with list_merge_requests", () => {
    it("should follow the default", () => {
      assert.equal(toolUsesListSummaryDefault("list_merge_requests"), true);
    });
  });

  describe("with mr_discussions", () => {
    it("should stay opt-in", () => {
      assert.equal(toolAcceptsDecoratedSummary("mr_discussions"), true);
      assert.equal(toolUsesListSummaryDefault("mr_discussions"), false);
    });
  });

  describe("with list_webhook_events", () => {
    it("should keep its native summary argument", () => {
      assert.equal(toolUsesListSummaryDefault("list_webhook_events"), false);
    });
  });
});
