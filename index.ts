#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import path, { dirname } from "path";
import { SocksProxyAgent } from "socks-proxy-agent";
import { fileURLToPath, URL } from "url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Add type imports for proxy agents
import { Agent } from "http";

import {
  CreateBranchOptionsSchema,
  CreateBranchSchema,
  CreateIssueLinkSchema,
  CreateIssueOptionsSchema,
  CreateIssueSchema,
  CreateLabelSchema, // Added
  CreateMergeRequestNoteSchema,
  CreateMergeRequestOptionsSchema,
  CreateMergeRequestSchema,
  CreateMergeRequestThreadSchema,
  CreateNoteSchema,
  CreateOrUpdateFileSchema,
  CreateRepositoryOptionsSchema,
  CreateRepositorySchema,
  CreateWikiPageSchema,
  DeleteIssueLinkSchema,
  DeleteIssueSchema,
  DeleteLabelSchema,
  DeleteWikiPageSchema,
  ForkRepositorySchema,
  GetFileContentsSchema,
  GetIssueLinkSchema,
  GetIssueSchema,
  GetLabelSchema,
  GetMergeRequestDiffsSchema,
  GetMergeRequestSchema,
  GetNamespaceSchema,
  GetProjectSchema,
  GetRepositoryTreeSchema,
  GetWikiPageSchema,
  GitLabCommitSchema,
  GitLabContentSchema,
  GitLabCreateUpdateFileResponseSchema,
  // Discussion Schemas
  GitLabDiscussionNoteSchema, // Added
  GitLabDiscussionSchema,
  GitLabForkSchema,
  GitLabIssueLinkSchema,
  GitLabIssueSchema,
  GitLabIssueWithLinkDetailsSchema,
  GitLabMergeRequestDiffSchema,
  GitLabMergeRequestSchema,
  GitLabNamespaceExistsResponseSchema,
  GitLabNamespaceSchema,
  GitLabProjectSchema,
  GitLabReferenceSchema,
  GitLabRepositorySchema,
  GitLabSearchResponseSchema,
  GitLabTreeItemSchema,
  GitLabTreeSchema,
  GitLabWikiPageSchema,
  ListGroupProjectsSchema,
  ListIssueLinksSchema,
  ListIssuesSchema,
  ListLabelsSchema, // Added
  ListMergeRequestDiscussionsSchema,
  ListNamespacesSchema,
  ListProjectsSchema,
  ListWikiPagesSchema,
  PushFilesSchema,
  SearchRepositoriesSchema,
  UpdateIssueSchema,
  UpdateLabelSchema,
  UpdateMergeRequestNoteSchema,
  UpdateMergeRequestSchema,
  UpdateWikiPageSchema,
  VerifyNamespaceSchema,
  type FileOperation,
  type GetRepositoryTreeOptions,
  type GitLabCommit,
  type GitLabContent,
  type GitLabCreateUpdateFileResponse, // Added
  type GitLabDiscussion,
  // Discussion Types
  type GitLabDiscussionNote,
  type GitLabFork,
  type GitLabIssue,
  type GitLabIssueLink,
  type GitLabIssueWithLinkDetails,
  type GitLabLabel,
  type GitLabMergeRequest,
  type GitLabMergeRequestDiff,
  type GitLabNamespace,
  type GitLabNamespaceExistsResponse,
  type GitLabProject,
  type GitLabReference,
  type GitLabRepository,
  type GitLabSearchResponse,
  type GitLabTree,
  type GitLabTreeItem,
  type GitLabWikiPage,
  type MergeRequestThreadPosition,
} from "./schemas.js";

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
  console.error("Warning: Could not read version from package.json:", error);
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
const GITLAB_READ_ONLY_MODE = process.env.GITLAB_READ_ONLY_MODE === "true";
const USE_GITLAB_WIKI = process.env.USE_GITLAB_WIKI === "true";

