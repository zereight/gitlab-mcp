import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createListedToolsCache,
  decorateToolForList,
  type ListedToolDecorationContext,
} from "../../tools/listed-tools.js";

const CONTEXT: ListedToolDecorationContext = {
  readOnlyToolNames: new Set(["get_issue"]),
  destructiveToolNames: new Set(["delete_issue"]),
  approveToolNames: new Set(["delete_issue"]),
  jmespathArgument: "jmespath",
  jmespathArgumentDescription: "filter",
};

function schemaTool(name: string, properties?: Record<string, unknown>) {
  return {
    name,
    description: name,
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      ...(properties ? { properties } : {}),
    },
  };
}

describe("When decorating a tool for tools/list", () => {
  describe("with a schema that still has $schema", () => {
    it("should remove $schema without changing the registry object", () => {
      const tool = schemaTool("get_issue", { project_id: { type: "string" } });
      const listed = decorateToolForList(tool, CONTEXT);

      assert.equal("$schema" in (listed.inputSchema ?? {}), false);
      assert.equal(tool.inputSchema.$schema.startsWith("https://"), true);
    });
  });

  describe("with an approval-required tool that already has properties", () => {
    it("should add the confirmation argument", () => {
      const listed = decorateToolForList(
        schemaTool("delete_issue", { project_id: { type: "string" } }),
        CONTEXT
      );
      const properties = listed.inputSchema?.properties;

      assert.equal(isRecord(properties) && "_confirmed" in properties, true);
    });
  });

  describe("with an approval-required tool that has no properties", () => {
    it("should not invent a confirmation argument", () => {
      const listed = decorateToolForList(schemaTool("delete_issue"), CONTEXT);

      assert.equal(
        listed.inputSchema?.properties && "_confirmed" in listed.inputSchema.properties,
        false
      );
    });
  });

  describe("with any schema object", () => {
    it("should add the jmespath argument", () => {
      const listed = decorateToolForList(schemaTool("get_issue"), CONTEXT);

      assert.equal(
        listed.inputSchema?.properties && "jmespath" in listed.inputSchema.properties,
        true
      );
      assert.equal(listed.annotations.readOnlyHint, true);
    });
  });
});

interface NamedTool {
  readonly name: string;
}

function countingDecorator(calls: { count: number }): (tools: readonly NamedTool[]) => NamedTool[] {
  return function decorate(tools: readonly NamedTool[]): NamedTool[] {
    calls.count += 1;
    return tools.map(tool => ({ name: tool.name }));
  };
}

describe("When tools/list is served again", () => {
  describe("with the same toolset revision", () => {
    it("should reuse the decorated list", () => {
      const calls = { count: 0 };
      const getListedTools = createListedToolsCache(countingDecorator(calls));
      const source = [{ name: "get_issue" }];
      const first = getListedTools(source, 0);
      const second = getListedTools(source, 0);

      assert.equal(second, first);
      assert.equal(calls.count, 1);
    });
  });

  describe("with a newer revision after discover_tools", () => {
    it("should decorate again", () => {
      const calls = { count: 0 };
      const getListedTools = createListedToolsCache(countingDecorator(calls));
      const source = [{ name: "get_issue" }];
      getListedTools(source, 0);
      getListedTools(source, 1);

      assert.equal(calls.count, 2);
    });
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
