#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import fetchCookie from "fetch-cookie";
import fs from "fs";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import nodeFetch from "node-fetch";
import path, { dirname } from "path";
import { SocksProxyAgent } from "socks-proxy-agent";
import { CookieJar, parse as parseCookie } from "tough-cookie";
import { fileURLToPath } from "url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
// Add type imports for proxy agents
import { Agent } from "http";
import { Agent as HttpsAgent } from "https";
import { URL } from "url";
import {
  BulkPublishDraftNotesSchema,
  CancelPipelineSchema,
  CreateBranchOptionsSchema,
  CreateBranchSchema,
  CreateDraftNoteSchema,
  CreateIssueLinkSchema,
  CreateIssueNoteSchema,
  CreateIssueOptionsSchema,
  CreateIssueSchema,
  CreateLabelSchema, // Added
  CreateMergeRequestNoteSchema,
  CreateMergeRequestOptionsSchema,
  CreateMergeRequestSchema,
  CreateMergeRequestThreadSchema,
  CreateNoteSchema,
  CreateOrUpdateFileSchema,
  CreatePipelineSchema,
  CreateProjectMilestoneSchema,
  CreateRepositoryOptionsSchema,
  CreateRepositorySchema,
  CreateWikiPageSchema,
  DeleteDraftNoteSchema,
  DeleteIssueLinkSchema,
  DeleteIssueSchema,
  DeleteLabelSchema,
  DeleteProjectMilestoneSchema,
  DeleteWikiPageSchema,
  EditProjectMilestoneSchema,
  type FileOperation,
  ForkRepositorySchema,
  GetBranchDiffsSchema,
  GetCommitDiffSchema,
  GetCommitSchema,
  GetDraftNoteSchema,
  GetFileContentsSchema,
  GetIssueLinkSchema,
  GetIssueSchema,
  GetLabelSchema,
  GetMergeRequestDiffsSchema,
  GetMergeRequestSchema,
  GetMilestoneBurndownEventsSchema,
  GetMilestoneIssuesSchema,
  GetMilestoneMergeRequestsSchema,
  GetNamespaceSchema,
  // pipeline job schemas
  GetPipelineJobOutputSchema,
  GetPipelineSchema,
  GetProjectMilestoneSchema,
  GetProjectSchema,
  type GetRepositoryTreeOptions,
  GetRepositoryTreeSchema,
  GetUsersSchema,
  GetWikiPageSchema,
  type GitLabCommit,
  GitLabCommitSchema,
  GitLabCompareResult,
  GitLabCompareResultSchema,
  type GitLabContent,
  GitLabContentSchema,
  type GitLabCreateUpdateFileResponse,
  GitLabCreateUpdateFileResponseSchema,
  GitLabDiffSchema,
  type GitLabDiscussion,
  // Discussion Types
  type GitLabDiscussionNote,
  // Discussion Schemas
  GitLabDiscussionNoteSchema, // Added
  GitLabDiscussionSchema,
  // Draft Notes Types
  type GitLabDraftNote,
  // Draft Notes Schemas
  GitLabDraftNoteSchema,
  type GitLabFork,
  GitLabForkSchema,
  type GitLabIssue,
  type GitLabIssueLink,
  GitLabIssueLinkSchema,
  GitLabIssueSchema,
  type GitLabIssueWithLinkDetails,
  GitLabIssueWithLinkDetailsSchema,
  type GitLabLabel,
  GitLabMarkdownUpload,
  GitLabMarkdownUploadSchema,
  type GitLabMergeRequest,
  type GitLabMergeRequestDiff,
  GitLabMergeRequestSchema,
  type GitLabMilestones,
  GitLabMilestonesSchema,
  type GitLabNamespace,
  type GitLabNamespaceExistsResponse,
  GitLabNamespaceExistsResponseSchema,
  GitLabNamespaceSchema,
  type GitLabPipeline,
  type GitLabPipelineJob,
  GitLabPipelineJobSchema,
  GitLabPipelineSchema,
  type GitLabPipelineTriggerJob,
  GitLabPipelineTriggerJobSchema,
  type GitLabProject,
  type GitLabProjectMember,
  GitLabProjectMemberSchema,
  GitLabProjectSchema,
  type GitLabReference,
  GitLabReferenceSchema,
  type GitLabRepository,
  GitLabRepositorySchema,
  type GitLabSearchResponse,
  GitLabSearchResponseSchema,
  type GitLabTree,
  type GitLabTreeItem,
  GitLabTreeItemSchema,
  GitLabTreeSchema,
  type GitLabUser,
  GitLabUserSchema,
  type GitLabUsersResponse,
  GitLabUsersResponseSchema,
  type GitLabWikiPage,
  GitLabWikiPageSchema,
  GroupIteration,
  type ListCommitsOptions,
  ListCommitsSchema,
  ListDraftNotesSchema,
  ListGroupIterationsSchema,
  ListGroupProjectsSchema,
  ListIssueDiscussionsSchema,
  ListIssueLinksSchema,
  ListIssuesSchema,
  ListLabelsSchema,
  ListMergeRequestDiffsSchema, // Added
  ListMergeRequestDiscussionsSchema,
  ListMergeRequestsSchema,
  ListNamespacesSchema,
  type ListPipelineJobsOptions,
  ListPipelineJobsSchema,
  type ListPipelinesOptions,
  ListPipelinesSchema,
  type ListPipelineTriggerJobsOptions,
  ListPipelineTriggerJobsSchema,
  type ListProjectMembersOptions,
  ListProjectMembersSchema,
  ListProjectMilestonesSchema,
  ListProjectsSchema,
  ListWikiPagesOptions,
  ListWikiPagesSchema,
  MarkdownUploadSchema,
  DownloadAttachmentSchema,
  MergeMergeRequestSchema,
  type MergeRequestThreadPosition,
  type MergeRequestThreadPositionCreate,
  type MyIssuesOptions,
  MyIssuesSchema,
  type PaginatedDiscussionsResponse,
  PaginatedDiscussionsResponseSchema,
  type PaginationOptions,
  PromoteProjectMilestoneSchema,
  PublishDraftNoteSchema,
  PushFilesSchema,
  RetryPipelineSchema,
  SearchRepositoriesSchema,
  UpdateDraftNoteSchema,
  UpdateIssueNoteSchema,
  UpdateIssueSchema,
  UpdateLabelSchema,
  UpdateMergeRequestNoteSchema,
  UpdateMergeRequestSchema,
  UpdateWikiPageSchema,
  VerifyNamespaceSchema
} from "./schemas.js";

// Import GitLab MCP Extensions
import { 
  allExtensionTools, 
  extensionHandlers, 
  readOnlyExtensionTools,
  type ExtensionHandlerContext 
} from "./extensions/index.js";

import { randomUUID } from "crypto";
import { pino } from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      levelFirst: true,
      destination: 2,
    },
  },
});

/**
 * Available transport modes for MCP server
 */
enum TransportMode {
  STDIO = "stdio",
  SSE = "sse",
  STREAMABLE_HTTP = "streamable-http",
}

