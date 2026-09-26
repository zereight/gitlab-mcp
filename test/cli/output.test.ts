import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCliError, formatToolOutput } from "../../cli/output.js";

describe("When formatToolOutput prints a tool result", () => {
  describe("with json mode", () => {
    it("should write the unwrapped payload as JSON", () => {
      const formatted = formatToolOutput({
        result: { content: [{ type: "text", text: JSON.stringify({ id: 1, username: "tao" }) }] },
        mode: "json",
        tableSpec: undefined,
      });

      assert.equal(formatted.stdout, "{\"id\":1,\"username\":\"tao\"}\n");
      assert.equal(formatted.stderr, "");
      assert.equal(formatted.isError, false);
    });
  });

  describe("with table mode for a list", () => {
    it("should print iid state title columns", () => {
      const formatted = formatToolOutput({
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify([
                { iid: 45, state: "opened", title: "fix: pipeline retry race" },
                { iid: 44, state: "opened", title: "chore: bump deps" },
              ]),
            },
          ],
        },
        mode: "table",
        tableSpec: { kind: "list", columns: ["iid", "state", "title"] },
      });

      assert.match(formatted.stdout, /IID\s+STATE\s+TITLE/);
      assert.match(formatted.stdout, /45\s+opened\s+fix: pipeline retry race/);
      assert.equal(formatted.stderr, "");
    });
  });

  describe("with a non-text content block first", () => {
    it("should unwrap the first text payload", () => {
      const formatted = formatToolOutput({
        result: {
          content: [
            { type: "image", data: "xxx" },
            { type: "text", text: JSON.stringify({ id: 2 }) },
          ],
        },
        mode: "json",
        tableSpec: undefined,
      });

      assert.equal(formatted.stdout, "{\"id\":2}\n");
    });
  });

  describe("with an API-style error object", () => {
    it("should mark the result as an error", () => {
      const formatted = formatToolOutput({
        result: { content: [{ type: "text", text: "GitLab API error: 404 Not Found" }], isError: true },
        mode: "json",
        tableSpec: undefined,
      });

      assert.equal(formatted.isError, true);
    });
  });
});

describe("When formatCliError prints a thrown error", () => {
  describe("with a token in the message", () => {
    it("should redact the token", () => {
      const leaked = `glpat-${"notarealtokenvalue"}`;
      const text = formatCliError(new Error(`auth failed ${leaked}`));

      assert.match(text, /\[REDACTED\]/);
      assert.equal(text.includes(leaked), false);
    });
  });
});
