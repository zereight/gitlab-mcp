// Re-export all API functions for the 6 exposed GitLab MCP tools

// Merge Request APIs (4 tools: get_merge_request, mr_discussions, create_merge_request_note, update_merge_request)
export {
  getMergeRequest,
  listMergeRequestDiscussions,
  createMergeRequestNote,
  updateMergeRequest
} from './merge-requests.js';

// Vulnerability APIs (1 tool: get_vulnerabilities_by_ids)
export {
  getVulnerabilitiesByIds
} from './vulnerabilities.js';

// Pipeline APIs (1 tool: get_failed_test_cases)
export {
  getFailedTestCases
} from './pipelines.js'; 