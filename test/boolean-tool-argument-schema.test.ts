import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as schemas from "../schemas.js";
import { GitLabApiRequestSchema } from "../tools/gitlab-api-request.js";

const {
  CreateMergeRequestSchema,
  MergeMergeRequestSchema,
  ResolveMergeRequestThreadSchema,
  UpdateIssueSchema,
  UpdateMergeRequestSchema,
} = schemas;

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "group/project";

const FALSE_INPUTS: unknown[] = [false, "false", "FALSE", " false ", "0", 0];
const TRUE_INPUTS: unknown[] = [true, "true", "TRUE", " true ", "1", 1];
const INVALID_INPUTS: unknown[] = ["", "no", "yes", "off", 2, {}];

describe("When parsing boolean tool arguments", () => {
  describe("with merge_merge_request", () => {
    const fields = [
      "should_remove_source_branch",
      "squash",
      "auto_merge",
      "merge_when_pipeline_succeeds",
    ] as const;
    const parse = (overrides: Record<string, unknown>) =>
      MergeMergeRequestSchema.parse({
        project_id: PROJECT_ID,
        merge_request_iid: "1",
        ...overrides,
      });

    for (const field of fields) {
      test(`should parse false-like values of ${field} as false`, () => {
        for (const value of FALSE_INPUTS) {
          assert.equal(
            parse({ [field]: value })[field],
            false,
            `${field}=${JSON.stringify(value)}`
          );
        }
      });

      test(`should parse true-like values of ${field} as true`, () => {
        for (const value of TRUE_INPUTS) {
          assert.equal(parse({ [field]: value })[field], true, `${field}=${JSON.stringify(value)}`);
        }
      });

      test(`should reject unrecognized values of ${field}`, () => {
        for (const value of INVALID_INPUTS) {
          assert.throws(() => parse({ [field]: value }), `${field}=${JSON.stringify(value)}`);
        }
      });

      test(`should default ${field} to false when omitted`, () => {
        assert.equal(parse({})[field], false);
      });
    }
  });

  describe("with update_issue", () => {
    test('should keep confidential and discussion_locked false for "false"', () => {
      const parsed = UpdateIssueSchema.parse({
        project_id: PROJECT_ID,
        issue_iid: "1",
        confidential: "false",
        discussion_locked: "false",
      });
      assert.equal(parsed.confidential, false);
      assert.equal(parsed.discussion_locked, false);
    });
  });

  describe("with resolve_merge_request_thread", () => {
    test('should unresolve for "false"', () => {
      const parsed = ResolveMergeRequestThreadSchema.parse({
        project_id: PROJECT_ID,
        merge_request_iid: "1",
        discussion_id: "abc",
        resolved: "false",
      });
      assert.equal(parsed.resolved, false);
    });
  });

  describe("with create_merge_request and update_merge_request", () => {
    test('should keep remove_source_branch, squash and draft false for "false"', () => {
      const created = CreateMergeRequestSchema.parse({
        project_id: PROJECT_ID,
        title: "Title",
        source_branch: "feature",
        target_branch: "main",
        remove_source_branch: "false",
        squash: "false",
        draft: "false",
      });
      assert.equal(created.remove_source_branch, false);
      assert.equal(created.squash, false);
      assert.equal(created.draft, false);

      const updated = UpdateMergeRequestSchema.parse({
        project_id: PROJECT_ID,
        merge_request_iid: "1",
        remove_source_branch: "false",
        squash: "false",
        draft: "false",
      });
      assert.equal(updated.remove_source_branch, false);
      assert.equal(updated.squash, false);
      assert.equal(updated.draft, false);
    });
  });
});

function findCoercedBooleans(schema: z.ZodType, path: string, seen: Set<unknown>): string[] {
  if (seen.has(schema)) return [];
  seen.add(schema);
  const def = (schema as any)._zod.def;
  if (def.type === "boolean" && def.coerce) return [path];

  const hits: string[] = [];
  const visit = (value: unknown, childPath: string) => {
    if (value instanceof z.ZodType) {
      hits.push(...findCoercedBooleans(value, childPath, seen));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${childPath}[${index}]`));
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) visit(item, `${childPath}.${key}`);
    }
  };
  for (const [key, value] of Object.entries(def)) {
    if (key === "shape") {
      for (const [field, fieldSchema] of Object.entries(value as object)) {
        visit(fieldSchema, `${path}.${field}`);
      }
    } else {
      visit(value, path);
    }
  }
  return hits;
}

describe("When guarding tool input schemas against z.coerce.boolean", () => {
  test("should not use z.coerce.boolean in any registered tool input schema", () => {
    const registrySource = readFileSync(join(REPO_ROOT, "tools/registry.ts"), "utf8");
    const schemaNames = [
      ...new Set([...registrySource.matchAll(/toJSONSchema\((\w+)\)/g)].map(m => m[1])),
    ];
    assert.ok(
      schemaNames.length > 100,
      "expected to find the tool input schemas in tools/registry.ts"
    );

    const exported: Record<string, unknown> = { ...schemas, GitLabApiRequestSchema };
    const hits: string[] = [];
    for (const name of schemaNames) {
      const schema = exported[name];
      assert.ok(schema instanceof z.ZodType, `${name} is not an exported Zod schema`);
      hits.push(...findCoercedBooleans(schema, name, new Set()));
    }

    assert.deepEqual(
      hits,
      [],
      'z.coerce.boolean() turns the string "false" into true; use coerceBooleanString for tool arguments'
    );
  });

  test("should only use z.coerce.boolean in GitLab response schemas in schemas.ts", () => {
    const lines = readFileSync(join(REPO_ROOT, "schemas.ts"), "utf8").split("\n");
    const offenders: string[] = [];
    let current = "";
    lines.forEach((line, index) => {
      const declaration = line.match(/^(?:export )?const (\w+)/);
      if (declaration) current = declaration[1];
      if (line.trim().startsWith("//")) return;
      const usesCoerceBoolean =
        line.includes("z.coerce.boolean") ||
        (/z\.coerce\s*$/.test(line) && /^\s*\.boolean\(/.test(lines[index + 1] ?? ""));
      if (usesCoerceBoolean && !current.startsWith("GitLab")) {
        offenders.push(`schemas.ts:${index + 1} (${current})`);
      }
    });

    assert.deepEqual(
      offenders,
      [],
      'z.coerce.boolean() turns the string "false" into true; use coerceBooleanString for tool arguments'
    );
  });
});
