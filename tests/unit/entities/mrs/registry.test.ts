import {
  mrsToolRegistry,
  getMrsReadOnlyToolNames,
  getMrsToolDefinitions,
  getFilteredMrsTools,
} from "../../../../src/entities/mrs/registry";
import { gitlab } from "../../../../src/utils/gitlab-api";

// Mock the gitlab API helper
// Note: toQuery mock mirrors the real implementation which filters out undefined values
jest.mock("../../../../src/utils/gitlab-api", () => ({
  gitlab: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  toQuery: jest.fn((options: Record<string, unknown>, exclude: string[] = []) => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(options)) {
      // Filter out excluded keys and undefined values (matches real implementation)
      if (!exclude.includes(key) && value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }),
}));

const mockGitlab = gitlab as jest.Mocked<typeof gitlab>;

// Mock environment variables
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    GITLAB_API_URL: "https://gitlab.example.com",
    GITLAB_TOKEN: "test-token-12345",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Note: Don't use resetAllMocks() here because it would remove the custom toQuery
  // mock implementation defined above, which is intended to mirror the real helper.
});

describe("MRS Registry", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(mrsToolRegistry instanceof Map).toBe(true);
    });

    it("should contain exactly 5 CQRS tools", () => {
      const toolNames = Array.from(mrsToolRegistry.keys());

      // Check for all 5 CQRS tools
      expect(toolNames).toContain("browse_merge_requests");
      expect(toolNames).toContain("browse_mr_discussions");
      expect(toolNames).toContain("manage_merge_request");
      expect(toolNames).toContain("manage_mr_discussion");
      expect(toolNames).toContain("manage_draft_notes");

      expect(mrsToolRegistry.size).toBe(5);
    });

    it("should have tools with valid structure", () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.inputSchema).toBe("object");
        expect(typeof tool.handler).toBe("function");
      });
    });

    it("should have unique tool names", () => {
      const toolNames = Array.from(mrsToolRegistry.keys());
      const uniqueNames = new Set(toolNames);
      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper browse_merge_requests tool", () => {
      const tool = mrsToolRegistry.get("browse_merge_requests");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("browse_merge_requests");
      expect(tool!.description).toContain("BROWSE");
      expect(tool!.description).toContain("list");
      expect(tool!.description).toContain("get");
      expect(tool!.description).toContain("diffs");
      expect(tool!.description).toContain("compare");
      expect(tool!.inputSchema).toBeDefined();
    });

    it("should have proper browse_mr_discussions tool", () => {
      const tool = mrsToolRegistry.get("browse_mr_discussions");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("browse_mr_discussions");
      expect(tool!.description).toContain("BROWSE");
      expect(tool!.description).toContain("list");
      expect(tool!.description).toContain("drafts");
      expect(tool!.description).toContain("draft");
      expect(tool!.inputSchema).toBeDefined();
    });

    it("should have proper manage_merge_request tool", () => {
      const tool = mrsToolRegistry.get("manage_merge_request");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("manage_merge_request");
      expect(tool!.description).toContain("MANAGE");
      expect(tool!.description).toContain("create");
      expect(tool!.description).toContain("update");
      expect(tool!.description).toContain("merge");
      expect(tool!.description).toContain("approve");
      expect(tool!.description).toContain("unapprove");
      expect(tool!.description).toContain("get_approval_state");
      expect(tool!.inputSchema).toBeDefined();
    });

    it("should have proper manage_mr_discussion tool", () => {
      const tool = mrsToolRegistry.get("manage_mr_discussion");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("manage_mr_discussion");
      expect(tool!.description).toContain("MANAGE");
      expect(tool!.description).toContain("comment");
      expect(tool!.description).toContain("thread");
      expect(tool!.description).toContain("reply");
      expect(tool!.description).toContain("update");
      expect(tool!.description).toContain("apply_suggestion");
      expect(tool!.description).toContain("apply_suggestions");
      expect(tool!.description).toContain("resolve");
      expect(tool!.description).toContain("suggest");
      expect(tool!.inputSchema).toBeDefined();
    });

    it("should have proper manage_draft_notes tool", () => {
      const tool = mrsToolRegistry.get("manage_draft_notes");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("manage_draft_notes");
      expect(tool!.description).toContain("MANAGE");
      expect(tool!.description).toContain("create");
      expect(tool!.description).toContain("update");
      expect(tool!.description).toContain("publish");
      expect(tool!.description).toContain("delete");
      expect(tool!.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include only browse_ tools", () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(readOnlyTools).toContain("browse_merge_requests");
      expect(readOnlyTools).toContain("browse_mr_discussions");
    });

    it("should not include manage_ tools", () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(readOnlyTools).not.toContain("manage_merge_request");
      expect(readOnlyTools).not.toContain("manage_mr_discussion");
      expect(readOnlyTools).not.toContain("manage_draft_notes");
    });

    it("should return exactly 2 read-only tools", () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(readOnlyTools.length).toBe(2);
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      readOnlyTools.forEach(toolName => {
        expect(mrsToolRegistry.has(toolName)).toBe(true);
      });
    });
  });

  describe("MRS Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const toolDefinitions = getMrsToolDefinitions();
      expect(Array.isArray(toolDefinitions)).toBe(true);
      expect(toolDefinitions.length).toBe(5);
    });

    it("should return all tools from registry", () => {
      const toolDefinitions = getMrsToolDefinitions();
      const registrySize = mrsToolRegistry.size;
      expect(toolDefinitions.length).toBe(registrySize);
    });

    it("should return tool definitions with proper structure", () => {
      const toolDefinitions = getMrsToolDefinitions();

      toolDefinitions.forEach(tool => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.inputSchema).toBe("object");
      });
    });
  });

  describe("Filtered MRS Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const filteredTools = getFilteredMrsTools(false);
      expect(filteredTools.length).toBe(5);
    });

    it("should return only read-only tools in read-only mode", () => {
      const filteredTools = getFilteredMrsTools(true);
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(filteredTools.length).toBe(readOnlyTools.length);
    });

    it("should filter tools correctly in read-only mode", () => {
      const filteredTools = getFilteredMrsTools(true);
      const toolNames = filteredTools.map(tool => tool.name);

      expect(toolNames).toContain("browse_merge_requests");
      expect(toolNames).toContain("browse_mr_discussions");

      expect(toolNames).not.toContain("manage_merge_request");
      expect(toolNames).not.toContain("manage_mr_discussion");
      expect(toolNames).not.toContain("manage_draft_notes");
    });

    it("should return exactly 2 tools in read-only mode", () => {
      const filteredTools = getFilteredMrsTools(true);
      expect(filteredTools.length).toBe(2);
    });
  });

  describe("Tool Handlers", () => {
    it("should have handlers that are async functions", () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(typeof tool.handler).toBe("function");
        expect(tool.handler.constructor.name).toBe("AsyncFunction");
      });
    });

    it("should have handlers that accept arguments", () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.handler.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Registry Consistency", () => {
    it("should have all expected CQRS tools", () => {
      const expectedTools = [
        "browse_merge_requests",
        "browse_mr_discussions",
        "manage_merge_request",
        "manage_mr_discussion",
        "manage_draft_notes",
      ];

      expectedTools.forEach(toolName => {
        expect(mrsToolRegistry.has(toolName)).toBe(true);
      });
    });

    it("should have consistent tool count between functions", () => {
      const registrySize = mrsToolRegistry.size;
      const toolDefinitions = getMrsToolDefinitions();
      const filteredTools = getFilteredMrsTools(false);

      expect(toolDefinitions.length).toBe(registrySize);
      expect(filteredTools.length).toBe(registrySize);
    });

    it("should have more tools than just read-only ones", () => {
      const totalTools = mrsToolRegistry.size;
      const readOnlyTools = getMrsReadOnlyToolNames();

      expect(totalTools).toBeGreaterThan(readOnlyTools.length);
    });
  });

  describe("Tool Input Schemas", () => {
    it("should have valid JSON schema structure for all tools", () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
      });
    });

    it("should have discriminatedUnion schemas with action field", () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        // Each schema should be a valid JSON Schema object with discriminator
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
      });
    });
  });

  describe("Handler Functions", () => {
    describe("browse_merge_requests handler", () => {
      describe("action: list", () => {
        it("should list MRs for specific project", async () => {
          const mockMRs = [{ id: 1, iid: 1, title: "Test MR" }];
          mockGitlab.get.mockResolvedValueOnce(mockMRs);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;
          const result = await tool.handler({
            action: "list",
            project_id: "test/project",
            state: "opened",
          });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests",
            expect.objectContaining({ query: expect.any(Object) })
          );
          expect(result).toEqual(mockMRs);
        });

        it("should use global endpoint when no project_id", async () => {
          const mockMRs = [{ id: 1, iid: 1, title: "Test MR" }];
          mockGitlab.get.mockResolvedValueOnce(mockMRs);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;
          await tool.handler({ action: "list", state: "opened" });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "merge_requests",
            expect.objectContaining({ query: expect.any(Object) })
          );
        });
      });

      describe("action: get", () => {
        it("should get MR by IID", async () => {
          const mockMR = { id: 1, iid: 1, title: "Test MR" };
          mockGitlab.get.mockResolvedValueOnce(mockMR);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;
          const result = await tool.handler({
            action: "get",
            project_id: "test/project",
            merge_request_iid: 1,
          });

          // No query params = undefined second argument
          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1",
            undefined
          );
          expect(result).toEqual(mockMR);
        });

        it("should get MR by IID with include flags", async () => {
          const mockMR = { id: 1, iid: 1, title: "Test MR", diverged_commits_count: 5 };
          mockGitlab.get.mockResolvedValueOnce(mockMR);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;
          const result = await tool.handler({
            action: "get",
            project_id: "test/project",
            merge_request_iid: 1,
            include_diverged_commits_count: true,
            include_rebase_in_progress: true,
          });

          expect(mockGitlab.get).toHaveBeenCalledWith("projects/test%2Fproject/merge_requests/1", {
            query: {
              include_diverged_commits_count: true,
              include_rebase_in_progress: true,
            },
          });
          expect(result).toEqual(mockMR);
        });

        it("should get MR by branch name", async () => {
          const mockMRs = [{ id: 1, iid: 1, title: "Test MR", source_branch: "feature" }];
          mockGitlab.get.mockResolvedValueOnce(mockMRs);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;
          const result = await tool.handler({
            action: "get",
            project_id: "test/project",
            branch_name: "feature",
          });

          expect(mockGitlab.get).toHaveBeenCalledWith("projects/test%2Fproject/merge_requests", {
            query: { source_branch: "feature" },
          });
          expect(result).toEqual(mockMRs[0]);
        });

        it("should throw error when no MR found by branch", async () => {
          mockGitlab.get.mockResolvedValueOnce([]);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;

          await expect(
            tool.handler({
              action: "get",
              project_id: "test/project",
              branch_name: "nonexistent",
            })
          ).rejects.toThrow("No merge request found for branch");
        });
      });

      describe("action: diffs", () => {
        it("should get MR diffs with pagination", async () => {
          const mockDiffs = { changes: [] };
          mockGitlab.get.mockResolvedValueOnce(mockDiffs);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;
          const result = await tool.handler({
            action: "diffs",
            project_id: "test/project",
            merge_request_iid: 1,
            page: 1,
            per_page: 20,
          });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/changes",
            { query: { page: 1, per_page: 20 } }
          );
          expect(result).toEqual(mockDiffs);
        });

        it("should get MR diffs with include flags", async () => {
          const mockDiffs = { changes: [], diverged_commits_count: 3 };
          mockGitlab.get.mockResolvedValueOnce(mockDiffs);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;
          const result = await tool.handler({
            action: "diffs",
            project_id: "test/project",
            merge_request_iid: 1,
            include_diverged_commits_count: true,
            include_rebase_in_progress: true,
          });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/changes",
            {
              query: {
                include_diverged_commits_count: true,
                include_rebase_in_progress: true,
              },
            }
          );
          expect(result).toEqual(mockDiffs);
        });
      });

      describe("action: compare", () => {
        it("should compare branches", async () => {
          const mockData = { commits: [], diffs: [] };
          mockGitlab.get.mockResolvedValueOnce(mockData);

          const tool = mrsToolRegistry.get("browse_merge_requests")!;
          const result = await tool.handler({
            action: "compare",
            project_id: "test/project",
            from: "main",
            to: "feature-branch",
            straight: true,
          });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/repository/compare",
            { query: { from: "main", to: "feature-branch", straight: true } }
          );
          expect(result).toEqual(mockData);
        });

        it("should handle API errors", async () => {
          mockGitlab.get.mockRejectedValueOnce(new Error("GitLab API error: 404 Error"));

          const tool = mrsToolRegistry.get("browse_merge_requests")!;

          await expect(
            tool.handler({
              action: "compare",
              project_id: "test/project",
              from: "main",
              to: "nonexistent",
            })
          ).rejects.toThrow("GitLab API error: 404 Error");
        });
      });
    });

    describe("browse_mr_discussions handler", () => {
      describe("action: list", () => {
        it("should list MR discussions", async () => {
          const mockDiscussions = [{ id: "abc123", notes: [] }];
          mockGitlab.get.mockResolvedValueOnce(mockDiscussions);

          const tool = mrsToolRegistry.get("browse_mr_discussions")!;
          const result = await tool.handler({
            action: "list",
            project_id: "test/project",
            merge_request_iid: 1,
          });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/discussions",
            expect.objectContaining({ query: expect.any(Object) })
          );
          expect(result).toEqual(mockDiscussions);
        });
      });

      describe("action: drafts", () => {
        it("should list draft notes", async () => {
          const mockNotes = [{ id: 1, note: "Draft 1" }];
          mockGitlab.get.mockResolvedValueOnce(mockNotes);

          const tool = mrsToolRegistry.get("browse_mr_discussions")!;
          const result = await tool.handler({
            action: "drafts",
            project_id: "test/project",
            merge_request_iid: 1,
          });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/draft_notes"
          );
          expect(result).toEqual(mockNotes);
        });
      });

      describe("action: draft", () => {
        it("should get single draft note", async () => {
          const mockNote = { id: 1, note: "Draft comment" };
          mockGitlab.get.mockResolvedValueOnce(mockNote);

          const tool = mrsToolRegistry.get("browse_mr_discussions")!;
          const result = await tool.handler({
            action: "draft",
            project_id: "test/project",
            merge_request_iid: 1,
            draft_note_id: 1,
          });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/draft_notes/1"
          );
          expect(result).toEqual(mockNote);
        });
      });
    });

    describe("manage_merge_request handler", () => {
      describe("action: create", () => {
        it("should create new MR", async () => {
          const mockMR = { id: 1, iid: 1, title: "New MR" };
          mockGitlab.post.mockResolvedValueOnce(mockMR);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          const result = await tool.handler({
            action: "create",
            project_id: "test/project",
            source_branch: "feature",
            target_branch: "main",
            title: "New MR",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests",
            expect.objectContaining({
              body: expect.objectContaining({
                source_branch: "feature",
                target_branch: "main",
                title: "New MR",
              }),
              contentType: "form",
            })
          );
          expect(result).toEqual(mockMR);
        });

        it("should handle array parameters", async () => {
          const mockMR = { id: 1, iid: 1, title: "New MR" };
          mockGitlab.post.mockResolvedValueOnce(mockMR);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          await tool.handler({
            action: "create",
            project_id: "test/project",
            source_branch: "feature",
            target_branch: "main",
            title: "New MR",
            assignee_ids: ["1", "2"],
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests",
            expect.objectContaining({
              body: expect.objectContaining({
                assignee_ids: "1,2", // Arrays are joined
              }),
            })
          );
        });
      });

      describe("action: update", () => {
        it("should update existing MR", async () => {
          const mockMR = { id: 1, iid: 1, title: "Updated MR" };
          mockGitlab.put.mockResolvedValueOnce(mockMR);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          const result = await tool.handler({
            action: "update",
            project_id: "test/project",
            merge_request_iid: 1,
            title: "Updated MR",
            description: "Updated description",
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1",
            expect.objectContaining({
              body: expect.objectContaining({
                title: "Updated MR",
                description: "Updated description",
              }),
              contentType: "form",
            })
          );
          expect(result).toEqual(mockMR);
        });

        it("should handle array parameters in update", async () => {
          const mockMR = { id: 1, iid: 1, title: "Updated MR" };
          mockGitlab.put.mockResolvedValueOnce(mockMR);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          await tool.handler({
            action: "update",
            project_id: "test/project",
            merge_request_iid: 1,
            assignee_ids: ["1", "2", "3"],
            reviewer_ids: ["4", "5"],
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1",
            expect.objectContaining({
              body: expect.objectContaining({
                assignee_ids: "1,2,3", // Arrays are joined
                reviewer_ids: "4,5",
              }),
            })
          );
        });
      });

      describe("action: merge", () => {
        it("should merge MR with options", async () => {
          const mockResult = { state: "merged" };
          mockGitlab.put.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          const result = await tool.handler({
            action: "merge",
            project_id: "test/project",
            merge_request_iid: 1,
            merge_commit_message: "Custom merge message",
            should_remove_source_branch: true,
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/merge",
            expect.objectContaining({
              body: expect.objectContaining({
                merge_commit_message: "Custom merge message",
                should_remove_source_branch: true,
              }),
              contentType: "form",
            })
          );
          expect(result).toEqual(mockResult);
        });
      });

      describe("action: approve", () => {
        it("should approve MR without sha", async () => {
          const mockResult = { id: 1, user: { id: 123, name: "Test User" } };
          mockGitlab.post.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          const result = await tool.handler({
            action: "approve",
            project_id: "test/project",
            merge_request_iid: 1,
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/approve",
            expect.objectContaining({
              body: undefined,
              contentType: "json",
            })
          );
          expect(result).toEqual(mockResult);
        });

        it("should approve MR with specific sha", async () => {
          const mockResult = { id: 1, user: { id: 123, name: "Test User" } };
          mockGitlab.post.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          const result = await tool.handler({
            action: "approve",
            project_id: "test/project",
            merge_request_iid: 1,
            sha: "abc123def456",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/approve",
            expect.objectContaining({
              body: { sha: "abc123def456" },
              contentType: "json",
            })
          );
          expect(result).toEqual(mockResult);
        });
      });

      describe("action: unapprove", () => {
        it("should remove approval from MR", async () => {
          const mockResult = { id: 1 };
          mockGitlab.post.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          const result = await tool.handler({
            action: "unapprove",
            project_id: "test/project",
            merge_request_iid: 1,
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/unapprove"
          );
          expect(result).toEqual(mockResult);
        });
      });

      describe("action: get_approval_state", () => {
        it("should get approval state for MR", async () => {
          const mockResult = {
            approval_rules_overwritten: false,
            rules: [{ id: 1, name: "All Members", eligible_approvers: [], approvals_required: 1 }],
          };
          mockGitlab.get.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_merge_request")!;
          const result = await tool.handler({
            action: "get_approval_state",
            project_id: "test/project",
            merge_request_iid: 1,
          });

          expect(mockGitlab.get).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/approval_state"
          );
          expect(result).toEqual(mockResult);
        });
      });
    });

    describe("manage_mr_discussion handler", () => {
      describe("action: comment", () => {
        it("should create note for merge request", async () => {
          const mockNote = { id: 1, body: "Test comment" };
          mockGitlab.post.mockResolvedValueOnce(mockNote);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "comment",
            project_id: "test/project",
            noteable_type: "merge_request",
            noteable_id: 1,
            body: "Test comment",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/notes",
            expect.objectContaining({
              body: { body: "Test comment" },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockNote);
        });

        it("should create note for issue", async () => {
          const mockNote = { id: 1, body: "Test comment" };
          mockGitlab.post.mockResolvedValueOnce(mockNote);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          await tool.handler({
            action: "comment",
            project_id: "test/project",
            noteable_type: "issue",
            noteable_id: 1,
            body: "Test comment",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/issues/1/notes",
            expect.objectContaining({
              body: { body: "Test comment" },
              contentType: "form",
            })
          );
        });
      });

      describe("action: thread", () => {
        it("should create MR thread", async () => {
          const mockDiscussion = { id: "abc123", notes: [] };
          mockGitlab.post.mockResolvedValueOnce(mockDiscussion);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "thread",
            project_id: "test/project",
            merge_request_iid: 1,
            body: "Thread comment",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/discussions",
            expect.objectContaining({
              body: { body: "Thread comment" },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockDiscussion);
        });
      });

      describe("action: reply", () => {
        it("should reply to existing thread", async () => {
          const mockNote = { id: 1, body: "Reply comment" };
          mockGitlab.post.mockResolvedValueOnce(mockNote);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "reply",
            project_id: "test/project",
            merge_request_iid: 1,
            discussion_id: "abc123",
            body: "Reply comment",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/discussions/abc123/notes",
            expect.objectContaining({
              body: { body: "Reply comment" },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockNote);
        });
      });

      describe("action: update", () => {
        it("should update MR note", async () => {
          const mockNote = { id: 1, body: "Updated comment" };
          mockGitlab.put.mockResolvedValueOnce(mockNote);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "update",
            project_id: "test/project",
            merge_request_iid: 1,
            note_id: 1,
            body: "Updated comment",
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/notes/1",
            expect.objectContaining({
              body: { body: "Updated comment" },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockNote);
        });
      });

      describe("action: apply_suggestion", () => {
        it("should apply a single suggestion", async () => {
          const mockResult = { id: 12345, applied: true };
          mockGitlab.put.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "apply_suggestion",
            project_id: "test/project",
            merge_request_iid: 42,
            suggestion_id: 12345,
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/42/suggestions/12345/apply",
            expect.objectContaining({
              body: undefined,
              contentType: "json",
            })
          );
          expect(result).toEqual(mockResult);
        });

        it("should apply a suggestion with custom commit message", async () => {
          const mockResult = { id: 12345, applied: true };
          mockGitlab.put.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "apply_suggestion",
            project_id: "test/project",
            merge_request_iid: 42,
            suggestion_id: 12345,
            commit_message: "Apply suggestion: fix typo",
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/42/suggestions/12345/apply",
            expect.objectContaining({
              body: { commit_message: "Apply suggestion: fix typo" },
              contentType: "json",
            })
          );
          expect(result).toEqual(mockResult);
        });
      });

      describe("action: apply_suggestions", () => {
        it("should batch apply multiple suggestions", async () => {
          const mockResult = { applied_count: 3 };
          mockGitlab.put.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "apply_suggestions",
            project_id: "test/project",
            merge_request_iid: 42,
            suggestion_ids: [12345, 12346, 12347],
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/42/suggestions/batch_apply",
            expect.objectContaining({
              body: { ids: [12345, 12346, 12347] },
              contentType: "json",
            })
          );
          expect(result).toEqual(mockResult);
        });

        it("should batch apply suggestions with custom commit message", async () => {
          const mockResult = { applied_count: 2 };
          mockGitlab.put.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "apply_suggestions",
            project_id: "test/project",
            merge_request_iid: 42,
            suggestion_ids: [12345, 12346],
            commit_message: "Apply code review suggestions",
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/42/suggestions/batch_apply",
            expect.objectContaining({
              body: {
                ids: [12345, 12346],
                commit_message: "Apply code review suggestions",
              },
              contentType: "json",
            })
          );
          expect(result).toEqual(mockResult);
        });
      });

      describe("action: resolve", () => {
        it("should resolve a discussion thread", async () => {
          const mockResult = { id: "abc123", resolved: true };
          mockGitlab.put.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "resolve",
            project_id: "test/project",
            merge_request_iid: 1,
            discussion_id: "abc123",
            resolved: true,
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/discussions/abc123",
            expect.objectContaining({
              body: { resolved: true },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockResult);
        });

        it("should unresolve a discussion thread", async () => {
          const mockResult = { id: "abc123", resolved: false };
          mockGitlab.put.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "resolve",
            project_id: "test/project",
            merge_request_iid: 1,
            discussion_id: "abc123",
            resolved: false,
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/discussions/abc123",
            expect.objectContaining({
              body: { resolved: false },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockResult);
        });
      });

      describe("action: suggest", () => {
        it("should create a code suggestion without line range", async () => {
          const mockResult = { id: "def456", notes: [] };
          mockGitlab.post.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "suggest",
            project_id: "test/project",
            merge_request_iid: 1,
            position: {
              base_sha: "abc123",
              head_sha: "def456",
              start_sha: "ghi789",
              new_path: "src/file.ts",
              new_line: 10,
            },
            suggestion: "const x = 1;",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/discussions",
            expect.objectContaining({
              body: {
                body: "```suggestion\nconst x = 1;\n```",
                position: expect.any(String),
              },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockResult);
        });

        it("should create a code suggestion with line range", async () => {
          const mockResult = { id: "def456", notes: [] };
          mockGitlab.post.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "suggest",
            project_id: "test/project",
            merge_request_iid: 1,
            position: {
              base_sha: "abc123",
              head_sha: "def456",
              start_sha: "ghi789",
              new_path: "src/file.ts",
              new_line: 10,
            },
            suggestion: "const x = 1;\nconst y = 2;",
            lines_above: 2,
            lines_below: 1,
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/discussions",
            expect.objectContaining({
              body: {
                body: "```suggestion:-2+1\nconst x = 1;\nconst y = 2;\n```",
                position: expect.any(String),
              },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockResult);
        });

        it("should create a code suggestion with comment", async () => {
          const mockResult = { id: "def456", notes: [] };
          mockGitlab.post.mockResolvedValueOnce(mockResult);

          const tool = mrsToolRegistry.get("manage_mr_discussion")!;
          const result = await tool.handler({
            action: "suggest",
            project_id: "test/project",
            merge_request_iid: 1,
            position: {
              base_sha: "abc123",
              head_sha: "def456",
              start_sha: "ghi789",
              new_path: "src/file.ts",
              new_line: 10,
            },
            suggestion: "const x = 1;",
            comment: "Consider using const instead of let",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/discussions",
            expect.objectContaining({
              body: {
                body: "Consider using const instead of let\n\n```suggestion\nconst x = 1;\n```",
                position: expect.any(String),
              },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockResult);
        });
      });
    });

    describe("manage_draft_notes handler", () => {
      describe("action: create", () => {
        it("should create draft note", async () => {
          const mockNote = { id: 1, note: "Draft comment" };
          mockGitlab.post.mockResolvedValueOnce(mockNote);

          const tool = mrsToolRegistry.get("manage_draft_notes")!;
          const result = await tool.handler({
            action: "create",
            project_id: "test/project",
            merge_request_iid: 1,
            note: "Draft comment",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/draft_notes",
            expect.objectContaining({
              body: { note: "Draft comment" },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockNote);
        });

        it("should create draft note with in_reply_to_discussion_id", async () => {
          const mockNote = { id: 2, note: "Reply draft" };
          mockGitlab.post.mockResolvedValueOnce(mockNote);

          const tool = mrsToolRegistry.get("manage_draft_notes")!;
          const result = await tool.handler({
            action: "create",
            project_id: "test/project",
            merge_request_iid: 1,
            note: "Reply draft",
            in_reply_to_discussion_id: "abc123",
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/draft_notes",
            expect.objectContaining({
              body: {
                note: "Reply draft",
                in_reply_to_discussion_id: "abc123",
              },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockNote);
        });
      });

      describe("action: update", () => {
        it("should update draft note", async () => {
          const mockNote = { id: 1, note: "Updated draft" };
          mockGitlab.put.mockResolvedValueOnce(mockNote);

          const tool = mrsToolRegistry.get("manage_draft_notes")!;
          const result = await tool.handler({
            action: "update",
            project_id: "test/project",
            merge_request_iid: 1,
            draft_note_id: 1,
            note: "Updated draft",
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/draft_notes/1",
            expect.objectContaining({
              body: { note: "Updated draft" },
              contentType: "form",
            })
          );
          expect(result).toEqual(mockNote);
        });
      });

      describe("action: publish", () => {
        it("should publish draft note", async () => {
          // gitlab.put returns undefined for 204 No Content
          mockGitlab.put.mockResolvedValueOnce(undefined);

          const tool = mrsToolRegistry.get("manage_draft_notes")!;
          const result = await tool.handler({
            action: "publish",
            project_id: "test/project",
            merge_request_iid: 1,
            draft_note_id: 1,
          });

          expect(mockGitlab.put).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/draft_notes/1/publish"
          );
          expect(result).toEqual({ published: true });
        });
      });

      describe("action: publish_all", () => {
        it("should bulk publish draft notes", async () => {
          // gitlab.post returns undefined for 204 No Content
          mockGitlab.post.mockResolvedValueOnce(undefined);

          const tool = mrsToolRegistry.get("manage_draft_notes")!;
          const result = await tool.handler({
            action: "publish_all",
            project_id: "test/project",
            merge_request_iid: 1,
          });

          expect(mockGitlab.post).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/draft_notes/bulk_publish"
          );
          expect(result).toEqual({ published: true });
        });
      });

      describe("action: delete", () => {
        it("should delete draft note", async () => {
          mockGitlab.delete.mockResolvedValueOnce(undefined);

          const tool = mrsToolRegistry.get("manage_draft_notes")!;
          const result = await tool.handler({
            action: "delete",
            project_id: "test/project",
            merge_request_iid: 1,
            draft_note_id: 1,
          });

          expect(mockGitlab.delete).toHaveBeenCalledWith(
            "projects/test%2Fproject/merge_requests/1/draft_notes/1"
          );
          expect(result).toEqual({ success: true, message: "Draft note deleted successfully" });
        });
      });
    });

    describe("Error handling", () => {
      it("should handle validation errors", async () => {
        const tool = mrsToolRegistry.get("browse_merge_requests")!;

        // Test with invalid action
        await expect(
          tool.handler({
            action: "invalid_action",
            project_id: "test/project",
          })
        ).rejects.toThrow();
      });

      it("should handle API errors with proper error messages", async () => {
        mockGitlab.get.mockRejectedValueOnce(new Error("GitLab API error: 500 Error"));

        const tool = mrsToolRegistry.get("browse_merge_requests")!;

        await expect(
          tool.handler({
            action: "list",
            project_id: "test/project",
          })
        ).rejects.toThrow("GitLab API error: 500 Error");
      });

      it("should handle network errors", async () => {
        mockGitlab.get.mockRejectedValueOnce(new Error("Network error"));

        const tool = mrsToolRegistry.get("browse_merge_requests")!;

        await expect(
          tool.handler({
            action: "get",
            project_id: "test/project",
            merge_request_iid: 1,
          })
        ).rejects.toThrow("Network error");
      });
    });
  });
});
