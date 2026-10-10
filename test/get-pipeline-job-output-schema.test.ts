import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GetPipelineJobOutputSchema } from "../schemas.js";
import { toJSONSchema } from "../utils/schema.js";
import {
  JOB_LOG_MAX_CONTEXT_LINES,
  JOB_LOG_MAX_MATCHES,
  JOB_LOG_MAX_PATTERN_LENGTH,
} from "../utils/job-log-search.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("When GetPipelineJobOutputSchema is parsed", () => {
  describe("with only project_id and job_id", () => {
    it("should leave search fields unset", () => {
      const parsed = GetPipelineJobOutputSchema.parse({ project_id: 12, job_id: 9 });

      assert.equal(parsed.project_id, "12");
      assert.equal(parsed.job_id, "9");
      assert.equal(parsed.pattern, undefined);
      assert.equal(parsed.regex, undefined);
    });
  });

  describe("with string search bounds", () => {
    it("should coerce context_lines and max_matches", () => {
      const parsed = GetPipelineJobOutputSchema.parse({
        project_id: "group/project",
        job_id: "4",
        pattern: "error",
        regex: false,
        case_sensitive: true,
        context_lines: "3",
        max_matches: "4",
      });

      assert.equal(parsed.context_lines, 3);
      assert.equal(parsed.max_matches, 4);
      assert.equal(parsed.case_sensitive, true);
    });
  });

  describe("with a pattern over the length cap", () => {
    it("should reject the input", () => {
      const parsed = GetPipelineJobOutputSchema.safeParse({
        project_id: "group/project",
        job_id: "4",
        pattern: "a".repeat(JOB_LOG_MAX_PATTERN_LENGTH + 1),
      });

      assert.equal(parsed.success, false);
    });
  });
});

describe("When GetPipelineJobOutputSchema is exposed as MCP JSON Schema", () => {
  describe("with the generated object schema", () => {
    it("should require only project_id and job_id and advertise search bounds", () => {
      const jsonSchema = toJSONSchema(GetPipelineJobOutputSchema);
      const properties = isRecord(jsonSchema.properties) ? jsonSchema.properties : {};
      const pattern = isRecord(properties.pattern) ? properties.pattern : {};
      const contextLines = isRecord(properties.context_lines) ? properties.context_lines : {};
      const maxMatches = isRecord(properties.max_matches) ? properties.max_matches : {};
      const regex = isRecord(properties.regex) ? properties.regex : {};

      assert.deepEqual(jsonSchema.required, ["project_id", "job_id"]);
      assert.equal(jsonSchema.anyOf, undefined);
      assert.equal(pattern.maxLength, JOB_LOG_MAX_PATTERN_LENGTH);
      assert.equal(regex.type, "boolean");
      assert.equal(contextLines.maximum, JOB_LOG_MAX_CONTEXT_LINES);
      assert.equal(maxMatches.maximum, JOB_LOG_MAX_MATCHES);
    });
  });
});
