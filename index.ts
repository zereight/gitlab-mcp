#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import {
  GitLabForkSchema,
  GitLabReferenceSchema,
  GitLabRepositorySchema,
  GitLabIssueSchema,
  GitLabMergeRequestSchema,
  GitLabContentSchema,
  GitLabCreateUpdateFileResponseSchema,
  GitLabSearchResponseSchema,
  GitLabTreeSchema,
  GitLabCommitSchema,
  CreateRepositoryOptionsSchema,
  CreateIssueOptionsSchema,
  CreateMergeRequestOptionsSchema,
  CreateBranchOptionsSchema,
  CreateOrUpdateFileSchema,
  SearchRepositoriesSchema,
  CreateRepositorySchema,
  GetFileContentsSchema,
  PushFilesSchema,
  CreateIssueSchema,
  CreateMergeRequestSchema,
  ForkRepositorySchema,
  CreateBranchSchema,
  GitLabMergeRequestDiffSchema,
  GetMergeRequestSchema,
  GetMergeRequestDiffsSchema,
  UpdateMergeRequestSchema,
  type GitLabFork,
  type GitLabReference,
  type GitLabRepository,
  type GitLabIssue,
  type GitLabMergeRequest,
  type GitLabContent,
  type GitLabCreateUpdateFileResponse,
  type GitLabSearchResponse,
  type GitLabTree,
  type GitLabCommit,
  type FileOperation,
  type GitLabMergeRequestDiff,
  CreateNoteSchema,
} from "./schemas.js";

const server = new Server(
  {
    name: "better-gitlab-mcp-server",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const GITLAB_API_URL =
  process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";

if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
  console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  process.exit(1);
}

// GitLab API 공통 헤더
const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
};

// API 에러 처리를 위한 유틸리티 함수
async function handleGitLabError(
  response: import("node-fetch").Response
): Promise<void> {
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`
    );
  }
}

// 프로젝트 포크 생성
async function forkProject(
  projectId: string,
  namespace?: string
): Promise<GitLabFork> {
  // API 엔드포인트 URL 생성
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(projectId)}/fork`
  );

  if (namespace) {
    url.searchParams.append("namespace", namespace);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: DEFAULT_HEADERS,
  });

  // 이미 존재하는 프로젝트인 경우 처리
  if (response.status === 409) {
    throw new Error("Project already exists in the target namespace");
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabForkSchema.parse(data);
}

// 새로운 브랜치 생성
async function createBranch(
  projectId: string,
  options: z.infer<typeof CreateBranchOptionsSchema>
): Promise<GitLabReference> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/repository/branches`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      branch: options.name,
      ref: options.ref,
    }),
  });

  await handleGitLabError(response);
  return GitLabReferenceSchema.parse(await response.json());
}

// 프로젝트의 기본 브랜치 조회
async function getDefaultBranchRef(projectId: string): Promise<string> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(projectId)}`
  );

  const response = await fetch(url.toString(), {
    headers: DEFAULT_HEADERS,
  });

  await handleGitLabError(response);
  const project = GitLabRepositorySchema.parse(await response.json());
  return project.default_branch ?? "main";
}

// 파일 내용 조회
async function getFileContents(
  projectId: string,
  filePath: string,
  ref?: string
): Promise<GitLabContent> {
  const encodedPath = encodeURIComponent(filePath);

  // ref가 없는 경우 default branch를 가져옴
  if (!ref) {
    ref = await getDefaultBranchRef(projectId);
  }

  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/repository/files/${encodedPath}`
  );

  url.searchParams.append("ref", ref);

  const response = await fetch(url.toString(), {
    headers: DEFAULT_HEADERS,
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

// 이슈 생성
async function createIssue(
  projectId: string,
  options: z.infer<typeof CreateIssueOptionsSchema>
): Promise<GitLabIssue> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(projectId)}/issues`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: DEFAULT_HEADERS,
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

async function createMergeRequest(
  projectId: string,
  options: z.infer<typeof CreateMergeRequestOptionsSchema>
): Promise<GitLabMergeRequest> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/merge_requests`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
    },
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

async function createOrUpdateFile(
  projectId: string,
  filePath: string,
  content: string,
  commitMessage: string,
  branch: string,
  previousPath?: string
): Promise<GitLabCreateUpdateFileResponse> {
  const encodedPath = encodeURIComponent(filePath);
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/repository/files/${encodedPath}`
  );

  const body = {
    branch,
    content,
    commit_message: commitMessage,
    encoding: "text",
    ...(previousPath ? { previous_path: previousPath } : {}),
  };

  // Check if file exists
  let method = "POST";
  try {
    await getFileContents(projectId, filePath, branch);
    method = "PUT";
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("File not found"))) {
      throw error;
    }
    // File doesn't exist, use POST
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
    },
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

