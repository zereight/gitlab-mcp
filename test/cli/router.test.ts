import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCliInvocation, resolveCli } from "../../cli/router.js";

function argv(...args: string[]): string[] {
  return ["node", "index.js", ...args];
}

describe("When resolveCli classifies argv", () => {
  describe("with no positional command", () => {
    it("should stay on the MCP server path", () => {
      const resolved = resolveCli(argv("--token", "glpat-xxxxxxxxxxxxxxxxxxxx"));

      assert.equal(resolved.kind, "server");
    });
  });

  describe("with --help", () => {
    it("should print global help without starting the server", () => {
      const resolved = resolveCli(argv("--help"));

      assert.equal(resolved.kind, "help");
      if (resolved.kind === "help") {
        assert.match(resolved.text, /tool <tool-name>/);
        assert.match(resolved.text, /auth/);
      }
    });
  });

  describe("with --help after an unknown positional", () => {
    it("should print global help instead of starting the server", () => {
      const resolved = resolveCli(argv("not-a-command", "--help"));

      assert.equal(resolved.kind, "help");
    });
  });

  describe("with tool whoami", () => {
    it("should run whoami with json output by default", () => {
      const resolved = resolveCli(argv("tool", "whoami"));

      assert.equal(resolved.kind, "run");
      if (resolved.kind === "run") {
        assert.equal(resolved.toolName, "whoami");
        assert.equal(resolved.output, "json");
        assert.deepEqual(resolved.args, {});
      }
    });
  });
});

describe("When a curated command is resolved", () => {
  describe("with mr list --group-id", () => {
    it("should call list_group_merge_requests", () => {
      const resolved = resolveCli(argv("mr", "list", "--group-id", "42", "--state", "opened"));

      assert.equal(resolved.kind, "run");
      if (resolved.kind === "run") {
        assert.equal(resolved.toolName, "list_group_merge_requests");
        assert.equal(resolved.args.group_id, "42");
        assert.equal(resolved.output, "table");
      }
    });
  });

  describe("with issue close", () => {
    it("should call update_issue with state_event close", () => {
      const resolved = resolveCli(
        argv("issue", "close", "--project-id", "123", "--issue-iid", "9")
      );

      assert.equal(resolved.kind, "run");
      if (resolved.kind === "run") {
        assert.equal(resolved.toolName, "update_issue");
        assert.equal(resolved.args.issue_iid, "9");
        assert.equal(resolved.args.state_event, "close");
      }
    });
  });

  describe("with mr merge and no --yes", () => {
    it("should refuse until --yes is passed", () => {
      const resolved = resolveCli(
        argv("mr", "merge", "--project-id", "123", "--mr-iid", "45")
      );

      assert.equal(resolved.kind, "refused");
      if (resolved.kind === "refused") {
        assert.match(resolved.message, /--yes/);
        assert.match(resolved.message, /merge_merge_request/);
      }
    });
  });
});

describe("When permission mode blocks a write", () => {
  describe("with readonly mode and issue create", () => {
    it("should refuse before dispatch", () => {
      const resolved = resolveCli(
        argv("issue", "create", "--project-id", "123", "--title", "bug"),
        { permissionMode: "readonly" }
      );

      assert.equal(resolved.kind, "refused");
      if (resolved.kind === "refused") {
        assert.match(resolved.message, /read-only/);
      }
    });
  });
});

describe("When isCliInvocation inspects argv", () => {
  describe("with a curated group", () => {
    it("should treat it as a human CLI invocation", () => {
      assert.equal(isCliInvocation(argv("mr", "list")), true);
    });
  });

  describe("with --help", () => {
    it("should treat it as a human CLI invocation", () => {
      assert.equal(isCliInvocation(argv("--help")), true);
    });
  });

  describe("with only a server token flag", () => {
    it("should stay on the MCP server path", () => {
      assert.equal(isCliInvocation(argv("--token", "x")), false);
    });
  });
});
