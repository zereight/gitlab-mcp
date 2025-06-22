// Re-export all schemas and types needed for our 11 MCP tools

// Base schemas
export * from "./base.js";

// Merge Request schemas (4 tools: get_merge_request, update_merge_request, create_merge_request)
export * from "./merge-requests.js";

// Discussion schemas (3 tools: get_mr_discussions, reply_to_thread, create_merge_request_note)
export * from "./discussions.js";

// Vulnerability schemas (1 tool: get_vulnerabilities_by_ids)
export * from "./vulnerabilities.js";

// Test Report schemas (1 tool: get_failed_test_cases)
export * from "./test-reports.js";

// Issue schemas (3 tools: create_issue, get_issue, update_issue)
export * from "./issues.js"; 