async function createTree(
  projectId: string,
  files: FileOperation[],
  ref?: string
): Promise<GitLabTree> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/repository/tree`
  );

  if (ref) {
    url.searchParams.append("ref", ref);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
    },
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

async function createCommit(
  projectId: string,
  message: string,
  branch: string,
  actions: FileOperation[]
): Promise<GitLabCommit> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/repository/commits`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
    },
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

async function searchProjects(
  query: string,
  page: number = 1,
  perPage: number = 20
): Promise<GitLabSearchResponse> {
  const url = new URL(`${GITLAB_API_URL}/api/v4/projects`);
  url.searchParams.append("search", query);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("per_page", perPage.toString());
  url.searchParams.append("order_by", "id");
  url.searchParams.append("sort", "desc");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
    },
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

async function createRepository(
  options: z.infer<typeof CreateRepositoryOptionsSchema>
): Promise<GitLabRepository> {
  const response = await fetch(`${GITLAB_API_URL}/api/v4/projects`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
    },
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

// MR 조회 함수
async function getMergeRequest(
  projectId: string,
  mergeRequestIid: number
): Promise<GitLabMergeRequest> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}`
  );

  const response = await fetch(url.toString(), {
    headers: DEFAULT_HEADERS,
  });

  await handleGitLabError(response);
  return GitLabMergeRequestSchema.parse(await response.json());
}

// MR 변경사항 조회 함수
async function getMergeRequestDiffs(
  projectId: string,
  mergeRequestIid: number,
  view?: "inline" | "parallel"
): Promise<GitLabMergeRequestDiff[]> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}/changes`
  );

  if (view) {
    url.searchParams.append("view", view);
  }

  const response = await fetch(url.toString(), {
    headers: DEFAULT_HEADERS,
  });

  await handleGitLabError(response);
  const data = (await response.json()) as { changes: unknown };
  return z.array(GitLabMergeRequestDiffSchema).parse(data.changes);
}

// MR 업데이트 함수
async function updateMergeRequest(
  projectId: string,
  mergeRequestIid: number,
  options: Omit<
    z.infer<typeof UpdateMergeRequestSchema>,
    "project_id" | "merge_request_iid"
  >
): Promise<GitLabMergeRequest> {
  const url = new URL(
    `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}`
  );

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(options),
  });

  await handleGitLabError(response);
  return GitLabMergeRequestSchema.parse(await response.json());
}

// 📦 새로운 함수: createNote - 이슈 또는 병합 요청에 노트(댓글)를 추가하는 함수
async function createNote(
  projectId: string,
  noteableType: "issue" | "merge_request", // 'issue' 또는 'merge_request' 타입 명시
  noteableIid: number,
  body: string
): Promise<any> {
  // ⚙️ 응답 타입은 GitLab API 문서에 따라 조정 가능
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/${noteableType}/${noteableIid}/notes`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ body }),
  });

  await handleGitLabError(response);
  return await response.json(); // ⚙️ 응답 타입은 GitLab API 문서에 따라 조정 가능, 필요하면 스키마 정의
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
        description:
          "Push multiple files to a GitLab project in a single commit",
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
        description:
          "Fork a GitLab project to your account or specified namespace",
        inputSchema: zodToJsonSchema(ForkRepositorySchema),
      },
      {
        name: "create_branch",
        description: "Create a new branch in a GitLab project",
        inputSchema: zodToJsonSchema(CreateBranchSchema),
      },
      {
        name: "get_merge_request",
        description: "Get details of a merge request",
        inputSchema: zodToJsonSchema(GetMergeRequestSchema),
      },
      {
        name: "get_merge_request_diffs",
        description: "Get the changes/diffs of a merge request",
        inputSchema: zodToJsonSchema(GetMergeRequestDiffsSchema),
      },
      {
        name: "update_merge_request",
        description: "Update a merge request",
        inputSchema: zodToJsonSchema(UpdateMergeRequestSchema),
      },
      {
        name: "create_note",
        description: "Create a new note (comment) to an issue or merge request",
        inputSchema: zodToJsonSchema(CreateNoteSchema),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "fork_repository": {
        const args = ForkRepositorySchema.parse(request.params.arguments);
        const fork = await forkProject(args.project_id, args.namespace);
        return {
          content: [{ type: "text", text: JSON.stringify(fork, null, 2) }],
        };
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
          args.previous_path
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

      case "get_merge_request": {
        const args = GetMergeRequestSchema.parse(request.params.arguments);
        const mergeRequest = await getMergeRequest(
          args.project_id,
          args.merge_request_iid
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
          args.view
        );
        return {
          content: [{ type: "text", text: JSON.stringify(diffs, null, 2) }],
        };
      }

      case "update_merge_request": {
        const args = UpdateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, ...options } = args;
        const mergeRequest = await updateMergeRequest(
          project_id,
          merge_request_iid,
          options
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(mergeRequest, null, 2) },
          ],
        };
      }

      case "create_note": {
        try {
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

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitLab MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
