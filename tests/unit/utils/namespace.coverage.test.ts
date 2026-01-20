import {
  detectNamespaceType,
  resolveNamespaceForAPI,
  extractNamespaceFromPath,
} from "../../../src/utils/namespace";
import { enhancedFetch } from "../../../src/utils/fetch";

// Mock enhancedFetch
jest.mock("../../../src/utils/fetch", () => ({
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
  mockEnhancedFetch.mockReset();
});

describe("Namespace Utils Coverage Tests", () => {
  describe("extractNamespaceFromPath", () => {
    it("should extract namespace from two-level path", () => {
      expect(extractNamespaceFromPath("group/project")).toBe("group");
    });

    it("should extract namespace from three-level path", () => {
      expect(extractNamespaceFromPath("group/subgroup/project")).toBe("group/subgroup");
    });

    it("should extract namespace from deeply nested path", () => {
      expect(extractNamespaceFromPath("a/b/c/d/project")).toBe("a/b/c/d");
    });

    it("should return project path for single-segment path (root-level project)", () => {
      expect(extractNamespaceFromPath("myproject")).toBe("myproject");
    });

    it("should return undefined for empty string", () => {
      expect(extractNamespaceFromPath("")).toBeUndefined();
    });
  });

  describe("detectNamespaceType", () => {
    it("should detect project type for likely project path", async () => {
      // Mock successful project response
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 123 }),
      } as any);

      const result = await detectNamespaceType("group/project");

      expect(result).toBe("project");
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/api/v4/projects/group%2Fproject"
      );
    });

    it("should fallback to group when project fails for likely project path", async () => {
      // Mock failed project response, successful group response
      mockEnhancedFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 456 }),
        } as any);

      const result = await detectNamespaceType("group/subgroup");

      expect(result).toBe("group");
      expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
      expect(mockEnhancedFetch).toHaveBeenNthCalledWith(
        1,
        "https://gitlab.example.com/api/v4/projects/group%2Fsubgroup"
      );
      expect(mockEnhancedFetch).toHaveBeenNthCalledWith(
        2,
        "https://gitlab.example.com/api/v4/groups/group%2Fsubgroup"
      );
    });

    it("should default to project when both fail for likely project path", async () => {
      // Mock both project and group responses as failed
      mockEnhancedFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any);

      const result = await detectNamespaceType("group/nonexistent");

      expect(result).toBe("project");
      expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
    });

    it("should detect group type for likely group path", async () => {
      // Mock successful group response
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 789 }),
      } as any);

      const result = await detectNamespaceType("group");

      expect(result).toBe("group");
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/api/v4/groups/group"
      );
    });

    it("should fallback to project when group fails for likely group path", async () => {
      // Mock failed group response, successful project response
      mockEnhancedFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 101 }),
        } as any);

      const result = await detectNamespaceType("singleproject");

      expect(result).toBe("project");
      expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
      expect(mockEnhancedFetch).toHaveBeenNthCalledWith(
        1,
        "https://gitlab.example.com/api/v4/groups/singleproject"
      );
      expect(mockEnhancedFetch).toHaveBeenNthCalledWith(
        2,
        "https://gitlab.example.com/api/v4/projects/singleproject"
      );
    });

    it("should default to group when both fail for likely group path", async () => {
      // Mock both group and project responses as failed
      mockEnhancedFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any);

      const result = await detectNamespaceType("nonexistent");

      expect(result).toBe("group");
      expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle network errors gracefully", async () => {
      // Mock network error
      mockEnhancedFetch.mockRejectedValue(new Error("Network error"));

      const result = await detectNamespaceType("group/project");

      expect(result).toBe("project"); // Default fallback for paths with slash
    });

    it("should handle complex nested paths", async () => {
      // Mock successful project response for deeply nested path
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 999 }),
      } as any);

      const result = await detectNamespaceType("group/subgroup/project");

      expect(result).toBe("project");
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/api/v4/projects/group%2Fsubgroup%2Fproject"
      );
    });
  });

  describe("resolveNamespaceForAPI", () => {
    it("should resolve project namespace", async () => {
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 123 }),
      } as any);

      const result = await resolveNamespaceForAPI("group/project");

      expect(result).toEqual({
        entityType: "projects",
        encodedPath: "group%2Fproject",
      });
    });

    it("should resolve group namespace", async () => {
      mockEnhancedFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 456 }),
        } as any);

      const result = await resolveNamespaceForAPI("group/subgroup");

      expect(result).toEqual({
        entityType: "groups",
        encodedPath: "group%2Fsubgroup",
      });
    });

    it("should handle special characters in namespace path", async () => {
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 789 }),
      } as any);

      const result = await resolveNamespaceForAPI("group/project-with.special_chars");

      expect(result).toEqual({
        entityType: "projects",
        encodedPath: "group%2Fproject-with.special_chars",
      });
    });

    it("should handle paths that need URL encoding", async () => {
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 101 }),
      } as any);

      const result = await resolveNamespaceForAPI("group/project with spaces");

      expect(result).toEqual({
        entityType: "projects",
        encodedPath: "group%2Fproject%20with%20spaces",
      });
    });

    it("should handle single-level group paths", async () => {
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 202 }),
      } as any);

      const result = await resolveNamespaceForAPI("toplevelgroup");

      expect(result).toEqual({
        entityType: "groups",
        encodedPath: "toplevelgroup",
      });
    });
  });
});
