import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

function readServerEntry(): string {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  return readFileSync(path.join(directory, "../../index.ts"), "utf8");
}

describe("When the server entry is loaded for stdio", () => {
  describe("with the top-level imports", () => {
    it("should not statically import the HTTP stack", () => {
      const source = readServerEntry();
      const valueImports = source
        .split("\n")
        .filter(line => line.startsWith("import ") && !line.startsWith("import type "));
      const staticallyImportsHttp = valueImports.some(
        line =>
          line.includes("express-rate-limit") ||
          line.includes("@modelcontextprotocol/sdk/server/sse.js") ||
          line.includes("@modelcontextprotocol/sdk/server/streamableHttp.js") ||
          line.includes("@modelcontextprotocol/sdk/server/auth/router.js") ||
          line.includes('from "express"')
      );

      assert.equal(staticallyImportsHttp, false);
    });
  });
});
