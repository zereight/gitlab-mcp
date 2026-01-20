/**
 * Unit tests for cli-utils.ts
 * Tests CLI argument parsing and project config display
 */

import { parseCliArgs, displayProjectConfig } from "../../src/cli-utils";
import { ProjectConfig } from "../../src/profiles";

// Mock logger
jest.mock("../../src/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock profiles module for getProjectConfigSummary
jest.mock("../../src/profiles", () => ({
  getProjectConfigSummary: jest.fn((config: ProjectConfig) => ({
    presetSummary: config.preset?.description || (config.preset ? "custom restrictions" : null),
    profileSummary: config.profile?.description || (config.profile ? "custom profile" : null),
  })),
  // Re-export types for type checking
  ProjectConfig: {},
}));

import { logger } from "../../src/logger";

const mockLogger = logger as jest.Mocked<typeof logger>;

describe("cli-utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("parseCliArgs", () => {
    it("should return default values when no args provided", () => {
      const result = parseCliArgs(["node", "main.js"]);

      expect(result).toEqual({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
      });
    });

    it("should parse --profile flag", () => {
      const result = parseCliArgs(["node", "main.js", "--profile", "work"]);

      expect(result.profileName).toBe("work");
    });

    it("should parse --no-project-config flag", () => {
      const result = parseCliArgs(["node", "main.js", "--no-project-config"]);

      expect(result.noProjectConfig).toBe(true);
    });

    it("should parse --show-project-config flag", () => {
      const result = parseCliArgs(["node", "main.js", "--show-project-config"]);

      expect(result.showProjectConfig).toBe(true);
    });

    it("should parse multiple flags together", () => {
      const result = parseCliArgs([
        "node",
        "main.js",
        "--profile",
        "production",
        "--no-project-config",
      ]);

      expect(result.profileName).toBe("production");
      expect(result.noProjectConfig).toBe(true);
    });

    it("should throw error when --profile has no value", () => {
      expect(() => parseCliArgs(["node", "main.js", "--profile"])).toThrow(
        "--profile requires a profile name"
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should throw error when --profile is followed by another flag", () => {
      expect(() => parseCliArgs(["node", "main.js", "--profile", "--no-project-config"])).toThrow(
        "--profile requires a profile name"
      );
    });

    it("should use first value when multiple --profile flags provided", () => {
      const result = parseCliArgs(["node", "main.js", "--profile", "first", "--profile", "second"]);

      expect(result.profileName).toBe("first");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { count: 2 },
        "Multiple --profile flags detected, using first value"
      );
    });

    it("should ignore unknown flags", () => {
      const result = parseCliArgs(["node", "main.js", "--unknown-flag", "value"]);

      expect(result).toEqual({
        profileName: undefined,
        noProjectConfig: false,
        showProjectConfig: false,
      });
    });
  });

  describe("displayProjectConfig", () => {
    let outputLines: string[];
    let mockOutput: jest.Mock;

    beforeEach(() => {
      outputLines = [];
      mockOutput = jest.fn((msg: string) => outputLines.push(msg));
    });

    it("should display message when no config found", () => {
      displayProjectConfig(null, mockOutput);

      expect(outputLines[0]).toContain("No project configuration found");
      expect(outputLines.some(l => l.includes("preset.yaml"))).toBe(true);
      expect(outputLines.some(l => l.includes("profile.yaml"))).toBe(true);
    });

    it("should display config path", () => {
      const config: ProjectConfig = {
        configPath: "/test/project/.gitlab-mcp",
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("/test/project/.gitlab-mcp"))).toBe(true);
    });

    it("should display preset with description", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          description: "Backend API restrictions",
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("Backend API restrictions"))).toBe(true);
    });

    it("should display preset with project scope", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          scope: { project: "myteam/backend" },
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes('project "myteam/backend"'))).toBe(true);
    });

    it("should display preset with namespace scope", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          scope: { namespace: "myteam" },
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes('namespace "myteam/*"'))).toBe(true);
    });

    it("should display preset with projects list scope", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          scope: { projects: ["proj1", "proj2", "proj3"] },
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("3 projects"))).toBe(true);
      expect(outputLines.some(l => l.includes("- proj1"))).toBe(true);
    });

    it("should display preset with read_only flag", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          read_only: true,
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("Read-only: yes"))).toBe(true);
    });

    it("should display preset with denied_actions", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          denied_actions: ["manage_files:delete", "manage_variable:delete"],
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("manage_files:delete, manage_variable:delete"))).toBe(
        true
      );
    });

    it("should display preset with denied_tools", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          denied_tools: ["browse_wiki", "manage_webhook"],
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("browse_wiki, manage_webhook"))).toBe(true);
    });

    it("should display preset with features", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          features: {
            wiki: false,
            pipelines: true,
          },
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("wiki=false"))).toBe(true);
      expect(outputLines.some(l => l.includes("pipelines=true"))).toBe(true);
    });

    it("should display profile with description", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        profile: {
          description: "MR focused workflow",
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("MR focused workflow"))).toBe(true);
    });

    it("should display profile with extends", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        profile: {
          extends: "senior-dev",
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("Extends: senior-dev"))).toBe(true);
    });

    it("should display profile with additional_tools", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        profile: {
          additional_tools: ["manage_pipeline", "browse_commits"],
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("manage_pipeline, browse_commits"))).toBe(true);
    });

    it("should display profile with denied_tools", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        profile: {
          denied_tools: ["browse_wiki"],
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("Denied tools: browse_wiki"))).toBe(true);
    });

    it("should display profile with features", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        profile: {
          features: {
            webhooks: true,
          },
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("webhooks=true"))).toBe(true);
    });

    it("should display summary section", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: { description: "Test preset" },
        profile: { description: "Test profile" },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("Summary:"))).toBe(true);
      expect(outputLines.some(l => l.includes("Preset:"))).toBe(true);
      expect(outputLines.some(l => l.includes("Profile:"))).toBe(true);
    });

    it("should display both preset and profile when both present", () => {
      const config: ProjectConfig = {
        configPath: "/test",
        preset: {
          description: "Restrictions",
          read_only: true,
        },
        profile: {
          description: "Tools",
          extends: "pm",
        },
      };

      displayProjectConfig(config, mockOutput);

      expect(outputLines.some(l => l.includes("Preset (restrictions):"))).toBe(true);
      expect(outputLines.some(l => l.includes("Profile (tool selection):"))).toBe(true);
    });
  });
});
