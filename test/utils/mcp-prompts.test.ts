import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMcpPrompt, listMcpPrompts } from "../../server/mcp-prompts.js";

function promptText(name: string, args: Record<string, string> = {}): string {
  const message = getMcpPrompt(name, args).messages[0];
  assert.ok(message);
  return message.content.text;
}

describe("When listing MCP prompts", () => {
  describe("with the inlined catalog", () => {
    it("should return review, pipeline triage, and vulnerability triage in order", () => {
      assert.deepEqual(
        listMcpPrompts().prompts.map(prompt => prompt.name),
        ["review_merge_request", "triage_pipeline_failure", "triage_vulnerabilities"]
      );
    });

    it("should list the required arguments of each prompt", () => {
      assert.deepEqual(
        listMcpPrompts().prompts.map(prompt => [
          prompt.name,
          prompt.arguments.map(argument => `${argument.name}:${argument.required}`),
        ]),
        [
          ["review_merge_request", ["project_id:true", "merge_request_iid:true"]],
          ["triage_pipeline_failure", ["project_id:true", "pipeline_id:true"]],
          ["triage_vulnerabilities", ["project_id:true"]],
        ]
      );
    });

    it("should not expose the render function", () => {
      for (const prompt of listMcpPrompts().prompts) {
        assert.deepEqual(Object.keys(prompt), ["name", "description", "arguments"]);
      }
    });
  });
});

describe("When getting an MCP prompt", () => {
  describe("with review_merge_request and both arguments", () => {
    it("should name the merge request and project in the first line", () => {
      const text = promptText("review_merge_request", {
        project_id: "group/app",
        merge_request_iid: "42",
      });

      assert.equal(text.split("\n")[0], "Review merge request !42 in project group/app:");
    });

    it("should return one user text message with the prompt description", () => {
      const result = getMcpPrompt("review_merge_request", {
        project_id: "group/app",
        merge_request_iid: "42",
      });

      assert.equal(
        result.description,
        "Review a merge request's diff in batches and leave threaded comments."
      );
      assert.equal(result.messages.length, 1);
      assert.equal(result.messages[0]?.role, "user");
      assert.equal(result.messages[0]?.content.type, "text");
    });
  });

  describe("with triage_pipeline_failure and no arguments", () => {
    it("should fill in placeholders", () => {
      assert.equal(
        promptText("triage_pipeline_failure").split("\n")[0],
        "Diagnose pipeline <pipeline_id> in project <project_id>:"
      );
    });
  });

  describe("with triage_vulnerabilities", () => {
    it("should ask for one call per state", () => {
      assert.equal(
        promptText("triage_vulnerabilities", { project_id: "7" }).includes(
          "once with state=detected and once with state=confirmed"
        ),
        true
      );
    });
  });

  describe("with an unknown prompt name", () => {
    it("should throw Unknown prompt with the name", () => {
      assert.throws(() => getMcpPrompt("nope", {}), {
        name: "Error",
        message: "Unknown prompt: nope",
      });
    });
  });
});
