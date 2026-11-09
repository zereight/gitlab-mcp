import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allTools } from "../tools/registry.js";

function exposedPropertyDescription(toolName: string, property: string): string {
  const tool = allTools.find(candidate => candidate.name === toolName);
  const description: unknown = tool?.inputSchema.properties?.[property]?.description;
  assert.ok(typeof description === "string", `${toolName}.${property} has no description`);
  return description;
}

describe("When an agent filters issues by milestone", () => {
  describe("with the list_issues milestone parameter", () => {
    it("should call it a title and send milestone IDs to the milestone issue tools", () => {
      const description = exposedPropertyDescription("list_issues", "milestone");

      assert.match(description, /milestone title, not an ID/i);
      assert.match(description, /get_milestone_issue\b[\s\S]*get_group_milestone_issue\b/);
    });
  });

  describe("with the milestone issue tools", () => {
    it("should ask for the milestone id rather than the iid", () => {
      for (const toolName of ["get_milestone_issue", "get_group_milestone_issue"]) {
        assert.match(exposedPropertyDescription(toolName, "milestone_id"), /\bid \(not iid\b/);
      }
    });
  });
});
