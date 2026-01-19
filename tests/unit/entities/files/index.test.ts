/**
 * Tests for files entity index.ts exports
 *
 * Tests the conditional exports based on GITLAB_READONLY environment variable
 * and verifies backward compatibility exports.
 */

describe("Files Index Exports", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Default Mode (GITLAB_READONLY not set)", () => {
    it("should export filesTools array", async () => {
      delete process.env.GITLAB_READONLY;

      const { filesTools } = await import("../../../../src/entities/files/index");

      expect(Array.isArray(filesTools)).toBe(true);
      expect(filesTools.length).toBe(2);
    });

    it("should export filesReadOnlyTools array", async () => {
      delete process.env.GITLAB_READONLY;

      const { filesReadOnlyTools } = await import("../../../../src/entities/files/index");

      expect(Array.isArray(filesReadOnlyTools)).toBe(true);
      expect(filesReadOnlyTools).toContain("browse_files");
    });

    it("should include both browse_files and manage_files tools", async () => {
      delete process.env.GITLAB_READONLY;

      const { filesTools } = await import("../../../../src/entities/files/index");

      const toolNames = filesTools.map(t => t.name);
      expect(toolNames).toContain("browse_files");
      expect(toolNames).toContain("manage_files");
    });

    it("should have tools with valid ToolDefinition structure", async () => {
      delete process.env.GITLAB_READONLY;

      const { filesTools } = await import("../../../../src/entities/files/index");

      for (const tool of filesTools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(tool.inputSchema).toBeDefined();
      }
    });
  });

  describe("Read-Only Mode (GITLAB_READONLY=true)", () => {
    it("should export only read-only tools when GITLAB_READONLY is true", async () => {
      process.env.GITLAB_READONLY = "true";

      const { filesTools } = await import("../../../../src/entities/files/index");

      expect(filesTools.length).toBe(1);
      expect(filesTools[0].name).toBe("browse_files");
    });

    it("should not include manage_files in read-only mode", async () => {
      process.env.GITLAB_READONLY = "true";

      const { filesTools } = await import("../../../../src/entities/files/index");

      const toolNames = filesTools.map(t => t.name);
      expect(toolNames).not.toContain("manage_files");
    });
  });

  describe("Read-Write Mode (GITLAB_READONLY=false)", () => {
    it("should export all tools when GITLAB_READONLY is false", async () => {
      process.env.GITLAB_READONLY = "false";

      const { filesTools } = await import("../../../../src/entities/files/index");

      expect(filesTools.length).toBe(2);
      const toolNames = filesTools.map(t => t.name);
      expect(toolNames).toContain("browse_files");
      expect(toolNames).toContain("manage_files");
    });
  });

  describe("Schema Re-exports", () => {
    it("should re-export BrowseFilesSchema from schema-readonly", async () => {
      const { BrowseFilesSchema } = await import("../../../../src/entities/files/index");
      expect(BrowseFilesSchema).toBeDefined();
    });

    it("should re-export ManageFilesSchema from schema", async () => {
      const { ManageFilesSchema } = await import("../../../../src/entities/files/index");
      expect(ManageFilesSchema).toBeDefined();
    });

    it("should re-export GetRepositoryTreeSchema", async () => {
      const { GetRepositoryTreeSchema } = await import("../../../../src/entities/files/index");
      expect(GetRepositoryTreeSchema).toBeDefined();
    });

    it("should re-export GetFileContentsSchema", async () => {
      const { GetFileContentsSchema } = await import("../../../../src/entities/files/index");
      expect(GetFileContentsSchema).toBeDefined();
    });

    it("should re-export CreateOrUpdateFileSchema", async () => {
      const { CreateOrUpdateFileSchema } = await import("../../../../src/entities/files/index");
      expect(CreateOrUpdateFileSchema).toBeDefined();
    });

    it("should re-export PushFilesSchema", async () => {
      const { PushFilesSchema } = await import("../../../../src/entities/files/index");
      expect(PushFilesSchema).toBeDefined();
    });

    it("should re-export MarkdownUploadSchema", async () => {
      const { MarkdownUploadSchema } = await import("../../../../src/entities/files/index");
      expect(MarkdownUploadSchema).toBeDefined();
    });
  });

  describe("Registry Re-exports", () => {
    it("should re-export filesToolRegistry", async () => {
      const { filesToolRegistry } = await import("../../../../src/entities/files/index");
      expect(filesToolRegistry).toBeDefined();
      expect(filesToolRegistry instanceof Map).toBe(true);
    });

    it("should re-export getFilesReadOnlyToolNames function", async () => {
      const { getFilesReadOnlyToolNames } = await import("../../../../src/entities/files/index");
      expect(typeof getFilesReadOnlyToolNames).toBe("function");
    });

    it("should re-export getFilesToolDefinitions function", async () => {
      const { getFilesToolDefinitions } = await import("../../../../src/entities/files/index");
      expect(typeof getFilesToolDefinitions).toBe("function");
    });

    it("should re-export getFilteredFilesTools function", async () => {
      const { getFilteredFilesTools } = await import("../../../../src/entities/files/index");
      expect(typeof getFilteredFilesTools).toBe("function");
    });
  });

  describe("Shared Schema Re-exports", () => {
    it("should re-export ProjectParamsSchema from shared", async () => {
      const { ProjectParamsSchema } = await import("../../../../src/entities/files/index");
      expect(ProjectParamsSchema).toBeDefined();
    });
  });
});
