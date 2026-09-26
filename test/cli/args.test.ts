import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allTools } from "../../tools/registry.js";
import {
  CreateWebhookSchema,
  GetPipelineJobOutputSchema,
  ProtectBranchSchema,
} from "../../schemas.js";
import {
  applyFlagAliases,
  CliUsageError,
  parseArgv,
  parseToolArgs,
} from "../../cli/args.js";

function argv(...args: string[]): string[] {
  return ["node", "index.js", ...args];
}

function schemaFor(toolName: string): unknown {
  const tool = allTools.find(entry => entry.name === toolName);
  assert.ok(tool, `missing tool ${toolName}`);
  return tool.inputSchema;
}

describe("When parseArgv reads a command line", () => {
  describe("with a generic tool invocation", () => {
    it("should keep positionals and kebab flags as snake_case tool args", () => {
      const parsed = parseArgv(
        argv("tool", "list_issues", "--project-id", "123", "--state", "opened")
      );

      assert.deepEqual(parsed.positionals, ["tool", "list_issues"]);
      assert.equal(parsed.toolFlags.project_id, "123");
      assert.equal(parsed.toolFlags.state, "opened");
      assert.equal(parsed.output, undefined);
    });
  });

  describe("with global flags mixed in", () => {
    it("should not treat --token --output --yes as tool flags", () => {
      const parsed = parseArgv(
        argv(
          "tool",
          "whoami",
          "--token",
          "glpat-xxxxxxxxxxxxxxxxxxxx",
          "--output=json",
          "--yes"
        )
      );

      assert.equal(parsed.output, "json");
      assert.equal(parsed.yes, true);
      assert.deepEqual(parsed.toolFlags, {});
    });
  });

  describe("with --args-json", () => {
    it("should parse the object and ignore prototype keys", () => {
      const parsed = parseArgv(
        argv("tool", "create_issue", "--args-json", '{"title":"bug","__proto__":{"x":1}}')
      );

      assert.equal(parsed.argsJson?.title, "bug");
      assert.equal(Object.prototype.hasOwnProperty.call(parsed.argsJson, "__proto__"), false);
    });
  });

  describe("with --use-oauth before a curated command", () => {
    it("should keep mr list as positionals instead of consuming mr as the flag value", () => {
      const parsed = parseArgv(argv("--use-oauth", "mr", "list"));

      assert.deepEqual(parsed.positionals, ["mr", "list"]);
    });
  });

  describe("with --read-only false before a curated command", () => {
    it("should keep false as the flag value and mr list as positionals", () => {
      const parsed = parseArgv(argv("--read-only", "false", "mr", "list"));

      assert.deepEqual(parsed.positionals, ["mr", "list"]);
    });
  });
});

describe("When parseToolArgs validates a real schema", () => {
  describe("with whoami", () => {
    it("should accept an empty flag set", () => {
      const args = parseToolArgs({
        schema: schemaFor("whoami"),
        flags: {},
        argsJson: undefined,
        extraArgs: undefined,
      });

      assert.deepEqual(args, {});
    });
  });

  describe("with create_issue missing title", () => {
    it("should throw a usage error for the required flag", () => {
      assert.throws(
        () =>
          parseToolArgs({
            schema: schemaFor("create_issue"),
            flags: { project_id: "123" },
            argsJson: undefined,
            extraArgs: undefined,
          }),
        (error: unknown) => error instanceof CliUsageError && error.message.includes("--title")
      );
    });
  });

  describe("with flags overlaying --args-json", () => {
    it("should let flags win", () => {
      const args = parseToolArgs({
        schema: schemaFor("create_issue"),
        flags: { title: "from-flag" },
        argsJson: { project_id: "123", title: "from-json" },
        extraArgs: undefined,
      });

      assert.equal(args.project_id, "123");
      assert.equal(args.title, "from-flag");
    });
  });

  describe("with an unknown flag", () => {
    it("should throw a usage error", () => {
      assert.throws(
        () =>
          parseToolArgs({
            schema: schemaFor("whoami"),
            flags: { nope: "1" },
            argsJson: undefined,
            extraArgs: undefined,
          }),
        (error: unknown) => error instanceof CliUsageError && error.message === "Unknown flag: --nope"
      );
    });
  });
});

describe("When parseToolArgs coerces scalar flags from the schema", () => {
  describe("with a number flag", () => {
    it("should pass a number that the tool schema accepts", () => {
      const args = parseToolArgs({
        schema: schemaFor("get_pipeline_job_output"),
        flags: { project_id: "1", job_id: "9", limit: "10" },
        argsJson: undefined,
        extraArgs: undefined,
      });

      assert.equal(GetPipelineJobOutputSchema.safeParse(args).success, true);
    });
  });

  describe("with a boolean flag", () => {
    it("should pass a boolean that the tool schema accepts", () => {
      const args = parseToolArgs({
        schema: schemaFor("create_webhook"),
        flags: { project_id: "1", url: "https://example.com/hook", push_events: "false" },
        argsJson: undefined,
        extraArgs: undefined,
      });

      assert.equal(CreateWebhookSchema.safeParse(args).success, true);
    });
  });

  describe("with an integer flag", () => {
    it("should pass an integer that the tool schema accepts", () => {
      const args = parseToolArgs({
        schema: schemaFor("protect_branch"),
        flags: { project_id: "1", branch_name: "main", push_access_level: "40" },
        argsJson: undefined,
        extraArgs: undefined,
      });

      assert.equal(ProtectBranchSchema.safeParse(args).success, true);
    });
  });

  describe("with a field that also accepts strings", () => {
    it("should keep the raw string", () => {
      const args = parseToolArgs({
        schema: schemaFor("list_webhook_events"),
        flags: { project_id: "1", hook_id: "2", status: "500" },
        argsJson: undefined,
        extraArgs: undefined,
      });

      assert.equal(args.status, "500");
    });
  });

  describe("with a non-boolean value for a boolean flag", () => {
    it("should throw a usage error", () => {
      assert.throws(
        () =>
          parseToolArgs({
            schema: schemaFor("create_webhook"),
            flags: { project_id: "1", url: "https://example.com/hook", push_events: "yes" },
            argsJson: undefined,
            extraArgs: undefined,
          }),
        (error: unknown) =>
          error instanceof CliUsageError && error.message === "--push-events must be true or false"
      );
    });
  });

  describe("with a fraction for an integer flag", () => {
    it("should throw a usage error", () => {
      assert.throws(
        () =>
          parseToolArgs({
            schema: schemaFor("protect_branch"),
            flags: { project_id: "1", branch_name: "main", push_access_level: "40.5" },
            argsJson: undefined,
            extraArgs: undefined,
          }),
        (error: unknown) =>
          error instanceof CliUsageError && error.message === "--push-access-level must be an integer"
      );
    });
  });
});

describe("When applyFlagAliases rewrites curated shorts", () => {
  describe("with --mr-iid", () => {
    it("should map onto merge_request_iid", () => {
      const mapped = applyFlagAliases({ mr_iid: "45", project_id: "123" }, {
        mr_iid: "merge_request_iid",
      });

      assert.equal(mapped.merge_request_iid, "45");
      assert.equal(mapped.project_id, "123");
    });
  });
});
