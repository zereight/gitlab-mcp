/**
 * Unit tests for main.ts
 * Tests server startup, configuration priority, and error handling
 *
 * Uses jest.isolateModules to import main.ts with mocks in place
 */

// Store original env
const originalEnv = { ...process.env };

// Mock process.exit to prevent actual exit during tests
const mockExit = jest.fn();

// Create mock implementations for all dependencies
const mockStartServer = jest.fn().mockResolvedValue(undefined);
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
const mockTryApplyProfileFromEnv = jest.fn().mockResolvedValue(undefined);
const mockFindProjectConfig = jest.fn().mockResolvedValue(null);
const mockGetProjectConfigSummary = jest.fn().mockReturnValue({
  presetSummary: null,
  profileSummary: null,
});
const mockParseCliArgs = jest.fn().mockReturnValue({
  profileName: undefined,
  noProjectConfig: false,
  showProjectConfig: false,
  auto: false,
  cwd: undefined,
  dryRun: false,
  remoteName: undefined,
});
const mockDisplayProjectConfig = jest.fn();
const mockAutoDiscover = jest.fn().mockResolvedValue(null);
const mockFormatDiscoveryResult = jest.fn().mockReturnValue("Discovery output");

// Helper to run main() with isolated modules
async function runMain(): Promise<void> {
  return new Promise((resolve, _reject) => {
    jest.isolateModules(() => {
      // Set up mocks before importing main
      jest.doMock("../../src/server", () => ({
        startServer: mockStartServer,
      }));
      jest.doMock("../../src/logger", () => ({
        logger: mockLogger,
      }));
      jest.doMock("../../src/profiles", () => ({
        tryApplyProfileFromEnv: mockTryApplyProfileFromEnv,
        findProjectConfig: mockFindProjectConfig,
        getProjectConfigSummary: mockGetProjectConfigSummary,
      }));
      jest.doMock("../../src/cli-utils", () => ({
        parseCliArgs: mockParseCliArgs,
        displayProjectConfig: mockDisplayProjectConfig,
      }));
      jest.doMock("../../src/discovery", () => ({
        autoDiscover: mockAutoDiscover,
        formatDiscoveryResult: mockFormatDiscoveryResult,
      }));

      // Import main.ts - this triggers main() execution

      require("../../src/main");

      // Wait for async operations to complete
      setTimeout(() => resolve(), 100);
    });
  });
}

