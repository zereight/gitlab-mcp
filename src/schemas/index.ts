// Re-export all schemas and types needed for our 6 MCP tools

// Base schemas
export * from "./base.js";

// Merge Request schemas (4 tools: get_merge_request, mr_discussions, create_merge_request_note, update_merge_request)
export * from "./merge-requests.js";

// Vulnerability schemas (1 tool: get_vulnerabilities_by_ids)
export * from "./vulnerabilities.js";

// Test Report schemas (1 tool: get_failed_test_cases)
export * from "./test-reports.js"; 