/**
 * Read version from package.json
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../package.json");
let SERVER_VERSION = "unknown";
try {
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    SERVER_VERSION = packageJson.version || SERVER_VERSION;
  }
} catch (error) {
  // Warning: Could not read version from package.json - silently continue
}

const server = new Server(
  {
    name: "better-gitlab-mcp-server",
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const GITLAB_AUTH_COOKIE_PATH = process.env.GITLAB_AUTH_COOKIE_PATH;
const IS_OLD = process.env.GITLAB_IS_OLD === "true";
const GITLAB_READ_ONLY_MODE = process.env.GITLAB_READ_ONLY_MODE === "true";
const USE_GITLAB_WIKI = process.env.USE_GITLAB_WIKI === "true";
const USE_MILESTONE = process.env.USE_MILESTONE === "true";
const USE_PIPELINE = process.env.USE_PIPELINE === "true";
const SSE = process.env.SSE === "true";
const STREAMABLE_HTTP = process.env.STREAMABLE_HTTP === "true";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT || 3002;
// Add proxy configuration
const HTTP_PROXY = process.env.HTTP_PROXY;
const HTTPS_PROXY = process.env.HTTPS_PROXY;
const NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const GITLAB_CA_CERT_PATH = process.env.GITLAB_CA_CERT_PATH;

let sslOptions = undefined;
if (NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  sslOptions = { rejectUnauthorized: false };
} else if (GITLAB_CA_CERT_PATH) {
  const ca = fs.readFileSync(GITLAB_CA_CERT_PATH);
  sslOptions = { ca };
}

// Configure proxy agents if proxies are set
let httpAgent: Agent | undefined = undefined;
let httpsAgent: Agent | undefined = undefined;

if (HTTP_PROXY) {
  if (HTTP_PROXY.startsWith("socks")) {
    httpAgent = new SocksProxyAgent(HTTP_PROXY);
  } else {
    httpAgent = new HttpProxyAgent(HTTP_PROXY);
  }
}
if (HTTPS_PROXY) {
  if (HTTPS_PROXY.startsWith("socks")) {
    httpsAgent = new SocksProxyAgent(HTTPS_PROXY);
  } else {
    httpsAgent = new HttpsProxyAgent(HTTPS_PROXY, sslOptions);
  }
}
httpsAgent = httpsAgent || new HttpsAgent(sslOptions);
httpAgent = httpAgent || new Agent();

// Create cookie jar with clean Netscape file parsing
const createCookieJar = (): CookieJar | null => {
  if (!GITLAB_AUTH_COOKIE_PATH) return null;

  try {
    const cookiePath = GITLAB_AUTH_COOKIE_PATH.startsWith("~/")
      ? path.join(process.env.HOME || "", GITLAB_AUTH_COOKIE_PATH.slice(2))
      : GITLAB_AUTH_COOKIE_PATH;

    const jar = new CookieJar();
    const cookieContent = fs.readFileSync(cookiePath, "utf8");

    cookieContent.split("\n").forEach(line => {
      // Handle #HttpOnly_ prefix
      if (line.startsWith("#HttpOnly_")) {
        line = line.slice(10);
      }
      // Skip comments and empty lines
      if (line.startsWith("#") || !line.trim()) {
        return;
      }

      // Parse Netscape format: domain, flag, path, secure, expires, name, value
      const parts = line.split("\t");
      if (parts.length >= 7) {
        const [domain, , path, secure, expires, name, value] = parts;

        // Build cookie string in standard format
        const cookieStr = `${name}=${value}; Domain=${domain}; Path=${path}${secure === "TRUE" ? "; Secure" : ""}${expires !== "0" ? `; Expires=${new Date(parseInt(expires) * 1000).toUTCString()}` : ""}`;

        // Use tough-cookie's parse function for robust parsing
        const cookie = parseCookie(cookieStr);
        if (cookie) {
          const url = `${secure === "TRUE" ? "https" : "http"}://${domain.startsWith(".") ? domain.slice(1) : domain}`;
          jar.setCookieSync(cookie, url);
        }
      }
    });

    return jar;
  } catch (error) {
    logger.error("Error loading cookie file:", error);
    return null;
  }
};

// Initialize cookie jar and fetch
const cookieJar = createCookieJar();
const fetch = cookieJar ? fetchCookie(nodeFetch, cookieJar) : nodeFetch;

// Ensure session is established for the current request
async function ensureSessionForRequest(): Promise<void> {
  if (!cookieJar || !GITLAB_AUTH_COOKIE_PATH) return;

  // Extract the base URL from GITLAB_API_URL
  const apiUrl = new URL(GITLAB_API_URL);
  const baseUrl = `${apiUrl.protocol}//${apiUrl.hostname}`;

  // Check if we already have GitLab session cookies
  const gitlabCookies = cookieJar.getCookiesSync(baseUrl);
  const hasSessionCookie = gitlabCookies.some(
    cookie => cookie.key === "_gitlab_session" || cookie.key === "remember_user_token"
  );

  if (!hasSessionCookie) {
    try {
      // Establish session with a lightweight request
      await fetch(`${GITLAB_API_URL}/user`, {
        ...DEFAULT_FETCH_CONFIG,
        redirect: "follow",
      }).catch(() => {
        // Ignore errors - the important thing is that cookies get set during redirects
      });

      // Small delay to ensure cookies are fully processed
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore session establishment errors
    }
  }
}

// Modify DEFAULT_HEADERS to include agent configuration
const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
};
if (IS_OLD) {
  DEFAULT_HEADERS["Private-Token"] = `${GITLAB_PERSONAL_ACCESS_TOKEN}`;
} else {
  DEFAULT_HEADERS["Authorization"] = `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`;
}

// Create a default fetch configuration object that includes proxy agents if set
const DEFAULT_FETCH_CONFIG = {
  headers: DEFAULT_HEADERS,
  agent: (parsedUrl: URL) => {
    if (parsedUrl.protocol === "https:") {
      return httpsAgent;
    }
    return httpAgent;
  },
};

// Define all available tools
const allTools = [
  {
    name: "merge_merge_request",
    description: "Merge a merge request in a GitLab project",
    inputSchema: zodToJsonSchema(MergeMergeRequestSchema),
  },
  {
    name: "create_or_update_file",
    description: "Create or update a single file in a GitLab project",
    inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema),
  },
  {
    name: "search_repositories",
    description: "Search for GitLab projects",
    inputSchema: zodToJsonSchema(SearchRepositoriesSchema),
  },
  {
    name: "create_repository",
    description: "Create a new GitLab project",
    inputSchema: zodToJsonSchema(CreateRepositorySchema),
  },
  {
    name: "get_file_contents",
    description: "Get the contents of a file or directory from a GitLab project",
    inputSchema: zodToJsonSchema(GetFileContentsSchema),
  },
  {
    name: "push_files",
    description: "Push multiple files to a GitLab project in a single commit",
    inputSchema: zodToJsonSchema(PushFilesSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue in a GitLab project",
    inputSchema: zodToJsonSchema(CreateIssueSchema),
  },
  {
    name: "create_merge_request",
    description: "Create a new merge request in a GitLab project",
    inputSchema: zodToJsonSchema(CreateMergeRequestSchema),
  },
  {
    name: "fork_repository",
    description: "Fork a GitLab project to your account or specified namespace",
    inputSchema: zodToJsonSchema(ForkRepositorySchema),
  },
  {
    name: "create_branch",
    description: "Create a new branch in a GitLab project",
    inputSchema: zodToJsonSchema(CreateBranchSchema),
  },
  {
    name: "get_merge_request",
    description:
      "Get details of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(GetMergeRequestSchema),
  },
  {
    name: "get_merge_request_diffs",
    description:
      "Get the changes/diffs of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(GetMergeRequestDiffsSchema),
  },
  {
    name: "list_merge_request_diffs",
    description:
      "List merge request diffs with pagination support (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(ListMergeRequestDiffsSchema),
  },
  {
    name: "get_branch_diffs",
    description: "Get the changes/diffs between two branches or commits in a GitLab project",
    inputSchema: zodToJsonSchema(GetBranchDiffsSchema),
  },
  {
    name: "update_merge_request",
    description: "Update a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(UpdateMergeRequestSchema),
  },
  {
    name: "create_note",
    description: "Create a new note (comment) to an issue or merge request",
    inputSchema: zodToJsonSchema(CreateNoteSchema),
  },
  {
    name: "create_merge_request_thread",
    description: "Create a new thread on a merge request",
    inputSchema: zodToJsonSchema(CreateMergeRequestThreadSchema),
  },
  {
    name: "mr_discussions",
    description: "List discussion items for a merge request",
    inputSchema: zodToJsonSchema(ListMergeRequestDiscussionsSchema),
  },
  {
    name: "update_merge_request_note",
    description: "Modify an existing merge request thread note",
    inputSchema: zodToJsonSchema(UpdateMergeRequestNoteSchema),
  },
  {
    name: "create_merge_request_note",
    description: "Add a new note to an existing merge request thread",
    inputSchema: zodToJsonSchema(CreateMergeRequestNoteSchema),
  },
  {
    name: "get_draft_note",
    description: "Get a single draft note from a merge request",
    inputSchema: zodToJsonSchema(GetDraftNoteSchema),
  },
  {
    name: "list_draft_notes",
    description: "List draft notes for a merge request",
    inputSchema: zodToJsonSchema(ListDraftNotesSchema),
  },
  {
    name: "create_draft_note",
    description: "Create a draft note for a merge request",
    inputSchema: zodToJsonSchema(CreateDraftNoteSchema),
  },
  {
    name: "update_draft_note",
    description: "Update an existing draft note",
    inputSchema: zodToJsonSchema(UpdateDraftNoteSchema),
  },
  {
    name: "delete_draft_note",
    description: "Delete a draft note",
    inputSchema: zodToJsonSchema(DeleteDraftNoteSchema),
  },
  {
    name: "publish_draft_note",
    description: "Publish a single draft note",
    inputSchema: zodToJsonSchema(PublishDraftNoteSchema),
  },
  {
    name: "bulk_publish_draft_notes",
    description: "Publish all draft notes for a merge request",
    inputSchema: zodToJsonSchema(BulkPublishDraftNotesSchema),
  },
  {
    name: "update_issue_note",
    description: "Modify an existing issue thread note",
    inputSchema: zodToJsonSchema(UpdateIssueNoteSchema),
  },
  {
    name: "create_issue_note",
    description: "Add a new note to an existing issue thread",
    inputSchema: zodToJsonSchema(CreateIssueNoteSchema),
  },
  {
    name: "list_issues",
    description:
      "List issues (default: created by current user only; use scope='all' for all accessible issues)",
    inputSchema: zodToJsonSchema(ListIssuesSchema),
  },
  {
    name: "my_issues",
    description: "List issues assigned to the authenticated user (defaults to open issues)",
    inputSchema: zodToJsonSchema(MyIssuesSchema),
  },
  {
    name: "get_issue",
    description: "Get details of a specific issue in a GitLab project",
    inputSchema: zodToJsonSchema(GetIssueSchema),
  },
  {
    name: "update_issue",
    description: "Update an issue in a GitLab project",
    inputSchema: zodToJsonSchema(UpdateIssueSchema),
  },
  {
    name: "delete_issue",
    description: "Delete an issue from a GitLab project",
    inputSchema: zodToJsonSchema(DeleteIssueSchema),
  },
  {
    name: "list_issue_links",
    description: "List all issue links for a specific issue",
    inputSchema: zodToJsonSchema(ListIssueLinksSchema),
  },
  {
    name: "list_issue_discussions",
    description: "List discussions for an issue in a GitLab project",
    inputSchema: zodToJsonSchema(ListIssueDiscussionsSchema),
  },
  {
    name: "get_issue_link",
    description: "Get a specific issue link",
    inputSchema: zodToJsonSchema(GetIssueLinkSchema),
  },
  {
    name: "create_issue_link",
    description: "Create an issue link between two issues",
    inputSchema: zodToJsonSchema(CreateIssueLinkSchema),
  },
  {
    name: "delete_issue_link",
    description: "Delete an issue link",
    inputSchema: zodToJsonSchema(DeleteIssueLinkSchema),
  },
  {
    name: "list_namespaces",
    description: "List all namespaces available to the current user",
    inputSchema: zodToJsonSchema(ListNamespacesSchema),
  },
  {
    name: "get_namespace",
    description: "Get details of a namespace by ID or path",
    inputSchema: zodToJsonSchema(GetNamespaceSchema),
  },
  {
    name: "verify_namespace",
    description: "Verify if a namespace path exists",
    inputSchema: zodToJsonSchema(VerifyNamespaceSchema),
  },
  {
    name: "get_project",
    description: "Get details of a specific project",
    inputSchema: zodToJsonSchema(GetProjectSchema),
  },
  {
    name: "list_projects",
    description: "List projects accessible by the current user",
    inputSchema: zodToJsonSchema(ListProjectsSchema),
  },
  {
    name: "list_project_members",
    description: "List members of a GitLab project",
    inputSchema: zodToJsonSchema(ListProjectMembersSchema),
  },
  {
    name: "list_labels",
    description: "List labels for a project",
    inputSchema: zodToJsonSchema(ListLabelsSchema),
  },
  {
    name: "get_label",
    description: "Get a single label from a project",
    inputSchema: zodToJsonSchema(GetLabelSchema),
  },
  {
    name: "create_label",
    description: "Create a new label in a project",
    inputSchema: zodToJsonSchema(CreateLabelSchema),
  },
  {
    name: "update_label",
    description: "Update an existing label in a project",
    inputSchema: zodToJsonSchema(UpdateLabelSchema),
  },
  {
    name: "delete_label",
    description: "Delete a label from a project",
    inputSchema: zodToJsonSchema(DeleteLabelSchema),
  },
  {
    name: "list_group_projects",
    description: "List projects in a GitLab group with filtering options",
    inputSchema: zodToJsonSchema(ListGroupProjectsSchema),
  },
  {
    name: "list_wiki_pages",
    description: "List wiki pages in a GitLab project",
    inputSchema: zodToJsonSchema(ListWikiPagesSchema),
  },
  {
    name: "get_wiki_page",
    description: "Get details of a specific wiki page",
    inputSchema: zodToJsonSchema(GetWikiPageSchema),
  },
  {
    name: "create_wiki_page",
    description: "Create a new wiki page in a GitLab project",
    inputSchema: zodToJsonSchema(CreateWikiPageSchema),
  },
  {
    name: "update_wiki_page",
    description: "Update an existing wiki page in a GitLab project",
    inputSchema: zodToJsonSchema(UpdateWikiPageSchema),
  },
  {
    name: "delete_wiki_page",
    description: "Delete a wiki page from a GitLab project",
    inputSchema: zodToJsonSchema(DeleteWikiPageSchema),
  },
  {
    name: "get_repository_tree",
    description: "Get the repository tree for a GitLab project (list files and directories)",
    inputSchema: zodToJsonSchema(GetRepositoryTreeSchema),
  },
  {
    name: "list_pipelines",
    description: "List pipelines in a GitLab project with filtering options",
    inputSchema: zodToJsonSchema(ListPipelinesSchema),
  },
  {
    name: "get_pipeline",
    description: "Get details of a specific pipeline in a GitLab project",
    inputSchema: zodToJsonSchema(GetPipelineSchema),
  },
  {
    name: "list_pipeline_jobs",
    description: "List all jobs in a specific pipeline",
    inputSchema: zodToJsonSchema(ListPipelineJobsSchema),
  },
  {
    name: "list_pipeline_trigger_jobs",
    description:
      "List all trigger jobs (bridges) in a specific pipeline that trigger downstream pipelines",
    inputSchema: zodToJsonSchema(ListPipelineTriggerJobsSchema),
  },
  {
    name: "get_pipeline_job",
    description: "Get details of a GitLab pipeline job number",
    inputSchema: zodToJsonSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "get_pipeline_job_output",
    description:
      "Get the output/trace of a GitLab pipeline job with optional pagination to limit context window usage",
    inputSchema: zodToJsonSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "create_pipeline",
    description: "Create a new pipeline for a branch or tag",
    inputSchema: zodToJsonSchema(CreatePipelineSchema),
  },
  {
    name: "retry_pipeline",
    description: "Retry a failed or canceled pipeline",
    inputSchema: zodToJsonSchema(RetryPipelineSchema),
  },
  {
    name: "cancel_pipeline",
    description: "Cancel a running pipeline",
    inputSchema: zodToJsonSchema(CancelPipelineSchema),
  },
  {
    name: "list_merge_requests",
    description: "List merge requests in a GitLab project with filtering options",
    inputSchema: zodToJsonSchema(ListMergeRequestsSchema),
  },
  {
    name: "list_milestones",
    description: "List milestones in a GitLab project with filtering options",
    inputSchema: zodToJsonSchema(ListProjectMilestonesSchema),
  },
  {
    name: "get_milestone",
    description: "Get details of a specific milestone",
    inputSchema: zodToJsonSchema(GetProjectMilestoneSchema),
  },
  {
    name: "create_milestone",
    description: "Create a new milestone in a GitLab project",
    inputSchema: zodToJsonSchema(CreateProjectMilestoneSchema),
  },
  {
    name: "edit_milestone",
    description: "Edit an existing milestone in a GitLab project",
    inputSchema: zodToJsonSchema(EditProjectMilestoneSchema),
  },
  {
    name: "delete_milestone",
    description: "Delete a milestone from a GitLab project",
    inputSchema: zodToJsonSchema(DeleteProjectMilestoneSchema),
  },
  {
    name: "get_milestone_issue",
    description: "Get issues associated with a specific milestone",
    inputSchema: zodToJsonSchema(GetMilestoneIssuesSchema),
  },
  {
    name: "get_milestone_merge_requests",
    description: "Get merge requests associated with a specific milestone",
    inputSchema: zodToJsonSchema(GetMilestoneMergeRequestsSchema),
  },
  {
    name: "promote_milestone",
    description: "Promote a milestone to the next stage",
    inputSchema: zodToJsonSchema(PromoteProjectMilestoneSchema),
  },
  {
    name: "get_milestone_burndown_events",
    description: "Get burndown events for a specific milestone",
    inputSchema: zodToJsonSchema(GetMilestoneBurndownEventsSchema),
  },
  {
    name: "get_users",
    description: "Get GitLab user details by usernames",
    inputSchema: zodToJsonSchema(GetUsersSchema),
  },
  {
    name: "list_commits",
    description: "List repository commits with filtering options",
    inputSchema: zodToJsonSchema(ListCommitsSchema),
  },
  {
    name: "get_commit",
    description: "Get details of a specific commit",
    inputSchema: zodToJsonSchema(GetCommitSchema),
  },
  {
    name: "get_commit_diff",
    description: "Get changes/diffs of a specific commit",
    inputSchema: zodToJsonSchema(GetCommitDiffSchema),
  },
  {
    name: "list_group_iterations",
    description: "List group iterations with filtering options",
    inputSchema: zodToJsonSchema(ListGroupIterationsSchema),
  },
  {
    name: "upload_markdown",
    description: "Upload a file to a GitLab project for use in markdown content",
    inputSchema: zodToJsonSchema(MarkdownUploadSchema),
  },
  {
    name: "download_attachment",
    description: "Download an uploaded file from a GitLab project by secret and filename",
    inputSchema: zodToJsonSchema(DownloadAttachmentSchema),
  },
  // Add GitLab MCP Extensions
  ...allExtensionTools,
];

// Define which tools are read-only
const readOnlyTools = [
  "search_repositories",
  "get_file_contents",
  "get_merge_request",
  "get_merge_request_diffs",
  "get_branch_diffs",
  "mr_discussions",
  "list_issues",
  "my_issues",
  "list_merge_requests",
  "get_issue",
  "list_issue_links",
  "list_issue_discussions",
  "get_issue_link",
  "list_namespaces",
  "get_namespace",
  "verify_namespace",
  "get_project",
  "list_projects",
  "list_project_members",
  "get_pipeline",
  "list_pipelines",
  "list_pipeline_jobs",
  "list_pipeline_trigger_jobs",
  "get_pipeline_job",
  "get_pipeline_job_output",
  "list_labels",
  "get_label",
  "list_group_projects",
  "get_repository_tree",
  "list_milestones",
  "get_milestone",
  "get_milestone_issue",
  "get_milestone_merge_requests",
  "get_milestone_burndown_events",
  "list_wiki_pages",
  "get_wiki_page",
  "get_users",
  "list_commits",
  "get_commit",
  "get_commit_diff",
  "list_group_iterations",
  "get_group_iteration",
  "download_attachment",
  // Add read-only extension tools
  ...readOnlyExtensionTools,
];

// Define which tools are related to wiki and can be toggled by USE_GITLAB_WIKI
const wikiToolNames = [
  "list_wiki_pages",
  "get_wiki_page",
  "create_wiki_page",
  "update_wiki_page",
  "delete_wiki_page",
  "upload_wiki_attachment",
];

// Define which tools are related to milestones and can be toggled by USE_MILESTONE
const milestoneToolNames = [
  "list_milestones",
  "get_milestone",
  "create_milestone",
  "edit_milestone",
  "delete_milestone",
  "get_milestone_issue",
  "get_milestone_merge_requests",
  "promote_milestone",
  "get_milestone_burndown_events",
];

// Define which tools are related to pipelines and can be toggled by USE_PIPELINE
const pipelineToolNames = [
  "list_pipelines",
  "get_pipeline",
  "list_pipeline_jobs",
  "list_pipeline_trigger_jobs",
  "get_pipeline_job",
  "get_pipeline_job_output",
  "create_pipeline",
  "retry_pipeline",
  "cancel_pipeline",
];

/**
 * Smart URL handling for GitLab API
 *
 * @param {string | undefined} url - Input GitLab API URL
 * @returns {string} Normalized GitLab API URL with /api/v4 path
 */
function normalizeGitLabApiUrl(url?: string): string {
  if (!url) {
    return "https://gitlab.com/api/v4";
  }

  // Remove trailing slash if present
  let normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;

  // Check if URL already has /api/v4
  if (!normalizedUrl.endsWith("/api/v4") && !normalizedUrl.endsWith("/api/v4/")) {
    // Append /api/v4 if not already present
    normalizedUrl = `${normalizedUrl}/api/v4`;
  }

  return normalizedUrl;
}

// Use the normalizeGitLabApiUrl function to handle various URL formats
const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "");
const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID;
const GITLAB_ALLOWED_PROJECT_IDS = process.env.GITLAB_ALLOWED_PROJECT_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];

if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
  logger.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  process.exit(1);
}

