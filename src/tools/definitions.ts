// Tool definitions for the 9 exposed GitLab MCP tools
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  GetMergeRequestSchema,
  ListMergeRequestDiscussionsSchema,
  CreateMergeRequestNoteSchema,
  UpdateMergeRequestSchema,
  GetVulnerabilitiesByIdsSchema,
  GetFailedTestReportSchema,
  CreateIssueSchema,
  GetIssueSchema,
  UpdateIssueSchema
} from '../schemas/index.js';

// Define all available tools - Extended version (9 tools)
export const allTools = [
  {
    name: "get_merge_request",
    description: "Get MR metadata - details of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(GetMergeRequestSchema),
  },
  {
    name: "mr_discussions",
    description: "List unresolved diff discussions with pagination - List discussion items for a merge request filtered for unresolved diff notes (DiffNote type, resolvable=true, resolved=false). Returns paginated results with metadata.",
    inputSchema: zodToJsonSchema(ListMergeRequestDiscussionsSchema),
  },
  {
    name: "create_merge_request_note",
    description: "Add MR notes - Add a reply note to an existing merge request thread",
    inputSchema: zodToJsonSchema(CreateMergeRequestNoteSchema),
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
];

// Define which tools are read-only - Extended version (5 read-only tools)
export const readOnlyTools = [
  "get_merge_request",
  "mr_discussions",
  "get_vulnerabilities_by_ids",
  "get_failed_test_cases",
  "get_issue",
];

// Define which tools are related to wiki and can be toggled by USE_GITLAB_WIKI - Extended version (no wiki tools)
export const wikiToolNames: string[] = []; 