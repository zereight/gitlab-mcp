import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allTools } from "../../tools/registry.js";
import {
  LIST_SUMMARY_SAFE_TOOLS,
  listSummaryClassifiedToolNames,
  listSummaryClassifications,
  summarizeListPayload,
  toolAcceptsDecoratedSummary,
  toolUsesListSummaryDefault,
} from "../../utils/list-summary.js";

const registryNames = allTools.map(tool => tool.name);
const summaryCapable = registryNames.filter(
  name => toolAcceptsDecoratedSummary(name) || listSummaryClassifications(name).includes("native")
);

describe("When a list tool can be summarized", () => {
  it("should be classified exactly once (excluded, content-on-request, native or summary-safe)", () => {
    const problems = summaryCapable
      .map(name => ({ name, classes: listSummaryClassifications(name) }))
      .filter(({ classes }) => classes.length !== 1 || classes[0] === "unclassified")
      .map(({ name, classes }) => `${name}: ${classes.join(", ")}`);
    assert.deepEqual(
      problems,
      [],
      "Classify each new list tool in utils/list-summary.ts: add it to LIST_SUMMARY_SAFE_TOOLS " +
        "with the fields its summary must keep, or to LIST_SUMMARY_DEFAULT_EXCLUDED_TOOLS"
    );
  });

  it("should only classify tools that exist in the registry", () => {
    const stale = listSummaryClassifiedToolNames().filter(name => !registryNames.includes(name));
    assert.deepEqual(stale, []);
  });
});

describe("When a summary-safe tool is summarized", () => {
  for (const [toolName, fields] of Object.entries(LIST_SUMMARY_SAFE_TOOLS)) {
    it(`should keep ${toolName}: ${fields.join(", ")}`, () => {
      const item: Record<string, unknown> = { description: "dropped" };
      for (const field of fields) {
        item[field] = field === "notes" ? [{ id: 1, body: "b" }] : `${field}-value`;
      }
      const [summarized] = summarizeListPayload([item], toolName) as Record<string, unknown>[];
      const missing = fields.filter(field => !(field in summarized));
      assert.deepEqual(missing, [], `${toolName} summary drops ${missing.join(", ")}`);
      assert.equal("description" in summarized, false);
    });
  }
});

describe("When the server summary default is on", () => {
  for (const [toolName, fields] of Object.entries({
    list_group_iterations: "start_date, due_date",
    list_project_iterations: "start_date, due_date",
    list_group_iteration_cadences: "start_date, duration_in_weeks",
    list_namespaces: "full_path, path, kind",
  })) {
    it(`should keep the full ${toolName} reply (${fields})`, () => {
      assert.equal(toolUsesListSummaryDefault(toolName), false);
    });
  }
});
