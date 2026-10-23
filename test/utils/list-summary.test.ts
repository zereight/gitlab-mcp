import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyListSummaryToToolResult,
  omitListSummaryArgument,
  readListSummaryRequested,
  summarizeListPayload,
  toolAcceptsDecoratedSummary,
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
});