describe("main", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.GITLAB_DEFAULT_PROJECT;
    delete process.env.GITLAB_DEFAULT_NAMESPACE;

    // Mock process.exit
    jest.spyOn(process, "exit").mockImplementation(mockExit as unknown as () => never);

    // Reset mock implementations to defaults
    mockStartServer.mockResolvedValue(undefined);
    mockTryApplyProfileFromEnv.mockResolvedValue(undefined);
    mockFindProjectConfig.mockResolvedValue(null);
    mockAutoDiscover.mockResolvedValue(null);
    mockParseCliArgs.mockReturnValue({
      profileName: undefined,
      noProjectConfig: false,
      showProjectConfig: false,
      auto: false,
      cwd: undefined,
      dryRun: false,
      remoteName: undefined,
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe("basic server startup", () => {
    it("should start server successfully with no flags", async () => {
      await runMain();

      expect(mockParseCliArgs).toHaveBeenCalled();
      expect(mockStartServer).toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it("should handle server startup error", async () => {
      mockStartServer.mockRejectedValue(new Error("Server failed"));

      await runMain();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to start GitLab MCP Server: Error: Server failed"
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("--show-project-config flag", () => {
    it("should display project config and exit 0", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: true,
        auto: false,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockFindProjectConfig.mockResolvedValue({
        configPath: "/test/.gitlab-mcp",
        preset: { read_only: true },
      });

      await runMain();

      expect(mockDisplayProjectConfig).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should handle error loading project config for display", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: true,
        auto: false,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockFindProjectConfig.mockRejectedValue(new Error("Config parse error"));

      await runMain();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: "Config parse error" },
        "Failed to load project config"
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("--auto flag", () => {
    it("should run auto-discovery when --auto is set", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: "/test/repo",
        dryRun: false,
        remoteName: "origin",
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.company.com",
        projectPath: "team/project",
        apiUrl: "https://gitlab.company.com",
        remote: {
          host: "gitlab.company.com",
          projectPath: "team/project",
          protocol: "ssh",
          url: "git@gitlab.company.com:team/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: null,
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });

      await runMain();

      expect(mockAutoDiscover).toHaveBeenCalledWith({
        repoPath: "/test/repo",
        remoteName: "origin",
        noProjectConfig: true,
        dryRun: false,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ host: "gitlab.company.com" }),
        "Auto-discovery detected GitLab configuration"
      );
    });

    it("should display results and exit on --dry-run", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: true,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.com",
        projectPath: "group/project",
        apiUrl: "https://gitlab.com",
        remote: {
          host: "gitlab.com",
          projectPath: "group/project",
          protocol: "https",
          url: "https://gitlab.com/group/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: null,
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });
      mockFormatDiscoveryResult.mockReturnValue("Discovery output");

      await runMain();

      expect(mockFormatDiscoveryResult).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Discovery output");
      expect(mockExit).toHaveBeenCalledWith(0);
      consoleSpy.mockRestore();
    });

    it("should warn when auto-discovery returns null", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue(null);

      await runMain();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Auto-discovery failed: not in a git repository or no remote found"
      );
    });

    it("should handle auto-discovery error", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockRejectedValue(new Error("Git error"));

      await runMain();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: "Git error" },
        "Auto-discovery failed"
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("profile handling", () => {
    it("should apply CLI profile with highest priority", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: "work",
        noProjectConfig: false,
        showProjectConfig: false,
        auto: false,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockTryApplyProfileFromEnv.mockResolvedValue({
        success: true,
        profileName: "work",
        host: "gitlab.work.com",
        appliedSettings: [],
        validation: { valid: true, errors: [], warnings: [] },
      });

      await runMain();

      expect(mockTryApplyProfileFromEnv).toHaveBeenCalledWith("work");
      expect(mockLogger.info).toHaveBeenCalledWith(
        { profile: "work", host: "gitlab.work.com" },
        "Using CLI-specified profile"
      );
    });

    it("should apply CLI preset", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: "readonly",
        noProjectConfig: false,
        showProjectConfig: false,
        auto: false,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockTryApplyProfileFromEnv.mockResolvedValue({
        success: true,
        presetName: "readonly",
        appliedSettings: [],
        validation: { valid: true, errors: [], warnings: [] },
      });

      await runMain();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { preset: "readonly" },
        "Using CLI-specified preset"
      );
    });

    it("should warn when CLI profile overrides auto-discovered profile", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: "work",
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.personal.com",
        projectPath: "user/project",
        apiUrl: "https://gitlab.personal.com",
        remote: {
          host: "gitlab.personal.com",
          projectPath: "user/project",
          protocol: "ssh",
          url: "git@gitlab.personal.com:user/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: {
          profileName: "personal",
          profile: {
            name: "personal",
            host: "gitlab.personal.com",
            readOnly: false,
            isBuiltIn: false,
            isPreset: false,
          },
          matchType: "exact",
        },
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });
      mockTryApplyProfileFromEnv.mockResolvedValue({
        success: true,
        profileName: "work",
        host: "gitlab.work.com",
        appliedSettings: [],
        validation: { valid: true, errors: [], warnings: [] },
      });

      await runMain();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cliProfile: "work", autoProfile: "personal" },
        "Auto-discovered profile ignored: --profile takes precedence"
      );
    });

    it("should apply auto-discovered profile when no CLI profile", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.work.com",
        projectPath: "team/project",
        apiUrl: "https://gitlab.work.com",
        remote: {
          host: "gitlab.work.com",
          projectPath: "team/project",
          protocol: "ssh",
          url: "git@gitlab.work.com:team/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: {
          profileName: "work",
          profile: {
            name: "work",
            host: "gitlab.work.com",
            readOnly: false,
            isBuiltIn: false,
            isPreset: false,
          },
          matchType: "exact",
        },
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });
      mockTryApplyProfileFromEnv.mockResolvedValue({
        success: true,
        profileName: "work",
        host: "gitlab.work.com",
        appliedSettings: [],
        validation: { valid: true, errors: [], warnings: [] },
      });

      await runMain();

      expect(mockTryApplyProfileFromEnv).toHaveBeenCalledWith("work");
      expect(mockLogger.info).toHaveBeenCalledWith(
        { profile: "work", host: "gitlab.work.com" },
        "Using auto-discovered profile"
      );
    });

    it("should warn when auto-discovered profile loading fails", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.work.com",
        projectPath: "team/project",
        apiUrl: "https://gitlab.work.com",
        remote: {
          host: "gitlab.work.com",
          projectPath: "team/project",
          protocol: "ssh",
          url: "git@gitlab.work.com:team/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: {
          profileName: "work",
          profile: {
            name: "work",
            host: "gitlab.work.com",
            readOnly: false,
            isBuiltIn: false,
            isPreset: false,
          },
          matchType: "exact",
        },
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });
      mockTryApplyProfileFromEnv.mockRejectedValue(new Error("Token expired"));

      await runMain();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: "Token expired" },
        "Failed to apply auto-discovered profile"
      );
    });

    it("should apply default profile from env when no CLI and no auto-discovery", async () => {
      mockTryApplyProfileFromEnv.mockResolvedValue({
        success: true,
        profileName: "default",
        host: "gitlab.com",
        appliedSettings: [],
        validation: { valid: true, errors: [], warnings: [] },
      });

      await runMain();

      expect(mockTryApplyProfileFromEnv).toHaveBeenCalledWith();
      expect(mockLogger.info).toHaveBeenCalledWith(
        { profile: "default", host: "gitlab.com" },
        "Using configuration profile"
      );
    });

    it("should apply default preset from env", async () => {
      mockTryApplyProfileFromEnv.mockResolvedValue({
        success: true,
        presetName: "readonly",
        appliedSettings: [],
        validation: { valid: true, errors: [], warnings: [] },
      });

      await runMain();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { preset: "readonly" },
        "Using configuration preset"
      );
    });

    it("should handle profile loading error", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: "nonexistent",
        noProjectConfig: false,
        showProjectConfig: false,
        auto: false,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockTryApplyProfileFromEnv.mockRejectedValue(new Error("Profile not found"));

      await runMain();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: "Profile not found" },
        "Failed to load profile"
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should handle default profile loading error", async () => {
      mockTryApplyProfileFromEnv.mockRejectedValue(new Error("Config error"));

      await runMain();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: "Config error" },
        "Failed to load profile"
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("project config loading", () => {
    it("should load project config when not disabled", async () => {
      mockFindProjectConfig.mockResolvedValue({
        configPath: "/project/.gitlab-mcp",
        preset: { read_only: true },
      });
      mockGetProjectConfigSummary.mockReturnValue({
        presetSummary: "read-only",
        profileSummary: null,
      });

      await runMain();

      expect(mockFindProjectConfig).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/project/.gitlab-mcp" }),
        "Loaded project configuration (restrictions applied)"
      );
    });

    it("should skip project config when --no-project-config is set", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: true,
        showProjectConfig: false,
        auto: false,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });

      await runMain();

      // findProjectConfig is still called for tryApplyProfileFromEnv,
      // but project config loading step is skipped
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        "Loaded project configuration (restrictions applied)"
      );
    });

    it("should warn when project config loading fails", async () => {
      mockFindProjectConfig.mockRejectedValue(new Error("Parse error"));

      await runMain();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: "Parse error" },
        "Failed to load project config, continuing without it"
      );
    });
  });

  describe("default context from auto-discovery", () => {
    it("should set default project and namespace from auto-discovery", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.com",
        projectPath: "group/subgroup/project",
        apiUrl: "https://gitlab.com",
        remote: {
          host: "gitlab.com",
          projectPath: "group/subgroup/project",
          protocol: "ssh",
          url: "git@gitlab.com:group/subgroup/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: null,
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });

      await runMain();

      expect(process.env.GITLAB_DEFAULT_PROJECT).toBe("group/subgroup/project");
      expect(process.env.GITLAB_DEFAULT_NAMESPACE).toBe("group/subgroup");
    });

    it("should set namespace to project path for single-segment paths", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.com",
        projectPath: "myproject",
        apiUrl: "https://gitlab.com",
        remote: {
          host: "gitlab.com",
          projectPath: "myproject",
          protocol: "ssh",
          url: "git@gitlab.com:myproject.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: null,
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });

      await runMain();

      expect(process.env.GITLAB_DEFAULT_PROJECT).toBe("myproject");
      expect(process.env.GITLAB_DEFAULT_NAMESPACE).toBe("myproject");
    });

    it("should not override existing default project", async () => {
      process.env.GITLAB_DEFAULT_PROJECT = "existing/project";
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.com",
        projectPath: "new/project",
        apiUrl: "https://gitlab.com",
        remote: {
          host: "gitlab.com",
          projectPath: "new/project",
          protocol: "ssh",
          url: "git@gitlab.com:new/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: null,
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });

      await runMain();

      expect(process.env.GITLAB_DEFAULT_PROJECT).toBe("existing/project");
    });

    it("should not override existing default namespace", async () => {
      process.env.GITLAB_DEFAULT_NAMESPACE = "existing";
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.com",
        projectPath: "new/project",
        apiUrl: "https://gitlab.com",
        remote: {
          host: "gitlab.com",
          projectPath: "new/project",
          protocol: "ssh",
          url: "git@gitlab.com:new/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: null,
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });

      await runMain();

      expect(process.env.GITLAB_DEFAULT_NAMESPACE).toBe("existing");
    });

    it("should log debug message after setting default context", async () => {
      mockParseCliArgs.mockReturnValue({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
        auto: true,
        cwd: undefined,
        dryRun: false,
        remoteName: undefined,
      });
      mockAutoDiscover.mockResolvedValue({
        host: "gitlab.com",
        projectPath: "team/project",
        apiUrl: "https://gitlab.com",
        remote: {
          host: "gitlab.com",
          projectPath: "team/project",
          protocol: "ssh",
          url: "git@gitlab.com:team/project.git",
          remoteName: "origin",
        },
        availableRemotes: [],
        matchedProfile: null,
        profileApplied: false,
        projectConfig: null,
        projectConfigApplied: false,
      });

      await runMain();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          defaultProject: "team/project",
          defaultNamespace: "team",
        },
        "Default context set from auto-discovery"
      );
    });
  });
});
