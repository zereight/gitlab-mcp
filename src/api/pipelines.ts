// Pipeline API functions for GitLab MCP (minimal - only for test cases)
import fetch from 'node-fetch';
import { 
  GITLAB_API_URL, 
  DEFAULT_FETCH_CONFIG 
} from '../config/gitlab.js';
import { handleGitLabError } from '../utils/index.js';
import {
  GitLabTestReportSchema,
  type GitLabTestCase
} from '../../schemas.js';

/**
 * Get failed test cases from a pipeline's test report
 * (for get_failed_test_cases tool)
 */
export async function getFailedTestCases(
  projectId: string,
  pipelineId: number
): Promise<GitLabTestCase[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}/test_report`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  if (response.status === 404) {
    throw new Error("Pipeline or test report not found");
  }

  // GitLab can return 204 (No Content) when the report is still being generated
  if (response.status === 204) {
    throw new Error("Test report is not ready yet, please retry later");
  }

  await handleGitLabError(response);
  const data = await response.json();
  const report = GitLabTestReportSchema.parse(data);

  // Extract failed test cases from all suites
  const failedCases: GitLabTestCase[] = report.test_suites.flatMap((suite) =>
    suite.test_cases.filter((test) => test.status === "failed")
  );

  return failedCases;
} 