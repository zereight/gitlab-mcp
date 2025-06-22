// Tool definitions for the 11 exposed GitLab MCP tools
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  GetMergeRequestSchema,
  ListMergeRequestDiscussionsSchema,
  ReplyToThreadSchema,
  UpdateMergeRequestSchema,
  GetVulnerabilitiesByIdsSchema,
  GetFailedTestReportSchema,
  CreateIssueSchema,
  GetIssueSchema,
  UpdateIssueSchema,
  CreateMergeRequestSchema,
  CreateMergeRequestNoteSchema
} from '../schemas/index.js';

// Define all available tools - Extended version (11 tools)
export const allTools = [
  {
    name: "get_merge_request",
    description: "Get MR metadata - details of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(GetMergeRequestSchema),
  },
  {
    name: "get_mr_discussions",
    description: "Get code review comments that need responses - Lists unresolved discussion threads on specific code lines in a merge request. Perfect for finding comments from reviewers that require action or replies.",
    inputSchema: zodToJsonSchema(ListMergeRequestDiscussionsSchema),
  },
  {
    name: "reply_to_thread",
    description: "Reply to an existing merge request discussion thread",
    inputSchema: zodToJsonSchema(ReplyToThreadSchema),
  },
  {
    name: "update_merge_request",
    description: "Append label in MR - Update a merge request including adding labels (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(UpdateMergeRequestSchema),
  },
  {
    name: "get_vulnerabilities_by_ids",
    description: "Get vulnerabilities by IDs - Fetch detailed information about multiple vulnerabilities using GraphQL",
    inputSchema: zodToJsonSchema(GetVulnerabilitiesByIdsSchema),
  },
  {
    name: "get_failed_test_cases",
    description: "Get failed test cases from a pipeline's test report (requires project_id and pipeline_id)",
    inputSchema: zodToJsonSchema(GetFailedTestReportSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue in a GitLab project with title, description, assignees, labels, and milestone",
    inputSchema: zodToJsonSchema(CreateIssueSchema),
  },
  {
    name: "get_issue",
    description: "Get details of a specific issue by its IID (internal ID)",
    inputSchema: zodToJsonSchema(GetIssueSchema),
  },
  {
    name: "update_issue",
    description: "Update an existing issue - modify title, description, assignees, labels, state, etc.",
    inputSchema: zodToJsonSchema(UpdateIssueSchema),
  },
  {
    name: "create_merge_request",
    description: "Create a new merge request in a GitLab project",
    inputSchema: zodToJsonSchema(CreateMergeRequestSchema),
  },
  {
    name: "create_merge_request_note",
    description: "Create a new note on a merge request (resolvable=false, optionally on specific diff lines)",
    inputSchema: zodToJsonSchema(CreateMergeRequestNoteSchema),
  },
];

// Define which tools are read-only - Extended version (5 read-only tools)
export const readOnlyTools = [
  "get_merge_request",
  "get_mr_discussions",
  "get_vulnerabilities_by_ids",
  "get_failed_test_cases",
  "get_issue",
];

// Define which tools are related to wiki and can be toggled by USE_GITLAB_WIKI - Extended version (no wiki tools)
export const wikiToolNames: string[] = []; 