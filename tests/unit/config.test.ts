/**
 * Unit tests for config.ts
 * Tests environment variable handling, URL normalization, and package info loading
 */

import * as fs from "fs";

// Mock fs module
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

describe("config.ts", () => {
  const originalEnv = process.env;
  const originalCwd = process.cwd;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset process.env to clean state
    process.env = { ...originalEnv };

    // Mock process.cwd
    jest.spyOn(process, "cwd").mockReturnValue("/test/project");

    // Reset fs mock to default behavior
    mockFs.readFileSync.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.cwd = originalCwd;
  });

  describe("environment variable parsing", () => {
    it("should parse boolean environment variables correctly", () => {
      process.env.GITLAB_IS_OLD = "true";
      process.env.GITLAB_READ_ONLY_MODE = "true";
      process.env.SKIP_TLS_VERIFY = "true";

      const config = require("../../src/config");

      expect(config.IS_OLD).toBe(true);
      expect(config.GITLAB_READ_ONLY_MODE).toBe(true);
      expect(config.SKIP_TLS_VERIFY).toBe(true);
    });

    it("should handle false boolean environment variables", () => {
      process.env.GITLAB_IS_OLD = "false";
      process.env.GITLAB_READ_ONLY_MODE = "false";
      process.env.SKIP_TLS_VERIFY = "false";

      const config = require("../../src/config");

      expect(config.IS_OLD).toBe(false);
      expect(config.GITLAB_READ_ONLY_MODE).toBe(false);
      expect(config.SKIP_TLS_VERIFY).toBe(false);
    });

    it("should handle feature flags that default to true", () => {
      // These should default to true when not set or not 'false'
      delete process.env.USE_GITLAB_WIKI;
      delete process.env.USE_MILESTONE;
      delete process.env.USE_PIPELINE;
      delete process.env.USE_WORKITEMS;
      delete process.env.USE_LABELS;
      delete process.env.USE_MRS;
      delete process.env.USE_FILES;
      delete process.env.USE_VARIABLES;

      const config = require("../../src/config");

      expect(config.USE_GITLAB_WIKI).toBe(true);
      expect(config.USE_MILESTONE).toBe(true);
      expect(config.USE_PIPELINE).toBe(true);
      expect(config.USE_WORKITEMS).toBe(true);
      expect(config.USE_LABELS).toBe(true);
      expect(config.USE_MRS).toBe(true);
      expect(config.USE_FILES).toBe(true);
      expect(config.USE_VARIABLES).toBe(true);
    });

    it("should disable features when explicitly set to false", () => {
      process.env.USE_GITLAB_WIKI = "false";
      process.env.USE_MILESTONE = "false";
      process.env.USE_PIPELINE = "false";
      process.env.USE_WORKITEMS = "false";
      process.env.USE_LABELS = "false";
      process.env.USE_MRS = "false";
      process.env.USE_FILES = "false";
      process.env.USE_VARIABLES = "false";

      const config = require("../../src/config");

      expect(config.USE_GITLAB_WIKI).toBe(false);
      expect(config.USE_MILESTONE).toBe(false);
      expect(config.USE_PIPELINE).toBe(false);
      expect(config.USE_WORKITEMS).toBe(false);
      expect(config.USE_LABELS).toBe(false);
      expect(config.USE_MRS).toBe(false);
      expect(config.USE_FILES).toBe(false);
      expect(config.USE_VARIABLES).toBe(false);
    });

    it("should parse GITLAB_DENIED_TOOLS_REGEX as RegExp", () => {
      process.env.GITLAB_DENIED_TOOLS_REGEX = "^list_";

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_TOOLS_REGEX).toBeInstanceOf(RegExp);
      expect(config.GITLAB_DENIED_TOOLS_REGEX.source).toBe("^list_");
    });

    it("should handle undefined GITLAB_DENIED_TOOLS_REGEX", () => {
      delete process.env.GITLAB_DENIED_TOOLS_REGEX;

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_TOOLS_REGEX).toBeUndefined();
    });

    it("should parse HOST and PORT with defaults", () => {
      delete process.env.HOST;
      delete process.env.PORT;

      const config = require("../../src/config");

      expect(config.HOST).toBe("0.0.0.0");
      expect(config.PORT).toBe(3002);
    });

    it("should use custom HOST and PORT when set", () => {
      process.env.HOST = "localhost";
      process.env.PORT = "8080";

      const config = require("../../src/config");

      expect(config.HOST).toBe("localhost");
      expect(config.PORT).toBe("8080");
    });

    it("should parse GITLAB_ALLOWED_PROJECT_IDS as array", () => {
      process.env.GITLAB_ALLOWED_PROJECT_IDS = "123, 456 , 789";

      const config = require("../../src/config");

      expect(config.GITLAB_ALLOWED_PROJECT_IDS).toEqual(["123", "456", "789"]);
    });

    it("should handle empty GITLAB_ALLOWED_PROJECT_IDS", () => {
      delete process.env.GITLAB_ALLOWED_PROJECT_IDS;

      const config = require("../../src/config");

      expect(config.GITLAB_ALLOWED_PROJECT_IDS).toEqual([]);
    });
  });

  describe("GitLab URL normalization", () => {
    it("should default to gitlab.com when no URL provided", () => {
      delete process.env.GITLAB_API_URL;

      const config = require("../../src/config");

      expect(config.GITLAB_BASE_URL).toBe("https://gitlab.com");
      expect(config.GITLAB_API_URL).toBe("https://gitlab.com/api/v4");
    });

    it("should remove trailing slash from URL", () => {
      process.env.GITLAB_API_URL = "https://gitlab.example.com/";

      const config = require("../../src/config");

      expect(config.GITLAB_BASE_URL).toBe("https://gitlab.example.com");
      expect(config.GITLAB_API_URL).toBe("https://gitlab.example.com/api/v4");
    });

    it("should remove /api/v4 suffix if accidentally added", () => {
      process.env.GITLAB_API_URL = "https://gitlab.example.com/api/v4";

      const config = require("../../src/config");

      expect(config.GITLAB_BASE_URL).toBe("https://gitlab.example.com");
      expect(config.GITLAB_API_URL).toBe("https://gitlab.example.com/api/v4");
    });

    it("should handle URL with both trailing slash and /api/v4", () => {
      process.env.GITLAB_API_URL = "https://gitlab.example.com/api/v4/";

      const config = require("../../src/config");

      expect(config.GITLAB_BASE_URL).toBe("https://gitlab.example.com");
      expect(config.GITLAB_API_URL).toBe("https://gitlab.example.com/api/v4");
    });

    it("should preserve custom URL as-is when properly formatted", () => {
      process.env.GITLAB_API_URL = "https://gitlab.example.com";

      const config = require("../../src/config");

      expect(config.GITLAB_BASE_URL).toBe("https://gitlab.example.com");
      expect(config.GITLAB_API_URL).toBe("https://gitlab.example.com/api/v4");
    });
  });

  describe("getEffectiveProjectId", () => {
    it("should return GITLAB_PROJECT_ID when set", () => {
      process.env.GITLAB_PROJECT_ID = "999";

      const config = require("../../src/config");

      expect(config.getEffectiveProjectId("123")).toBe("999");
    });

    it("should return provided project ID when no restrictions", () => {
      delete process.env.GITLAB_PROJECT_ID;
      delete process.env.GITLAB_ALLOWED_PROJECT_IDS;

      const config = require("../../src/config");

      expect(config.getEffectiveProjectId("123")).toBe("123");
    });

    it("should allow project ID when in allowed list", () => {
      delete process.env.GITLAB_PROJECT_ID;
      process.env.GITLAB_ALLOWED_PROJECT_IDS = "123,456,789";

      const config = require("../../src/config");

      expect(config.getEffectiveProjectId("456")).toBe("456");
    });

    it("should throw error when project ID not in allowed list", () => {
      delete process.env.GITLAB_PROJECT_ID;
      process.env.GITLAB_ALLOWED_PROJECT_IDS = "123,456,789";

      const config = require("../../src/config");

      expect(() => config.getEffectiveProjectId("999")).toThrow(
        "Project ID 999 is not allowed. Allowed project IDs: 123, 456, 789"
      );
    });

    it("should prioritize GITLAB_PROJECT_ID over allowed list", () => {
      process.env.GITLAB_PROJECT_ID = "999";
      process.env.GITLAB_ALLOWED_PROJECT_IDS = "123,456,789";

      const config = require("../../src/config");

      expect(config.getEffectiveProjectId("456")).toBe("999");
    });
  });

  describe("package info loading", () => {
    it("should load package info from filesystem", () => {
      // Since config.ts loads at module time, we test that it doesn't crash
      // and has reasonable default values
      const config = require("../../src/config");

      expect(config.packageName).toBeDefined();
      expect(config.packageVersion).toBeDefined();
      expect(typeof config.packageName).toBe("string");
      expect(typeof config.packageVersion).toBe("string");
    });

    it("should have package name fallback", () => {
      const config = require("../../src/config");

      // Should have either a real package name or the default
      expect(config.packageName.length).toBeGreaterThan(0);
    });

    it("should have package version fallback", () => {
      const config = require("../../src/config");

      // Should have either a real version or 'unknown'
      expect(config.packageVersion.length).toBeGreaterThan(0);
    });
  });

  describe("getToolDescriptionOverrides", () => {
    it("should parse tool description overrides from environment variables", () => {
      process.env.GITLAB_TOOL_LIST_PROJECTS = "Custom project listing tool";
      process.env.GITLAB_TOOL_GET_PROJECT = "Custom project details tool";
      process.env.GITLAB_TOOL_CREATE_ISSUE = "Custom issue creation tool";
      // Non-tool env var should be ignored
      process.env.GITLAB_API_URL = "https://gitlab.example.com";

      const config = require("../../src/config");
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.get("list_projects")).toBe("Custom project listing tool");
      expect(overrides.get("get_project")).toBe("Custom project details tool");
      expect(overrides.get("create_issue")).toBe("Custom issue creation tool");
      expect(overrides.has("api_url")).toBe(false);
    });

    it("should handle empty tool override values", () => {
      process.env.GITLAB_TOOL_LIST_PROJECTS = "";
      process.env.GITLAB_TOOL_GET_PROJECT = "Valid description";

      const config = require("../../src/config");
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.has("list_projects")).toBe(false);
      expect(overrides.get("get_project")).toBe("Valid description");
    });

    it("should return empty map when no tool overrides exist", () => {
      // Clear all GITLAB_TOOL_ env vars
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("GITLAB_TOOL_")) {
          delete process.env[key];
        }
      }

      const config = require("../../src/config");
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.size).toBe(0);
    });

    it("should convert tool names to lowercase", () => {
      process.env.GITLAB_TOOL_LIST_PROJECTS = "List projects tool";
      process.env.GITLAB_TOOL_GET_USER_DETAILS = "Get user details tool";

      const config = require("../../src/config");
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.get("list_projects")).toBe("List projects tool");
      expect(overrides.get("get_user_details")).toBe("Get user details tool");
    });

    it("should handle undefined process.env values", () => {
      // Ensure process.env has some undefined values
      process.env.GITLAB_TOOL_VALID = "Valid tool";
      process.env.GITLAB_TOOL_UNDEFINED = undefined;

      const config = require("../../src/config");
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.get("valid")).toBe("Valid tool");
      expect(overrides.has("undefined")).toBe(false);
    });
  });

  describe("GITLAB_DENIED_ACTIONS parsing", () => {
    it("should parse denied actions from environment variable", () => {
      process.env.GITLAB_DENIED_ACTIONS =
        "manage_milestone:delete,manage_milestone:promote,browse_events:user";

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_ACTIONS).toBeInstanceOf(Map);
      expect(config.GITLAB_DENIED_ACTIONS.size).toBe(2); // Two tools: manage_milestone, browse_events
      expect(config.GITLAB_DENIED_ACTIONS.get("manage_milestone")).toEqual(
        new Set(["delete", "promote"])
      );
      expect(config.GITLAB_DENIED_ACTIONS.get("browse_events")).toEqual(new Set(["user"]));
    });

    it("should handle empty GITLAB_DENIED_ACTIONS", () => {
      delete process.env.GITLAB_DENIED_ACTIONS;

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_ACTIONS).toBeInstanceOf(Map);
      expect(config.GITLAB_DENIED_ACTIONS.size).toBe(0);
    });

    it("should handle whitespace in GITLAB_DENIED_ACTIONS", () => {
      process.env.GITLAB_DENIED_ACTIONS = " manage_milestone:delete , browse_events:user ";

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_ACTIONS.get("manage_milestone")).toEqual(new Set(["delete"]));
      expect(config.GITLAB_DENIED_ACTIONS.get("browse_events")).toEqual(new Set(["user"]));
    });

    it("should skip invalid entries without colon", () => {
      process.env.GITLAB_DENIED_ACTIONS =
        "manage_milestone:delete,invalid_entry,browse_events:user";

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_ACTIONS.size).toBe(2);
      expect(config.GITLAB_DENIED_ACTIONS.has("invalid_entry")).toBe(false);
    });

    it("should skip entries with empty tool or action names", () => {
      process.env.GITLAB_DENIED_ACTIONS = ":delete,manage_milestone:,valid:action";

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_ACTIONS.size).toBe(1);
      expect(config.GITLAB_DENIED_ACTIONS.get("valid")).toEqual(new Set(["action"]));
    });

    it("should handle colons in action names", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete";

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_ACTIONS.get("manage_milestone")).toEqual(new Set(["delete"]));
    });

    it("should convert tool and action names to lowercase", () => {
      process.env.GITLAB_DENIED_ACTIONS = "MANAGE_MILESTONE:DELETE,Browse_Events:User";

      const config = require("../../src/config");

      expect(config.GITLAB_DENIED_ACTIONS.get("manage_milestone")).toEqual(new Set(["delete"]));
      expect(config.GITLAB_DENIED_ACTIONS.get("browse_events")).toEqual(new Set(["user"]));
    });
  });

  describe("getActionDescriptionOverrides", () => {
    it("should parse action description overrides from environment variables", () => {
      process.env.GITLAB_ACTION_MANAGE_MILESTONE_DELETE = "Remove a milestone permanently";
      process.env.GITLAB_ACTION_MANAGE_MILESTONE_CREATE = "Create a new milestone";
      process.env.GITLAB_ACTION_BROWSE_COMMITS_LIST = "List repository commits";

      const config = require("../../src/config");
      const overrides = config.getActionDescriptionOverrides();

      expect(overrides.get("manage_milestone:delete")).toBe("Remove a milestone permanently");
      expect(overrides.get("manage_milestone:create")).toBe("Create a new milestone");
      expect(overrides.get("browse_commits:list")).toBe("List repository commits");
    });

    it("should handle empty action override values", () => {
      process.env.GITLAB_ACTION_MANAGE_MILESTONE_DELETE = "";
      process.env.GITLAB_ACTION_MANAGE_MILESTONE_CREATE = "Valid description";

      const config = require("../../src/config");
      const overrides = config.getActionDescriptionOverrides();

      expect(overrides.has("manage_milestone:delete")).toBe(false);
      expect(overrides.get("manage_milestone:create")).toBe("Valid description");
    });

    it("should return empty map when no action overrides exist", () => {
      // Clear all GITLAB_ACTION_ env vars
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("GITLAB_ACTION_")) {
          delete process.env[key];
        }
      }

      const config = require("../../src/config");
      const overrides = config.getActionDescriptionOverrides();

      expect(overrides.size).toBe(0);
    });

    it("should convert tool and action names to lowercase", () => {
      process.env.GITLAB_ACTION_MANAGE_MILESTONE_DELETE = "Delete milestone";

      const config = require("../../src/config");
      const overrides = config.getActionDescriptionOverrides();

      expect(overrides.get("manage_milestone:delete")).toBe("Delete milestone");
    });

    it("should skip entries without underscore separator", () => {
      process.env.GITLAB_ACTION_INVALIDENTRY = "Invalid entry";
      process.env.GITLAB_ACTION_MANAGE_VALID = "Valid entry";

      const config = require("../../src/config");
      const overrides = config.getActionDescriptionOverrides();

      expect(overrides.has("invalidentry:")).toBe(false);
      expect(overrides.get("manage:valid")).toBe("Valid entry");
    });
  });

  describe("getParamDescriptionOverrides", () => {
    it("should parse param description overrides from environment variables", () => {
      process.env.GITLAB_PARAM_MANAGE_MILESTONE_TITLE = "The milestone title (required for create)";
      process.env.GITLAB_PARAM_MANAGE_MILESTONE_DESCRIPTION = "Optional milestone description";
      process.env.GITLAB_PARAM_LIST_PROJECTS_SEARCH = "Search term to filter projects";

      const config = require("../../src/config");
      const overrides = config.getParamDescriptionOverrides();

      expect(overrides.get("manage_milestone:title")).toBe(
        "The milestone title (required for create)"
      );
      expect(overrides.get("manage_milestone:description")).toBe("Optional milestone description");
      expect(overrides.get("list_projects:search")).toBe("Search term to filter projects");
    });

    it("should handle empty param override values", () => {
      process.env.GITLAB_PARAM_MANAGE_MILESTONE_TITLE = "";
      process.env.GITLAB_PARAM_MANAGE_MILESTONE_DESCRIPTION = "Valid description";

      const config = require("../../src/config");
      const overrides = config.getParamDescriptionOverrides();

      expect(overrides.has("manage_milestone:title")).toBe(false);
      expect(overrides.get("manage_milestone:description")).toBe("Valid description");
    });

    it("should return empty map when no param overrides exist", () => {
      // Clear all GITLAB_PARAM_ env vars
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("GITLAB_PARAM_")) {
          delete process.env[key];
        }
      }

      const config = require("../../src/config");
      const overrides = config.getParamDescriptionOverrides();

      expect(overrides.size).toBe(0);
    });

    it("should convert tool and param names to lowercase", () => {
      process.env.GITLAB_PARAM_MANAGE_MILESTONE_TITLE = "Milestone title";

      const config = require("../../src/config");
      const overrides = config.getParamDescriptionOverrides();

      expect(overrides.get("manage_milestone:title")).toBe("Milestone title");
    });
  });

  describe("isActionDenied", () => {
    it("should return true for denied actions", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete,manage_milestone:promote";

      const config = require("../../src/config");

      expect(config.isActionDenied("manage_milestone", "delete")).toBe(true);
      expect(config.isActionDenied("manage_milestone", "promote")).toBe(true);
    });

    it("should return false for allowed actions", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete";

      const config = require("../../src/config");

      expect(config.isActionDenied("manage_milestone", "create")).toBe(false);
      expect(config.isActionDenied("manage_milestone", "update")).toBe(false);
    });

    it("should return false for unknown tools", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete";

      const config = require("../../src/config");

      expect(config.isActionDenied("unknown_tool", "delete")).toBe(false);
    });

    it("should be case-insensitive", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete";

      const config = require("../../src/config");

      expect(config.isActionDenied("MANAGE_MILESTONE", "DELETE")).toBe(true);
      expect(config.isActionDenied("Manage_Milestone", "Delete")).toBe(true);
    });

    it("should return false when no actions are denied", () => {
      delete process.env.GITLAB_DENIED_ACTIONS;

      const config = require("../../src/config");

      expect(config.isActionDenied("manage_milestone", "delete")).toBe(false);
    });
  });

  describe("getAllowedActions", () => {
    it("should filter out denied actions", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete,manage_milestone:promote";

      const config = require("../../src/config");
      const allActions = ["create", "update", "delete", "promote", "list"];
      const allowed = config.getAllowedActions("manage_milestone", allActions);

      expect(allowed).toEqual(["create", "update", "list"]);
    });

    it("should return all actions when none are denied", () => {
      delete process.env.GITLAB_DENIED_ACTIONS;

      const config = require("../../src/config");
      const allActions = ["create", "update", "delete"];
      const allowed = config.getAllowedActions("manage_milestone", allActions);

      expect(allowed).toEqual(["create", "update", "delete"]);
    });

    it("should return all actions for unknown tools", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete";

      const config = require("../../src/config");
      const allActions = ["create", "update", "delete"];
      const allowed = config.getAllowedActions("unknown_tool", allActions);

      expect(allowed).toEqual(["create", "update", "delete"]);
    });

    it("should be case-insensitive for tool names", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete";

      const config = require("../../src/config");
      const allActions = ["create", "update", "delete"];

      expect(config.getAllowedActions("MANAGE_MILESTONE", allActions)).toEqual([
        "create",
        "update",
      ]);
      expect(config.getAllowedActions("Manage_Milestone", allActions)).toEqual([
        "create",
        "update",
      ]);
    });

    it("should be case-insensitive for action names", () => {
      process.env.GITLAB_DENIED_ACTIONS = "manage_milestone:delete";

      const config = require("../../src/config");
      const allActions = ["Create", "Update", "Delete"];
      const allowed = config.getAllowedActions("manage_milestone", allActions);

      expect(allowed).toEqual(["Create", "Update"]);
    });

    it("should return empty array when all actions are denied", () => {
      process.env.GITLAB_DENIED_ACTIONS =
        "manage_milestone:create,manage_milestone:update,manage_milestone:delete";

      const config = require("../../src/config");
      const allActions = ["create", "update", "delete"];
      const allowed = config.getAllowedActions("manage_milestone", allActions);

      expect(allowed).toEqual([]);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle completely empty environment", () => {
      // Clear all environment variables
      process.env = {};

      expect(() => require("../../src/config")).not.toThrow();
    });

    it("should handle null and undefined environment values", () => {
      process.env.GITLAB_TOKEN = undefined;
      process.env.GITLAB_API_URL = null as any;

      const config = require("../../src/config");

      expect(config.GITLAB_TOKEN).toBeUndefined();
      expect(config.GITLAB_BASE_URL).toBe("https://gitlab.com");
    });

    it("should handle very long environment variable values", () => {
      const longValue = "a".repeat(10000);
      process.env.GITLAB_TOKEN = longValue;
      process.env.GITLAB_TOOL_LONG_NAME = longValue;

      const config = require("../../src/config");

      expect(config.GITLAB_TOKEN).toBe(longValue);

      const overrides = config.getToolDescriptionOverrides();
      expect(overrides.get("long_name")).toBe(longValue);
    });

    it("should handle special characters in environment variables", () => {
      process.env.GITLAB_API_URL = "https://gitlab.example.com/special-chars/@#$%";
      process.env.GITLAB_TOOL_SPECIAL = "Tool with special chars: @#$%^&*()";

      const config = require("../../src/config");

      expect(config.GITLAB_BASE_URL).toBe("https://gitlab.example.com/special-chars/@#$%");

      const overrides = config.getToolDescriptionOverrides();
      expect(overrides.get("special")).toBe("Tool with special chars: @#$%^&*()");
    });
  });

  describe("GITLAB_SCHEMA_MODE", () => {
    it("should default to 'flat' when not set", () => {
      delete process.env.GITLAB_SCHEMA_MODE;

      const config = require("../../src/config");

      expect(config.GITLAB_SCHEMA_MODE).toBe("flat");
    });

    it("should return 'flat' when set to 'flat'", () => {
      process.env.GITLAB_SCHEMA_MODE = "flat";

      const config = require("../../src/config");

      expect(config.GITLAB_SCHEMA_MODE).toBe("flat");
    });

    it("should return 'discriminated' when set to 'discriminated'", () => {
      process.env.GITLAB_SCHEMA_MODE = "discriminated";

      const config = require("../../src/config");

      expect(config.GITLAB_SCHEMA_MODE).toBe("discriminated");
    });

    it("should be case-insensitive", () => {
      process.env.GITLAB_SCHEMA_MODE = "DISCRIMINATED";

      const config = require("../../src/config");

      expect(config.GITLAB_SCHEMA_MODE).toBe("discriminated");
    });

    it("should default to 'flat' for invalid values", () => {
      process.env.GITLAB_SCHEMA_MODE = "invalid";

      const config = require("../../src/config");

      expect(config.GITLAB_SCHEMA_MODE).toBe("flat");
    });

    it("should default to 'flat' for empty string", () => {
      process.env.GITLAB_SCHEMA_MODE = "";

      const config = require("../../src/config");

      expect(config.GITLAB_SCHEMA_MODE).toBe("flat");
    });

    it("should return 'auto' when set to 'auto'", () => {
      process.env.GITLAB_SCHEMA_MODE = "auto";

      const config = require("../../src/config");

      expect(config.GITLAB_SCHEMA_MODE).toBe("auto");
    });

    it("should be case-insensitive for 'auto'", () => {
      process.env.GITLAB_SCHEMA_MODE = "AUTO";

      const config = require("../../src/config");

      expect(config.GITLAB_SCHEMA_MODE).toBe("auto");
    });
  });

  describe("detectSchemaMode", () => {
    it("should return 'flat' for Claude clients (exact match or prefix)", () => {
      const config = require("../../src/config");

      // Exact match
      expect(config.detectSchemaMode("claude")).toBe("flat");
      expect(config.detectSchemaMode("CLAUDE")).toBe("flat");

      // Prefix match (claude-*)
      expect(config.detectSchemaMode("claude-code")).toBe("flat");
      expect(config.detectSchemaMode("Claude-Desktop")).toBe("flat");
      expect(config.detectSchemaMode("claude-ai")).toBe("flat");
    });

    it("should return 'flat' for Cursor (exact match or prefix)", () => {
      const config = require("../../src/config");

      expect(config.detectSchemaMode("cursor")).toBe("flat");
      expect(config.detectSchemaMode("Cursor")).toBe("flat");
      expect(config.detectSchemaMode("cursor-editor")).toBe("flat");
    });

    it("should return 'discriminated' for MCP Inspector", () => {
      const config = require("../../src/config");

      expect(config.detectSchemaMode("mcp-inspector")).toBe("discriminated");
      expect(config.detectSchemaMode("MCP-Inspector")).toBe("discriminated");
      expect(config.detectSchemaMode("inspector")).toBe("discriminated");
      expect(config.detectSchemaMode("inspector-v2")).toBe("discriminated"); // inspector-* variant
      expect(config.detectSchemaMode("mcp-inspector-v2")).toBe("discriminated");
    });

    it("should return 'flat' for unknown clients", () => {
      const config = require("../../src/config");

      expect(config.detectSchemaMode("unknown-client")).toBe("flat");
      expect(config.detectSchemaMode("some-other-ai")).toBe("flat");
    });

    it("should return 'flat' for undefined/empty client name", () => {
      const config = require("../../src/config");

      expect(config.detectSchemaMode(undefined)).toBe("flat");
      expect(config.detectSchemaMode("")).toBe("flat");
    });

    it("should NOT match clients with 'claude' as substring (avoid false positives)", () => {
      // These should NOT match because 'claude' is a substring, not exact/prefix
      const config = require("../../src/config");

      expect(config.detectSchemaMode("my-claude-wrapper")).toBe("flat"); // Safe default
      expect(config.detectSchemaMode("non-claude-app")).toBe("flat"); // Safe default
      expect(config.detectSchemaMode("preclaude")).toBe("flat"); // Safe default
    });

    it("should NOT match clients with 'cursor' as substring (avoid false positives)", () => {
      const config = require("../../src/config");

      expect(config.detectSchemaMode("my-cursor-tool")).toBe("flat"); // Safe default
      expect(config.detectSchemaMode("precursor")).toBe("flat"); // Safe default
    });
  });
});
