import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findGroupCycles,
  findGroupEdges,
  groupOf,
  type SourceFile,
} from "../scripts/check-module-cycles.js";

describe("check-module-cycles", () => {
  describe("with an injected cycle between config and utils", () => {
    const files: SourceFile[] = [
      {
        path: "config.ts",
        text: 'import { parseCompact } from "./utils/compact.js";\nexport const FLAG = true;\n',
      },
      {
        path: "utils/compact.ts",
        text: 'import type { Flags } from "../config.js";\nexport const parseCompact = (): Flags => ({});\n',
      },
    ];

    it("detects the cycle and reports both group edges", () => {
      const cycles = findGroupCycles(findGroupEdges(files));

      assert.equal(cycles.length, 1);
      assert.deepEqual(cycles[0].groups, ["config", "utils"]);
      assert.deepEqual(
        cycles[0].edges.map(edge => `${edge.from} -> ${edge.to}`),
        ["config -> utils", "utils -> config"]
      );
    });

    it("counts type-only imports and reports file:line evidence", () => {
      const cycles = findGroupCycles(findGroupEdges(files));
      const utilsToConfig = cycles[0].edges.find(edge => edge.from === "utils");

      assert.deepEqual(utilsToConfig?.evidence, [
        { file: "utils/compact.ts", line: 1, specifier: "../config.js" },
      ]);
    });
  });

  describe("with an acyclic graph", () => {
    const files: SourceFile[] = [
      { path: "config.ts", text: "export const FLAG = true;\n" },
      { path: "config-tool-profile.ts", text: 'export type ToolProfile = "full";\n' },
      {
        path: "tools/registry.ts",
        text: 'import { FLAG } from "../config.js";\nimport { helper } from "../utils/helper.js";\n',
      },
      {
        path: "tools/tool-profile.ts",
        text: 'import type { ToolProfile } from "../config-tool-profile.js";\n',
      },
      { path: "utils/helper.ts", text: 'export * from "./other.js";\n' },
      { path: "utils/other.ts", text: "export const other = 1;\n" },
      { path: "tools/a.ts", text: 'import { b } from "./b.js";\n' },
      { path: "tools/b.ts", text: 'import "./a.js";\n' },
      { path: "utils/external.ts", text: 'import { z } from "zod";\n' },
    ];

    it("reports no cycles and ignores edges inside one group", () => {
      const edges = findGroupEdges(files);

      assert.deepEqual(
        edges.map(edge => `${edge.from} -> ${edge.to}`),
        ["tools -> config", "tools -> utils"]
      );
      assert.equal(edges[0].evidence.length, 2);
      assert.deepEqual(findGroupCycles(edges), []);
    });
  });

  it("follows export-from and literal dynamic import() edges", () => {
    const files: SourceFile[] = [
      { path: "server/session.ts", text: 'export { redact } from "../utils/redact.js";\n' },
      {
        path: "utils/redact.ts",
        text: 'export const redact = (s: string) => s;\nexport const load = () => import("../server/session.js");\n',
      },
    ];

    const cycles = findGroupCycles(findGroupEdges(files));

    assert.equal(cycles.length, 1);
    assert.deepEqual(cycles[0].groups, ["server", "utils"]);
  });

  it("maps files to groups as documented", () => {
    assert.equal(groupOf("oauth-proxy.ts"), "auth");
    assert.equal(groupOf("auth-retry.ts"), "auth");
    assert.equal(groupOf("stateless/codec.ts"), "auth");
    assert.equal(groupOf("config-tool-profile.ts"), "config");
    assert.equal(groupOf("config-personal-access-token.ts"), "config");
    assert.equal(groupOf("customSchemas.ts"), "schemas");
    assert.equal(groupOf("tools/registry.ts"), "tools");
    assert.equal(groupOf("utils/logger.ts"), "utils");
    assert.equal(groupOf("cli-command.ts"), "cli-command.ts");
    assert.equal(groupOf("index.ts"), "index.ts");
  });
});