/**
 * Utility function for handling GitLab API errors
 * API 에러 처리를 위한 유틸리티 함수 (Utility function for handling API errors)
 *
 * @param {import("node-fetch").Response} response - The response from GitLab API
 * @throws {Error} Throws an error with response details if the request failed
 */
async function handleGitLabError(response: import("node-fetch").Response): Promise<void> {
  if (!response.ok) {
    const errorBody = await response.text();
    // Check specifically for Rate Limit error
    if (response.status === 403 && errorBody.includes("User API Key Rate limit exceeded")) {
      logger.error("GitLab API Rate Limit Exceeded:", errorBody);
      logger.error("User API Key Rate limit exceeded. Please try again later.");
      throw new Error(`GitLab API Rate Limit Exceeded: ${errorBody}`);
    } else {
      // Handle other API errors
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }
  }
}

/**
 * @param {string} projectId - The project ID parameter passed to the function
 * @returns {string} The project ID to use for the API call
 * @throws {Error} If GITLAB_ALLOWED_PROJECT_IDS is set and the requested project is not in the whitelist
 */
function getEffectiveProjectId(projectId: string): string {
  if (GITLAB_ALLOWED_PROJECT_IDS.length > 0) {
    // If there's only one allowed project, use it as default
    if (GITLAB_ALLOWED_PROJECT_IDS.length === 1 && !projectId) {
      return GITLAB_ALLOWED_PROJECT_IDS[0];
    }
    
    // If a project ID is provided, check if it's in the whitelist
    if (projectId && !GITLAB_ALLOWED_PROJECT_IDS.includes(projectId)) {
      throw new Error(`Access denied: Project ${projectId} is not in the allowed project list: ${GITLAB_ALLOWED_PROJECT_IDS.join(', ')}`);
    }
    
    // If no project ID provided but we have multiple allowed projects, require an explicit choice
    if (!projectId && GITLAB_ALLOWED_PROJECT_IDS.length > 1) {
      throw new Error(`Multiple projects allowed (${GITLAB_ALLOWED_PROJECT_IDS.join(', ')}). Please specify a project ID.`);
    }
    
    return projectId || GITLAB_ALLOWED_PROJECT_IDS[0];
  }
  return GITLAB_PROJECT_ID || projectId;
}

/**
 * Create a fork of a GitLab project
 * 프로젝트 포크 생성 (Create a project fork)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} [namespace] - The namespace to fork the project to
 * @returns {Promise<GitLabFork>} The created fork
 */
async function forkProject(projectId: string, namespace?: string): Promise<GitLabFork> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(`${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/fork`);

  if (namespace) {
    url.searchParams.append("namespace", namespace);
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
  });

  // 이미 존재하는 프로젝트인 경우 처리
  if (response.status === 409) {
    throw new Error("Project already exists in the target namespace");
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabForkSchema.parse(data);
}

/**
 * Create a new branch in a GitLab project
 * 새로운 브랜치 생성 (Create a new branch)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {z.infer<typeof CreateBranchOptionsSchema>} options - Branch creation options
 * @returns {Promise<GitLabReference>} The created branch reference
 */
async function createBranch(
  projectId: string,
  options: z.infer<typeof CreateBranchOptionsSchema>
): Promise<GitLabReference> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/repository/branches`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      branch: options.name,
      ref: options.ref,
    }),
  });

  await handleGitLabError(response);
  return GitLabReferenceSchema.parse(await response.json());
}

/**
 * Get the default branch for a GitLab project
 * 프로젝트의 기본 브랜치 조회 (Get the default branch of a project)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @returns {Promise<string>} The name of the default branch
 */
async function getDefaultBranchRef(projectId: string): Promise<string> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(`${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}`);

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const project = GitLabRepositorySchema.parse(await response.json());
  return project.default_branch ?? "main";
}

/**
 * Get the contents of a file from a GitLab project
 * 파일 내용 조회 (Get file contents)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} filePath - The path of the file to get
 * @param {string} [ref] - The name of the branch, tag or commit
 * @returns {Promise<GitLabContent>} The file content
 */
async function getFileContents(
  projectId: string,
  filePath: string,
  ref?: string
): Promise<GitLabContent> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const encodedPath = encodeURIComponent(filePath);

  // ref가 없는 경우 default branch를 가져옴
  if (!ref) {
    ref = await getDefaultBranchRef(projectId);
  }

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/repository/files/${encodedPath}`
  );

  url.searchParams.append("ref", ref);

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  // 파일을 찾을 수 없는 경우 처리
  if (response.status === 404) {
    throw new Error(`File not found: ${filePath}`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  const parsedData = GitLabContentSchema.parse(data);

  // Base64로 인코딩된 파일 내용을 UTF-8로 디코딩
  if (!Array.isArray(parsedData) && parsedData.content) {
    parsedData.content = Buffer.from(parsedData.content, "base64").toString("utf8");
    parsedData.encoding = "utf8";
  }

  return parsedData;
}

/**
 * Create a new issue in a GitLab project
 * 이슈 생성 (Create an issue)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {z.infer<typeof CreateIssueOptionsSchema>} options - Issue creation options
 * @returns {Promise<GitLabIssue>} The created issue
 */
async function createIssue(
  projectId: string,
  options: z.infer<typeof CreateIssueOptionsSchema>
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/issues`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      title: options.title,
      description: options.description,
      assignee_ids: options.assignee_ids,
      milestone_id: options.milestone_id,
      labels: options.labels?.join(","),
    }),
  });

  // 잘못된 요청 처리
  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}

/**
 * List issues across all accessible projects or within a specific project
 * 프로젝트의 이슈 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project (optional)
 * @param {Object} options - Options for listing issues
 * @returns {Promise<GitLabIssue[]>} List of issues
 */
async function listIssues(
  projectId?: string,
  options: Omit<z.infer<typeof ListIssuesSchema>, "project_id"> = {}
): Promise<GitLabIssue[]> {
  let url: URL;
  if (projectId) {
    projectId = decodeURIComponent(projectId); // Decode project ID
    const effectiveProjectId = getEffectiveProjectId(projectId);
    url = new URL(`${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/issues`);
  } else {
    url = new URL(`${GITLAB_API_URL}/issues`);
  }

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      const keys = ["labels", "assignee_username"];
      if (keys.includes(key)) {
        if (Array.isArray(value)) {
          // Handle array of labels
          value.forEach(label => {
            url.searchParams.append(`${key}[]`, label.toString());
          });
        } else if (value) {
          url.searchParams.append(`${key}[]`, value.toString());
        }
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabIssueSchema).parse(data);
}

/**
 * List merge requests in a GitLab project with optional filtering
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Optional filtering parameters
 * @returns {Promise<GitLabMergeRequest[]>} List of merge requests
 */
async function listMergeRequests(
  projectId: string,
  options: Omit<z.infer<typeof ListMergeRequestsSchema>, "project_id"> = {}
): Promise<GitLabMergeRequest[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === "labels" && Array.isArray(value)) {
        // Handle array of labels
        url.searchParams.append(key, value.join(","));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMergeRequestSchema).parse(data);
}

/**
 * Get a single issue from a GitLab project
 * 단일 이슈 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @returns {Promise<GitLabIssue>} The issue
 */
async function getIssue(projectId: string, issueIid: number | string): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}

/**
 * Update an issue in a GitLab project
 * 이슈 업데이트
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {Object} options - Update options for the issue
 * @returns {Promise<GitLabIssue>} The updated issue
 */
async function updateIssue(
  projectId: string,
  issueIid: number | string,
  options: Omit<z.infer<typeof UpdateIssueSchema>, "project_id" | "issue_iid">
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}`
  );

  // Convert labels array to comma-separated string if present
  const body: Record<string, any> = { ...options };
  if (body.labels && Array.isArray(body.labels)) {
    body.labels = body.labels.join(",");
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(body),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}

/**
 * Delete an issue from a GitLab project
 * 이슈 삭제
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @returns {Promise<void>}
 */
async function deleteIssue(projectId: string, issueIid: number | string): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "DELETE",
  });

  await handleGitLabError(response);
}

/**
 * List all issue links for a specific issue
 * 이슈 관계 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @returns {Promise<GitLabIssueWithLinkDetails[]>} List of issues with link details
 */
async function listIssueLinks(
  projectId: string,
  issueIid: number | string
): Promise<GitLabIssueWithLinkDetails[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}/links`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabIssueWithLinkDetailsSchema).parse(data);
}

/**
 * Get a specific issue link
 * 특정 이슈 관계 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {number} issueLinkId - The ID of the issue link
 * @returns {Promise<GitLabIssueLink>} The issue link
 */
async function getIssueLink(
  projectId: string,
  issueIid: number | string,
  issueLinkId: number | string
): Promise<GitLabIssueLink> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/issues/${issueIid}/links/${issueLinkId}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueLinkSchema.parse(data);
}

/**
 * Create an issue link between two issues
 * 이슈 관계 생성
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {string} targetProjectId - The ID or URL-encoded path of the target project
 * @param {number} targetIssueIid - The internal ID of the target project issue
 * @param {string} linkType - The type of the relation (relates_to, blocks, is_blocked_by)
 * @returns {Promise<GitLabIssueLink>} The created issue link
 */
async function createIssueLink(
  projectId: string,
  issueIid: number | string,
  targetProjectId: string,
  targetIssueIid: number | string,
  linkType: "relates_to" | "blocks" | "is_blocked_by" = "relates_to"
): Promise<GitLabIssueLink> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  targetProjectId = decodeURIComponent(targetProjectId); // Decode target project ID as well
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}/links`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      target_project_id: targetProjectId,
      target_issue_iid: targetIssueIid,
      link_type: linkType,
    }),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueLinkSchema.parse(data);
}

/**
 * Delete an issue link
 * 이슈 관계 삭제
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {number} issueLinkId - The ID of the issue link
 * @returns {Promise<void>}
 */
async function deleteIssueLink(
  projectId: string,
  issueIid: number | string,
  issueLinkId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/issues/${issueIid}/links/${issueLinkId}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "DELETE",
  });

  await handleGitLabError(response);
}

/**
 * Create a new merge request in a GitLab project
 * 병합 요청 생성
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {z.infer<typeof CreateMergeRequestOptionsSchema>} options - Merge request creation options
 * @returns {Promise<GitLabMergeRequest>} The created merge request
 */
async function createMergeRequest(
  projectId: string,
  options: z.infer<typeof CreateMergeRequestOptionsSchema>
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      title: options.title,
      description: options.description,
      source_branch: options.source_branch,
      target_branch: options.target_branch,
      target_project_id: options.target_project_id,
      assignee_ids: options.assignee_ids,
      reviewer_ids: options.reviewer_ids,
      labels: options.labels?.join(","),
      allow_collaboration: options.allow_collaboration,
      draft: options.draft,
      remove_source_branch: options.remove_source_branch,
      squash: options.squash,
    }),
  });

  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabMergeRequestSchema.parse(data);
}

/**
 * Shared helper function for listing discussions
 * 토론 목록 조회를 위한 공유 헬퍼 함수
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {"issues" | "merge_requests"} resourceType - The type of resource (issues or merge_requests)
 * @param {number} resourceIid - The IID of the issue or merge request
 * @param {PaginationOptions} options - Pagination and sorting options
 * @returns {Promise<PaginatedDiscussionsResponse>} Paginated list of discussions
 */
async function listDiscussions(
  projectId: string,
  resourceType: "issues" | "merge_requests",
  resourceIid: number | string,
  options: PaginationOptions = {}
): Promise<PaginatedDiscussionsResponse> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/${resourceType}/${resourceIid}/discussions`
  );

  // Add query parameters for pagination and sorting
  if (options.page) {
    url.searchParams.append("page", options.page.toString());
  }
  if (options.per_page) {
    url.searchParams.append("per_page", options.per_page.toString());
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const discussions = await response.json();

  // Extract pagination headers
  const pagination = {
    x_next_page: response.headers.get("x-next-page")
      ? parseInt(response.headers.get("x-next-page")!)
      : null,
    x_page: response.headers.get("x-page") ? parseInt(response.headers.get("x-page")!) : undefined,
    x_per_page: response.headers.get("x-per-page")
      ? parseInt(response.headers.get("x-per-page")!)
      : undefined,
    x_prev_page: response.headers.get("x-prev-page")
      ? parseInt(response.headers.get("x-prev-page")!)
      : null,
    x_total: response.headers.get("x-total") ? parseInt(response.headers.get("x-total")!) : null,
    x_total_pages: response.headers.get("x-total-pages")
      ? parseInt(response.headers.get("x-total-pages")!)
      : null,
  };

  return PaginatedDiscussionsResponseSchema.parse({
    items: discussions,
    pagination: pagination,
  });
}

/**
 * List merge request discussion items
 * 병합 요청 토론 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The IID of a merge request
 * @param {DiscussionPaginationOptions} options - Pagination and sorting options
 * @returns {Promise<GitLabDiscussion[]>} List of discussions
 */
async function listMergeRequestDiscussions(
  projectId: string,
  mergeRequestIid: number | string,
  options: PaginationOptions = {}
): Promise<PaginatedDiscussionsResponse> {
  return listDiscussions(projectId, "merge_requests", mergeRequestIid, options);
}

/**
 * List discussions for an issue
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {DiscussionPaginationOptions} options - Pagination and sorting options
 * @returns {Promise<GitLabDiscussion[]>} List of issue discussions
 */
async function listIssueDiscussions(
  projectId: string,
  issueIid: number | string,
  options: PaginationOptions = {}
): Promise<PaginatedDiscussionsResponse> {
  return listDiscussions(projectId, "issues", issueIid, options);
}

/**
 * Modify an existing merge request thread note
 * 병합 요청 토론 노트 수정
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The IID of a merge request
 * @param {string} discussionId - The ID of a thread
 * @param {number} noteId - The ID of a thread note
 * @param {string} body - The new content of the note
 * @param {boolean} [resolved] - Resolve/unresolve state
 * @returns {Promise<GitLabDiscussionNote>} The updated note
 */
async function updateMergeRequestNote(
  projectId: string,
  mergeRequestIid: number | string,
  discussionId: string,
  noteId: number | string,
  body?: string,
  resolved?: boolean
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/discussions/${discussionId}/notes/${noteId}`
  );

  // Only one of body or resolved can be sent according to GitLab API
  const payload: { body?: string; resolved?: boolean } = {};
  if (body !== undefined) {
    payload.body = body;
  } else if (resolved !== undefined) {
    payload.resolved = resolved;
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Update an issue discussion note
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The IID of an issue
 * @param {string} discussionId - The ID of a thread
 * @param {number} noteId - The ID of a thread note
 * @param {string} body - The new content of the note
 * @returns {Promise<GitLabDiscussionNote>} The updated note
 */
async function updateIssueNote(
  projectId: string,
  issueIid: number | string,
  discussionId: string,
  noteId: number | string,
  body: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/issues/${issueIid}/discussions/${discussionId}/notes/${noteId}`
  );

  const payload = { body };

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Create a note in an issue discussion
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The IID of an issue
 * @param {string} discussionId - The ID of a thread
 * @param {string} body - The content of the new note
 * @param {string} [createdAt] - The creation date of the note (ISO 8601 format)
 * @returns {Promise<GitLabDiscussionNote>} The created note
 */
async function createIssueNote(
  projectId: string,
  issueIid: number | string,
  discussionId: string,
  body: string,
  createdAt?: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/issues/${issueIid}/discussions/${discussionId}/notes`
  );

  const payload: { body: string; created_at?: string } = { body };
  if (createdAt) {
    payload.created_at = createdAt;
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Add a new note to an existing merge request thread
 * 기존 병합 요청 스레드에 새 노트 추가
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The IID of a merge request
 * @param {string} discussionId - The ID of a thread
 * @param {string} body - The content of the new note
 * @param {string} [createdAt] - The creation date of the note (ISO 8601 format)
 * @returns {Promise<GitLabDiscussionNote>} The created note
 */
async function createMergeRequestNote(
  projectId: string,
  mergeRequestIid: number | string,
  discussionId: string,
  body: string,
  createdAt?: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/discussions/${discussionId}/notes`
  );

  const payload: { body: string; created_at?: string } = { body };
  if (createdAt) {
    payload.created_at = createdAt;
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Create or update a file in a GitLab project
 * 파일 생성 또는 업데이트
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} filePath - The path of the file to create or update
 * @param {string} content - The content of the file
 * @param {string} commitMessage - The commit message
 * @param {string} branch - The branch name
 * @param {string} [previousPath] - The previous path of the file in case of rename
 * @returns {Promise<GitLabCreateUpdateFileResponse>} The file update response
 */
async function createOrUpdateFile(
  projectId: string,
  filePath: string,
  content: string,
  commitMessage: string,
  branch: string,
  previousPath?: string,
  last_commit_id?: string,
  commit_id?: string
): Promise<GitLabCreateUpdateFileResponse> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const encodedPath = encodeURIComponent(filePath);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/files/${encodedPath}`
  );

  const body: Record<string, any> = {
    branch,
    content,
    commit_message: commitMessage,
    encoding: "text",
    ...(previousPath ? { previous_path: previousPath } : {}),
  };

  // Check if file exists
  let method = "POST";
  try {
    // Get file contents to check existence and retrieve commit IDs
    const fileData = await getFileContents(projectId, filePath, branch);
    method = "PUT";

    // If fileData is not an array, it's a file content object with commit IDs
    if (!Array.isArray(fileData)) {
      // Use commit IDs from the file data if not provided in parameters
      if (!commit_id && fileData.commit_id) {
        body.commit_id = fileData.commit_id;
      } else if (commit_id) {
        body.commit_id = commit_id;
      }

      if (!last_commit_id && fileData.last_commit_id) {
        body.last_commit_id = fileData.last_commit_id;
      } else if (last_commit_id) {
        body.last_commit_id = last_commit_id;
      }
    }
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("File not found"))) {
      throw error;
    }
    // File doesn't exist, use POST - no need for commit IDs for new files
    // But still use any provided as parameters if they exist
    if (commit_id) {
      body.commit_id = commit_id;
    }
    if (last_commit_id) {
      body.last_commit_id = last_commit_id;
    }
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabCreateUpdateFileResponseSchema.parse(data);
}

