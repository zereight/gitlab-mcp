/**
 * Mock data fixtures for unit tests
 * Provides consistent test data for GitLab API responses
 */

export const mockProject = {
  id: 12345,
  name: "test-project",
  path: "test-project",
  path_with_namespace: "test-group/test-project",
  description: "Test project for unit tests",
  web_url: "https://gitlab.example.com/test-group/test-project",
  visibility: "private",
  default_branch: "main",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  namespace: {
    id: 67890,
    name: "test-group",
    path: "test-group",
    kind: "group",
  },
};

export const mockUser = {
  id: 11111,
  name: "Test User",
  username: "testuser",
  email: "test@example.com",
  avatar_url: "https://gitlab.example.com/avatar.png",
  web_url: "https://gitlab.example.com/testuser",
  created_at: "2024-01-01T00:00:00Z",
};

export const mockMergeRequest = {
  id: 54321,
  iid: 1,
  title: "Test Merge Request",
  description: "Test MR description",
  state: "opened",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  source_branch: "feature/test",
  target_branch: "main",
  author: mockUser,
  assignee: mockUser,
  web_url: "https://gitlab.example.com/test-group/test-project/-/merge_requests/1",
  merge_status: "can_be_merged",
  draft: false,
  work_in_progress: false,
  project_id: mockProject.id,
};

export const mockLabel = {
  id: 98765,
  name: "bug",
  color: "#FF0000",
  description: "Bug label",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  project_id: mockProject.id,
};

export const mockMilestone = {
  id: 13579,
  title: "v1.0.0",
  description: "First release milestone",
  state: "active",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  due_date: "2024-12-31",
  web_url: "https://gitlab.example.com/test-group/test-project/-/milestones/1",
  project_id: mockProject.id,
};

export const mockPipeline = {
  id: 24680,
  iid: 1,
  status: "success",
  ref: "main",
  sha: "abc123def456",
  web_url: "https://gitlab.example.com/test-group/test-project/-/pipelines/24680",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  user: mockUser,
  project_id: mockProject.id,
};

export const mockWorkItem = {
  id: "12345",
  iid: "1",
  title: "Test Work Item",
  workItemType: {
    id: "gid://gitlab/WorkItems::Type/1",
    name: "Issue",
  },
  state: "OPEN",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  author: {
    name: mockUser.name,
    username: mockUser.username,
  },
  widgets: [],
};

export const mockFile = {
  file_name: "test.md",
  file_path: "docs/test.md",
  size: 1024,
  encoding: "base64",
  content_sha256: "abc123",
  ref: "main",
  blob_id: "blob123",
  commit_id: "commit123",
  last_commit_id: "commit123",
};

export const mockCommit = {
  id: "commit123",
  short_id: "commit1",
  title: "Test commit",
  message: "Test commit message",
  author_name: mockUser.name,
  author_email: mockUser.email,
  authored_date: "2024-01-01T00:00:00Z",
  committer_name: mockUser.name,
  committer_email: mockUser.email,
  committed_date: "2024-01-01T00:00:00Z",
  web_url: "https://gitlab.example.com/test-group/test-project/-/commit/commit123",
};

export const mockNamespace = {
  id: mockProject.namespace.id,
  name: mockProject.namespace.name,
  path: mockProject.namespace.path,
  kind: mockProject.namespace.kind,
  full_path: "test-group",
  web_url: "https://gitlab.example.com/groups/test-group",
};

export const mockVariable = {
  key: "TEST_VAR",
  value: "test-value",
  variable_type: "env_var",
  protected: false,
  masked: false,
  environment_scope: "*",
};

export const mockWikiPage = {
  title: "Test Wiki Page",
  content: "Test wiki content",
  format: "markdown",
  slug: "test-wiki-page",
  encoding: "text",
};

// API Response helpers
export const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? "OK" : "Error",
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  headers: new Map([
    ["content-type", "application/json"],
    ["x-total", "1"],
    ["x-page", "1"],
    ["x-per-page", "20"],
  ]),
});

export const createMockErrorResponse = (status = 404, message = "Not Found") => ({
  ok: false,
  status,
  statusText: message,
  json: jest.fn().mockResolvedValue({ message }),
  text: jest.fn().mockResolvedValue(JSON.stringify({ message })),
  headers: new Map([["content-type", "application/json"]]),
});

// Common test scenarios
export const mockApiResponses = {
  project: createMockResponse(mockProject),
  projects: createMockResponse([mockProject]),
  user: createMockResponse(mockUser),
  users: createMockResponse([mockUser]),
  mergeRequest: createMockResponse(mockMergeRequest),
  mergeRequests: createMockResponse([mockMergeRequest]),
  label: createMockResponse(mockLabel),
  labels: createMockResponse([mockLabel]),
  milestone: createMockResponse(mockMilestone),
  milestones: createMockResponse([mockMilestone]),
  pipeline: createMockResponse(mockPipeline),
  pipelines: createMockResponse([mockPipeline]),
  workItem: createMockResponse(mockWorkItem),
  workItems: createMockResponse([mockWorkItem]),
  file: createMockResponse(mockFile),
  commit: createMockResponse(mockCommit),
  commits: createMockResponse([mockCommit]),
  namespace: createMockResponse(mockNamespace),
  namespaces: createMockResponse([mockNamespace]),
  variable: createMockResponse(mockVariable),
  variables: createMockResponse([mockVariable]),
  wikiPage: createMockResponse(mockWikiPage),
  wikiPages: createMockResponse([mockWikiPage]),

  // Error responses
  notFound: createMockErrorResponse(404, "Not Found"),
  unauthorized: createMockErrorResponse(401, "Unauthorized"),
  forbidden: createMockErrorResponse(403, "Forbidden"),
  serverError: createMockErrorResponse(500, "Internal Server Error"),
};
