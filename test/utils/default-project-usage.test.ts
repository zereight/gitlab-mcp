import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getManagedMaskingProjectIds } from "../../masking/project-scope.js";
import {
  DEFAULT_PROJECT_USAGE_BY_TOOL,
  toolUsesDefaultProject,
} from "../../tools/default-project-usage.js";
import { allTools } from "../../tools/registry.js";

type OracleSchema = { required?: string[] } | undefined;

interface OracleEnv {
  GITLAB_PROJECT_ID: string | undefined;
  ENABLE_STRICT_PROJECT_SCOPE: boolean;
  getEffectiveAllowedProjectIds: () => string[];
}

/**
 * Oracle: the expression verbatim from main (27d976f7), index.ts selectMaskingPolicy.
 * Only the module-level reads are parameters (GITLAB_PROJECT_ID,
 * ENABLE_STRICT_PROJECT_SCOPE, getEffectiveAllowedProjectIds). Do not simplify it. It
 * is the reference the new decision is checked against.
 */
function mainUsesDefaultProject(
  toolName: string,
  inputSchema: OracleSchema,
  env: OracleEnv
): boolean | undefined {
  const GITLAB_PROJECT_ID = env.GITLAB_PROJECT_ID;
  const ENABLE_STRICT_PROJECT_SCOPE = env.ENABLE_STRICT_PROJECT_SCOPE;
  const getEffectiveAllowedProjectIds = env.getEffectiveAllowedProjectIds;
  return (
    inputSchema?.required?.includes("project_id") ||
    toolName === "get_file_contents" ||
    (toolName === "my_issues" &&
      (Boolean(GITLAB_PROJECT_ID) || getEffectiveAllowedProjectIds().length > 0)) ||
    ((toolName === "list_issues" || toolName === "list_merge_requests") &&
      ENABLE_STRICT_PROJECT_SCOPE &&
      getEffectiveAllowedProjectIds().length > 0)
  );
}

const PROJECT_IDS: ReadonlyArray<string | undefined> = [undefined, "", "42"];
const ALLOWLIST_SIZES = [0, 1, 2];
const STRICT_FLAGS = [false, true];

/**
 * Schemas to test for each tool name. The first is the real schema from the registry.
 * The others force both branches of the required-project_id check, and cover a tool
 * name with no schema, which is what the find() in index.ts yields for an unknown name.
 */
function schemaVariants(
  realSchema: { required?: readonly string[] } | undefined
): Array<{ label: string; schema: OracleSchema }> {
  return [
    { label: "real", schema: realSchema as OracleSchema },
    { label: "no-schema", schema: undefined },
    { label: "empty", schema: {} },
    { label: "requires-project_id", schema: { required: ["project_id"] } },
  ];
}

const allowlistOf = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("toolUsesDefaultProject equivalence with main", () => {
  const toolNames = [...allTools.map(t => t.name), "unknown_tool_for_equivalence"];

  it("matches the main expression for every tool and config combination", () => {
    let combinations = 0;
    for (const toolName of toolNames) {
      const real = allTools.find(t => t.name === toolName)?.inputSchema as
        { required?: readonly string[] } | undefined;
      for (const variant of schemaVariants(real)) {
        for (const projectId of PROJECT_IDS) {
          for (const allowlistSize of ALLOWLIST_SIZES) {
            for (const strict of STRICT_FLAGS) {
              combinations++;
              const allowed = allowlistOf(allowlistSize);
              let oracleReads = 0;
              let newReads = 0;
              const expected = mainUsesDefaultProject(toolName, variant.schema, {
                GITLAB_PROJECT_ID: projectId,
                ENABLE_STRICT_PROJECT_SCOPE: strict,
                getEffectiveAllowedProjectIds: () => {
                  oracleReads++;
                  return allowed;
                },
              });
              const actual = toolUsesDefaultProject(toolName, variant.schema, {
                hasDefaultProject: Boolean(projectId),
                hasAllowedProjectIds: () => {
                  newReads++;
                  return allowed.length > 0;
                },
                strictProjectScope: strict,
              });
              const context = `${toolName} schema=${variant.label} GITLAB_PROJECT_ID=${JSON.stringify(projectId)} allowlist=${allowlistSize} strict=${strict}`;
              // The oracle always returns a boolean here, so comparing with === is exact.
              assert.equal(typeof expected, "boolean", context);
              assert.equal(actual, expected, context);
              // The allowlist is read at the same points, so the reads match too.
              assert.equal(newReads, oracleReads, `allowlist reads: ${context}`);
            }
          }
        }
      }
    }
    // Guards against the loop silently covering nothing.
    assert.equal(combinations, toolNames.length * 4 * 3 * 3 * 2);
  });

  it("declares only tools that exist in the registry", () => {
    const registered = new Set(allTools.map(t => t.name));
    const stale = [...DEFAULT_PROJECT_USAGE_BY_TOOL.keys()].filter(name => !registered.has(name));
    assert.deepEqual(stale, []);
  });

  it("covers the four tools that main's expression named", () => {
    for (const name of ["get_file_contents", "my_issues", "list_issues", "list_merge_requests"]) {
      assert.ok(DEFAULT_PROJECT_USAGE_BY_TOOL.has(name), name);
    }
  });
});

describe("masking scope for the four default-project tools", () => {
  const FOUR_TOOLS = ["get_file_contents", "my_issues", "list_issues", "list_merge_requests"];
  const DEFAULT_PROJECT = "D-default";

  it("passes the same project ids to the masking resolver before and after", () => {
    for (const toolName of FOUR_TOOLS) {
      const schema = allTools.find(t => t.name === toolName)?.inputSchema;
      for (const projectId of PROJECT_IDS) {
        for (const allowlistSize of ALLOWLIST_SIZES) {
          for (const strict of STRICT_FLAGS) {
            const allowed = allowlistOf(allowlistSize);
            const env: OracleEnv = {
              GITLAB_PROJECT_ID: projectId,
              ENABLE_STRICT_PROJECT_SCOPE: strict,
              getEffectiveAllowedProjectIds: () => allowed,
            };
            const oracleUses = mainUsesDefaultProject(toolName, schema, env);
            const newUses = toolUsesDefaultProject(toolName, schema, {
              hasDefaultProject: Boolean(projectId),
              hasAllowedProjectIds: () => allowed.length > 0,
              strictProjectScope: strict,
            });
            for (const args of [{ project_id: "77" }, {}]) {
              // Same call shape as index.ts: the default is supplied only when the decision is true.
              const before = getManagedMaskingProjectIds(
                schema,
                args,
                oracleUses ? () => DEFAULT_PROJECT : undefined
              );
              const after = getManagedMaskingProjectIds(
                schema,
                args,
                newUses ? () => DEFAULT_PROJECT : undefined
              );
              assert.deepStrictEqual(
                after,
                before,
                `${toolName} args=${JSON.stringify(args)} config=${JSON.stringify({ projectId, allowlistSize, strict })}`
              );
            }
          }
        }
      }
    }
  });

  it("does inject the default for a bare get_file_contents call, so the comparison is not vacuous", () => {
    const schema = allTools.find(t => t.name === "get_file_contents")?.inputSchema;
    const scope = getManagedMaskingProjectIds(schema, {}, () => DEFAULT_PROJECT);
    assert.ok(scope.projectIds.includes(DEFAULT_PROJECT));
  });
});
