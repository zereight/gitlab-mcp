import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GetBranchDiffsSchema,
  GetMergeRequestDiffsSchema,
  ListMergeRequestChangedFilesSchema,
} from "../schemas.js";

const MAX_PATTERNS = 50;
const MAX_PATTERN_LENGTH = 200;

const TOOLS = [
  {
    name: "get_branch_diffs",
    schema: GetBranchDiffsSchema,
    args: { project_id: "group/project", from: "main", to: "feature" },
  },
  {
    name: "get_merge_request_diffs",
    schema: GetMergeRequestDiffsSchema,
    args: { project_id: "group/project", merge_request_iid: 1 },
  },
  {
    name: "list_merge_request_changed_files",
    schema: ListMergeRequestChangedFilesSchema,
    args: { project_id: "group/project", merge_request_iid: 1 },
  },
];

for (const { name, schema, args } of TOOLS) {
  test(`${name} accepts ${MAX_PATTERNS} patterns of ${MAX_PATTERN_LENGTH} characters`, () => {
    const patterns = Array(MAX_PATTERNS).fill("a".repeat(MAX_PATTERN_LENGTH));
    assert.equal(schema.safeParse({ ...args, excluded_file_patterns: patterns }).success, true);
  });

  test(`${name} rejects more than ${MAX_PATTERNS} patterns`, () => {
    const patterns = Array(MAX_PATTERNS + 1).fill("^vendor/");
    assert.equal(schema.safeParse({ ...args, excluded_file_patterns: patterns }).success, false);
  });

  test(`${name} rejects a pattern longer than ${MAX_PATTERN_LENGTH} characters`, () => {
    const patterns = ["a".repeat(MAX_PATTERN_LENGTH + 1)];
    assert.equal(schema.safeParse({ ...args, excluded_file_patterns: patterns }).success, false);
  });

  test(`${name} still accepts omitted excluded_file_patterns`, () => {
    assert.equal(schema.safeParse(args).success, true);
  });
}