/**
 * Create a tree structure in a GitLab project repository
 * 저장소에 트리 구조 생성
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {FileOperation[]} files - Array of file operations
 * @param {string} [ref] - The name of the branch, tag or commit
 * @returns {Promise<GitLabTree>} The created tree
 */
async function createTree(
  projectId: string,
  files: FileOperation[],
  ref?: string
): Promise<GitLabTree> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/tree`
  );

  if (ref) {
    url.searchParams.append("ref", ref);
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      files: files.map(file => ({
        file_path: file.path,
        content: file.content,
        encoding: "text",
      })),
    }),
  });

  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabTreeSchema.parse(data);
}

/**
 * Create a commit in a GitLab project repository
 * 저장소에 커밋 생성
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} message - The commit message
 * @param {string} branch - The branch name
 * @param {FileOperation[]} actions - Array of file operations for the commit
 * @returns {Promise<GitLabCommit>} The created commit
 */
async function createCommit(
  projectId: string,
  message: string,
  branch: string,
  actions: FileOperation[]
): Promise<GitLabCommit> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/commits`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      branch,
      commit_message: message,
      actions: actions.map(action => ({
        action: "create",
        file_path: action.path,
        content: action.content,
        encoding: "text",
      })),
    }),
  });

  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabCommitSchema.parse(data);
}

/**
 * Search for GitLab projects
 * 프로젝트 검색
 *
 * @param {string} query - The search query
 * @param {number} [page=1] - The page number
 * @param {number} [perPage=20] - Number of items per page
 * @returns {Promise<GitLabSearchResponse>} The search results
 */
async function searchProjects(
  query: string,
  page: number = 1,
  perPage: number = 20
): Promise<GitLabSearchResponse> {
  const url = new URL(`${GITLAB_API_URL}/projects`);
  url.searchParams.append("search", query);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("per_page", perPage.toString());
  url.searchParams.append("order_by", "id");
  url.searchParams.append("sort", "desc");

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const projects = (await response.json()) as GitLabRepository[];
  const totalCount = response.headers.get("x-total");
  const totalPages = response.headers.get("x-total-pages");

  // GitLab API doesn't return these headers for results > 10,000
  const count = totalCount ? parseInt(totalCount) : projects.length;

  return GitLabSearchResponseSchema.parse({
    count,
    total_pages: totalPages ? parseInt(totalPages) : Math.ceil(count / perPage),
    current_page: page,
    items: projects,
  });
}

/**
 * Create a new GitLab repository
 * 새 저장소 생성
 *
 * @param {z.infer<typeof CreateRepositoryOptionsSchema>} options - Repository creation options
 * @returns {Promise<GitLabRepository>} The created repository
 */
async function createRepository(
  options: z.infer<typeof CreateRepositoryOptionsSchema>
): Promise<GitLabRepository> {
  const response = await fetch(`${GITLAB_API_URL}/projects`, {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      description: options.description,
      visibility: options.visibility,
      initialize_with_readme: options.initialize_with_readme,
      default_branch: "main",
      path: options.name.toLowerCase().replace(/\s+/g, "-"),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabRepositorySchema.parse(data);
}

/**
 * Get merge request details
 * MR 조회 함수 (Function to retrieve merge request)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request (Optional)
 * @param {string} [branchName] - The name of the branch to search for merge request by branch name (Optional)
 * @returns {Promise<GitLabMergeRequest>} The merge request details
 */
async function getMergeRequest(
  projectId: string,
  mergeRequestIid?: number | string,
  branchName?: string
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  let url: URL;

  if (mergeRequestIid) {
    url = new URL(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(
        getEffectiveProjectId(projectId)
      )}/merge_requests/${mergeRequestIid}`
    );
  } else if (branchName) {
    url = new URL(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(
        getEffectiveProjectId(projectId)
      )}/merge_requests?source_branch=${encodeURIComponent(branchName)}`
    );
  } else {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);

  const data = await response.json();

  // If response is an array (Comes from branchName search), return the first item if exist
  if (Array.isArray(data) && data.length > 0) {
    return GitLabMergeRequestSchema.parse(data[0]);
  }

  return GitLabMergeRequestSchema.parse(data);
}

/**
 * Get merge request changes/diffs
 * MR 변경사항 조회 함수 (Function to retrieve merge request changes)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request (Either mergeRequestIid or branchName must be provided)
 * @param {string} [branchName] - The name of the branch to search for merge request by branch name (Either mergeRequestIid or branchName must be provided)
 * @param {string} [view] - The view type for the diff (inline or parallel)
 * @returns {Promise<GitLabMergeRequestDiff[]>} The merge request diffs
 */
async function getMergeRequestDiffs(
  projectId: string,
  mergeRequestIid?: number | string,
  branchName?: string,
  view?: "inline" | "parallel"
): Promise<GitLabMergeRequestDiff[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  if (!mergeRequestIid && !branchName) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  if (branchName && !mergeRequestIid) {
    const mergeRequest = await getMergeRequest(projectId, undefined, branchName);
    mergeRequestIid = mergeRequest.iid;
  }

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/changes`
  );

  if (view) {
    url.searchParams.append("view", view);
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = (await response.json()) as { changes: unknown };
  return z.array(GitLabDiffSchema).parse(data.changes);
}

/**
 * Get merge request changes with detailed information including commits, diff_refs, and more
 * 마지막으로 추가된 상세한 MR 변경사항 조회 함수 (Detailed merge request changes retrieval function)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request (Either mergeRequestIid or branchName must be provided)
 * @param {string} [branchName] - The name of the branch to search for merge request by branch name (Either mergeRequestIid or branchName must be provided)
 * @param {boolean} [unidiff] - Return diff in unidiff format
 * @returns {Promise<any>} The complete merge request changes response
 */
async function listMergeRequestDiffs(
  projectId: string,
  mergeRequestIid?: number | string,
  branchName?: string,
  page?: number,
  perPage?: number,
  unidiff?: boolean
): Promise<any> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  if (!mergeRequestIid && !branchName) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  if (branchName && !mergeRequestIid) {
    const mergeRequest = await getMergeRequest(projectId, undefined, branchName);
    mergeRequestIid = mergeRequest.iid;
  }

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/diffs`
  );

  if (page) {
    url.searchParams.append("page", page.toString());
  }

  if (perPage) {
    url.searchParams.append("per_page", perPage.toString());
  }

  if (unidiff) {
    url.searchParams.append("unidiff", "true");
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  return await response.json(); // Return full response including commits, diff_refs, changes, etc.
}

/**
 * Get branch comparison diffs
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} from - The branch name or commit SHA to compare from
 * @param {string} to - The branch name or commit SHA to compare to
 * @param {boolean} [straight] - Comparison method: false for '...' (default), true for '--'
 * @returns {Promise<GitLabCompareResult>} Branch comparison results
 */
async function getBranchDiffs(
  projectId: string,
  from: string,
  to: string,
  straight?: boolean
): Promise<GitLabCompareResult> {
  projectId = decodeURIComponent(projectId); // Decode project ID

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/compare`
  );

  url.searchParams.append("from", from);
  url.searchParams.append("to", to);

  if (straight !== undefined) {
    url.searchParams.append("straight", straight.toString());
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabCompareResultSchema.parse(data);
}

/**
 * Update a merge request
 * MR 업데이트 함수 (Function to update merge request)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request (Optional)
 * @param {string} branchName - The name of the branch to search for merge request by branch name (Optional)
 * @param {Object} options - The update options
 * @returns {Promise<GitLabMergeRequest>} The updated merge request
 */
async function updateMergeRequest(
  projectId: string,
  options: Omit<
    z.infer<typeof UpdateMergeRequestSchema>,
    "project_id" | "merge_request_iid" | "source_branch"
  >,
  mergeRequestIid?: number | string,
  branchName?: string
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  if (!mergeRequestIid && !branchName) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  if (branchName && !mergeRequestIid) {
    const mergeRequest = await getMergeRequest(projectId, undefined, branchName);
    mergeRequestIid = mergeRequest.iid;
  }

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests/${mergeRequestIid}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(options),
  });

  await handleGitLabError(response);
  return GitLabMergeRequestSchema.parse(await response.json());
}

/**
 * Merge a merge request
 * マージリクエストをマージする
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request
 * @param {Object} options - Options for merging the merge request
 * @returns {Promise<GitLabMergeRequest>} The merged merge request
 */
async function mergeMergeRequest(
  projectId: string,
  options: Omit<z.infer<typeof MergeMergeRequestSchema>, "project_id" | "merge_request_iid">,
  mergeRequestIid?: number | string
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests/${mergeRequestIid}/merge`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(options),
  });

  await handleGitLabError(response);
  return GitLabMergeRequestSchema.parse(await response.json());
}

/**
 * Create a new note (comment) on an issue or merge request
 * 📦 새로운 함수: createNote - 이슈 또는 병합 요청에 노트(댓글)를 추가하는 함수
 * (New function: createNote - Function to add a note (comment) to an issue or merge request)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {"issue" | "merge_request"} noteableType - The type of the item to add a note to (issue or merge_request)
 * @param {number} noteableIid - The internal ID of the issue or merge request
 * @param {string} body - The content of the note
 * @returns {Promise<any>} The created note
 */
async function createNote(
  projectId: string,
  noteableType: "issue" | "merge_request", // 'issue' 또는 'merge_request' 타입 명시
  noteableIid: number | string,
  body: string
): Promise<any> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // ⚙️ 응답 타입은 GitLab API 문서에 따라 조정 가능
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/${noteableType}s/${noteableIid}/notes` // Using plural form (issues/merge_requests) as per GitLab API documentation
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  return await response.json();
}

/**
 * List draft notes for a merge request
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @returns {Promise<GitLabDraftNote[]>} Array of draft notes
 */
async function getDraftNote(
  project_id: string,
  merge_request_iid: string,
  draft_note_id: string
): Promise<GitLabDraftNote> {
  const response = await fetch(
    `/projects/${encodeURIComponent(project_id)}/merge_requests/${merge_request_iid}/draft_notes/${draft_note_id}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return GitLabDraftNoteSchema.parse(data);
}

async function listDraftNotes(
  projectId: string,
  mergeRequestIid: number | string
): Promise<GitLabDraftNote[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return z.array(GitLabDraftNoteSchema).parse(data);
}

/**
 * Create a draft note for a merge request
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @param {string} body - The content of the draft note
 * @param {MergeRequestThreadPosition} [position] - Position information for diff notes
 * @param {boolean} [resolveDiscussion] - Whether to resolve the discussion when publishing
 * @returns {Promise<GitLabDraftNote>} The created draft note
 */
async function createDraftNote(
  projectId: string,
  mergeRequestIid: number | string,
  body: string,
  position?: MergeRequestThreadPositionCreate,
  resolveDiscussion?: boolean
): Promise<GitLabDraftNote> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes`
  );

  const requestBody: any = { note: body };
  if (position) {
    requestBody.position = position;
  }
  if (resolveDiscussion !== undefined) {
    requestBody.resolve_discussion = resolveDiscussion;
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return GitLabDraftNoteSchema.parse(data);
}

/**
 * Update an existing draft note
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @param {number|string} draftNoteId - The ID of the draft note
 * @param {string} [body] - The updated content of the draft note
 * @param {MergeRequestThreadPosition} [position] - Updated position information
 * @param {boolean} [resolveDiscussion] - Whether to resolve the discussion when publishing
 * @returns {Promise<GitLabDraftNote>} The updated draft note
 */
async function updateDraftNote(
  projectId: string,
  mergeRequestIid: number | string,
  draftNoteId: number | string,
  body?: string,
  position?: MergeRequestThreadPositionCreate,
  resolveDiscussion?: boolean
): Promise<GitLabDraftNote> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}`
  );

  const requestBody: any = {};
  if (body !== undefined) {
    requestBody.note = body;
  }
  if (position) {
    requestBody.position = position;
  }
  if (resolveDiscussion !== undefined) {
    requestBody.resolve_discussion = resolveDiscussion;
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return GitLabDraftNoteSchema.parse(data);
}