// Add proxy configuration
const HTTP_PROXY = process.env.HTTP_PROXY;
const HTTPS_PROXY = process.env.HTTPS_PROXY;

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
    httpsAgent = new HttpsProxyAgent(HTTPS_PROXY);
  }
}

// Modify DEFAULT_HEADERS to include agent configuration
const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
};

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
    description:
      "Get the contents of a file or directory from a GitLab project",
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
    name: "update_merge_request",
    description:
      "Update a merge request (Either mergeRequestIid or branchName must be provided)",
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
    name: "list_issues",
    description: "List issues in a GitLab project with filtering options",
    inputSchema: zodToJsonSchema(ListIssuesSchema),
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
    description:
      "Get the repository tree for a GitLab project (list files and directories)",
    inputSchema: zodToJsonSchema(GetRepositoryTreeSchema),
  },
];

// Define which tools are read-only
const readOnlyTools = [
  "search_repositories",
  "get_file_contents",
  "get_merge_request",
  "get_merge_request_diffs",
  "mr_discussions",
  "list_issues",
  "get_issue",
  "list_issue_links",
  "get_issue_link",
  "list_namespaces",
  "get_namespace",
  "verify_namespace",
  "get_project",
  "list_projects",
  "list_labels",
  "get_label",
  "list_group_projects",
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
  if (
    !normalizedUrl.endsWith("/api/v4") &&
    !normalizedUrl.endsWith("/api/v4/")
  ) {
    // Append /api/v4 if not already present
    normalizedUrl = `${normalizedUrl}/api/v4`;
  }

  return normalizedUrl;
}

// Use the normalizeGitLabApiUrl function to handle various URL formats
const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "");

if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
  console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  process.exit(1);
}

/**
 * Utility function for handling GitLab API errors
 * API 에러 처리를 위한 유틸리티 함수 (Utility function for handling API errors)
 *
 * @param {import("node-fetch").Response} response - The response from GitLab API
 * @throws {Error} Throws an error with response details if the request failed
 */
async function handleGitLabError(
  response: import("node-fetch").Response
): Promise<void> {
  if (!response.ok) {
    const errorBody = await response.text();
    // Check specifically for Rate Limit error
    if (
      response.status === 403 &&
      errorBody.includes("User API Key Rate limit exceeded")
    ) {
      console.error("GitLab API Rate Limit Exceeded:", errorBody);
      console.log("User API Key Rate limit exceeded. Please try again later.");
      throw new Error(`GitLab API Rate Limit Exceeded: ${errorBody}`);
    } else {
      // Handle other API errors
      throw new Error(
        `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
      );
    }
  }
}

/**
 * Create a fork of a GitLab project
 * 프로젝트 포크 생성 (Create a project fork)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} [namespace] - The namespace to fork the project to
 * @returns {Promise<GitLabFork>} The created fork
 */
async function forkProject(
  projectId: string,
  namespace?: string
): Promise<GitLabFork> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/fork`
  );

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
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/repository/branches`
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
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}`
  );

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
  const encodedPath = encodeURIComponent(filePath);

  // ref가 없는 경우 default branch를 가져옴
  if (!ref) {
    ref = await getDefaultBranchRef(projectId);
  }

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/repository/files/${encodedPath}`
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
    parsedData.content = Buffer.from(parsedData.content, "base64").toString(
      "utf8"
    );
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
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/issues`
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
 * List issues in a GitLab project
 * 프로젝트의 이슈 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for listing issues
 * @returns {Promise<GitLabIssue[]>} List of issues
 */
async function listIssues(
  projectId: string,
  options: Omit<z.infer<typeof ListIssuesSchema>, "project_id"> = {}
): Promise<GitLabIssue[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/issues`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === "label_name" && Array.isArray(value)) {
        // Handle array of labels
        url.searchParams.append(key, value.join(","));
      } else {
        url.searchParams.append(key, value.toString());
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
 * Get a single issue from a GitLab project
 * 단일 이슈 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @returns {Promise<GitLabIssue>} The issue
 */
async function getIssue(
  projectId: string,
  issueIid: number
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/issues/${issueIid}`
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
  issueIid: number,
  options: Omit<z.infer<typeof UpdateIssueSchema>, "project_id" | "issue_iid">
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/issues/${issueIid}`
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
async function deleteIssue(projectId: string, issueIid: number): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/issues/${issueIid}`
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
  issueIid: number
): Promise<GitLabIssueWithLinkDetails[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/issues/${issueIid}/links`
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
  issueIid: number,
  issueLinkId: number
): Promise<GitLabIssueLink> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
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
  issueIid: number,
  targetProjectId: string,
  targetIssueIid: number,
  linkType: "relates_to" | "blocks" | "is_blocked_by" = "relates_to"
): Promise<GitLabIssueLink> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  targetProjectId = decodeURIComponent(targetProjectId); // Decode target project ID as well
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/issues/${issueIid}/links`
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
  issueIid: number,
  issueLinkId: number
): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      title: options.title,
      description: options.description,
      source_branch: options.source_branch,
      target_branch: options.target_branch,
      allow_collaboration: options.allow_collaboration,
      draft: options.draft,
    }),
  });

  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
    );
  }

  const data = await response.json();
  return GitLabMergeRequestSchema.parse(data);
}

