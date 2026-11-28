import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GitLabPermissionMode } from "../../config.js";
import {
  assertToolAllowedByPermissionMode,
  createPermissionModeGate,
  isToolAllowedByPermissionMode,
  type PermissionModeConfig,
} from "../../tools/permission.js";
import { allTools, deleteTools, destructiveTools, readOnlyTools } from "../../tools/registry.js";

const MODES: readonly GitLabPermissionMode[] = ["readonly", "modify", "full"];

// Oracle: verbatim copy of isToolAllowedByPermissionMode from index.ts on main (27d976f7).
// The only change: main reads the global GITLAB_PERMISSION_MODE, so the mode is a parameter here.
function oracleIsToolAllowedByPermissionMode(
  mode: GitLabPermissionMode,
  toolName: string
): boolean {
  switch (mode) {
    case "readonly":
      return readOnlyTools.has(toolName);
    case "modify":
      return !deleteTools.has(toolName);
    default:
      return true;
  }
}

// Every tool in the registry, the three classification sets, and synthetic names for the default branch.
const TOOL_NAMES: readonly string[] = [
  ...new Set([
    ...allTools.map(tool => tool.name),
    ...readOnlyTools,
    ...destructiveTools,
    ...deleteTools,
    "not_a_registered_tool",
    "",
  ]),
];

function configFor(mode: GitLabPermissionMode): PermissionModeConfig {
  return { mode, readOnlyTools, deleteTools };
}

describe("isToolAllowedByPermissionMode characterization", () => {
  it("covers the full tool list", () => {
    assert.ok(allTools.length > 0);
    for (const tool of allTools) {
      assert.ok(TOOL_NAMES.includes(tool.name), `missing ${tool.name}`);
    }
  });

  it("matches the main-branch oracle for every tool name and mode", () => {
    for (const mode of MODES) {
      for (const toolName of TOOL_NAMES) {
        assert.equal(
          isToolAllowedByPermissionMode(configFor(mode), toolName),
          oracleIsToolAllowedByPermissionMode(mode, toolName),
          `mode=${mode} tool=${JSON.stringify(toolName)}`
        );
      }
    }
  });

  it("createPermissionModeGate returns the same decision as the pure function", () => {
    for (const mode of MODES) {
      const gate = createPermissionModeGate(configFor(mode));
      for (const toolName of TOOL_NAMES) {
        assert.equal(gate(toolName), oracleIsToolAllowedByPermissionMode(mode, toolName));
      }
    }
  });

  it("assertToolAllowedByPermissionMode throws the exact mode-specific message for every denied tool", () => {
    for (const mode of MODES) {
      for (const toolName of TOOL_NAMES) {
        const allowed = oracleIsToolAllowedByPermissionMode(mode, toolName);
        if (allowed) {
          assert.doesNotThrow(() => assertToolAllowedByPermissionMode(configFor(mode), toolName));
          continue;
        }
        const message =
          mode === "readonly"
            ? `${toolName} is not allowed in read-only mode`
            : `${toolName} is not allowed in modify mode (delete and teardown operations are disabled)`;
        assert.throws(() => assertToolAllowedByPermissionMode(configFor(mode), toolName), {
          name: "Error",
          message,
        });
      }
    }
  });

  it("full mode never denies a tool", () => {
    for (const toolName of TOOL_NAMES) {
      assert.doesNotThrow(() => assertToolAllowedByPermissionMode(configFor("full"), toolName));
    }
  });
});