/**
 * Delete a draft note
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @param {number|string} draftNoteId - The ID of the draft note
 * @returns {Promise<void>}
 */
async function deleteDraftNote(
  projectId: string,
  mergeRequestIid: number | string,
  draftNoteId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

/**
 * Publish a single draft note
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @param {number|string} draftNoteId - The ID of the draft note
 * @returns {Promise<GitLabDiscussionNote>} The published note
 */
async function publishDraftNote(
  projectId: string,
  mergeRequestIid: number | string,
  draftNoteId: number | string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}/publish`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  // Handle empty response (204 No Content) or successful response
  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    // Return a success indicator for empty responses
    return {
      id: draftNoteId.toString(),
      body: "Draft note published successfully",
      author: { id: "unknown", username: "unknown" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      system: false,
      noteable_id: mergeRequestIid.toString(),
      noteable_type: "MergeRequest"
    } as any;
  }

  try {
    const data = JSON.parse(responseText);
    return GitLabDiscussionNoteSchema.parse(data);
  } catch (parseError) {
    // If JSON parsing fails but the operation was successful (2xx status),
    // return a success indicator
    console.warn(`JSON parse error for successful publish operation: ${parseError}`);
    return {
      id: draftNoteId.toString(),
      body: "Draft note published successfully (response parse error)",
      author: { id: "unknown", username: "unknown" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      system: false,
      noteable_id: mergeRequestIid.toString(),
      noteable_type: "MergeRequest"
    } as any;
  }
}

/**
 * Publish all draft notes for a merge request
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @returns {Promise<GitLabDiscussionNote[]>} Array of published notes
 */
async function bulkPublishDraftNotes(
  projectId: string,
  mergeRequestIid: number | string
): Promise<GitLabDiscussionNote[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes/bulk_publish`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST", // Changed from PUT to POST
    body: JSON.stringify({}), // Send empty body for POST request
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  // Handle empty response (204 No Content) or successful response
  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    // Return empty array for successful bulk publish with no content
    return [];
  }

  try {
    const data = JSON.parse(responseText);
    return z.array(GitLabDiscussionNoteSchema).parse(data);
  } catch (parseError) {
    // If JSON parsing fails but the operation was successful (2xx status),
    // return empty array indicating successful bulk publish
    console.warn(`JSON parse error for successful bulk publish operation: ${parseError}`);
    return [];
  }
}

/**
 * Create a new thread on a merge request
 * 📦 새로운 함수: createMergeRequestThread - 병합 요청에 새로운 스레드(토론)를 생성하는 함수
 * (New function: createMergeRequestThread - Function to create a new thread (discussion) on a merge request)
 *
 * This function provides more capabilities than createNote, including the ability to:
 * - Create diff notes (comments on specific lines of code)
 * - Specify exact positions for comments
 * - Set creation timestamps
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request
 * @param {string} body - The content of the thread
 * @param {MergeRequestThreadPosition} [position] - Position information for diff notes
 * @param {string} [createdAt] - ISO 8601 formatted creation date
 * @returns {Promise<GitLabDiscussion>} The created discussion thread
 */
async function createMergeRequestThread(
  projectId: string,
  mergeRequestIid: number | string,
  body: string,
  position?: MergeRequestThreadPosition,
  createdAt?: string
): Promise<GitLabDiscussion> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/discussions`
  );

  const payload: Record<string, any> = { body };

  // Add optional parameters if provided
  if (position) {
    payload.position = position;
  }

  if (createdAt) {
    payload.created_at = createdAt;
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionSchema.parse(data);
}

/**
 * List all namespaces
 * 사용 가능한 모든 네임스페이스 목록 조회
 *
 * @param {Object} options - Options for listing namespaces
 * @param {string} [options.search] - Search query to filter namespaces
 * @param {boolean} [options.owned_only] - Only return namespaces owned by the authenticated user
 * @param {boolean} [options.top_level_only] - Only return top-level namespaces
 * @returns {Promise<GitLabNamespace[]>} List of namespaces
 */
async function listNamespaces(options: {
  search?: string;
  owned_only?: boolean;
  top_level_only?: boolean;
}): Promise<GitLabNamespace[]> {
  const url = new URL(`${GITLAB_API_URL}/namespaces`);

  if (options.search) {
    url.searchParams.append("search", options.search);
  }

  if (options.owned_only) {
    url.searchParams.append("owned_only", "true");
  }

  if (options.top_level_only) {
    url.searchParams.append("top_level_only", "true");
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabNamespaceSchema).parse(data);
}

/**
 * Get details on a namespace
 * 네임스페이스 상세 정보 조회
 *
 * @param {string} id - The ID or URL-encoded path of the namespace
 * @returns {Promise<GitLabNamespace>} The namespace details
 */
async function getNamespace(id: string): Promise<GitLabNamespace> {
  const url = new URL(`${GITLAB_API_URL}/namespaces/${encodeURIComponent(id)}`);

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabNamespaceSchema.parse(data);
}

/**
 * Verify if a namespace exists
 * 네임스페이스 존재 여부 확인
 *
 * @param {string} namespacePath - The path of the namespace to check
 * @param {number} [parentId] - The ID of the parent namespace
 * @returns {Promise<GitLabNamespaceExistsResponse>} The verification result
 */
async function verifyNamespaceExistence(
  namespacePath: string,
  parentId?: number
): Promise<GitLabNamespaceExistsResponse> {
  const url = new URL(`${GITLAB_API_URL}/namespaces/${encodeURIComponent(namespacePath)}/exists`);

  if (parentId) {
    url.searchParams.append("parent_id", parentId.toString());
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabNamespaceExistsResponseSchema.parse(data);
}

/**
 * Get a single project
 * 단일 프로젝트 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for getting project details
 * @param {boolean} [options.license] - Include project license data
 * @param {boolean} [options.statistics] - Include project statistics
 * @param {boolean} [options.with_custom_attributes] - Include custom attributes in response
 * @returns {Promise<GitLabProject>} Project details
 */
async function getProject(
  projectId: string,
  options: {
    license?: boolean;
    statistics?: boolean;
    with_custom_attributes?: boolean;
  } = {}
): Promise<GitLabProject> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}`
  );

  if (options.license) {
    url.searchParams.append("license", "true");
  }

  if (options.statistics) {
    url.searchParams.append("statistics", "true");
  }

  if (options.with_custom_attributes) {
    url.searchParams.append("with_custom_attributes", "true");
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabRepositorySchema.parse(data);
}

/**
 * List projects
 * 프로젝트 목록 조회
 *
 * @param {Object} options - Options for listing projects
 * @returns {Promise<GitLabProject[]>} List of projects
 */
async function listProjects(
  options: z.infer<typeof ListProjectsSchema> = {}
): Promise<GitLabProject[]> {
  // Construct the query parameters
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null) {
      if (typeof value === "boolean") {
        params.append(key, value ? "true" : "false");
      } else {
        params.append(key, String(value));
      }
    }
  }

  // Make the API request
  const response = await fetch(`${GITLAB_API_URL}/projects?${params.toString()}`, {
    ...DEFAULT_FETCH_CONFIG,
  });

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return z.array(GitLabProjectSchema).parse(data);
}

/**
 * List labels for a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Optional parameters for listing labels
 * @returns Array of GitLab labels
 */
async function listLabels(
  projectId: string,
  options: Omit<z.infer<typeof ListLabelsSchema>, "project_id"> = {}
): Promise<GitLabLabel[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Construct the URL with project path
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/labels`
  );

  // Add query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === "boolean") {
        url.searchParams.append(key, value ? "true" : "false");
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  // Make the API request
  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel[];
}

/**
 * Get a single label from a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label
 * @param includeAncestorGroups Whether to include ancestor groups
 * @returns GitLab label
 */
async function getLabel(
  projectId: string,
  labelId: number | string,
  includeAncestorGroups?: boolean
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeURIComponent(String(labelId))}`
  );

  // Add query parameters
  if (includeAncestorGroups !== undefined) {
    url.searchParams.append("include_ancestor_groups", includeAncestorGroups ? "true" : "false");
  }

  // Make the API request
  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Create a new label in a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Options for creating the label
 * @returns Created GitLab label
 */
async function createLabel(
  projectId: string,
  options: Omit<z.infer<typeof CreateLabelSchema>, "project_id">
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/labels`,
    {
      ...DEFAULT_FETCH_CONFIG,
      method: "POST",
      body: JSON.stringify(options),
    }
  );

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Update an existing label in a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label to update
 * @param options Options for updating the label
 * @returns Updated GitLab label
 */
async function updateLabel(
  projectId: string,
  labelId: number | string,
  options: Omit<z.infer<typeof UpdateLabelSchema>, "project_id" | "label_id">
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeURIComponent(String(labelId))}`,
    {
      ...DEFAULT_FETCH_CONFIG,
      method: "PUT",
      body: JSON.stringify(options),
    }
  );

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Delete a label from a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label to delete
 */
async function deleteLabel(projectId: string, labelId: number | string): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeURIComponent(String(labelId))}`,
    {
      ...DEFAULT_FETCH_CONFIG,
      method: "DELETE",
    }
  );

  // Handle errors
  await handleGitLabError(response);
}

/**
 * List all projects in a GitLab group
 *
 * @param {z.infer<typeof ListGroupProjectsSchema>} options - Options for listing group projects
 * @returns {Promise<GitLabProject[]>} Array of projects in the group
 */
async function listGroupProjects(
  options: z.infer<typeof ListGroupProjectsSchema>
): Promise<GitLabProject[]> {
  const url = new URL(`${GITLAB_API_URL}/groups/${encodeURIComponent(options.group_id)}/projects`);

  // Add optional parameters to URL
  if (options.include_subgroups) url.searchParams.append("include_subgroups", "true");
  if (options.search) url.searchParams.append("search", options.search);
  if (options.order_by) url.searchParams.append("order_by", options.order_by);
  if (options.sort) url.searchParams.append("sort", options.sort);
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
  if (options.archived !== undefined)
    url.searchParams.append("archived", options.archived.toString());
  if (options.visibility) url.searchParams.append("visibility", options.visibility);
  if (options.with_issues_enabled !== undefined)
    url.searchParams.append("with_issues_enabled", options.with_issues_enabled.toString());
  if (options.with_merge_requests_enabled !== undefined)
    url.searchParams.append(
      "with_merge_requests_enabled",
      options.with_merge_requests_enabled.toString()
    );
  if (options.min_access_level !== undefined)
    url.searchParams.append("min_access_level", options.min_access_level.toString());
  if (options.with_programming_language)
    url.searchParams.append("with_programming_language", options.with_programming_language);
  if (options.starred !== undefined) url.searchParams.append("starred", options.starred.toString());
  if (options.statistics !== undefined)
    url.searchParams.append("statistics", options.statistics.toString());
  if (options.with_custom_attributes !== undefined)
    url.searchParams.append("with_custom_attributes", options.with_custom_attributes.toString());
  if (options.with_security_reports !== undefined)
    url.searchParams.append("with_security_reports", options.with_security_reports.toString());

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const projects = await response.json();
  return GitLabProjectSchema.array().parse(projects);
}

// Wiki API helper functions
/**
 * List wiki pages in a project
 */
async function listWikiPages(
  projectId: string,
  options: Omit<ListWikiPagesOptions, "project_id"> = {}
): Promise<GitLabWikiPage[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis`
  );
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
  if (options.with_content)
    url.searchParams.append("with_content", options.with_content.toString());
  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.array().parse(data);
}

/**
 * Get a specific wiki page
 */
async function getWikiPage(projectId: string, slug: string): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
    { ...DEFAULT_FETCH_CONFIG }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Create a new wiki page
 */
async function createWikiPage(
  projectId: string,
  title: string,
  content: string,
  format?: string
): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const body: Record<string, any> = { title, content };
  if (format) body.format = format;
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis`,
    {
      ...DEFAULT_FETCH_CONFIG,
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Update an existing wiki page
 */
async function updateWikiPage(
  projectId: string,
  slug: string,
  title?: string,
  content?: string,
  format?: string
): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const body: Record<string, any> = {};
  if (title) body.title = title;
  if (content) body.content = content;
  if (format) body.format = format;
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
    {
      ...DEFAULT_FETCH_CONFIG,
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Delete a wiki page
 */
async function deleteWikiPage(projectId: string, slug: string): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
    {
      ...DEFAULT_FETCH_CONFIG,
      method: "DELETE",
    }
  );
  await handleGitLabError(response);
}

/**
 * List pipelines in a GitLab project
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {ListPipelinesOptions} options - Options for filtering pipelines
 * @returns {Promise<GitLabPipeline[]>} List of pipelines
 */
async function listPipelines(
  projectId: string,
  options: Omit<ListPipelinesOptions, "project_id"> = {}
): Promise<GitLabPipeline[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabPipelineSchema).parse(data);
}

/**
 * Get details of a specific pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline
 * @returns {Promise<GitLabPipeline>} Pipeline details
 */
async function getPipeline(
  projectId: string,
  pipelineId: number | string
): Promise<GitLabPipeline> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  if (response.status === 404) {
    throw new Error(`Pipeline not found`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineSchema.parse(data);
}

/**
 * List all jobs in a specific pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline
 * @param {Object} options - Options for filtering jobs
 * @returns {Promise<GitLabPipelineJob[]>} List of pipeline jobs
 */
async function listPipelineJobs(
  projectId: string,
  pipelineId: number | string,
  options: Omit<ListPipelineJobsOptions, "project_id" | "pipeline_id"> = {}
): Promise<GitLabPipelineJob[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/jobs`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === "boolean") {
        url.searchParams.append(key, value ? "true" : "false");
      } else {
        url.searchParams.append(key, value.toString());
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  if (response.status === 404) {
    throw new Error(`Pipeline not found`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabPipelineJobSchema).parse(data);
}

/**
 * List all trigger jobs (bridges) in a specific pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline
 * @param {Object} options - Options for filtering trigger jobs
 * @returns {Promise<GitLabPipelineTriggerJob[]>} List of pipeline trigger jobs
 */
async function listPipelineTriggerJobs(
  projectId: string,
  pipelineId: number | string,
  options: Omit<ListPipelineTriggerJobsOptions, "project_id" | "pipeline_id"> = {}
): Promise<GitLabPipelineTriggerJob[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/bridges`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === "boolean") {
        url.searchParams.append(key, value ? "true" : "false");
      } else {
        url.searchParams.append(key, value.toString());
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  if (response.status === 404) {
    throw new Error(`Pipeline not found`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabPipelineTriggerJobSchema).parse(data);
}

async function getPipelineJob(
  projectId: string,
  jobId: number | string
): Promise<GitLabPipelineJob> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/jobs/${jobId}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  if (response.status === 404) {
    throw new Error(`Job not found`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineJobSchema.parse(data);
}

/**
 * Get the output/trace of a pipeline job
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} jobId - The ID of the job
 * @param {number} limit - Maximum number of lines to return from the end (default: 1000)
 * @param {number} offset - Number of lines to skip from the end (default: 0)
 * @returns {Promise<string>} The job output/trace
 */
async function getPipelineJobOutput(
  projectId: string,
  jobId: number | string,
  limit?: number,
  offset?: number
): Promise<string> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/jobs/${jobId}/trace`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    headers: {
      ...DEFAULT_HEADERS,
      Accept: "text/plain", // Override Accept header to get plain text
    },
  });

  if (response.status === 404) {
    throw new Error(`Job trace not found or job is not finished yet`);
  }

  await handleGitLabError(response);
  const fullTrace = await response.text();

  // Apply client-side pagination to limit context window usage
  if (limit !== undefined || offset !== undefined) {
    const lines = fullTrace.split("\n");
    const startOffset = offset || 0;
    const maxLines = limit || 1000;

    // Return lines from the end, skipping offset lines and limiting to maxLines
    const startIndex = Math.max(0, lines.length - startOffset - maxLines);
    const endIndex = lines.length - startOffset;

    const selectedLines = lines.slice(startIndex, endIndex);
    const result = selectedLines.join("\n");

    // Add metadata about truncation
    if (startIndex > 0 || endIndex < lines.length) {
      const totalLines = lines.length;
      const shownLines = selectedLines.length;
      const skippedFromStart = startIndex;
      const skippedFromEnd = startOffset;

      return `[Log truncated: showing ${shownLines} of ${totalLines} lines, skipped ${skippedFromStart} from start, ${skippedFromEnd} from end]\n\n${result}`;
    }

    return result;
  }

  return fullTrace;
}

