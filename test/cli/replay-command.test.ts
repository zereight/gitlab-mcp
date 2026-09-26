import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildToolReplayCommand } from "../../cli/replay-command.js";

describe("When buildToolReplayCommand prints a CLI invocation", () => {
  describe("with scalar tool arguments", () => {
    it("should emit kebab-case flags without the token", () => {
      const command = buildToolReplayCommand("list_issues", {
        project_id: "123",
        state: "opened",
        token: "glpat-secret",
      });

      assert.equal(
        command,
        "zereight-mcp-gitlab tool list_issues --project-id 123 --state opened"
      );
    });
  });

  describe("with a nested object", () => {
    it("should pass it through --args-json", () => {
      const command = buildToolReplayCommand("execute_graphql", {
        query: "{ currentUser { id } }",
        variables: { n: 1 },
      });

      assert.match(command, /tool execute_graphql/);
      assert.match(command, /--query/);
      assert.match(command, /--args-json/);
      assert.equal(command.includes("glpat"), false);
    });
  });

  describe("with confirmation metadata", () => {
    it("should omit _confirmed", () => {
      const command = buildToolReplayCommand("push_files", {
        project_id: "1",
        _confirmed: true,
      });

      assert.equal(command.includes("_confirmed"), false);
      assert.match(command, /--project-id 1/);
    });
  });
});
