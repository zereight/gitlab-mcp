import { z } from "zod";
import { ProjectParamsSchema } from "./base.js";

// Test case schema
export const GitLabTestCaseSchema = z.object({
  status: z.string(),
  classname: z.string().optional(),
  name: z.string().optional(),
  execution_time: z.number().optional(),
  system_output: z.string().nullable().optional(),
});

// Test suite schema
export const GitLabTestSuiteSchema = z.object({
  name: z.string().optional(),
  total_time: z.number().optional(),
  total_count: z.number().optional(),
  success_count: z.number().optional(),
  failed_count: z.number().optional(),
  skipped_count: z.number().optional(),
  error_count: z.number().optional(),
  test_cases: z.array(GitLabTestCaseSchema),
});

// Test report schema
export const GitLabTestReportSchema = z.object({
  total_time: z.number().optional(),
  total_count: z.number().optional(),
  success_count: z.number().optional(),
  failed_count: z.number().optional(),
  skipped_count: z.number().optional(),
  error_count: z.number().optional(),
  test_suites: z.array(GitLabTestSuiteSchema),
});

// Input schema for getting failed test cases from a pipeline's test report
export const GetFailedTestReportSchema = ProjectParamsSchema.extend({
  pipeline_id: z.number().describe("The ID of the pipeline"),
});

// Types
export type GitLabTestCase = z.infer<typeof GitLabTestCaseSchema>;
export type GitLabTestSuite = z.infer<typeof GitLabTestSuiteSchema>;
export type GitLabTestReport = z.infer<typeof GitLabTestReportSchema>;
export type GetFailedTestReportOptions = z.infer<typeof GetFailedTestReportSchema>; 