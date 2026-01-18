import { coreToolRegistry } from "../../../../src/entities/core/registry";
import { enhancedFetch } from "../../../../src/utils/fetch";

// Mock enhancedFetch to avoid actual API calls
jest.mock("../../../../src/utils/fetch", () => ({
  enhancedFetch: jest.fn(),
}));

const mockEnhancedFetch = enhancedFetch as jest.MockedFunction<typeof enhancedFetch>;

// Mock environment variables
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    GITLAB_API_URL: "https://test-gitlab.com",
    GITLAB_TOKEN: "test-token-123",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  // Ensure mockEnhancedFetch is properly reset
  mockEnhancedFetch.mockReset();
});

describe("Core Registry Handlers", () => {
  describe("search_repositories handler", () => {
    it("should make correct API call with search parameters", async () => {
      const handler = coreToolRegistry.get("search_repositories")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 1, name: "test-project" }]),
      } as any);

      await handler?.({ q: "nodejs", per_page: 10 });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects?search=nodejs&per_page=10&active=true"
      );
    });

    it("should handle API errors gracefully", async () => {
      const handler = coreToolRegistry.get("search_repositories")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as any);

      await expect(handler?.({ q: "test" })).rejects.toThrow("GitLab API error: 401 Unauthorized");
    });

    it("should validate input parameters", async () => {
      const handler = coreToolRegistry.get("search_repositories")?.handler;
      await expect(handler?.({ invalid_param: "test" })).rejects.toThrow();
    });
  });

  describe("list_projects handler", () => {
    it("should make correct API call for listing projects", async () => {
      const handler = coreToolRegistry.get("list_projects")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 1, name: "project1" },
          { id: 2, name: "project2" },
        ]),
      } as any);

      await handler?.({ visibility: "public", per_page: 20 });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects?active=true&order_by=created_at&sort=desc&simple=true&per_page=20&visibility=public"
      );
    });

    it("should work with minimal parameters", async () => {
      const handler = coreToolRegistry.get("list_projects")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      } as any);

      await handler?.({});

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects?active=true&order_by=created_at&sort=desc&simple=true&per_page=20"
      );
    });

    it("should handle server errors", async () => {
      const handler = coreToolRegistry.get("list_projects")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as any);

      await expect(handler?.({})).rejects.toThrow("GitLab API error: 500 Internal Server Error");
    });
  });

  describe("list_namespaces handler", () => {
    it("should make correct API call for listing namespaces", async () => {
      const handler = coreToolRegistry.get("list_namespaces")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 1, name: "namespace1", kind: "group" }]),
      } as any);

      await handler?.({ search: "test-group", per_page: 50 });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/namespaces?search=test-group&per_page=50"
      );
    });
  });

  describe("get_users handler", () => {
    it("should make correct API call for getting users", async () => {
      const handler = coreToolRegistry.get("get_users")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 1, username: "testuser", name: "Test User" }]),
      } as any);

      await handler?.({ username: "testuser" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/users?username=testuser&per_page=20"
      );
    });
  });

  describe("get_project handler", () => {
    it("should make correct API call for getting specific project", async () => {
      const handler = coreToolRegistry.get("get_project")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 123,
          name: "my-project",
          path_with_namespace: "group/my-project",
        }),
      } as any);

      await handler?.({ project_id: "123" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/123?"
      );
    });

    it("should handle project not found", async () => {
      const handler = coreToolRegistry.get("get_project")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      await expect(handler?.({ project_id: "999" })).rejects.toThrow(
        "GitLab API error: 404 Not Found"
      );
    });
  });

  describe("get_namespace handler", () => {
    it("should make correct API call for getting namespace", async () => {
      const handler = coreToolRegistry.get("get_namespace")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 456, name: "test-namespace", kind: "group" }),
      } as any);

      await handler?.({ namespace_id: "456" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/namespaces/456"
      );
    });
  });

  describe("verify_namespace handler", () => {
    it("should verify namespace exists by making API call", async () => {
      const handler = coreToolRegistry.get("verify_namespace")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 789, name: "verified-namespace" }),
      } as any);

      const result = await handler?.({ namespace: "verified-namespace" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/namespaces/verified-namespace"
      );
      expect(result).toEqual({
        exists: true,
        status: undefined,
        namespace: "verified-namespace",
        data: { id: 789, name: "verified-namespace" },
      });
    });

    it("should handle namespace verification failure", async () => {
      const handler = coreToolRegistry.get("verify_namespace")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      const result = await handler?.({ namespace: "nonexistent" });

      expect(result).toEqual({
        exists: false,
        status: 404,
        namespace: "nonexistent",
        data: null,
      });
    });
  });

  describe("list_project_members handler", () => {
    it("should list project members correctly", async () => {
      const handler = coreToolRegistry.get("list_project_members")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 1, username: "user1", access_level: 40 },
          { id: 2, username: "user2", access_level: 30 },
        ]),
      } as any);

      await handler?.({ project_id: "123", per_page: 25 });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/123/members?per_page=25"
      );
    });
  });

  describe("list_projects handler with user scope", () => {
    it("should list user projects with defaults", async () => {
      const handler = coreToolRegistry.get("list_projects")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 10, name: "user-project-1" },
          { id: 11, name: "user-project-2" },
        ]),
      } as any);

      await handler?.({});

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects?active=true&order_by=created_at&sort=desc&simple=true&per_page=20"
      );
    });

    it("should list user projects with custom parameters", async () => {
      const handler = coreToolRegistry.get("list_projects")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 12, name: "user-project-3" }]),
      } as any);

      await handler?.({ visibility: "public", per_page: 5 });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects?active=true&order_by=created_at&sort=desc&simple=true&per_page=5&visibility=public"
      );
    });
  });

  describe("list_projects handler with group scope", () => {
    it("should list group projects correctly", async () => {
      const handler = coreToolRegistry.get("list_projects")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 100, name: "group-project-1" },
          { id: 101, name: "group-project-2" },
        ]),
      } as any);

      await handler?.({ group_id: "456" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/groups/456/projects?order_by=created_at&sort=desc&simple=true&per_page=20"
      );
    });
  });

  describe("list_commits handler", () => {
    it("should list commits with proper parameters", async () => {
      const handler = coreToolRegistry.get("list_commits")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: "commit1", title: "First commit", author_name: "Author 1" },
          { id: "commit2", title: "Second commit", author_name: "Author 2" },
        ]),
      } as any);

      await handler?.({ project_id: "789", ref_name: "main", per_page: 20 });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/789/repository/commits?ref_name=main&per_page=20"
      );
    });
  });

  describe("get_commit handler", () => {
    it("should get specific commit details", async () => {
      const handler = coreToolRegistry.get("get_commit")?.handler;
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: "abc123",
          title: "Commit title",
          message: "Commit message",
          author_name: "John Doe",
        }),
      } as any);

      await handler?.({ project_id: "123", commit_sha: "abc123" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/123/repository/commits/abc123?"
      );
    });
  });

  describe("get_commit_diff handler", () => {
    it("should get commit diff details", async () => {
      const handler = coreToolRegistry.get("get_commit_diff")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue([
            { diff: "+added line\n-removed line", new_path: "file.js", old_path: "file.js" },
          ]),
      } as any);

      await handler?.({ project_id: "456", commit_sha: "def456" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/456/repository/commits/def456/diff?"
      );
    });
  });

  describe("list_group_iterations handler", () => {
    it("should list group iterations", async () => {
      const handler = coreToolRegistry.get("list_group_iterations")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 1, title: "Sprint 1", state: "opened" },
          { id: 2, title: "Sprint 2", state: "closed" },
        ]),
      } as any);

      await handler?.({ group_id: "789" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/groups/789/iterations?per_page=20"
      );
    });
  });

  describe("download_attachment handler", () => {
    it("should download attachment with correct URL", async () => {
      const handler = coreToolRegistry.get("download_attachment")?.handler;

      const mockBuffer = Buffer.from("file content");
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockBuffer),
        headers: new Map([["content-type", "application/pdf"]]),
      } as any);

      await handler?.({ project_id: "123", secret: "abc123", filename: "attachment.pdf" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/123/uploads/abc123/attachment.pdf"
      );
    });
  });

  describe("list_events handler", () => {
    it("should list user events", async () => {
      const handler = coreToolRegistry.get("list_events")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 1, action_name: "pushed", target_title: "main" },
          { id: 2, action_name: "created", target_title: "feature-branch" },
        ]),
      } as any);

      await handler?.({ per_page: 50 });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/events?per_page=50"
      );
    });
  });

  describe("get_project_events handler", () => {
    it("should get project-specific events", async () => {
      const handler = coreToolRegistry.get("get_project_events")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 10, action_name: "opened", target_title: "New Issue" },
          { id: 11, action_name: "merged", target_title: "Feature PR" },
        ]),
      } as any);

      await handler?.({ project_id: "999" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/999/events?per_page=20"
      );
    });
  });

  describe("create_repository handler", () => {
    it("should create repository with correct API call", async () => {
      const handler = coreToolRegistry.get("create_repository")?.handler;

      // Mock project existence check (step 1) - project doesn't exist
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      // Mock project creation (step 2)
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 1000,
          name: "new-repo",
          web_url: "https://test-gitlab.com/current-user/new-repo",
        }),
      } as any);

      const result = await handler?.({
        name: "new-repo",
        description: "A new repository",
        visibility: "private",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(
        expect.objectContaining({
          id: 1000,
          name: "new-repo",
        })
      );
    });

    it("should handle repository creation failure", async () => {
      const handler = coreToolRegistry.get("create_repository")?.handler;

      // Mock project existence check (step 1) - project doesn't exist
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      // Mock project creation failure (step 2)
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
      } as any);

      await expect(
        handler?.({
          name: "invalid-repo-name!@#",
        })
      ).rejects.toThrow("GitLab API error: 422 Unprocessable Entity");
    });
  });

  describe("fork_repository handler", () => {
    it("should fork repository with correct parameters", async () => {
      const handler = coreToolRegistry.get("fork_repository")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 2000,
          name: "forked-repo",
          forked_from_project: { id: 1000, name: "original-repo" },
        }),
      } as any);

      await handler?.({
        project_id: "1000",
        namespace: "my-group",
        name: "forked-repo",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/1000/fork",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "namespace=my-group&name=forked-repo",
        }
      );
    });

    it("should handle fork permission errors", async () => {
      const handler = coreToolRegistry.get("fork_repository")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as any);

      await expect(
        handler?.({
          project_id: "1000",
        })
      ).rejects.toThrow("GitLab API error: 403 Forbidden");
    });
  });

  describe("create_branch handler", () => {
    it("should create branch with correct API call", async () => {
      const handler = coreToolRegistry.get("create_branch")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          name: "feature-branch",
          commit: { id: "abc123", message: "Initial commit" },
          protected: false,
        }),
      } as any);

      await handler?.({
        project_id: "123",
        branch: "feature-branch",
        ref: "main",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://test-gitlab.com/api/v4/projects/123/repository/branches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "branch=feature-branch&ref=main",
        }
      );
    });

    it("should handle branch creation conflicts", async () => {
      const handler = coreToolRegistry.get("create_branch")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
      } as any);

      await expect(
        handler?.({
          project_id: "123",
          branch: "existing-branch",
          ref: "main",
        })
      ).rejects.toThrow("GitLab API error: 409 Conflict");
    });

    it("should handle invalid reference errors", async () => {
      const handler = coreToolRegistry.get("create_branch")?.handler;

      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      } as any);

      await expect(
        handler?.({
          project_id: "123",
          branch: "new-branch",
          ref: "nonexistent-ref",
        })
      ).rejects.toThrow("GitLab API error: 400 Bad Request");
    });
  });

  describe("Handler Error Cases", () => {
    it("should handle network errors across all handlers", async () => {
      mockEnhancedFetch.mockRejectedValueOnce(new Error("Network error"));

      const searchHandler = coreToolRegistry.get("search_repositories")?.handler;
      await expect(searchHandler?.({ q: "test" })).rejects.toThrow("Network error");
    });

    it("should call enhancedFetch without Authorization header (handled internally)", async () => {
      // Handlers no longer pass Authorization headers - enhancedFetch handles that internally
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      } as any);

      const handler = coreToolRegistry.get("list_projects")?.handler;
      await handler?.({});

      // Verify the handler doesn't pass Authorization headers - enhancedFetch adds auth internally
      expect(mockEnhancedFetch).toHaveBeenCalledWith(expect.any(String));
    });

    it("should validate required parameters for all handlers", async () => {
      const testCases = [
        { handler: "get_project", invalidArgs: {} }, // missing project_id
        { handler: "get_namespace", invalidArgs: {} }, // missing namespace_id
        { handler: "verify_namespace", invalidArgs: {} }, // missing namespace
        { handler: "list_project_members", invalidArgs: {} }, // missing project_id
        { handler: "list_commits", invalidArgs: {} }, // missing project_id
        { handler: "get_commit", invalidArgs: { project_id: "123" } }, // missing commit_sha
        { handler: "get_commit_diff", invalidArgs: { project_id: "123" } }, // missing commit_sha
        { handler: "list_group_iterations", invalidArgs: {} }, // missing group_id
        { handler: "download_attachment", invalidArgs: {} }, // missing project_id/secret/filename
        { handler: "get_project_events", invalidArgs: {} }, // missing project_id
        { handler: "create_repository", invalidArgs: {} }, // missing name
        { handler: "fork_repository", invalidArgs: {} }, // missing project_id
        { handler: "create_branch", invalidArgs: { project_id: "123" } }, // missing branch or ref
      ];

      for (const testCase of testCases) {
        const handler = coreToolRegistry.get(testCase.handler)?.handler;
        if (handler) {
          await expect(handler(testCase.invalidArgs)).rejects.toThrow();
        }
      }
    });

    it("should handle JSON parsing errors in responses", async () => {
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
      } as any);

      const handler = coreToolRegistry.get("list_projects")?.handler;
      await expect(handler?.({})).rejects.toThrow("Invalid JSON");
    });
  });
});
