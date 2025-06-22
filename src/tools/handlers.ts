// Tool handlers for the 11 exposed GitLab MCP tools
import * as z from 'zod';
import {
  getMergeRequest,
  listMergeRequestDiscussions,
  replyToThread,
  updateMergeRequest,
  getVulnerabilitiesByIds,
  getFailedTestCases,
  createIssue,
  getIssue,
  updateIssue,
  createMergeRequest,
  createMergeRequestNote
} from '../api/index.js';
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

// Type for MCP tool call request
interface ToolCallRequest {
  params: {
    name: string;
    arguments?: any;
  };
}

// Type for MCP tool response
interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Handle tool requests for the 11 exposed GitLab MCP tools
 */
export async function handleToolCall(request: ToolCallRequest): Promise<ToolResponse> {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "get_merge_request": {
        const args = GetMergeRequestSchema.parse(request.params.arguments);
        const mergeRequest = await getMergeRequest(
          args.project_id,
          args.merge_request_iid,
          args.source_branch
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(mergeRequest) },
          ],
        };
      }

      case "get_mr_discussions": {
        const args = ListMergeRequestDiscussionsSchema.parse(
          request.params.arguments
        );
        const discussions = await listMergeRequestDiscussions(
          args.project_id,
          args.merge_request_iid,
          args.page,
          args.per_page
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(discussions) },
          ],
        };
      }

      case "reply_to_thread": {
        const args = ReplyToThreadSchema.parse(
          request.params.arguments
        );
        const note = await replyToThread(
          args.project_id,
          args.merge_request_iid,
          args.discussion_id,
          args.body,
          args.created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note) }],
        };
      }

      case "update_merge_request": {
        const args = UpdateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, source_branch, ...options } =
          args;
        const mergeRequest = await updateMergeRequest(
          project_id,
          options,
          merge_request_iid,
          source_branch
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(mergeRequest) },
          ],
        };
      }

      case "get_vulnerabilities_by_ids": {
        const args = GetVulnerabilitiesByIdsSchema.parse(request.params.arguments);
        const vulnerabilities = await getVulnerabilitiesByIds(args.project_id, args.vulnerability_ids);
        return {
          content: [
            { type: "text", text: JSON.stringify(vulnerabilities) },
          ],
        };
      }

      case "get_failed_test_cases": {
        const { project_id, pipeline_id } = GetFailedTestReportSchema.parse(
          request.params.arguments
        );
        const failedCases = await getFailedTestCases(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failedCases),
            },
          ],
        };
      }

      case "create_issue": {
        const args = CreateIssueSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const issue = await createIssue(project_id, options);
        return {
          content: [
            { type: "text", text: JSON.stringify(issue) },
          ],
        };
      }

      case "get_issue": {
        const args = GetIssueSchema.parse(request.params.arguments);
        const issue = await getIssue(args.project_id, args.issue_iid);
        return {
          content: [
            { type: "text", text: JSON.stringify(issue) },
          ],
        };
      }

      case "update_issue": {
        const args = UpdateIssueSchema.parse(request.params.arguments);
        const { project_id, issue_iid, ...options } = args;
        const issue = await updateIssue(project_id, issue_iid, options);
        return {
          content: [
            { type: "text", text: JSON.stringify(issue) },
          ],
        };
      }

      case "create_merge_request": {
        const args = CreateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const mergeRequest = await createMergeRequest(project_id, options);
        return {
          content: [
            { type: "text", text: JSON.stringify(mergeRequest) },
          ],
        };
      }

      case "create_merge_request_note": {
        const args = CreateMergeRequestNoteSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, body, position, created_at } = args;
        const discussion = await createMergeRequestNote(
          project_id,
          merge_request_iid,
          body,
          position,
          created_at
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(discussion) },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
} 