/**
 * List merge request discussion items
 * 병합 요청 토론 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The IID of a merge request
 * @returns {Promise<GitLabDiscussion[]>} List of discussions
 */
async function listMergeRequestDiscussions(
  projectId: string,
  mergeRequestIid: number
): Promise<GitLabDiscussion[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}/discussions`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
  });

  await handleGitLabError(response);
  const data = await response.json();
  // Ensure the response is parsed as an array of discussions
  return z.array(GitLabDiscussionSchema).parse(data);
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
  mergeRequestIid: number,
  discussionId: string,
  noteId: number,
  body?: string,
  resolved?: boolean
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
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
  mergeRequestIid: number,
  discussionId: string,
  body: string,
  createdAt?: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/repository/files/${encodedPath}`
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
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
    );
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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/repository/tree`
  );

  if (ref) {
    url.searchParams.append("ref", ref);
  }

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      files: files.map((file) => ({
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
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
    );
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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/repository/commits`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({
      branch,
      commit_message: message,
      actions: actions.map((action) => ({
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
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
    );
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
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
    );
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
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
    );
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
  mergeRequestIid?: number,
  branchName?: string
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  let url: URL;

  if (mergeRequestIid) {
    url = new URL(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(
        projectId
      )}/merge_requests/${mergeRequestIid}`
    );
  } else if (branchName) {
    url = new URL(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(
        projectId
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
  mergeRequestIid?: number,
  branchName?: string,
  view?: "inline" | "parallel"
): Promise<GitLabMergeRequestDiff[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  if (!mergeRequestIid && !branchName) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  if (branchName && !mergeRequestIid) {
    const mergeRequest = await getMergeRequest(
      projectId,
      undefined,
      branchName
    );
    mergeRequestIid = mergeRequest.iid;
  }

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
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
  return z.array(GitLabMergeRequestDiffSchema).parse(data.changes);
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
  mergeRequestIid?: number,
  branchName?: string
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  if (!mergeRequestIid && !branchName) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  if (branchName && !mergeRequestIid) {
    const mergeRequest = await getMergeRequest(
      projectId,
      undefined,
      branchName
    );
    mergeRequestIid = mergeRequest.iid;
  }

  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}`
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
  noteableIid: number,
  body: string
): Promise<any> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // ⚙️ 응답 타입은 GitLab API 문서에 따라 조정 가능
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/${noteableType}s/${noteableIid}/notes` // Using plural form (issues/merge_requests) as per GitLab API documentation
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}\n${errorText}`
    );
  }

  return await response.json();
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
  mergeRequestIid: number,
  body: string,
  position?: MergeRequestThreadPosition,
  createdAt?: string
): Promise<GitLabDiscussion> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}/discussions`
  );

  url.searchParams.append("body", body);

  const form = new URLSearchParams();

  let positionNewLine = null;

  if (position) {
    form.append("position[position_type]", "text");
    form.append("position[base_sha]", position.base_sha);
    form.append("position[head_sha]", position.head_sha);
    form.append("position[start_sha]", position.start_sha);

    if (position.new_path) {
      form.append("position[new_path]", position.new_path);
    }
    if (position.old_path) {
      form.append("position[old_path]", position.old_path);
    }

    // Optional single-line position fields
    if (position.new_line) {
      form.append("position[new_line]", position.new_line.toString());
      positionNewLine = position.new_line.toString();
    }
    if (position.old_line) {
      form.append("position[old_line]", position.old_line.toString());
    }

    // Optional created_at
    if (createdAt) {
      form.append("created_at", createdAt);
    }

    // Optional line_range block
    if (position.line_range) {
      const { start, end } = position.line_range;

      form.append("position[line_range][start][type]", start.type);
      if (start.new_line) {
        form.append(
          "position[line_range][start][new_line]",
          start.new_line.toString()
        );

        if (!positionNewLine) {
          form.append("position[new_line]", start.new_line.toString());
        }
      }
      if (start.old_line) {
        form.append(
          "position[line_range][start][old_line]",
          start.old_line.toString()
        );
      }

      form.append("position[line_range][end][type]", end.type);

      if (end.new_line) {
        form.append(
          "position[line_range][end][new_line]",
          end.new_line.toString()
        );

        if (!positionNewLine) {
          form.append("position[new_line]", end.new_line.toString());
        }
      }
      if (end.old_line) {
        form.append(
          "position[line_range][end][old_line]",
          end.old_line.toString()
        );
      }
    }
  }

  const headers = {
    ...DEFAULT_FETCH_CONFIG.headers,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const response = await fetch(url.toString(), {
    headers,
    method: "POST",
    body: form.toString(),
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
  const url = new URL(
    `${GITLAB_API_URL}/namespaces/${encodeURIComponent(namespacePath)}/exists`
  );

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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}`
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
  const response = await fetch(
    `${GITLAB_API_URL}/projects?${params.toString()}`,
    {
      ...DEFAULT_FETCH_CONFIG,
    }
  );

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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/labels`
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
      projectId
    )}/labels/${encodeURIComponent(String(labelId))}`
  );

  // Add query parameters
  if (includeAncestorGroups !== undefined) {
    url.searchParams.append(
      "include_ancestor_groups",
      includeAncestorGroups ? "true" : "false"
    );
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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/labels`,
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
      projectId
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
async function deleteLabel(
  projectId: string,
  labelId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
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
  const url = new URL(
    `${GITLAB_API_URL}/groups/${encodeURIComponent(options.group_id)}/projects`
  );

  // Add optional parameters to URL
  if (options.include_subgroups)
    url.searchParams.append("include_subgroups", "true");
  if (options.search) url.searchParams.append("search", options.search);
  if (options.order_by) url.searchParams.append("order_by", options.order_by);
  if (options.sort) url.searchParams.append("sort", options.sort);
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page)
    url.searchParams.append("per_page", options.per_page.toString());
  if (options.archived !== undefined)
    url.searchParams.append("archived", options.archived.toString());
  if (options.visibility)
    url.searchParams.append("visibility", options.visibility);
  if (options.with_issues_enabled !== undefined)
    url.searchParams.append(
      "with_issues_enabled",
      options.with_issues_enabled.toString()
    );
  if (options.with_merge_requests_enabled !== undefined)
    url.searchParams.append(
      "with_merge_requests_enabled",
      options.with_merge_requests_enabled.toString()
    );
  if (options.min_access_level !== undefined)
    url.searchParams.append(
      "min_access_level",
      options.min_access_level.toString()
    );
  if (options.with_programming_language)
    url.searchParams.append(
      "with_programming_language",
      options.with_programming_language
    );
  if (options.starred !== undefined)
    url.searchParams.append("starred", options.starred.toString());
  if (options.statistics !== undefined)
    url.searchParams.append("statistics", options.statistics.toString());
  if (options.with_custom_attributes !== undefined)
    url.searchParams.append(
      "with_custom_attributes",
      options.with_custom_attributes.toString()
    );
  if (options.with_security_reports !== undefined)
    url.searchParams.append(
      "with_security_reports",
      options.with_security_reports.toString()
    );

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
  options: Omit<z.infer<typeof ListWikiPagesSchema>, "project_id"> = {}
): Promise<GitLabWikiPage[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/wikis`
  );
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page)
    url.searchParams.append("per_page", options.per_page.toString());
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
async function getWikiPage(
  projectId: string,
  slug: string
): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/wikis/${encodeURIComponent(slug)}`,
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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/wikis`,
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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/wikis/${encodeURIComponent(slug)}`,
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
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/wikis/${encodeURIComponent(slug)}`,
    {
      ...DEFAULT_FETCH_CONFIG,
      method: "DELETE",
    }
  );
  await handleGitLabError(response);
}

