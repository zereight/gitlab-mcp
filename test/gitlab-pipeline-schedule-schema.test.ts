import assert from "node:assert/strict";
import { test } from "node:test";
import { GitLabPipelineScheduleSchema } from "../schemas.js";

const BASE_SCHEDULE = {
  id: 13,
  description: "Nightly build",
  cron: "0 1 * * *",
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
};

test("pipeline schedule response accepts inputs without value", () => {
  // Zod 4 rejects a missing key on required unknown (Zod 3 accepted it);
  // schedule inputs must tolerate a valueless entry.
  const parsed = GitLabPipelineScheduleSchema.parse({
    ...BASE_SCHEDULE,
    inputs: [{ name: "deploy_strategy" }],
  });
  assert.equal(parsed.inputs?.[0].name, "deploy_strategy");
  assert.equal("value" in (parsed.inputs?.[0] ?? {}), false);
});

test("pipeline schedule response keeps inputs with value", () => {
  const parsed = GitLabPipelineScheduleSchema.parse({
    ...BASE_SCHEDULE,
    inputs: [
      { name: "deploy_strategy", value: "blue-green" },
      { name: "matrix", value: { os: "linux" } },
    ],
  });
  assert.equal(parsed.inputs?.[0].value, "blue-green");
  assert.deepEqual(parsed.inputs?.[1].value, { os: "linux" });
});
