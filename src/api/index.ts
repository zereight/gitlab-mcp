// Re-export all API functions for the 11 exposed GitLab MCP tools

// Merge Request APIs (6 tools: get_merge_request, get_mr_discussions, reply_to_thread, create_merge_request_note, update_merge_request, create_merge_request)
export {
  getMergeRequest,
  listMergeRequestDiscussions,
  replyToThread,
  updateMergeRequest,
  createMergeRequest,
  createMergeRequestNote
} from './merge-requests.js';

// Vulnerability APIs (1 tool: get_vulnerabilities_by_ids)
export {
  getVulnerabilitiesByIds
} from './vulnerabilities.js';

// Pipeline APIs (1 tool: get_failed_test_cases)
export {
  getFailedTestCases
} from './pipelines.js';

// Issue APIs (3 tools: create_issue, get_issue, update_issue)
export {
  createIssue,
  getIssue,
  updateIssue
} from './issues.js'; 