/**
 * Get the repository tree for a project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {GetRepositoryTreeOptions} options - Options for the tree
 * @returns {Promise<GitLabTreeItem[]>}
 */
async function getRepositoryTree(
  options: GetRepositoryTreeOptions
): Promise<GitLabTreeItem[]> {
  options.project_id = decodeURIComponent(options.project_id); // Decode project_id within options
  const queryParams = new URLSearchParams();
  if (options.path) queryParams.append("path", options.path);
  if (options.ref) queryParams.append("ref", options.ref);
  if (options.recursive) queryParams.append("recursive", "true");
  if (options.per_page)
    queryParams.append("per_page", options.per_page.toString());
  if (options.page_token) queryParams.append("page_token", options.page_token);
  if (options.pagination) queryParams.append("pagination", options.pagination);

  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      options.project_id
    )}/repository/tree?${queryParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Apply read-only filter first
  const tools0 = GITLAB_READ_ONLY_MODE
    ? allTools.filter((tool) => readOnlyTools.includes(tool.name))
    : allTools;
  // Toggle wiki tools by USE_GITLAB_WIKI flag
  let tools = USE_GITLAB_WIKI
    ? tools0
    : tools0.filter((tool) => !wikiToolNames.includes(tool.name));

  // <<< START: Gemini 호환성을 위해 $schema 제거 >>>
  tools = tools.map((tool) => {
    // inputSchema가 존재하고 객체인지 확인
    if (
      tool.inputSchema &&
      typeof tool.inputSchema === "object" &&
      tool.inputSchema !== null
    ) {
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "fork_repository": {
        const forkArgs = ForkRepositorySchema.parse(request.params.arguments);
        try {
          const forkedProject = await forkProject(
            forkArgs.project_id,
            forkArgs.namespace
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(forkedProject, null, 2) },
            ],
          };
        } catch (forkError) {
          console.error("Error forking repository:", forkError);
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

      case "search_repositories": {
        const args = SearchRepositoriesSchema.parse(request.params.arguments);
        const results = await searchProjects(
          args.search,
          args.page,
          args.per_page
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "create_repository": {
        const args = CreateRepositorySchema.parse(request.params.arguments);
        const repository = await createRepository(args);
        return {
          content: [
            { type: "text", text: JSON.stringify(repository, null, 2) },
          ],
        };
      }

      case "get_file_contents": {
        const args = GetFileContentsSchema.parse(request.params.arguments);
        const contents = await getFileContents(
          args.project_id,
          args.file_path,
          args.ref
        );
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
          args.files.map((f) => ({ path: f.file_path, content: f.content }))
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
          content: [
            { type: "text", text: JSON.stringify(mergeRequest, null, 2) },
          ],
        };
      }

      case "update_merge_request_note": {
        const args = UpdateMergeRequestNoteSchema.parse(
          request.params.arguments
        );
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
        const args = CreateMergeRequestNoteSchema.parse(
          request.params.arguments
        );
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

      case "get_merge_request": {
        const args = GetMergeRequestSchema.parse(request.params.arguments);
        const mergeRequest = await getMergeRequest(
          args.project_id,
          args.merge_request_iid,
          args.source_branch
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(mergeRequest, null, 2) },
          ],
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
            { type: "text", text: JSON.stringify(mergeRequest, null, 2) },
          ],
        };
      }

      case "mr_discussions": {
        const args = ListMergeRequestDiscussionsSchema.parse(
          request.params.arguments
        );
        const discussions = await listMergeRequestDiscussions(
          args.project_id,
          args.merge_request_iid
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(discussions, null, 2) },
          ],
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
          content: [
            { type: "text", text: JSON.stringify(namespaces, null, 2) },
          ],
        };
      }

      case "get_namespace": {
        const args = GetNamespaceSchema.parse(request.params.arguments);
        const url = new URL(
          `${GITLAB_API_URL}/namespaces/${encodeURIComponent(
            args.namespace_id
          )}`
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
        const url = new URL(
          `${GITLAB_API_URL}/namespaces/${encodeURIComponent(args.path)}/exists`
        );

        const response = await fetch(url.toString(), {
          ...DEFAULT_FETCH_CONFIG,
        });

        await handleGitLabError(response);
        const data = await response.json();
        const namespaceExists = GitLabNamespaceExistsResponseSchema.parse(data);

        return {
          content: [
            { type: "text", text: JSON.stringify(namespaceExists, null, 2) },
          ],
        };
      }

      case "get_project": {
        const args = GetProjectSchema.parse(request.params.arguments);
        const url = new URL(
          `${GITLAB_API_URL}/projects/${encodeURIComponent(args.project_id)}`
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

      case "create_note": {
        const args = CreateNoteSchema.parse(request.params.arguments);
        const { project_id, noteable_type, noteable_iid, body } = args;

        const note = await createNote(
          project_id,
          noteable_type,
          noteable_iid,
          body
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_merge_request_thread": {
        const args = CreateMergeRequestThreadSchema.parse(
          request.params.arguments
        );
        const { project_id, merge_request_iid, body, position, created_at } =
          args;

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

      case "get_issue_link": {
        const args = GetIssueLinkSchema.parse(request.params.arguments);
        const link = await getIssueLink(
          args.project_id,
          args.issue_iid,
          args.issue_link_id
        );
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
        await deleteIssueLink(
          args.project_id,
          args.issue_iid,
          args.issue_link_id
        );
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
        const label = await getLabel(
          args.project_id,
          args.label_id,
          args.include_ancestor_groups
        );
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
        const { project_id, page, per_page } = ListWikiPagesSchema.parse(
          request.params.arguments
        );
        const wikiPages = await listWikiPages(project_id, { page, per_page });
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPages, null, 2) }],
        };
      }

      case "get_wiki_page": {
        const { project_id, slug } = GetWikiPageSchema.parse(
          request.params.arguments
        );
        const wikiPage = await getWikiPage(project_id, slug);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "create_wiki_page": {
        const { project_id, title, content, format } =
          CreateWikiPageSchema.parse(request.params.arguments);
        const wikiPage = await createWikiPage(
          project_id,
          title,
          content,
          format
        );
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "update_wiki_page": {
        const { project_id, slug, title, content, format } =
          UpdateWikiPageSchema.parse(request.params.arguments);
        const wikiPage = await updateWikiPage(
          project_id,
          slug,
          title,
          content,
          format
        );
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "delete_wiki_page": {
        const { project_id, slug } = DeleteWikiPageSchema.parse(
          request.params.arguments
        );
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
});

/**
 * Initialize and run the server
 * 서버 초기화 및 실행
 */
async function runServer() {
  try {
    console.error("========================");
    console.error(`GitLab MCP Server v${SERVER_VERSION}`);
    console.error(`API URL: ${GITLAB_API_URL}`);
    console.error("========================");

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GitLab MCP Server running on stdio");
  } catch (error) {
    console.error("Error initializing server:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
