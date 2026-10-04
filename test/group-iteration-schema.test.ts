import assert from "node:assert/strict";
import { test } from "node:test";
import { GetGroupIterationSchema, UpdateGroupIterationSchema } from "../schemas.js";

test("get group iteration accepts IDs, IIDs, and GIDs", () => {
  for (const iteration_id of ["53", "13", "gid://gitlab/Iteration/53"]) {
    const parsed = GetGroupIterationSchema.parse({ group_id: "5", iteration_id });
    assert.equal(parsed.group_id, "5");
    assert.equal(parsed.iteration_id, iteration_id);
  }
});

test("iteration schemas coerce numeric JSON IDs to strings", () => {
  const get = GetGroupIterationSchema.parse({ group_id: 5, iteration_id: 53 });
  assert.equal(get.group_id, "5");
  assert.equal(get.iteration_id, "53");

  const update = UpdateGroupIterationSchema.parse({ group_id: 5, iteration_id: 53, title: "S" });
  assert.equal(update.group_id, "5");
  assert.equal(update.iteration_id, "53");
});

test("update group iteration maps all supported fields", () => {
  const parsed = UpdateGroupIterationSchema.parse({
    group_id: "my/group",
    iteration_id: "53",
    title: "Sprint 1",
    description: "Goal and checkpoint",
    start_date: "2026-09-01",
    due_date: "2026-09-07",
  });

  assert.equal(parsed.title, "Sprint 1");
  assert.equal(parsed.description, "Goal and checkpoint");
  assert.equal(parsed.start_date, "2026-09-01");
  assert.equal(parsed.due_date, "2026-09-07");
});

test("update group iteration supports clearing description", () => {
  const parsed = UpdateGroupIterationSchema.parse({
    group_id: "5",
    iteration_id: "53",
    description: null,
  });
  assert.equal(parsed.description, null);
});

/**
 * Names of the top-level fields a parse rejected. Asserting on the field rather than on
 * the error text keeps these tests independent of the Zod version's wording.
 */
function rejectedFields(
  schema: { safeParse: (input: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } },
  input: unknown
): string[] {
  const result = schema.safeParse(input);
  assert.equal(result.success, false, "expected the input to be rejected");
  return [...new Set(result.error!.issues.map(issue => String(issue.path[0])))].sort();
}

test("update group iteration requires group and iteration IDs", () => {
  assert.deepEqual(rejectedFields(UpdateGroupIterationSchema, { description: "Goal" }), [
    "group_id",
    "iteration_id",
  ]);
});

test("iteration schemas reject an empty ID", () => {
  assert.deepEqual(rejectedFields(GetGroupIterationSchema, { group_id: "", iteration_id: "53" }), [
    "group_id",
  ]);
});
