import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { allTools } from "../../tools/registry.js";
import {
  lazyJSONSchema,
  toJSONSchema,
  withLazyInputSchemas,
  zodSchemaFor,
} from "../../utils/schema.js";

const isLazy = (tool: object): boolean =>
  typeof Object.getOwnPropertyDescriptor(tool, "inputSchema")?.get === "function";

describe("When tool input schemas are built lazily", () => {
  describe("with the registry just imported", () => {
    it("should not have built any lazy schema yet", () => {
      const built = allTools.filter(tool => tool.name !== "discover_tools" && !isLazy(tool));

      assert.deepEqual(
        built.map(tool => tool.name),
        []
      );
    });

    it("should keep the literal discover_tools schema as a data property", () => {
      const tool = allTools.find(entry => entry.name === "discover_tools");

      assert.ok(tool);
      assert.equal(isLazy(tool), false);
      assert.equal(tool.inputSchema.type, "object");
    });
  });

  describe("with every registry entry read", () => {
    it("should return an object schema that maps back to its Zod schema", () => {
      const broken = allTools
        .filter(tool => tool.name !== "discover_tools")
        .filter(tool => tool.inputSchema?.type !== "object" || !zodSchemaFor(tool.inputSchema))
        .map(tool => tool.name);

      assert.deepEqual(broken, []);
    });
  });

  describe("with a placeholder schema", () => {
    const schema = z.object({ project_id: z.string(), page: z.number().optional() });

    it("should build the same JSON Schema as toJSONSchema on first read", () => {
      const [tool] = withLazyInputSchemas([{ name: "t", inputSchema: lazyJSONSchema(schema) }]);

      assert.deepEqual(tool.inputSchema, toJSONSchema(schema));
      assert.equal(zodSchemaFor(tool.inputSchema), schema);
    });

    it("should return the same object on later reads and store it as a data property", () => {
      const [tool] = withLazyInputSchemas([{ name: "t", inputSchema: lazyJSONSchema(schema) }]);
      const first = tool.inputSchema;
      const descriptor = Object.getOwnPropertyDescriptor(tool, "inputSchema");

      assert.equal(tool.inputSchema, first);
      assert.equal(descriptor?.get, undefined);
      assert.equal(descriptor?.writable, true);
      assert.equal(descriptor?.enumerable, true);
    });

    it("should keep inputSchema in a spread or JSON copy of an unread tool", () => {
      const [tool] = withLazyInputSchemas([{ name: "t", inputSchema: lazyJSONSchema(schema) }]);
      const expected = toJSONSchema(schema);

      assert.deepEqual({ ...tool }.inputSchema, expected);
      assert.deepEqual(JSON.parse(JSON.stringify(tool)), { name: "t", inputSchema: expected });
    });

    it("should stay enumerable before the first read", () => {
      const [tool] = withLazyInputSchemas([{ name: "t", inputSchema: lazyJSONSchema(schema) }]);

      assert.equal(isLazy(tool), true);
      assert.deepEqual(Object.keys(tool), ["name", "inputSchema"]);
    });
  });

  describe("with an inputSchema that is not a placeholder", () => {
    it("should leave it untouched", () => {
      const inputSchema = { type: "object", properties: {} };
      const [tool] = withLazyInputSchemas([{ name: "t", inputSchema }]);

      assert.equal(isLazy(tool), false);
      assert.equal(tool.inputSchema, inputSchema);
    });
  });
});
