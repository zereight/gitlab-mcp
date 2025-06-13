// Tool definitions for the 6 exposed GitLab MCP tools
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  GetMergeRequestSchema,
  ListMergeRequestDiscussionsSchema,
  CreateMergeRequestNoteSchema,
  UpdateMergeRequestSchema,
  GetVulnerabilitiesByIdsSchema,
  GetFailedTestReportSchema
} from '../schemas/index.js';

// Define all available tools - Custom MR-only version (6 tools only)
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
];

// Define which tools are read-only - Custom MR-only version (4 read-only tools)
export const readOnlyTools = [
  "get_merge_request",
  "mr_discussions",
  "get_vulnerabilities_by_ids",
  "get_failed_test_cases",
];

// Define which tools are related to wiki and can be toggled by USE_GITLAB_WIKI - Custom MR-only version (no wiki tools)
export const wikiToolNames: string[] = []; 