/**
 * Create a new pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} ref - The branch or tag to run the pipeline on
 * @param {Array} variables - Optional variables for the pipeline
 * @returns {Promise<GitLabPipeline>} The created pipeline
 */
async function createPipeline(
  projectId: string,
  ref: string,
  variables?: Array<{ key: string; value: string }>
): Promise<GitLabPipeline> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipeline`
  );

  const body: any = { ref };
  if (variables && variables.length > 0) {
    body.variables = variables;
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineSchema.parse(data);
}

/**
 * Retry a pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline to retry
 * @returns {Promise<GitLabPipeline>} The retried pipeline
 */
async function retryPipeline(
  projectId: string,
  pipelineId: number | string
): Promise<GitLabPipeline> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/retry`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: DEFAULT_HEADERS,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineSchema.parse(data);
}

/**
 * Cancel a pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline to cancel
 * @returns {Promise<GitLabPipeline>} The canceled pipeline
 */
async function cancelPipeline(
  projectId: string,
  pipelineId: number | string
): Promise<GitLabPipeline> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/cancel`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: DEFAULT_HEADERS,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineSchema.parse(data);
}

/**
 * Get the repository tree for a project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {GetRepositoryTreeOptions} options - Options for the tree
 * @returns {Promise<GitLabTreeItem[]>}
 */
async function getRepositoryTree(options: GetRepositoryTreeOptions): Promise<GitLabTreeItem[]> {
  options.project_id = decodeURIComponent(options.project_id); // Decode project_id within options
  const queryParams = new URLSearchParams();
  if (options.path) queryParams.append("path", options.path);
  if (options.ref) queryParams.append("ref", options.ref);
  if (options.recursive) queryParams.append("recursive", "true");
  if (options.per_page) queryParams.append("per_page", options.per_page.toString());
  if (options.page_token) queryParams.append("page_token", options.page_token);
  if (options.pagination) queryParams.append("pagination", options.pagination);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (IS_OLD) {
    headers["Private-Token"] = `${GITLAB_PERSONAL_ACCESS_TOKEN}`;
  } else {
    headers["Authorization"] = `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`;
  }
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(options.project_id)
    )}/repository/tree?${queryParams.toString()}`,
    {
      headers,
    }
  );

  if (response.status === 404) {
    throw new Error("Repository or path not found");
  }

  if (!response.ok) {
    throw new Error(`Failed to get repository tree: ${response.statusText}`);
  }

  const data = await response.json();
  return z.array(GitLabTreeItemSchema).parse(data);
}

/**
 * List project milestones in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for listing milestones
 * @returns {Promise<GitLabMilestones[]>} List of milestones
 */
async function listProjectMilestones(
  projectId: string,
  options: Omit<z.infer<typeof ListProjectMilestonesSchema>, "project_id">
): Promise<GitLabMilestones[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones`
  );

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === "iids" && Array.isArray(value) && value.length > 0) {
        value.forEach(iid => {
          url.searchParams.append("iids[]", iid.toString());
        });
      } else if (value !== undefined) {
        url.searchParams.append(key, value.toString());
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMilestonesSchema).parse(data);
}

/**
 * Get a single milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabMilestones>} Milestone details
 */
async function getProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Create a new milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for creating a milestone
 * @returns {Promise<GitLabMilestones>} Created milestone
 */
async function createProjectMilestone(
  projectId: string,
  options: Omit<z.infer<typeof CreateProjectMilestoneSchema>, "project_id">
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Edit an existing milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @param {Object} options - Options for editing a milestone
 * @returns {Promise<GitLabMilestones>} Updated milestone
 */
async function editProjectMilestone(
  projectId: string,
  milestoneId: number | string,
  options: Omit<z.infer<typeof EditProjectMilestoneSchema>, "project_id" | "milestone_id">
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Delete a milestone from a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<void>}
 */
async function deleteProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "DELETE",
  });
  await handleGitLabError(response);
}

/**
 * Get all issues assigned to a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabIssue[]>} List of issues
 */
async function getMilestoneIssues(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabIssue[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}/issues`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabIssueSchema).parse(data);
}

/**
 * Get all merge requests assigned to a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabMergeRequest[]>} List of merge requests
 */
async function getMilestoneMergeRequests(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabMergeRequest[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/milestones/${milestoneId}/merge_requests`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMergeRequestSchema).parse(data);
}

/**
 * Promote a project milestone to a group milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabMilestones>} Promoted milestone
 */
async function promoteProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}/promote`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Get all burndown chart events for a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<any[]>} Burndown chart events
 */
async function getMilestoneBurndownEvents(
  projectId: string,
  milestoneId: number | string
): Promise<any[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/milestones/${milestoneId}/burndown_events`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });
  await handleGitLabError(response);
  const data = await response.json();
  return data as any[];
}

/**
 * Get a single user from GitLab
 *
 * @param {string} username - The username to look up
 * @returns {Promise<GitLabUser | null>} The user data or null if not found
 */
async function getUser(username: string): Promise<GitLabUser | null> {
  try {
    const url = new URL(`${GITLAB_API_URL}/users`);
    url.searchParams.append("username", username);

    const response = await fetch(url.toString(), {
      ...DEFAULT_FETCH_CONFIG,
    });

    await handleGitLabError(response);

    const users = await response.json();

    // GitLab returns an array of users that match the username
    if (Array.isArray(users) && users.length > 0) {
      // Find exact match for username (case-sensitive)
      const exactMatch = users.find(user => user.username === username);
      if (exactMatch) {
        return GitLabUserSchema.parse(exactMatch);
      }
    }

    // No matching user found
    return null;
  } catch (error) {
    logger.error(`Error fetching user by username '${username}':`, error);
    return null;
  }
}

/**
 * Get multiple users from GitLab
 *
 * @param {string[]} usernames - Array of usernames to look up
 * @returns {Promise<GitLabUsersResponse>} Object with usernames as keys and user objects or null as values
 */
async function getUsers(usernames: string[]): Promise<GitLabUsersResponse> {
  const users: Record<string, GitLabUser | null> = {};

  // Process usernames sequentially to avoid rate limiting
  for (const username of usernames) {
    try {
      const user = await getUser(username);
      users[username] = user;
    } catch (error) {
      logger.error(`Error processing username '${username}':`, error);
      users[username] = null;
    }
  }

  return GitLabUsersResponseSchema.parse(users);
}

/**
 * List repository commits
 * 저장소 커밋 목록 조회
 *
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {ListCommitsOptions} options - List commits options
 * @returns {Promise<GitLabCommit[]>} List of commits
 */
async function listCommits(
  projectId: string,
  options: Omit<ListCommitsOptions, "project_id"> = {}
): Promise<GitLabCommit[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/commits`
  );

  // Add query parameters
  if (options.ref_name) url.searchParams.append("ref_name", options.ref_name);
  if (options.since) url.searchParams.append("since", options.since);
  if (options.until) url.searchParams.append("until", options.until);
  if (options.path) url.searchParams.append("path", options.path);
  if (options.author) url.searchParams.append("author", options.author);
  if (options.all) url.searchParams.append("all", options.all.toString());
  if (options.with_stats) url.searchParams.append("with_stats", options.with_stats.toString());
  if (options.first_parent)
    url.searchParams.append("first_parent", options.first_parent.toString());
  if (options.order) url.searchParams.append("order", options.order);
  if (options.trailers) url.searchParams.append("trailers", options.trailers.toString());
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);

  const data = await response.json();
  return z.array(GitLabCommitSchema).parse(data);
}

/**
 * Get a single commit
 * 단일 커밋 정보 조회
 *
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {string} sha - The commit hash or name of a repository branch or tag
 * @param {boolean} [stats] - Include commit stats
 * @returns {Promise<GitLabCommit>} The commit details
 */
async function getCommit(projectId: string, sha: string, stats?: boolean): Promise<GitLabCommit> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/commits/${encodeURIComponent(sha)}`
  );

  if (stats) {
    url.searchParams.append("stats", "true");
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabCommitSchema.parse(data);
}

/**
 * Get commit diff
 * 커밋 변경사항 조회
 *
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {string} sha - The commit hash or name of a repository branch or tag
 * @returns {Promise<GitLabMergeRequestDiff[]>} The commit diffs
 */
async function getCommitDiff(projectId: string, sha: string): Promise<GitLabMergeRequestDiff[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/commits/${encodeURIComponent(sha)}/diff`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);

  const data = await response.json();
  return z.array(GitLabDiffSchema).parse(data);
}

/**
 * Get the current authenticated user
 * 현재 인증된 사용자 가져오기
 *
 * @returns {Promise<GitLabUser>} The current user
 */
async function getCurrentUser(): Promise<GitLabUser> {
  const response = await fetch(`${GITLAB_API_URL}/user`, DEFAULT_FETCH_CONFIG);

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabUserSchema.parse(data);
}

/**
 * List issues assigned to the current authenticated user
 * 현재 인증된 사용자에게 할당된 이슈 목록 조회
 *
 * @param {MyIssuesOptions} options - Options for filtering issues
 * @returns {Promise<GitLabIssue[]>} List of issues assigned to the current user
 */
async function myIssues(options: MyIssuesOptions = {}): Promise<GitLabIssue[]> {
  // Get current user to find their username
  const currentUser = await getCurrentUser();
  
  // Use getEffectiveProjectId to handle project ID resolution
  const effectiveProjectId = getEffectiveProjectId(options.project_id || "");
  
  // Use listIssues with assignee_username filter
  let listIssuesOptions: Omit<z.infer<typeof ListIssuesSchema>, "project_id"> = {
    state: options.state || "opened", // Default to "opened" if not specified
    labels: options.labels,
    milestone: options.milestone,
    search: options.search,
    created_after: options.created_after,
    created_before: options.created_before,
    updated_after: options.updated_after,
    updated_before: options.updated_before,
    per_page: options.per_page,
    page: options.page,
  };
  
  if (currentUser.username) {
    listIssuesOptions.assignee_username = [currentUser.username]
  } else {
    listIssuesOptions.assignee_id = currentUser.id
  }
  return listIssues(effectiveProjectId, listIssuesOptions);
}

/**
 * List members of a GitLab project
 * GitLab 프로젝트 멤버 목록 조회
 *
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {Omit<ListProjectMembersOptions, "project_id">} options - Options for filtering members
 * @returns {Promise<GitLabProjectMember[]>} List of project members
 */
async function listProjectMembers(
  projectId: string,
  options: Omit<ListProjectMembersOptions, "project_id"> = {}
): Promise<GitLabProjectMember[]> {
  projectId = decodeURIComponent(projectId);
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(`${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/members`);

  // Add query parameters
  if (options.query) url.searchParams.append("query", options.query);
  if (options.user_ids) {
    options.user_ids.forEach(id => url.searchParams.append("user_ids[]", id.toString()));
  }
  if (options.skip_users) {
    options.skip_users.forEach(id => url.searchParams.append("skip_users[]", id.toString()));
  }
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
  if (options.page) url.searchParams.append("page", options.page.toString());

  const response = await fetch(url.toString(), DEFAULT_FETCH_CONFIG);

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabProjectMemberSchema).parse(data);
}

/**
 * list group iterations
 *
 * @param {string} groupId
 * @param {Omit<ListGroupIterationsOptions, "group_id">} options
 * @returns {Promise<GetIt[]>}
 */
async function listGroupIterations(
  groupId: string,
  options: Omit<z.infer<typeof ListGroupIterationsSchema>, "group_id"> = {}
): Promise<GroupIteration[]> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(`${GITLAB_API_URL}/groups/${encodeURIComponent(groupId)}/iterations`);

  // クエリパラメータの追加
  if (options.state) url.searchParams.append("state", options.state);
  if (options.search) url.searchParams.append("search", options.search);
  if (options.in) url.searchParams.append("in", options.in.join(","));
  if (options.include_ancestors !== undefined)
    url.searchParams.append("include_ancestors", options.include_ancestors.toString());
  if (options.include_descendants !== undefined)
    url.searchParams.append("include_descendants", options.include_descendants.toString());
  if (options.updated_before) url.searchParams.append("updated_before", options.updated_before);
  if (options.updated_after) url.searchParams.append("updated_after", options.updated_after);
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());

  const response = await fetch(url.toString(), DEFAULT_FETCH_CONFIG);

  if (!response.ok) {
    await handleGitLabError(response);
  }

  const data = await response.json();
  return z.array(GroupIteration).parse(data);
}

