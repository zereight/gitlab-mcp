import {
  pipelinesToolRegistry,
  getPipelinesReadOnlyToolNames,
  getPipelinesToolDefinitions,
  getFilteredPipelinesTools,
} from "../../../../src/entities/pipelines/registry";
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
    GITLAB_API_URL: "https://gitlab.example.com",
    GITLAB_TOKEN: "test-token-12345",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  mockEnhancedFetch.mockReset();
});

describe("Pipelines Registry - CQRS Tools", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(pipelinesToolRegistry instanceof Map).toBe(true);
    });

    it("should contain exactly 3 CQRS tools", () => {
      const toolNames = Array.from(pipelinesToolRegistry.keys());

      expect(toolNames).toContain("browse_pipelines");
      expect(toolNames).toContain("manage_pipeline");
      expect(toolNames).toContain("manage_pipeline_job");
      expect(pipelinesToolRegistry.size).toBe(3);
    });

    it("should have tools with valid structure", () => {
      for (const [toolName, tool] of pipelinesToolRegistry) {
        expect(tool).toHaveProperty("name", toolName);
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.handler).toBe("function");
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });

    it("should have unique tool names", () => {
      const toolNames = Array.from(pipelinesToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper browse_pipelines tool", () => {
      const tool = pipelinesToolRegistry.get("browse_pipelines");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_pipelines");
      expect(tool?.description).toContain("BROWSE pipelines");
      expect(tool?.description).toContain("list");
      expect(tool?.description).toContain("get");
      expect(tool?.description).toContain("jobs");
      expect(tool?.description).toContain("triggers");
      expect(tool?.description).toContain("logs");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_pipeline tool", () => {
      const tool = pipelinesToolRegistry.get("manage_pipeline");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_pipeline");
      expect(tool?.description).toContain("MANAGE pipelines");
      expect(tool?.description).toContain("create");
      expect(tool?.description).toContain("retry");
      expect(tool?.description).toContain("cancel");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_pipeline_job tool", () => {
      const tool = pipelinesToolRegistry.get("manage_pipeline_job");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_pipeline_job");
      expect(tool?.description).toContain("MANAGE pipeline jobs");
      expect(tool?.description).toContain("play");
      expect(tool?.description).toContain("retry");
      expect(tool?.description).toContain("cancel");
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include only browse_pipelines as read-only", () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();

      expect(readOnlyTools).toContain("browse_pipelines");
      expect(readOnlyTools).toEqual(["browse_pipelines"]);
    });

    it("should not include manage tools (write tools)", () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();

      expect(readOnlyTools).not.toContain("manage_pipeline");
      expect(readOnlyTools).not.toContain("manage_pipeline_job");
    });

    it("should return exactly 1 read-only tool", () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(1);
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();
      const registryKeys = Array.from(pipelinesToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe("Pipelines Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const definitions = getPipelinesToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(pipelinesToolRegistry.size);
    });

    it("should return all 3 CQRS tools from registry", () => {
      const definitions = getPipelinesToolDefinitions();

      expect(definitions.length).toBe(3);
    });

    it("should return tool definitions with proper structure", () => {
      const definitions = getPipelinesToolDefinitions();

      for (const definition of definitions) {
        expect(definition).toHaveProperty("name");
        expect(definition).toHaveProperty("description");
        expect(definition).toHaveProperty("inputSchema");
        expect(definition).toHaveProperty("handler");
      }
    });
  });

  describe("Filtered Pipelines Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const allTools = getFilteredPipelinesTools(false);
      const allDefinitions = getPipelinesToolDefinitions();

      expect(allTools.length).toBe(allDefinitions.length);
      expect(allTools.length).toBe(3);
    });

    it("should return only read-only tools in read-only mode", () => {
      const readOnlyTools = getFilteredPipelinesTools(true);
      const readOnlyNames = getPipelinesReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(readOnlyTools.length).toBe(1);
    });

    it("should filter tools correctly in read-only mode", () => {
      const readOnlyTools = getFilteredPipelinesTools(true);
      const readOnlyNames = getPipelinesReadOnlyToolNames();

      for (const tool of readOnlyTools) {
        expect(readOnlyNames).toContain(tool.name);
      }
    });

    it("should not include manage tools in read-only mode", () => {
      const readOnlyTools = getFilteredPipelinesTools(true);

      for (const tool of readOnlyTools) {
        expect(tool.name).not.toBe("manage_pipeline");
        expect(tool.name).not.toBe("manage_pipeline_job");
      }
    });
  });

  describe("Tool Handlers", () => {
    it("should have handlers that are async functions", () => {
      for (const [, tool] of pipelinesToolRegistry) {
        expect(tool.handler.constructor.name).toBe("AsyncFunction");
      }
    });

    it("should have handlers that accept arguments", () => {
      for (const [, tool] of pipelinesToolRegistry) {
        expect(tool.handler.length).toBe(1);
      }
    });
  });

  describe("Registry Consistency", () => {
    it("should have all expected CQRS tools", () => {
      const expectedTools = ["browse_pipelines", "manage_pipeline", "manage_pipeline_job"];

      for (const toolName of expectedTools) {
        expect(pipelinesToolRegistry.has(toolName)).toBe(true);
      }
    });

    it("should have consistent tool count between functions", () => {
      const allDefinitions = getPipelinesToolDefinitions();
      const readOnlyNames = getPipelinesReadOnlyToolNames();
      const readOnlyTools = getFilteredPipelinesTools(true);

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(allDefinitions.length).toBe(pipelinesToolRegistry.size);
      expect(allDefinitions.length).toBeGreaterThan(readOnlyNames.length);
    });

    it("should have more tools than just read-only ones", () => {
      const totalTools = pipelinesToolRegistry.size;
      const readOnlyCount = getPipelinesReadOnlyToolNames().length;

      expect(totalTools).toBeGreaterThan(readOnlyCount);
      expect(totalTools).toBe(3);
      expect(readOnlyCount).toBe(1);
    });
  });

  describe("Tool Input Schemas", () => {
    it("should have valid JSON schema structure for all tools", () => {
      for (const [, tool] of pipelinesToolRegistry) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
        // CQRS tools use discriminated unions which produce "anyOf" in JSON schema
        const schema = tool.inputSchema;
        const hasValidStructure = "type" in schema || "anyOf" in schema || "oneOf" in schema;
        expect(hasValidStructure).toBe(true);
      }
    });

    it("should have consistent schema format", () => {
      for (const [toolName, tool] of pipelinesToolRegistry) {
        expect(tool.inputSchema).toBeDefined();

        if (typeof tool.inputSchema === "object" && tool.inputSchema !== null) {
          const schema = tool.inputSchema;
          const hasValidStructure = "type" in schema || "anyOf" in schema || "oneOf" in schema;
          expect(hasValidStructure).toBe(true);
        } else {
          throw new Error(`Tool ${toolName} has invalid inputSchema type`);
        }
      }
    });
  });

  describe("Handler Tests", () => {
    const mockResponse = (data: unknown, ok = true, status = 200) => ({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      json: jest.fn().mockResolvedValue(data),
      text: jest.fn().mockResolvedValue(typeof data === "string" ? data : JSON.stringify(data)),
    });

    describe("browse_pipelines handler - list action", () => {
      it("should list pipelines with basic parameters", async () => {
        const mockPipelines = [
          { id: 1, status: "success", ref: "main", sha: "abc123" },
          { id: 2, status: "running", ref: "feature-branch", sha: "def456" },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipelines) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = await tool.handler({
          action: "list",
          project_id: "test/project",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining(
            "https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines"
          )
        );
        expect(result).toEqual(mockPipelines);
      });

      it("should list pipelines with filtering options", async () => {
        const mockPipelines = [{ id: 1, status: "success", ref: "main" }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipelines) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        await tool.handler({
          action: "list",
          project_id: "test/project",
          status: "success",
          ref: "main",
          per_page: 50,
          page: 1,
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const url = call[0];
        expect(url).toContain("status=success");
        expect(url).toContain("ref=main");
        expect(url).toContain("per_page=50");
        expect(url).toContain("page=1");
      });

      it("should handle API errors", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;

        await expect(
          tool.handler({
            action: "list",
            project_id: "nonexistent/project",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("browse_pipelines handler - get action", () => {
      it("should get pipeline by ID", async () => {
        const mockPipeline = {
          id: 1,
          iid: 1,
          status: "success",
          ref: "main",
          sha: "abc123",
          web_url: "https://gitlab.example.com/test/project/-/pipelines/1",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = await tool.handler({
          action: "get",
          project_id: "test/project",
          pipeline_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1"
        );
        expect(result).toEqual(mockPipeline);
      });

      it("should handle pipeline not found", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;

        await expect(
          tool.handler({
            action: "get",
            project_id: "test/project",
            pipeline_id: "999",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("browse_pipelines handler - jobs action", () => {
      it("should list jobs in pipeline", async () => {
        const mockJobs = [
          { id: 1, name: "build", status: "success", stage: "build" },
          { id: 2, name: "test", status: "failed", stage: "test" },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJobs) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = await tool.handler({
          action: "jobs",
          project_id: "test/project",
          pipeline_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining(
            "https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1/jobs"
          )
        );
        expect(result).toEqual(mockJobs);
      });

      it("should list jobs with scope filter", async () => {
        const mockJobs = [{ id: 1, name: "build", status: "failed" }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJobs) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        await tool.handler({
          action: "jobs",
          project_id: "test/project",
          pipeline_id: "1",
          job_scope: ["failed"],
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const url = call[0];
        expect(url).toContain("scope=failed");
      });
    });

    describe("browse_pipelines handler - triggers action", () => {
      it("should list trigger jobs (bridges)", async () => {
        const mockBridges = [
          { id: 1, name: "trigger-downstream", status: "success", downstream_pipeline: { id: 2 } },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockBridges) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = await tool.handler({
          action: "triggers",
          project_id: "test/project",
          pipeline_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining(
            "https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1/bridges"
          )
        );
        expect(result).toEqual(mockBridges);
      });
    });

    describe("browse_pipelines handler - job action", () => {
      it("should get job details", async () => {
        const mockJob = {
          id: 1,
          name: "build",
          status: "success",
          stage: "build",
          pipeline: { id: 1 },
          web_url: "https://gitlab.example.com/test/project/-/jobs/1",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = await tool.handler({
          action: "job",
          project_id: "test/project",
          job_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1"
        );
        expect(result).toEqual(mockJob);
      });
    });

    describe("browse_pipelines handler - logs action", () => {
      it("should get job trace without limit", async () => {
        const mockTrace = "Running build...\nBuild successful\nTests passed";
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          text: jest.fn().mockResolvedValue(mockTrace),
        } as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = await tool.handler({
          action: "logs",
          project_id: "test/project",
          job_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/trace"
        );
        expect(result).toEqual({ trace: mockTrace, totalLines: 3, shownLines: 3 });
      });

      it("should default to 200 lines when no limit specified", async () => {
        const lines = Array.from({ length: 300 }, (_, i) => `Line ${i + 1}: Some output here`);
        const longTrace = lines.join("\n");

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          text: jest.fn().mockResolvedValue(longTrace),
        } as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = (await tool.handler({
          action: "logs",
          project_id: "test/project",
          job_id: "1",
        })) as { trace: string; totalLines: number; shownLines: number };

        expect(result).toHaveProperty("trace");
        expect(result).toHaveProperty("totalLines", 300);
        expect(result).toHaveProperty("shownLines", 200);

        const trace = result.trace;
        const traceLines = trace.split("\n");

        expect(traceLines).toHaveLength(201);
        expect(trace).toContain("100 lines hidden");
        expect(trace).toContain("Showing last 200 of 300 lines");
        expect(trace).toContain("Line 101: Some output here");
        expect(trace).toContain("Line 300: Some output here");
        expect(trace).not.toContain("Line 100: Some output here");
      });

      it("should truncate long job trace when limit is provided", async () => {
        const longTrace = Array(1000).fill("Very long line with lots of content here").join("\n");
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          text: jest.fn().mockResolvedValue(longTrace),
        } as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = (await tool.handler({
          action: "logs",
          project_id: "test/project",
          job_id: "1",
          limit: 50,
        })) as { trace: string; totalLines: number; shownLines: number };

        expect(result).toHaveProperty("trace");
        expect(result.trace).toContain("lines hidden");
        expect(result.trace.length).toBeLessThan(longTrace.length);
        expect(result.totalLines).toBe(1000);
        expect(result.shownLines).toBe(50);
      });

      it("should handle start + limit combination correctly", async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1} content`);
        const fullTrace = lines.join("\n");

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          text: jest.fn().mockResolvedValue(fullTrace),
        } as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = (await tool.handler({
          action: "logs",
          project_id: "test/project",
          job_id: "1",
          start: 50,
          limit: 10,
        })) as { trace: string; totalLines: number; shownLines: number };

        const trace = result.trace;
        const traceLines = trace.split("\n");

        expect(traceLines).toHaveLength(11);
        expect(trace).toContain("Line 51 content");
        expect(trace).toContain("Line 60 content");
        expect(trace).not.toContain("Line 61 content");
        expect(result.totalLines).toBe(100);
        expect(result.shownLines).toBe(10);
      });

      it("should handle negative start correctly", async () => {
        const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1} content`);
        const fullTrace = lines.join("\n");

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          text: jest.fn().mockResolvedValue(fullTrace),
        } as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = (await tool.handler({
          action: "logs",
          project_id: "test/project",
          job_id: "1",
          start: -50,
          max_lines: 30,
        })) as { trace: string; totalLines: number; shownLines: number };

        const trace = result.trace;

        expect(trace).toContain("Line 171 content");
        expect(trace).toContain("Line 200 content");
        expect(trace).not.toContain("Line 170 content");
        expect(result.totalLines).toBe(200);
        expect(result.shownLines).toBe(30);
      });

      it("should handle out of bounds start position", async () => {
        const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1} content`);
        const fullTrace = lines.join("\n");

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          text: jest.fn().mockResolvedValue(fullTrace),
        } as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = (await tool.handler({
          action: "logs",
          project_id: "test/project",
          job_id: "1",
          start: 100,
          limit: 10,
        })) as { trace: string; totalLines: number; shownLines: number };

        expect(result.trace).toContain("OUT OF BOUNDS");
        expect(result.totalLines).toBe(50);
        expect(result.shownLines).toBe(0);
      });

      // Test for line 89: error handling when fetch returns non-ok response
      it("should throw error when API returns non-ok response", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;

        await expect(
          tool.handler({
            action: "logs",
            project_id: "test/project",
            job_id: "999",
          })
        ).rejects.toThrow("GitLab API error: 404 Not Found");
      });

      // Test for lines 120-121: partial request message when start + max_lines exceeds total
      it("should show partial request message when requested range exceeds available lines", async () => {
        const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1} content`);
        const fullTrace = lines.join("\n");

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          text: jest.fn().mockResolvedValue(fullTrace),
        } as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;
        const result = (await tool.handler({
          action: "logs",
          project_id: "test/project",
          job_id: "1",
          start: 40,
          max_lines: 20,
        })) as { trace: string; totalLines: number; shownLines: number };

        // start=40, max_lines=20 means requesting lines 40-59, but only 40-49 exist
        expect(result.trace).toContain("PARTIAL REQUEST");
        expect(result.trace).toContain("Requested 20 lines from position 40");
        expect(result.trace).toContain("only 10 lines available");
        expect(result.totalLines).toBe(50);
        expect(result.shownLines).toBe(10);
      });
    });

    describe("manage_pipeline handler - create action", () => {
      it("should create pipeline for branch", async () => {
        const mockPipeline = {
          id: 3,
          iid: 3,
          status: "pending",
          ref: "main",
          sha: "new123",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;
        const result = await tool.handler({
          action: "create",
          project_id: "test/project",
          ref: "main",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/pipeline?ref=main",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: "{}",
          }
        );
        expect(result).toEqual(mockPipeline);
      });

      it("should create pipeline with variables", async () => {
        const mockPipeline = { id: 4, status: "pending", ref: "feature" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;
        await tool.handler({
          action: "create",
          project_id: "test/project",
          ref: "feature",
          variables: [
            { key: "BUILD_TYPE", value: "release" },
            { key: "DEPLOY", value: "true" },
          ],
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.variables).toEqual([
          { key: "BUILD_TYPE", value: "release" },
          { key: "DEPLOY", value: "true" },
        ]);
      });

      it("should handle detailed API errors", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: jest.fn().mockResolvedValue({
            message: { ref: ["is invalid"] },
          }),
        } as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;

        await expect(
          tool.handler({
            action: "create",
            project_id: "test/project",
            ref: "invalid-ref",
          })
        ).rejects.toThrow("ref: is invalid");
      });

      // Test for line 197: string error message
      it("should handle string error message", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: jest.fn().mockResolvedValue({
            message: "Reference not found",
          }),
        } as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;

        await expect(
          tool.handler({
            action: "create",
            project_id: "test/project",
            ref: "nonexistent-branch",
          })
        ).rejects.toThrow("Reference not found");
      });

      // Test for line 207: non-array value in message object
      it("should handle non-array values in message object", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: jest.fn().mockResolvedValue({
            message: { ref: "invalid ref format", branch: "does not exist" },
          }),
        } as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;

        await expect(
          tool.handler({
            action: "create",
            project_id: "test/project",
            ref: "bad/ref",
          })
        ).rejects.toThrow("ref: invalid ref format");
      });

      // Test for line 217: errorBody.error string
      it("should handle error string field", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          json: jest.fn().mockResolvedValue({
            error: "insufficient_scope",
          }),
        } as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;

        await expect(
          tool.handler({
            action: "create",
            project_id: "test/project",
            ref: "main",
          })
        ).rejects.toThrow("insufficient_scope");
      });

      // Test for line 220: errorBody.errors array
      it("should handle errors array field", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          json: jest.fn().mockResolvedValue({
            errors: ["Variable key is required", "Variable value cannot be empty"],
          }),
        } as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;

        await expect(
          tool.handler({
            action: "create",
            project_id: "test/project",
            ref: "main",
            variables: [{ key: "", value: "" }],
          })
        ).rejects.toThrow("Variable key is required, Variable value cannot be empty");
      });

      // Test for line 228: catch block when JSON parsing fails
      it("should handle non-JSON error response", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
        } as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;

        await expect(
          tool.handler({
            action: "create",
            project_id: "test/project",
            ref: "main",
          })
        ).rejects.toThrow("GitLab API error: 500 Internal Server Error");
      });
    });

    describe("manage_pipeline handler - retry action", () => {
      it("should retry failed pipeline", async () => {
        const mockPipeline = {
          id: 1,
          status: "running",
          ref: "main",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;
        const result = await tool.handler({
          action: "retry",
          project_id: "test/project",
          pipeline_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1/retry",
          {
            method: "POST",
          }
        );
        expect(result).toEqual(mockPipeline);
      });
    });

    describe("manage_pipeline handler - cancel action", () => {
      it("should cancel running pipeline", async () => {
        const mockPipeline = {
          id: 1,
          status: "canceled",
          ref: "main",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;
        const result = await tool.handler({
          action: "cancel",
          project_id: "test/project",
          pipeline_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1/cancel",
          {
            method: "POST",
          }
        );
        expect(result).toEqual(mockPipeline);
      });
    });

    describe("manage_pipeline_job handler - play action", () => {
      it("should play manual job", async () => {
        const mockJob = {
          id: 1,
          name: "deploy",
          status: "running",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline_job")!;
        const result = await tool.handler({
          action: "play",
          project_id: "test/project",
          job_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/play",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: "{}",
          }
        );
        expect(result).toEqual(mockJob);
      });

      it("should play job with job variables", async () => {
        const mockJob = { id: 1, name: "deploy", status: "running" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline_job")!;
        await tool.handler({
          action: "play",
          project_id: "test/project",
          job_id: "1",
          job_variables_attributes: [{ key: "ENVIRONMENT", value: "production" }],
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.job_variables_attributes).toEqual([
          { key: "ENVIRONMENT", value: "production" },
        ]);
      });
    });

    describe("manage_pipeline_job handler - retry action", () => {
      it("should retry failed job", async () => {
        const mockJob = {
          id: 1,
          name: "test",
          status: "running",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline_job")!;
        const result = await tool.handler({
          action: "retry",
          project_id: "test/project",
          job_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/retry",
          {
            method: "POST",
          }
        );
        expect(result).toEqual(mockJob);
      });
    });

    describe("manage_pipeline_job handler - cancel action", () => {
      it("should cancel running job", async () => {
        const mockJob = {
          id: 1,
          name: "build",
          status: "canceled",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline_job")!;
        const result = await tool.handler({
          action: "cancel",
          project_id: "test/project",
          job_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/cancel",
          {
            method: "POST",
          }
        );
        expect(result).toEqual(mockJob);
      });

      it("should cancel job with force option", async () => {
        const mockJob = { id: 1, name: "build", status: "canceled" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as never);

        const tool = pipelinesToolRegistry.get("manage_pipeline_job")!;
        await tool.handler({
          action: "cancel",
          project_id: "test/project",
          job_id: "1",
          force: true,
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/cancel?force=true",
          {
            method: "POST",
          }
        );
      });
    });

    describe("Error Handling", () => {
      it("should handle schema validation errors for browse_pipelines", async () => {
        const tool = pipelinesToolRegistry.get("browse_pipelines")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", project_id: "test" })).rejects.toThrow();

        // Missing project_id for list
        await expect(tool.handler({ action: "list" })).rejects.toThrow();

        // Missing pipeline_id for get
        await expect(tool.handler({ action: "get", project_id: "test" })).rejects.toThrow();

        // Missing job_id for job
        await expect(tool.handler({ action: "job", project_id: "test" })).rejects.toThrow();
      });

      it("should handle schema validation errors for manage_pipeline", async () => {
        const tool = pipelinesToolRegistry.get("manage_pipeline")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", project_id: "test" })).rejects.toThrow();

        // Missing ref for create
        await expect(tool.handler({ action: "create", project_id: "test" })).rejects.toThrow();

        // Missing pipeline_id for retry
        await expect(tool.handler({ action: "retry", project_id: "test" })).rejects.toThrow();
      });

      it("should handle schema validation errors for manage_pipeline_job", async () => {
        const tool = pipelinesToolRegistry.get("manage_pipeline_job")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", job_id: "1" })).rejects.toThrow();

        // Missing job_id for play
        await expect(tool.handler({ action: "play", project_id: "test" })).rejects.toThrow();
      });

      it("should handle network errors", async () => {
        mockEnhancedFetch.mockRejectedValueOnce(new Error("Connection timeout"));

        const tool = pipelinesToolRegistry.get("manage_pipeline")!;

        await expect(
          tool.handler({
            action: "create",
            project_id: "test/project",
            ref: "main",
          })
        ).rejects.toThrow("Connection timeout");
      });

      it("should handle API errors with proper error messages", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 403) as never);

        const tool = pipelinesToolRegistry.get("browse_pipelines")!;

        await expect(
          tool.handler({
            action: "list",
            project_id: "private/project",
          })
        ).rejects.toThrow("GitLab API error: 403 Error");
      });
    });
  });
});
