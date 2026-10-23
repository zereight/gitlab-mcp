import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advertisesReadOnly,
  allTools,
  destructiveTools,
  readOnlyTools,
} from "../../tools/registry.js";
import { decorateToolForList, type ListedToolDecorationContext } from "../../tools/listed-tools.js";

const CONTEXT: ListedToolDecorationContext = {
  readOnlyToolNames: new Set([...readOnlyTools].filter(toolName => advertisesReadOnly(toolName))),
  destructiveToolNames: destructiveTools,
  approveToolNames: new Set(),
  jmespathArgument: "jmespath",
  jmespathArgumentDescription: "filter",
};

describe("When tools/list annotations are applied", () => {
  describe("with every advertised read-only tool", () => {
    it("should set readOnlyHint and omit destructiveHint", () => {
      const missing = allTools
        .filter(tool => advertisesReadOnly(tool.name))
        .filter(tool => decorateToolForList(tool, CONTEXT).annotations.readOnlyHint !== true)
        .map(tool => tool.name);

      assert.deepEqual(missing, []);
    });
  });

  describe("with every destructive tool", () => {
    it("should set destructiveHint and omit readOnlyHint", () => {
      const missing = allTools
        .filter(tool => destructiveTools.has(tool.name))
        .filter(tool => {
          const annotations = decorateToolForList(tool, CONTEXT).annotations;
          return annotations.destructiveHint !== true || annotations.readOnlyHint === true;
        })
        .map(tool => tool.name);

      assert.deepEqual(missing, []);
    });
  });

  describe("with mixed-access or local-file-write tools", () => {
    it("should not advertise readOnlyHint", () => {
      const leaked = allTools
        .filter(tool => readOnlyTools.has(tool.name) && !advertisesReadOnly(tool.name))
        .filter(tool => decorateToolForList(tool, CONTEXT).annotations.readOnlyHint === true)
        .map(tool => tool.name);

      assert.deepEqual(leaked, []);
    });
  });
});