/**
 * Upload a file to a GitLab project for use in markdown content
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} filePath - Path to the local file to upload
 * @returns {Promise<GitLabMarkdownUpload>} The upload response
 */
async function markdownUpload(projectId: string, filePath: string): Promise<GitLabMarkdownUpload> {
  projectId = decodeURIComponent(projectId);
  const effectiveProjectId = getEffectiveProjectId(projectId);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read the file
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // Create form data
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", fileBuffer, {
    filename: fileName,
    contentType: "application/octet-stream",
  });

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/uploads`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      // Remove Content-Type header to let form-data set it with boundary
      "Content-Type": undefined as any,
    },
    body: form,
  });

  if (!response.ok) {
    await handleGitLabError(response);
  }

  const data = await response.json();
  return GitLabMarkdownUploadSchema.parse(data);
}

async function downloadAttachment(projectId: string, secret: string, filename: string, localPath?: string): Promise<string> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/uploads/${secret}/${filename}`
  );

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: DEFAULT_HEADERS,
  });

  if (!response.ok) {
    await handleGitLabError(response);
  }

  // Get the file content as buffer
  const buffer = await response.arrayBuffer();
  
  // Determine the save path
  const savePath = localPath ? path.join(localPath, filename) : filename;
  
  // Write the file to disk
  fs.writeFileSync(savePath, Buffer.from(buffer));
  
  return savePath;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Apply read-only filter first
  const tools0 = GITLAB_READ_ONLY_MODE
    ? allTools.filter(tool => readOnlyTools.includes(tool.name))
    : allTools;
  // Toggle wiki tools by USE_GITLAB_WIKI flag
  const tools1 = USE_GITLAB_WIKI
    ? tools0
    : tools0.filter(tool => !wikiToolNames.includes(tool.name));
  // Toggle milestone tools by USE_MILESTONE flag
  const tools2 = USE_MILESTONE
    ? tools1
    : tools1.filter(tool => !milestoneToolNames.includes(tool.name));
  // Toggle pipeline tools by USE_PIPELINE flag
  let tools = USE_PIPELINE ? tools2 : tools2.filter(tool => !pipelineToolNames.includes(tool.name));

  // <<< START: Gemini 호환성을 위해 $schema 제거 >>>
  tools = tools.map(tool => {
    // inputSchema가 존재하고 객체인지 확인
    if (tool.inputSchema && typeof tool.inputSchema === "object" && tool.inputSchema !== null) {
      // $schema 키가 존재하면 삭제
      if ("$schema" in tool.inputSchema) {
        // 불변성을 위해 새로운 객체 생성 (선택적이지만 권장)
        const modifiedSchema = { ...tool.inputSchema };
        delete modifiedSchema.$schema;
        return { ...tool, inputSchema: modifiedSchema };
      }
    }
    // 변경이 필요 없으면 그대로 반환
    return tool;
  });
  // <<< END: Gemini 호환성을 위해 $schema 제거 >>>

  return {
    tools, // $schema가 제거된 도구 목록 반환
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    // Ensure session is established for every request if cookie authentication is enabled
    if (GITLAB_AUTH_COOKIE_PATH) {
      await ensureSessionForRequest();
    }
    logger.info(request.params.name);
    switch (request.params.name) {
      case "fork_repository": {
        if (GITLAB_PROJECT_ID) {
          throw new Error("Direct project ID is set. So fork_repository is not allowed");
        }
        const forkArgs = ForkRepositorySchema.parse(request.params.arguments);
        try {
          const forkedProject = await forkProject(forkArgs.project_id, forkArgs.namespace);
          return {
            content: [{ type: "text", text: JSON.stringify(forkedProject, null, 2) }],
          };
        } catch (forkError) {
          logger.error("Error forking repository:", forkError);
          let forkErrorMessage = "Failed to fork repository";
          if (forkError instanceof Error) {
            forkErrorMessage = `${forkErrorMessage}: ${forkError.message}`;
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: forkErrorMessage }, null, 2),
              },
            ],
          };
        }
      }

      case "create_branch": {
        const args = CreateBranchSchema.parse(request.params.arguments);
        let ref = args.ref;
        if (!ref) {
          ref = await getDefaultBranchRef(args.project_id);
        }

        const branch = await createBranch(args.project_id, {
          name: args.branch,
          ref,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
        };
      }

      case "get_branch_diffs": {
        const args = GetBranchDiffsSchema.parse(request.params.arguments);
        const diffResp = await getBranchDiffs(args.project_id, args.from, args.to, args.straight);

        if (args.excluded_file_patterns?.length) {
          const regexPatterns = args.excluded_file_patterns.map(pattern => new RegExp(pattern));

          // Helper function to check if a path matches any regex pattern
          const matchesAnyPattern = (path: string): boolean => {
            if (!path) return false;
            return regexPatterns.some(regex => regex.test(path));
          };

          // Filter out files that match any of the regex patterns on new files
          diffResp.diffs = diffResp.diffs.filter(diff => !matchesAnyPattern(diff.new_path));
        }
        return {
          content: [{ type: "text", text: JSON.stringify(diffResp, null, 2) }],
        };
      }

      case "search_repositories": {
        const args = SearchRepositoriesSchema.parse(request.params.arguments);
        const results = await searchProjects(args.search, args.page, args.per_page);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "create_repository": {
        if (GITLAB_PROJECT_ID) {
          throw new Error("Direct project ID is set. So fork_repository is not allowed");
        }
        const args = CreateRepositorySchema.parse(request.params.arguments);
        const repository = await createRepository(args);
        return {
          content: [{ type: "text", text: JSON.stringify(repository, null, 2) }],
        };
      }

      case "get_file_contents": {
        const args = GetFileContentsSchema.parse(request.params.arguments);
        const contents = await getFileContents(args.project_id, args.file_path, args.ref);
        return {
          content: [{ type: "text", text: JSON.stringify(contents, null, 2) }],
        };
      }

      case "create_or_update_file": {
        const args = CreateOrUpdateFileSchema.parse(request.params.arguments);
        const result = await createOrUpdateFile(
          args.project_id,
          args.file_path,
          args.content,
          args.commit_message,
          args.branch,
          args.previous_path,
          args.last_commit_id,
          args.commit_id
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "push_files": {
        const args = PushFilesSchema.parse(request.params.arguments);
        const result = await createCommit(
          args.project_id,
          args.commit_message,
          args.branch,
          args.files.map(f => ({ path: f.file_path, content: f.content }))
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_issue": {
        const args = CreateIssueSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const issue = await createIssue(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "create_merge_request": {
        const args = CreateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const mergeRequest = await createMergeRequest(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "update_merge_request_note": {
        const args = UpdateMergeRequestNoteSchema.parse(request.params.arguments);
        const note = await updateMergeRequestNote(
          args.project_id,
          args.merge_request_iid,
          args.discussion_id,
          args.note_id,
          args.body, // Now optional
          args.resolved // Now one of body or resolved must be provided, not both
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_merge_request_note": {
        const args = CreateMergeRequestNoteSchema.parse(request.params.arguments);
        const note = await createMergeRequestNote(
          args.project_id,
          args.merge_request_iid,
          args.discussion_id,
          args.body,
          args.created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "update_issue_note": {
        const args = UpdateIssueNoteSchema.parse(request.params.arguments);
        const note = await updateIssueNote(
          args.project_id,
          args.issue_iid,
          args.discussion_id,
          args.note_id,
          args.body
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_issue_note": {
        const args = CreateIssueNoteSchema.parse(request.params.arguments);
        const note = await createIssueNote(
          args.project_id,
          args.issue_iid,
          args.discussion_id,
          args.body,
          args.created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "get_merge_request": {
        const args = GetMergeRequestSchema.parse(request.params.arguments);
        const mergeRequest = await getMergeRequest(
          args.project_id,
          args.merge_request_iid,
          args.source_branch
        );
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "get_merge_request_diffs": {
        const args = GetMergeRequestDiffsSchema.parse(request.params.arguments);
        const diffs = await getMergeRequestDiffs(
          args.project_id,
          args.merge_request_iid,
          args.source_branch,
          args.view
        );
        return {
          content: [{ type: "text", text: JSON.stringify(diffs, null, 2) }],
        };
      }

      case "list_merge_request_diffs": {
        const args = ListMergeRequestDiffsSchema.parse(request.params.arguments);
        const changes = await listMergeRequestDiffs(
          args.project_id,
          args.merge_request_iid,
          args.source_branch,
          args.page,
          args.per_page,
          args.unidiff
        );
        return {
          content: [{ type: "text", text: JSON.stringify(changes, null, 2) }],
        };
      }

      case "update_merge_request": {
        const args = UpdateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, source_branch, ...options } = args;
        const mergeRequest = await updateMergeRequest(
          project_id,
          options,
          merge_request_iid,
          source_branch
        );
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "merge_merge_request": {
        const args = MergeMergeRequestSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, ...options } = args;
        const mergeRequest = await mergeMergeRequest(project_id, options, merge_request_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "mr_discussions": {
        const args = ListMergeRequestDiscussionsSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, ...options } = args;
        const discussions = await listMergeRequestDiscussions(
          project_id,
          merge_request_iid,
          options
        );
        return {
          content: [{ type: "text", text: JSON.stringify(discussions, null, 2) }],
        };
      }

      case "list_namespaces": {
        const args = ListNamespacesSchema.parse(request.params.arguments);
        const url = new URL(`${GITLAB_API_URL}/namespaces`);

        if (args.search) {
          url.searchParams.append("search", args.search);
        }
        if (args.page) {
          url.searchParams.append("page", args.page.toString());
        }
        if (args.per_page) {
          url.searchParams.append("per_page", args.per_page.toString());
        }
        if (args.owned) {
          url.searchParams.append("owned", args.owned.toString());
        }

        const response = await fetch(url.toString(), {
          ...DEFAULT_FETCH_CONFIG,
        });

        await handleGitLabError(response);
        const data = await response.json();
        const namespaces = z.array(GitLabNamespaceSchema).parse(data);

        return {
          content: [{ type: "text", text: JSON.stringify(namespaces, null, 2) }],
        };
      }

      case "get_namespace": {
        const args = GetNamespaceSchema.parse(request.params.arguments);
        const url = new URL(
          `${GITLAB_API_URL}/namespaces/${encodeURIComponent(args.namespace_id)}`
        );

        const response = await fetch(url.toString(), {
          ...DEFAULT_FETCH_CONFIG,
        });

        await handleGitLabError(response);
        const data = await response.json();
        const namespace = GitLabNamespaceSchema.parse(data);

        return {
          content: [{ type: "text", text: JSON.stringify(namespace, null, 2) }],
        };
      }

      case "verify_namespace": {
        const args = VerifyNamespaceSchema.parse(request.params.arguments);
        const url = new URL(`${GITLAB_API_URL}/namespaces/${encodeURIComponent(args.path)}/exists`);

        const response = await fetch(url.toString(), {
          ...DEFAULT_FETCH_CONFIG,
        });

        await handleGitLabError(response);
        const data = await response.json();
        const namespaceExists = GitLabNamespaceExistsResponseSchema.parse(data);

        return {
          content: [{ type: "text", text: JSON.stringify(namespaceExists, null, 2) }],
        };
      }

      case "get_project": {
        const args = GetProjectSchema.parse(request.params.arguments);
        const url = new URL(
          `${GITLAB_API_URL}/projects/${encodeURIComponent(getEffectiveProjectId(args.project_id))}`
        );

        const response = await fetch(url.toString(), {
          ...DEFAULT_FETCH_CONFIG,
        });

        await handleGitLabError(response);
        const data = await response.json();
        const project = GitLabProjectSchema.parse(data);

        return {
          content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
        };
      }

      case "list_projects": {
        const args = ListProjectsSchema.parse(request.params.arguments);
        const projects = await listProjects(args);

        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        };
      }

      case "list_project_members": {
        const args = ListProjectMembersSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const members = await listProjectMembers(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(members, null, 2) }],
        };
      }

      case "get_users": {
        const args = GetUsersSchema.parse(request.params.arguments);
        const usersMap = await getUsers(args.usernames);

        return {
          content: [{ type: "text", text: JSON.stringify(usersMap, null, 2) }],
        };
      }

      case "create_note": {
        const args = CreateNoteSchema.parse(request.params.arguments);
        const { project_id, noteable_type, noteable_iid, body } = args;

        const note = await createNote(project_id, noteable_type, noteable_iid, body);
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "get_draft_note": {
        const args = GetDraftNoteSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, draft_note_id } = args;

        const draftNote = await getDraftNote(project_id, merge_request_iid, draft_note_id);
        return {
          content: [{ type: "text", text: JSON.stringify(draftNote, null, 2) }],
        };
      }

      case "list_draft_notes": {
        const args = ListDraftNotesSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid } = args;

        const draftNotes = await listDraftNotes(project_id, merge_request_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(draftNotes, null, 2) }],
        };
      }

      case "create_draft_note": {
        const args = CreateDraftNoteSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, body, position, resolve_discussion } = args;

        const draftNote = await createDraftNote(project_id, merge_request_iid, body, position, resolve_discussion);
        return {
          content: [{ type: "text", text: JSON.stringify(draftNote, null, 2) }],
        };
      }

      case "update_draft_note": {
        const args = UpdateDraftNoteSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, draft_note_id, body, position, resolve_discussion } = args;

        const draftNote = await updateDraftNote(project_id, merge_request_iid, draft_note_id, body, position, resolve_discussion);
        return {
          content: [{ type: "text", text: JSON.stringify(draftNote, null, 2) }],
        };
      }

      case "delete_draft_note": {
        const args = DeleteDraftNoteSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, draft_note_id } = args;

        await deleteDraftNote(project_id, merge_request_iid, draft_note_id);
        return {
          content: [{ type: "text", text: "Draft note deleted successfully" }],
        };
      }

      case "publish_draft_note": {
        const args = PublishDraftNoteSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, draft_note_id } = args;

        const publishedNote = await publishDraftNote(project_id, merge_request_iid, draft_note_id);
        return {
          content: [{ type: "text", text: JSON.stringify(publishedNote, null, 2) }],
        };
      }

      case "bulk_publish_draft_notes": {
        const args = BulkPublishDraftNotesSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid } = args;

        const publishedNotes = await bulkPublishDraftNotes(project_id, merge_request_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(publishedNotes, null, 2) }],
        };
      }

      case "create_merge_request_thread": {
        const args = CreateMergeRequestThreadSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, body, position, created_at } = args;

        const thread = await createMergeRequestThread(
          project_id,
          merge_request_iid,
          body,
          position,
          created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(thread, null, 2) }],
        };
      }

      case "list_issues": {
        const args = ListIssuesSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const issues = await listIssues(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
        };
      }

      case "my_issues": {
        const args = MyIssuesSchema.parse(request.params.arguments);
        const issues = await myIssues(args);
        return {
          content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
        };
      }

      case "get_issue": {
        const args = GetIssueSchema.parse(request.params.arguments);
        const issue = await getIssue(args.project_id, args.issue_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "update_issue": {
        const args = UpdateIssueSchema.parse(request.params.arguments);
        const { project_id, issue_iid, ...options } = args;
        const issue = await updateIssue(project_id, issue_iid, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "delete_issue": {
        const args = DeleteIssueSchema.parse(request.params.arguments);
        await deleteIssue(args.project_id, args.issue_iid);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: "success", message: "Issue deleted successfully" },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_issue_links": {
        const args = ListIssueLinksSchema.parse(request.params.arguments);
        const links = await listIssueLinks(args.project_id, args.issue_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(links, null, 2) }],
        };
      }

      case "list_issue_discussions": {
        const args = ListIssueDiscussionsSchema.parse(request.params.arguments);
        const { project_id, issue_iid, ...options } = args;

        const discussions = await listIssueDiscussions(project_id, issue_iid, options);
        return {
          content: [{ type: "text", text: JSON.stringify(discussions, null, 2) }],
        };
      }

      case "get_issue_link": {
        const args = GetIssueLinkSchema.parse(request.params.arguments);
        const link = await getIssueLink(args.project_id, args.issue_iid, args.issue_link_id);
        return {
          content: [{ type: "text", text: JSON.stringify(link, null, 2) }],
        };
      }

      case "create_issue_link": {
        const args = CreateIssueLinkSchema.parse(request.params.arguments);
        const link = await createIssueLink(
          args.project_id,
          args.issue_iid,
          args.target_project_id,
          args.target_issue_iid,
          args.link_type
        );
        return {
          content: [{ type: "text", text: JSON.stringify(link, null, 2) }],
        };
      }

      case "delete_issue_link": {
        const args = DeleteIssueLinkSchema.parse(request.params.arguments);
        await deleteIssueLink(args.project_id, args.issue_iid, args.issue_link_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Issue link deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_labels": {
        const args = ListLabelsSchema.parse(request.params.arguments);
        const labels = await listLabels(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(labels, null, 2) }],
        };
      }

      case "get_label": {
        const args = GetLabelSchema.parse(request.params.arguments);
        const label = await getLabel(args.project_id, args.label_id, args.include_ancestor_groups);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "create_label": {
        const args = CreateLabelSchema.parse(request.params.arguments);
        const label = await createLabel(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "update_label": {
        const args = UpdateLabelSchema.parse(request.params.arguments);
        const { project_id, label_id, ...options } = args;
        const label = await updateLabel(project_id, label_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "delete_label": {
        const args = DeleteLabelSchema.parse(request.params.arguments);
        await deleteLabel(args.project_id, args.label_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: "success", message: "Label deleted successfully" },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_group_projects": {
        const args = ListGroupProjectsSchema.parse(request.params.arguments);
        const projects = await listGroupProjects(args);
        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        };
      }

      case "list_wiki_pages": {
        const { project_id, page, per_page, with_content } = ListWikiPagesSchema.parse(
          request.params.arguments
        );
        const wikiPages = await listWikiPages(project_id, {
          page,
          per_page,
          with_content,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPages, null, 2) }],
        };
      }

      case "get_wiki_page": {
        const { project_id, slug } = GetWikiPageSchema.parse(request.params.arguments);
        const wikiPage = await getWikiPage(project_id, slug);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "create_wiki_page": {
        const { project_id, title, content, format } = CreateWikiPageSchema.parse(
          request.params.arguments
        );
        const wikiPage = await createWikiPage(project_id, title, content, format);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "update_wiki_page": {
        const { project_id, slug, title, content, format } = UpdateWikiPageSchema.parse(
          request.params.arguments
        );
        const wikiPage = await updateWikiPage(project_id, slug, title, content, format);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "delete_wiki_page": {
        const { project_id, slug } = DeleteWikiPageSchema.parse(request.params.arguments);
        await deleteWikiPage(project_id, slug);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Wiki page deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_repository_tree": {
        const args = GetRepositoryTreeSchema.parse(request.params.arguments);
        const tree = await getRepositoryTree(args);
        return {
          content: [{ type: "text", text: JSON.stringify(tree, null, 2) }],
        };
      }

      case "list_pipelines": {
        const args = ListPipelinesSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const pipelines = await listPipelines(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(pipelines, null, 2) }],
        };
      }

      case "get_pipeline": {
        const { project_id, pipeline_id } = GetPipelineSchema.parse(request.params.arguments);
        const pipeline = await getPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pipeline, null, 2),
            },
          ],
        };
      }

      case "list_pipeline_jobs": {
        const { project_id, pipeline_id, ...options } = ListPipelineJobsSchema.parse(
          request.params.arguments
        );
        const jobs = await listPipelineJobs(project_id, pipeline_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobs, null, 2),
            },
          ],
        };
      }

      case "list_pipeline_trigger_jobs": {
        const { project_id, pipeline_id, ...options } = ListPipelineTriggerJobsSchema.parse(
          request.params.arguments
        );
        const triggerJobs = await listPipelineTriggerJobs(project_id, pipeline_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(triggerJobs, null, 2),
            },
          ],
        };
      }

      case "get_pipeline_job": {
        const { project_id, job_id } = GetPipelineJobOutputSchema.parse(request.params.arguments);
        const jobDetails = await getPipelineJob(project_id, job_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobDetails, null, 2),
            },
          ],
        };
      }

      case "get_pipeline_job_output": {
        const { project_id, job_id, limit, offset } = GetPipelineJobOutputSchema.parse(
          request.params.arguments
        );
        const jobOutput = await getPipelineJobOutput(project_id, job_id, limit, offset);
        return {
          content: [
            {
              type: "text",
              text: jobOutput,
            },
          ],
        };
      }

      case "create_pipeline": {
        const { project_id, ref, variables } = CreatePipelineSchema.parse(request.params.arguments);
        const pipeline = await createPipeline(project_id, ref, variables);
        return {
          content: [
            {
              type: "text",
              text: `Created pipeline #${pipeline.id} for ${ref}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "retry_pipeline": {
        const { project_id, pipeline_id } = RetryPipelineSchema.parse(request.params.arguments);
        const pipeline = await retryPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: `Retried pipeline #${pipeline.id}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "cancel_pipeline": {
        const { project_id, pipeline_id } = CancelPipelineSchema.parse(request.params.arguments);
        const pipeline = await cancelPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: `Canceled pipeline #${pipeline.id}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "list_merge_requests": {
        const args = ListMergeRequestsSchema.parse(request.params.arguments);
        const mergeRequests = await listMergeRequests(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequests, null, 2) }],
        };
      }

      case "list_milestones": {
        const { project_id, ...options } = ListProjectMilestonesSchema.parse(
          request.params.arguments
        );
        const milestones = await listProjectMilestones(project_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestones, null, 2),
            },
          ],
        };
      }

      case "get_milestone": {
        const { project_id, milestone_id } = GetProjectMilestoneSchema.parse(
          request.params.arguments
        );
        const milestone = await getProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "create_milestone": {
        const { project_id, ...options } = CreateProjectMilestoneSchema.parse(
          request.params.arguments
        );
        const milestone = await createProjectMilestone(project_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "edit_milestone": {
        const { project_id, milestone_id, ...options } = EditProjectMilestoneSchema.parse(
          request.params.arguments
        );
        const milestone = await editProjectMilestone(project_id, milestone_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "delete_milestone": {
        const { project_id, milestone_id } = DeleteProjectMilestoneSchema.parse(
          request.params.arguments
        );
        await deleteProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Milestone deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_milestone_issue": {
        const { project_id, milestone_id } = GetMilestoneIssuesSchema.parse(
          request.params.arguments
        );
        const issues = await getMilestoneIssues(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(issues, null, 2),
            },
          ],
        };
      }

      case "get_milestone_merge_requests": {
        const { project_id, milestone_id } = GetMilestoneMergeRequestsSchema.parse(
          request.params.arguments
        );
        const mergeRequests = await getMilestoneMergeRequests(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(mergeRequests, null, 2),
            },
          ],
        };
      }

      case "promote_milestone": {
        const { project_id, milestone_id } = PromoteProjectMilestoneSchema.parse(
          request.params.arguments
        );
        const milestone = await promoteProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "get_milestone_burndown_events": {
        const { project_id, milestone_id } = GetMilestoneBurndownEventsSchema.parse(
          request.params.arguments
        );
        const events = await getMilestoneBurndownEvents(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(events, null, 2),
            },
          ],
        };
      }

      case "list_commits": {
        const args = ListCommitsSchema.parse(request.params.arguments);
        const commits = await listCommits(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(commits, null, 2) }],
        };
      }

      case "get_commit": {
        const args = GetCommitSchema.parse(request.params.arguments);
        const commit = await getCommit(args.project_id, args.sha, args.stats);
        return {
          content: [{ type: "text", text: JSON.stringify(commit, null, 2) }],
        };
      }

      case "get_commit_diff": {
        const args = GetCommitDiffSchema.parse(request.params.arguments);
        const diff = await getCommitDiff(args.project_id, args.sha);
        return {
          content: [{ type: "text", text: JSON.stringify(diff, null, 2) }],
        };
      }

      case "list_group_iterations": {
        const args = ListGroupIterationsSchema.parse(request.params.arguments);
        const iterations = await listGroupIterations(args.group_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(iterations, null, 2) }],
        };
      }

      case "upload_markdown": {
        const args = MarkdownUploadSchema.parse(request.params.arguments);
        const upload = await markdownUpload(args.project_id, args.file_path);
        return {
          content: [{ type: "text", text: JSON.stringify(upload, null, 2) }],
        };
      }

      case "download_attachment": {
        const args = DownloadAttachmentSchema.parse(request.params.arguments);
        const filePath = await downloadAttachment(args.project_id, args.secret, args.filename, args.local_path);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, file_path: filePath }, null, 2) }],
        };
      }

      default:
        // Check if it's an extension tool
        if (extensionHandlers[request.params.name as keyof typeof extensionHandlers]) {
          const handler = extensionHandlers[request.params.name as keyof typeof extensionHandlers];
          const context: ExtensionHandlerContext = {
            GITLAB_API_URL,
            DEFAULT_FETCH_CONFIG,
            getEffectiveProjectId,
            handleGitLabError,
            logger,
            fetch,
          };
          return await handler(request.params.arguments, context);
        }
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    logger.debug(request.params);
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map(e => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});

/**
 *  Color constants for terminal output
 */
const colorGreen = "\x1b[32m";
const colorReset = "\x1b[0m";

/**
 * Determine the transport mode based on environment variables and availability
 *
 * Transport mode priority (highest to lowest):
 * 1. STREAMABLE_HTTP
 * 2. SSE
 * 3. STDIO
 */
function determineTransportMode(): TransportMode {
  // Check for streamable-http support (highest priority)
  if (STREAMABLE_HTTP) {
    return TransportMode.STREAMABLE_HTTP;
  }

  // Check for SSE support (medium priority)
  if (SSE) {
    return TransportMode.SSE;
  }

  // Default to stdio (lowest priority)
  return TransportMode.STDIO;
}

/**
 * Start server with stdio transport
 */
async function startStdioServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Start server with traditional SSE transport
 */
async function startSSEServer(): Promise<void> {
  const app = express();
  const transports: { [sessionId: string]: SSEServerTransport } = {};

  app.get("/sse", async (_: Request, res: Response) => {
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
      delete transports[transport.sessionId];
    });
    await server.connect(transport);
  });

  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send("No transport found for sessionId");
    }
  });

  app.get("/health", (_: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      version: SERVER_VERSION,
      transport: TransportMode.SSE,
    });
  });

  app.listen(Number(PORT), HOST, () => {
    logger.info(`GitLab MCP Server running with SSE transport`);
    const colorGreen = "\x1b[32m";
    const colorReset = "\x1b[0m";
    logger.info(`${colorGreen}Endpoint: http://${HOST}:${PORT}/sse${colorReset}`);
  });
}

/**
 * Start server with Streamable HTTP transport
 */
async function startStreamableHTTPServer(): Promise<void> {
  const app = express();
  const streamableTransports: {
    [sessionId: string]: StreamableHTTPServerTransport;
  } = {};

  // Configure Express middleware
  app.use(express.json());

  // Streamable HTTP endpoint - handles both session creation and message handling
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && streamableTransports[sessionId]) {
        // Reuse existing transport for ongoing session
        transport = streamableTransports[sessionId];
        await transport.handleRequest(req, res, req.body);
      } else {
        // Create new transport for new session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            streamableTransports[newSessionId] = transport;
            logger.warn(`Streamable HTTP session initialized: ${newSessionId}`);
          },
        });

        // Set up cleanup handler when transport closes
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && streamableTransports[sid]) {
            logger.warn(`Streamable HTTP transport closed for session ${sid}, cleaning up`);
            delete streamableTransports[sid];
          }
        };

        // Connect transport to MCP server before handling the request
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      }
    } catch (error) {
      logger.error("Streamable HTTP error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Health check endpoint
  app.get("/health", (_: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      version: SERVER_VERSION,
      transport: TransportMode.STREAMABLE_HTTP,
      activeSessions: Object.keys(streamableTransports).length,
    });
  });

  // Start server
  app.listen(Number(PORT), HOST, () => {
    logger.info(`GitLab MCP Server running with Streamable HTTP transport`);
    logger.info(`${colorGreen}Endpoint: http://${HOST}:${PORT}/mcp${colorReset}`);
  });
}

