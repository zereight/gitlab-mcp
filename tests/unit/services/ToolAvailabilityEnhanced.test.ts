import { ToolAvailability } from "../../../src/services/ToolAvailability";
import { ConnectionManager } from "../../../src/services/ConnectionManager";
import { logger } from "../../../src/logger";
import { GitLabInstanceInfo } from "../../../src/services/GitLabVersionDetector";

// Mock dependencies
jest.mock("../../../src/services/ConnectionManager");
jest.mock("../../../src/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

describe("ToolAvailability Enhanced Coverage Tests", () => {
  const mockInstanceInfo: GitLabInstanceInfo = {
    version: "16.0.0",
    tier: "premium",
    features: {
      workItems: true,
      epics: true,
      iterations: true,
      roadmaps: true,
      portfolioManagement: false,
      securityDashboard: false,
      complianceFramework: false,
      valueStreamAnalytics: true,
      customFields: false,
      okrs: false,
      healthStatus: false,
      weight: true,
      multiLevelEpics: false,
      requirements: false,
      qualityManagement: false,
      crmContacts: true,
      vulnerabilities: false,
      linkedResources: true,
      emailParticipants: true,
      advancedSearch: true,
      timeTracking: true,
      codeReview: true,
      serviceDesk: true,
      designManagement: true,
      errorTracking: true,
    },
    detectedAt: new Date("2024-01-15T10:00:00Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the singleton getInstance method
    jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
      getInstanceInfo: jest.fn().mockReturnValue(mockInstanceInfo),
    } as any);
  });

  describe("Error Handling and Logging", () => {
    it("should allow tools when connection not initialized (OAuth mode deferred introspection)", () => {
      const error = new Error("Connection not initialized. Call initialize() first.");
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockImplementation(() => {
          throw error;
        }),
      } as any);

      const result = ToolAvailability.isToolAvailable("list_projects");

      // In OAuth mode, tools are allowed when connection not yet initialized
      // They will be properly filtered on actual use after authentication
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Tool availability check for 'list_projects': instance info not available yet, allowing"
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should handle other errors with warn logging", () => {
      const error = new Error("Network timeout occurred");
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockImplementation(() => {
          throw error;
        }),
      } as any);

      const result = ToolAvailability.isToolAvailable("list_projects");

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to check tool availability for 'list_projects': Network timeout occurred"
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it("should handle generic Error objects", () => {
      const error = new TypeError("Invalid type conversion");
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockImplementation(() => {
          throw error;
        }),
      } as any);

      const result = ToolAvailability.isToolAvailable("get_project");

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to check tool availability for 'get_project': Invalid type conversion"
      );
    });

    it("should handle string errors", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockImplementation(() => {
          throw "String error message";
        }),
      } as any);

      const result = ToolAvailability.isToolAvailable("create_project");

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to check tool availability for 'create_project': String error message"
      );
    });

    it("should handle non-error objects thrown", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockImplementation(() => {
          throw { customError: true, message: "Custom error" };
        }),
      } as any);

      const result = ToolAvailability.isToolAvailable("delete_project");

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to check tool availability for 'delete_project': [object Object]"
      );
    });
  });

  describe("getAvailableTools method", () => {
    it("should return only available tools when instance is configured", () => {
      // Default mock is already set up in beforeEach
      const availableTools = ToolAvailability.getAvailableTools();

      expect(Array.isArray(availableTools)).toBe(true);
      expect(availableTools.length).toBeGreaterThan(0);
      // Should include tools that meet premium tier and version requirements
      expect(availableTools).toContain("list_projects");
      expect(availableTools).toContain("create_merge_request");
    });

    it("should return all tools when connection not initialized (OAuth mode)", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockImplementation(() => {
          throw new Error("Connection not initialized");
        }),
      } as any);

      const availableTools = ToolAvailability.getAvailableTools();

      // In OAuth mode with deferred introspection, all tools are allowed initially
      expect(availableTools.length).toBeGreaterThan(0);
      expect(availableTools).toContain("list_projects");
    });

    it("should filter based on version requirements", () => {
      // Set up instance with older version
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockReturnValue({
          version: "12.0.0",
          tier: "premium",
          features: mockInstanceInfo.features,
          detectedAt: new Date(),
        }),
      } as any);

      const availableTools = ToolAvailability.getAvailableTools();

      // Should include tools that work with 12.x
      expect(availableTools).toContain("list_projects");
      // Should exclude tools that require newer versions
      expect(availableTools).not.toContain("get_draft_note"); // requires 13.2+
    });
  });

  describe("getToolRequirement method", () => {
    it("should return requirement for existing tools", () => {
      const requirement = ToolAvailability.getToolRequirement("list_projects");

      expect(requirement).toBeDefined();
      expect(requirement?.minVersion).toBe(8.0);
      expect(requirement?.requiredTier).toBe("free");
    });

    it("should return undefined for non-existing tools", () => {
      const requirement = ToolAvailability.getToolRequirement("non_existent_tool");

      expect(requirement).toBeUndefined();
    });

    it("should return requirement with notes when available", () => {
      const requirement = ToolAvailability.getToolRequirement("get_merge_request_approvals");

      expect(requirement).toBeDefined();
      expect(requirement?.notes).toBe("MR approval rules");
    });
  });

  describe("getUnavailableReason method", () => {
    it("should return null when tool is available", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockReturnValue({
          version: "16.0.0",
          tier: "ultimate",
          features: mockInstanceInfo.features,
          detectedAt: new Date(),
        }),
      } as any);

      const reason = ToolAvailability.getUnavailableReason("list_projects");

      expect(reason).toBeNull();
    });

    it("should return tool not recognized message", () => {
      // Use default mock setup
      const reason = ToolAvailability.getUnavailableReason("unknown_tool");

      expect(reason).toBe("Tool 'unknown_tool' is not recognized");
    });

    it("should return version requirement message", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockReturnValue({
          version: "7.0.0",
          tier: "ultimate",
          features: mockInstanceInfo.features,
          detectedAt: new Date(),
        }),
      } as any);

      const reason = ToolAvailability.getUnavailableReason("list_projects");

      expect(reason).toBe("Requires GitLab 8+, current version is 7.0.0");
    });

    it("should return tier requirement message", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockReturnValue({
          version: "16.0.0",
          tier: "free",
          features: mockInstanceInfo.features,
          detectedAt: new Date(),
        }),
      } as any);

      const reason = ToolAvailability.getUnavailableReason("get_merge_request_approvals");

      expect(reason).toBe("Requires GitLab premium tier or higher, current tier is free");
    });

    it("should return connection not initialized message", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockImplementation(() => {
          throw new Error("Not initialized");
        }),
      } as any);

      const reason = ToolAvailability.getUnavailableReason("list_projects");

      expect(reason).toBe("GitLab connection not initialized");
    });
  });

  describe("filterToolsByAvailability method", () => {
    it("should filter available tools correctly", () => {
      // Use default mock (premium tier, v16)
      const inputTools = ["list_projects", "get_merge_request_approvals", "unknown_tool"];
      const filteredTools = ToolAvailability.filterToolsByAvailability(inputTools);

      expect(filteredTools).toContain("list_projects");
      expect(filteredTools).toContain("get_merge_request_approvals"); // premium tier
      // unknown_tool is allowed because version 16.0 >= 15.0 (default for unknown tools)
      expect(filteredTools).toContain("unknown_tool");
    });

    it("should return all input tools when connection not initialized (OAuth mode)", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockImplementation(() => {
          throw new Error("Connection not initialized");
        }),
      } as any);

      const inputTools = ["list_projects", "create_project"];
      const filteredTools = ToolAvailability.filterToolsByAvailability(inputTools);

      // In OAuth mode with deferred introspection, all tools pass through
      expect(filteredTools).toEqual(inputTools);
    });

    it("should handle empty input array", () => {
      // Use default mock
      const filteredTools = ToolAvailability.filterToolsByAvailability([]);

      expect(filteredTools).toEqual([]);
    });

    it("should filter out unknown tools on older versions", () => {
      // Set up instance with older version that doesn't allow unknown tools
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockReturnValue({
          version: "14.0.0", // Below 15.0 threshold
          tier: "premium",
          features: mockInstanceInfo.features,
          detectedAt: new Date(),
        }),
      } as any);

      const inputTools = ["list_projects", "unknown_tool"];
      const filteredTools = ToolAvailability.filterToolsByAvailability(inputTools);

      expect(filteredTools).toContain("list_projects");
      expect(filteredTools).not.toContain("unknown_tool"); // Should be filtered out on v14
    });
  });

  describe("getToolsByTier method", () => {
    it("should return tools for free tier", () => {
      const freeTools = ToolAvailability.getToolsByTier("free");

      expect(Array.isArray(freeTools)).toBe(true);
      expect(freeTools.length).toBeGreaterThan(0);
      expect(freeTools).toContain("list_projects");
      expect(freeTools).toContain("create_merge_request");
      expect(freeTools).not.toContain("get_merge_request_approvals"); // premium only
    });

    it("should return tools for premium tier", () => {
      const premiumTools = ToolAvailability.getToolsByTier("premium");

      expect(Array.isArray(premiumTools)).toBe(true);
      expect(premiumTools).toContain("get_merge_request_approvals");
      expect(premiumTools).toContain("approve_merge_request");
    });

    it("should return tools for ultimate tier", () => {
      const ultimateTools = ToolAvailability.getToolsByTier("ultimate");

      expect(Array.isArray(ultimateTools)).toBe(true);
      // Should include tools that require ultimate tier
    });
  });

  describe("getToolsByMinVersion method", () => {
    it("should return tools that require minimum version 13", () => {
      const tools = ToolAvailability.getToolsByMinVersion(13);

      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toContain("get_draft_note"); // requires 13.2
      expect(tools).toContain("create_draft_note"); // requires 13.2
      expect(tools).not.toContain("list_projects"); // requires 8.0
    });

    it("should return tools that require minimum version 15", () => {
      const tools = ToolAvailability.getToolsByMinVersion(15);

      expect(Array.isArray(tools)).toBe(true);
      // Should only include tools that require 15.0+
      const allRequirements = tools.map(
        tool => ToolAvailability.getToolRequirement(tool)?.minVersion || 0
      );
      allRequirements.forEach(version => {
        expect(version).toBeGreaterThanOrEqual(15);
      });
    });

    it("should return empty array for very high version requirement", () => {
      const tools = ToolAvailability.getToolsByMinVersion(99);

      expect(tools).toEqual([]);
    });

    it("should handle version 0 (should return all tools)", () => {
      const tools = ToolAvailability.getToolsByMinVersion(0);

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases and Complex Scenarios", () => {
    it("should handle tools with decimal version requirements", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockReturnValue({
          version: "8.15.0",
          tier: "free",
          features: mockInstanceInfo.features,
          detectedAt: new Date(),
        }),
      } as any);

      // cherry_pick_commit requires 8.15
      const available = ToolAvailability.isToolAvailable("cherry_pick_commit");
      expect(available).toBe(true);
    });

    it("should handle version edge cases", () => {
      jest.spyOn(ConnectionManager, "getInstance").mockReturnValue({
        getInstanceInfo: jest.fn().mockReturnValue({
          version: "8.14.9",
          tier: "free",
          features: mockInstanceInfo.features,
          detectedAt: new Date(),
        }),
      } as any);

      // Should not be available for 8.15 requirement
      const available = ToolAvailability.isToolAvailable("cherry_pick_commit");
      expect(available).toBe(false);
    });
  });
});
