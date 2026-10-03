import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCliInvocation, resolveCli } from "../../cli/router.js";
import type { CliExposure } from "../../cli/exposure.js";

function argv(...args: string[]): string[] {
  return ["node", "index.js", ...args];
}

const OPEN_EXPOSURE: CliExposure = {
  isExposed() {
    return true;
  },
  needsConfirmation() {
    return false;
  },
  exposureRefusal() {
    return undefined;
  },
};

function resolve(args: string[], extra: { permissionMode?: "readonly" | "modify" | "full"; exposure?: CliExposure } = {}) {
  return resolveCli(args, { exposure: extra.exposure ?? OPEN_EXPOSURE, permissionMode: extra.permissionMode });
}

describe("When resolveCli classifies argv", () => {
  describe("with no positional command", () => {
    it("should stay on the MCP server path", () => {
      const resolved = resolve(argv("--token", "glpat-xxxxxxxxxxxxxxxxxxxx"));

      assert.equal(resolved.kind, "server");
    });
  });

  describe("with --help", () => {
    it("should print global help without starting the server", () => {
      const resolved = resolve(argv("--help"));

      assert.equal(resolved.kind, "help");
      if (resolved.kind === "help") {
        assert.match(resolved.text, /tool <tool-name>/);
        assert.match(resolved.text, /auth/);
      }
    });
  });

  describe("with --help after an unknown positional", () => {
    it("should print global help instead of starting the server", () => {
      const resolved = resolve(argv("not-a-command", "--help"));

      assert.equal(resolved.kind, "help");
    });
  });

  describe("with tool whoami", () => {
    it("should run whoami with json output by default", () => {
      const resolved = resolve(argv("tool", "whoami"));

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
      const resolved = resolve(argv("mr", "list", "--group-id", "42", "--state", "opened"));

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
      const resolved = resolve(
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

  describe("with mr merge and --yes=false", () => {
    it("should reject the inline value instead of merging", () => {
      const resolved = resolve(
        argv("mr", "merge", "--project-id", "123", "--mr-iid", "45", "--yes=false")
      );

      assert.equal(resolved.kind, "usage");
      if (resolved.kind === "usage") {
        assert.match(resolved.message, /--yes does not accept a value/);
      }
    });
  });

  describe("with mr merge and no --yes", () => {
    it("should refuse until --yes is passed without dumping argument values", () => {
      const resolved = resolve(
        argv("mr", "merge", "--project-id", "123", "--mr-iid", "45")
      );

      assert.equal(resolved.kind, "refused");
      if (resolved.kind === "refused") {
        assert.match(resolved.message, /--yes/);
        assert.match(resolved.message, /merge_merge_request/);
        assert.match(resolved.message, /project_id/);
        assert.equal(resolved.message.includes("123"), false);
      }
    });
  });

  describe("with variable list scoped via --args-json", () => {
    it("should call list_group_variables when group_id is only in JSON", () => {
      const resolved = resolve(
        argv("variable", "list", "--args-json", '{"group_id":"42"}')
      );

      assert.equal(resolved.kind, "run");
      if (resolved.kind === "run") {
        assert.equal(resolved.toolName, "list_group_variables");
        assert.equal(resolved.args.group_id, "42");
      }
    });
  });
});

describe("When permission mode blocks a write", () => {
  describe("with readonly mode and issue create", () => {
    it("should refuse before dispatch", () => {
      const resolved = resolve(
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

describe("When MCP exposure filters block a CLI tool", () => {
  describe("with a denied-tools regex", () => {
    it("should refuse before dispatch", () => {
      const resolved = resolve(argv("tool", "whoami"), {
        exposure: {
          isExposed() {
            return false;
          },
          needsConfirmation() {
            return false;
          },
          exposureRefusal(toolName) {
            return `${toolName} is blocked by GITLAB_DENIED_TOOLS_REGEX`;
          },
        },
      });

      assert.equal(resolved.kind, "refused");
      if (resolved.kind === "refused") {
        assert.match(resolved.message, /GITLAB_DENIED_TOOLS_REGEX/);
      }
    });
  });

  describe("with GITLAB_TOOL_POLICY_APPROVE", () => {
    it("should require --yes", () => {
      const resolved = resolve(argv("tool", "whoami"), {
        exposure: {
          isExposed() {
            return true;
          },
          needsConfirmation() {
            return true;
          },
          exposureRefusal() {
            return undefined;
          },
        },
      });

      assert.equal(resolved.kind, "refused");
      if (resolved.kind === "refused") {
        assert.match(resolved.message, /GITLAB_TOOL_POLICY_APPROVE/);
        assert.match(resolved.message, /--yes/);
      }
    });
  });
});
