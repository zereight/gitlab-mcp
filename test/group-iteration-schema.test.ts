import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CreateGroupIterationCadenceSchema,
  CreateGroupIterationSchema,
  DeleteGroupIterationCadenceSchema,
  DeleteGroupIterationSchema,
  GetGroupIterationSchema,
  ListGroupIterationCadencesSchema,
  ListProjectIterationsSchema,
  UpdateGroupIterationCadenceSchema,
  UpdateGroupIterationSchema,
} from "../schemas.js";

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

  const create = CreateGroupIterationSchema.parse({
    group_id: 5,
    start_date: "2026-09-08",
    due_date: "2026-09-21",
    iterations_cadence_id: 7,
  });
  assert.equal(create.group_id, "5");
  assert.equal(create.iterations_cadence_id, "7");
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

test("create group iteration maps all supported fields", () => {
  const parsed = CreateGroupIterationSchema.parse({
    group_id: "my/group",
    title: "Sprint 2",
    description: "Second goal",
    start_date: "2026-09-08",
    due_date: "2026-09-21",
    iterations_cadence_id: "gid://gitlab/Iterations::Cadence/7",
  });

  assert.equal(parsed.title, "Sprint 2");
  assert.equal(parsed.description, "Second goal");
  assert.equal(parsed.start_date, "2026-09-08");
  assert.equal(parsed.due_date, "2026-09-21");
  assert.equal(parsed.iterations_cadence_id, "gid://gitlab/Iterations::Cadence/7");
});

test("create group iteration requires only the group, like iterationCreate", () => {
  const parsed = CreateGroupIterationSchema.parse({ group_id: "5" });
  assert.equal(parsed.start_date, undefined);
  assert.equal(parsed.due_date, undefined);
  assert.deepEqual(
    rejectedFields(CreateGroupIterationSchema, { start_date: "2026-09-08", due_date: "2026-09-21" }),
    ["group_id"]
  );
});

test("delete group iteration requires group and iteration IDs", () => {
  const parsed = DeleteGroupIterationSchema.parse({ group_id: 5, iteration_id: 53 });
  assert.equal(parsed.group_id, "5");
  assert.equal(parsed.iteration_id, "53");
  assert.deepEqual(rejectedFields(DeleteGroupIterationSchema, {}), ["group_id", "iteration_id"]);
});

test("list project iterations takes a project ID and the group listing filters", () => {
  const parsed = ListProjectIterationsSchema.parse({
    project_id: 9,
    state: "current",
    search_in: ["cadence_title"],
  });
  assert.equal(parsed.project_id, "9");
  assert.equal(parsed.state, "current");
  assert.deepEqual(parsed.search_in, ["cadence_title"]);
  assert.equal("group_id" in parsed, false);
  assert.deepEqual(rejectedFields(ListProjectIterationsSchema, {}), ["project_id"]);
});

test("create iteration cadence requires group, automatic, and active", () => {
  const parsed = CreateGroupIterationCadenceSchema.parse({
    group_id: 5,
    automatic: "false",
    active: true,
    duration_in_weeks: "2",
    iterations_in_advance: 3,
    roll_over: "true",
  });
  assert.equal(parsed.group_id, "5");
  assert.equal(parsed.automatic, false);
  assert.equal(parsed.active, true);
  assert.equal(parsed.duration_in_weeks, 2);
  assert.equal(parsed.iterations_in_advance, 3);
  assert.equal(parsed.roll_over, true);
  assert.deepEqual(rejectedFields(CreateGroupIterationCadenceSchema, {}), [
    "active",
    "automatic",
    "group_id",
  ]);
});

test("update and delete iteration cadence require the cadence ID", () => {
  const parsed = UpdateGroupIterationCadenceSchema.parse({
    iteration_cadence_id: 7,
    active: "false",
  });
  assert.equal(parsed.iteration_cadence_id, "7");
  assert.equal(parsed.active, false);
  assert.deepEqual(rejectedFields(UpdateGroupIterationCadenceSchema, { title: "S" }), [
    "iteration_cadence_id",
  ]);
  assert.deepEqual(rejectedFields(DeleteGroupIterationCadenceSchema, {}), [
    "iteration_cadence_id",
  ]);
});

test("list group iteration cadences accepts a numeric group ID and string booleans", () => {
  const parsed = ListGroupIterationCadencesSchema.parse({
    group_id: 5,
    automatic: "false",
    active: true,
    title: "Sprints",
    include_ancestor_groups: "true",
  });

  assert.equal(parsed.group_id, "5");
  assert.equal(parsed.automatic, false);
  assert.equal(parsed.active, true);
  assert.equal(parsed.title, "Sprints");
  assert.equal(parsed.include_ancestor_groups, true);
});

test("list group iteration cadences requires a group ID", () => {
  assert.deepEqual(rejectedFields(ListGroupIterationCadencesSchema, {}), ["group_id"]);
  assert.deepEqual(rejectedFields(ListGroupIterationCadencesSchema, { group_id: "" }), [
    "group_id",
  ]);
});
