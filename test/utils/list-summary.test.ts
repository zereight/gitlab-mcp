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
          labels: ["bug", "backend"],
          source_branch: "fix-login",
          target_branch: "main",
          draft: false,
          updated_at: "2024-01-03T00:00:00Z",
          author: {
            id: 7,
            username: "alice",
            name: "Alice",
            web_url: "https://gitlab.example.com/alice",
          },
          assignees: [
            { id: 8, username: "bob", name: "Bob" },
            { id: 9, username: "carol", name: "Carol" },
          ],
          references: { full: "g/p!12" },
        },
      ]);

      assert.deepEqual(summarized, [
        {
          iid: 12,
          title: "Fix login",
          state: "opened",
          web_url: "https://gitlab.example.com/g/p/-/merge_requests/12",
          labels: ["bug", "backend"],
          source_branch: "fix-login",
          target_branch: "main",
          draft: false,
          updated_at: "2024-01-03T00:00:00Z",
          author: { username: "alice" },
          assignees: [{ username: "bob" }, { username: "carol" }],
        },
      ]);
    });
  });

  describe("with an issue that has no assignees", () => {
    it("should keep the empty assignees list and drop the author object fields", () => {
      const summarized = summarizeListPayload([
        { iid: 3, title: "Unassigned", author: { id: 1, username: "alice" }, assignees: [] },
      ]);

      assert.deepEqual(summarized, [
        { iid: 3, title: "Unassigned", author: { username: "alice" }, assignees: [] },
      ]);
    });
  });

  describe("with merge request discussions", () => {
    it("should keep the discussion id and the author, body, created_at, resolved of each note", () => {
      const summarized = summarizeListPayload({
        items: [
          {
            id: "10d5abc",
            individual_note: false,
            notes: [
              {
                id: 501,
                type: "DiffNote",
                body: "Please rename this.",
                author: { id: 7, username: "alice", name: "Alice" },
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-02T00:00:00Z",
                system: false,
                resolvable: true,
                resolved: false,
                resolved_by: null,
                position: { new_line: 3 },
              },
              {
                id: 502,
                body: "Done.",
                author: { id: 8, username: "bob" },
                created_at: "2024-01-02T00:00:00Z",
                system: false,
              },
            ],
          },
        ],
        pagination: { x_total: 1 },
      });

      assert.deepEqual(summarized, {
        items: [
          {
            id: "10d5abc",
            notes: [
              {
                author: { username: "alice" },
                body: "Please rename this.",
                created_at: "2024-01-01T00:00:00Z",
                resolved: false,
              },
              { author: { username: "bob" }, body: "Done.", created_at: "2024-01-02T00:00:00Z" },
            ],
          },
        ],
        pagination: { x_total: 1 },
      });
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
    it("should follow the default", () => {
      assert.equal(toolAcceptsDecoratedSummary("mr_discussions"), true);
      assert.equal(toolUsesListSummaryDefault("mr_discussions"), true);
    });
  });

  describe("with list_webhook_events", () => {
    it("should keep its native summary argument", () => {
      assert.equal(toolUsesListSummaryDefault("list_webhook_events"), false);
    });
  });
});