/**
 * Initialize server with specific transport mode
 * Handle transport-specific initialization logic
 */
async function initializeServerByTransportMode(mode: TransportMode): Promise<void> {
  logger.info("Initializing server with transport mode:", mode);
  switch (mode) {
    case TransportMode.STDIO:
      logger.warn("Starting GitLab MCP Server with stdio transport");
      await startStdioServer();
      break;

    case TransportMode.SSE:
      logger.warn("Starting GitLab MCP Server with SSE transport");
      await startSSEServer();
      break;

    case TransportMode.STREAMABLE_HTTP:
      logger.warn("Starting GitLab MCP Server with Streamable HTTP transport");
      await startStreamableHTTPServer();
      break;

    default:
      // This should never happen with proper enum usage, but TypeScript requires it
      const exhaustiveCheck: never = mode;
      throw new Error(`Unknown transport mode: ${exhaustiveCheck}`);
  }
}

/**
 * Initialize and run the server
 * Main entry point for server startup
 */
async function runServer() {
  try {
    const transportMode = determineTransportMode();
    await initializeServerByTransportMode(transportMode);
  } catch (error) {
    logger.error("Error initializing server:", error);
    process.exit(1);
  }
}

/**
 * Create and return the server instance for testing
 */
export function createServer() {
  return server;
}

// 下記の２行を追記
runServer().catch(error => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
