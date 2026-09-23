import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyJmespathFilter,
  applyJmespathToToolResult,
  getJmespathSyntaxError,
  omitJmespathArgument,
  readJmespathExpression,
  shouldApplyJmespathFilter,
} from "../../utils/jmespath-tool-result.js";

describe("jmespath tool result helpers", () => {
  test("readJmespathExpression trims and rejects blank values", () => {
    assert.equal(readJmespathExpression({ jmespath: "  [].title  " }), "[].title");
    assert.equal(readJmespathExpression({ jmespath: "   " }), undefined);
    assert.equal(readJmespathExpression({ jmespath: 1 }), undefined);
  });

  test("omitJmespathArgument removes MCP-only key", () => {
    assert.deepEqual(omitJmespathArgument({ project_id: "1", jmespath: "[].id" }), {
      project_id: "1",
    });
  });

  test("applyJmespathFilter projects array fields", () => {
    const data = [
      { title: "a", description: "long" },
      { title: "b", description: "longer" },
    ];
    assert.deepEqual(applyJmespathFilter(data, "[].title"), ["a", "b"]);
  });

  test("applyJmespathToToolResult filters JSON text content", () => {
    const result = applyJmespathToToolResult(
      {
        content: [
          {
            type: "text",
            text: JSON.stringify([{ title: "mr-one", iid: 1 }]),
          },
        ],
      },
      "[].title"
    );
    assert.equal((result.content as { text: string }[])[0].text, JSON.stringify(["mr-one"]));
  });

  test("applyJmespathToToolResult applies maskValue before JMESPath", () => {
    const result = applyJmespathToToolResult(
      {
        content: [
          {
            type: "text",
            text: JSON.stringify([{ title: "ProjectOneSecret" }]),
          },
        ],
      },
      "[].starts_with(title, `ProjectOne`)",
      {
        maskValue: value => {
          if (!Array.isArray(value)) return value;
          return value.map(entry =>
            entry && typeof entry === "object" && "title" in entry
              ? { ...entry, title: "[one]" }
              : entry
          );
        },
      }
    );
    assert.deepEqual(JSON.parse((result.content as { text: string }[])[0].text), [false]);
  });

  test("shouldApplyJmespathFilter is false for isError and explicit skip", () => {
    const errorResult = {
      content: [{ type: "text", text: 'Unknown category "foo"' }],
      isError: true,
    };
    assert.equal(shouldApplyJmespathFilter(errorResult, "[].title"), false);
    assert.equal(
      shouldApplyJmespathFilter(
        { content: [{ type: "text", text: "requires confirmation" }] },
        "[].title",
        { skipJmespath: true }
      ),
      false
    );
    assert.equal(
      shouldApplyJmespathFilter({ content: [{ type: "text", text: "[]" }] }, "[].title"),
      true
    );
  });

  test("applyJmespathToToolResult preserves isError tool results", () => {
    const original = {
      content: [{ type: "text", text: 'Unknown category "foo"' }],
      isError: true,
    };
    assert.deepEqual(applyJmespathToToolResult(original, "[].title"), original);
  });

  test("applyJmespathToToolResult preserves approval-style plain text when skipJmespath", () => {
    const original = {
      content: [
        {
          type: "text",
          text: 'Tool "create_issue" requires confirmation. Re-call with _confirmed: true to proceed.',
        },
      ],
    };
    assert.deepEqual(
      applyJmespathToToolResult(original, "[].title", { skipJmespath: true }),
      original
    );
  });

  test("applyJmespathToToolResult passes non-JSON success text through unchanged", () => {
    const original = { content: [{ type: "text", text: "Created pipeline #1 for main." }] };
    assert.deepEqual(applyJmespathToToolResult(original, "id"), original);
  });

  test("applyJmespathToToolResult returns the original result when evaluation fails", () => {
    const original = { content: [{ type: "text", text: JSON.stringify({ title: 1 }) }] };
    assert.deepEqual(applyJmespathToToolResult(original, "starts_with(title, `a`)"), original);
  });

  test("getJmespathSyntaxError rejects invalid expressions before execution", () => {
    assert.match(getJmespathSyntaxError("[[[") ?? "", /Invalid jmespath expression/);
    assert.equal(getJmespathSyntaxError("[].title"), undefined);
  });
});
