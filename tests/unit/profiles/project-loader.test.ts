/**
 * Tests for project-level configuration loader
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  loadProjectConfig,
  findProjectConfig,
  validateProjectPreset,
  validateProjectProfile,
  getProjectConfigSummary,
  PROJECT_CONFIG_DIR,
  PROJECT_PRESET_FILE,
  PROJECT_PROFILE_FILE,
} from "../../../src/profiles/project-loader";
import {
  ProjectConfig,
  ProjectPreset,
  ProjectProfile,
  ScopeConfigSchema,
} from "../../../src/profiles/types";

describe("project-loader", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mcp-test-"));
  });

  afterEach(() => {
    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("loadProjectConfig", () => {
    it("should return null when .gitlab-mcp/ directory does not exist", async () => {
      const result = await loadProjectConfig(testDir);
      expect(result).toBeNull();
    });

    it("should return null when .gitlab-mcp/ exists but contains no config files", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      const result = await loadProjectConfig(testDir);
      expect(result).toBeNull();
    });

    it("should return null when .gitlab-mcp/ exists but is a file, not a directory", async () => {
      const configPath = path.join(testDir, PROJECT_CONFIG_DIR);
      // Create .gitlab-mcp as a file instead of directory
      fs.writeFileSync(configPath, "this is a file, not a directory");

      const result = await loadProjectConfig(testDir);
      expect(result).toBeNull();
    });

    it("should load preset.yaml when it exists", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      const presetContent = `
description: "Test project preset"
read_only: true
denied_actions:
  - "manage_files:delete"
`;
      fs.writeFileSync(path.join(configDir, PROJECT_PRESET_FILE), presetContent);

      const result = await loadProjectConfig(testDir);

      expect(result).not.toBeNull();
      expect(result?.configPath).toBe(configDir);
      expect(result?.preset).toBeDefined();
      expect(result?.preset?.description).toBe("Test project preset");
      expect(result?.preset?.read_only).toBe(true);
      expect(result?.preset?.denied_actions).toEqual(["manage_files:delete"]);
    });

    it("should load profile.yaml when it exists", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      const profileContent = `
description: "Test project profile"
extends: "senior-dev"
additional_tools:
  - "manage_pipeline"
denied_tools:
  - "browse_wiki"
`;
      fs.writeFileSync(path.join(configDir, PROJECT_PROFILE_FILE), profileContent);

      const result = await loadProjectConfig(testDir);

      expect(result).not.toBeNull();
      expect(result?.configPath).toBe(configDir);
      expect(result?.profile).toBeDefined();
      expect(result?.profile?.description).toBe("Test project profile");
      expect(result?.profile?.extends).toBe("senior-dev");
      expect(result?.profile?.additional_tools).toEqual(["manage_pipeline"]);
      expect(result?.profile?.denied_tools).toEqual(["browse_wiki"]);
    });

    it("should load both preset.yaml and profile.yaml when they exist", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      fs.writeFileSync(
        path.join(configDir, PROJECT_PRESET_FILE),
        `
description: "Preset"
read_only: true
`
      );

      fs.writeFileSync(
        path.join(configDir, PROJECT_PROFILE_FILE),
        `
description: "Profile"
extends: "pm"
`
      );

      const result = await loadProjectConfig(testDir);

      expect(result).not.toBeNull();
      expect(result?.preset).toBeDefined();
      expect(result?.profile).toBeDefined();
      expect(result?.preset?.description).toBe("Preset");
      expect(result?.profile?.description).toBe("Profile");
    });

    it("should load preset with scope configuration", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      const presetContent = `
description: "Scoped preset"
scope:
  project: "myteam/backend"
`;
      fs.writeFileSync(path.join(configDir, PROJECT_PRESET_FILE), presetContent);

      const result = await loadProjectConfig(testDir);

      expect(result?.preset?.scope).toBeDefined();
      expect(result?.preset?.scope?.project).toBe("myteam/backend");
    });

    it("should load preset with namespace scope", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      const presetContent = `
description: "Namespace scoped"
scope:
  namespace: "myteam"
`;
      fs.writeFileSync(path.join(configDir, PROJECT_PRESET_FILE), presetContent);

      const result = await loadProjectConfig(testDir);

      expect(result?.preset?.scope?.namespace).toBe("myteam");
    });

    it("should load preset with multiple projects scope", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      const presetContent = `
description: "Multi-project scope"
scope:
  projects:
    - "myteam/frontend"
    - "myteam/backend"
    - "myteam/shared-libs"
`;
      fs.writeFileSync(path.join(configDir, PROJECT_PRESET_FILE), presetContent);

      const result = await loadProjectConfig(testDir);

      expect(result?.preset?.scope?.projects).toEqual([
        "myteam/frontend",
        "myteam/backend",
        "myteam/shared-libs",
      ]);
    });

    it("should throw on invalid preset YAML", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      fs.writeFileSync(
        path.join(configDir, PROJECT_PRESET_FILE),
        `
invalid_field: "not allowed"
`
      );

      await expect(loadProjectConfig(testDir)).rejects.toThrow(/Invalid project preset/);
    });

    it("should throw on invalid profile YAML", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      fs.writeFileSync(
        path.join(configDir, PROJECT_PROFILE_FILE),
        `
host: "should not be here"
`
      );

      await expect(loadProjectConfig(testDir)).rejects.toThrow(/Invalid project profile/);
    });

    it("should load preset with features configuration", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);

      const presetContent = `
description: "Features preset"
features:
  wiki: false
  pipelines: true
  webhooks: false
`;
      fs.writeFileSync(path.join(configDir, PROJECT_PRESET_FILE), presetContent);

      const result = await loadProjectConfig(testDir);

      expect(result?.preset?.features).toEqual({
        wiki: false,
        pipelines: true,
        webhooks: false,
      });
    });
  });

  describe("findProjectConfig", () => {
    it("should find config in current directory", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);
      fs.writeFileSync(path.join(configDir, PROJECT_PRESET_FILE), 'description: "Found"\n');

      const result = await findProjectConfig(testDir);

      expect(result).not.toBeNull();
      expect(result?.preset?.description).toBe("Found");
    });

    it("should find config in parent directory", async () => {
      const configDir = path.join(testDir, PROJECT_CONFIG_DIR);
      fs.mkdirSync(configDir);
      fs.writeFileSync(path.join(configDir, PROJECT_PRESET_FILE), 'description: "In parent"\n');

      const subDir = path.join(testDir, "src", "components");
      fs.mkdirSync(subDir, { recursive: true });

      const result = await findProjectConfig(subDir);

      expect(result).not.toBeNull();
      expect(result?.preset?.description).toBe("In parent");
    });

    it("should stop at .git directory without .gitlab-mcp", async () => {
      // Create .git directory but no .gitlab-mcp
      fs.mkdirSync(path.join(testDir, ".git"));

      const subDir = path.join(testDir, "src");
      fs.mkdirSync(subDir);

      const result = await findProjectConfig(subDir);

      expect(result).toBeNull();
    });

    it("should return null when no config found", async () => {
      const result = await findProjectConfig(testDir);
      expect(result).toBeNull();
    });
  });

  describe("validateProjectPreset", () => {
    it("should validate a valid preset", () => {
      const preset: ProjectPreset = {
        description: "Test",
        read_only: true,
      };

      const result = validateProjectPreset(preset);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate denied_actions format", () => {
      const preset: ProjectPreset = {
        denied_actions: ["invalid_format", "tool:valid_action"],
      };

      const result = validateProjectPreset(preset);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Invalid denied_action format 'invalid_format', expected 'tool:action'"
      );
    });

    it("should warn about namespace-only scope", () => {
      const preset: ProjectPreset = {
        scope: {
          namespace: "myteam",
        },
      };

      const result = validateProjectPreset(preset);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("namespace 'myteam'");
    });

    it("should error when scope combines project with projects (schema validation)", () => {
      // This validation is handled by the Zod schema refinement, not validateProjectPreset
      const invalidScope = {
        project: "single/project",
        projects: ["list/project1", "list/project2"],
      };

      const result = ScopeConfigSchema.safeParse(invalidScope);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Cannot combine 'project' with 'projects'");
      }
    });
  });

  describe("validateProjectProfile", () => {
    it("should validate a valid profile", () => {
      const profile: ProjectProfile = {
        description: "Test",
        extends: "senior-dev",
      };

      const result = validateProjectProfile(profile, ["senior-dev", "pm", "ci"]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should error on unknown extends preset", () => {
      const profile: ProjectProfile = {
        extends: "nonexistent",
      };

      const result = validateProjectProfile(profile, ["senior-dev", "pm"]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Unknown preset 'nonexistent' in extends field");
    });

    it("should warn about conflicting tools", () => {
      const profile: ProjectProfile = {
        additional_tools: ["browse_wiki", "browse_files"],
        denied_tools: ["browse_wiki", "browse_commits"],
      };

      const result = validateProjectProfile(profile, []);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("browse_wiki");
    });

    it("should not warn when additional_tools and denied_tools have no overlap", () => {
      const profile: ProjectProfile = {
        additional_tools: ["browse_wiki", "browse_files"],
        denied_tools: ["browse_commits", "browse_pipelines"],
      };

      const result = validateProjectProfile(profile, []);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("getProjectConfigSummary", () => {
    it("should generate summary for preset with scope", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        preset: {
          description: "Backend API restrictions",
          scope: { project: "myteam/backend" },
          read_only: true,
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.presetSummary).toContain("Backend API restrictions");
      expect(summary.presetSummary).toContain("scope: myteam/backend");
      expect(summary.presetSummary).toContain("read-only");
      expect(summary.profileSummary).toBeNull();
    });

    it("should generate summary for profile with extends", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        profile: {
          description: "MR focused",
          extends: "senior-dev",
          additional_tools: ["tool1", "tool2"],
          denied_tools: ["tool3"],
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.profileSummary).toContain("MR focused");
      expect(summary.profileSummary).toContain("extends: senior-dev");
      expect(summary.profileSummary).toContain("+2 tools");
      expect(summary.profileSummary).toContain("-1 tools");
      expect(summary.presetSummary).toBeNull();
    });

    it("should generate summary for namespace scope", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        preset: {
          scope: { namespace: "myteam" },
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.presetSummary).toContain("scope: myteam/*");
    });

    it("should generate summary for projects list scope", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        preset: {
          scope: { projects: ["p1", "p2", "p3"] },
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.presetSummary).toContain("scope: 3 projects");
    });

    it("should generate summary with denied_actions", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        preset: {
          denied_actions: ["manage_files:delete", "manage_variable:delete"],
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.presetSummary).toContain("2 denied actions");
    });

    it("should generate fallback summary for minimal preset", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        preset: {
          // Empty preset - no description, no scope, no restrictions
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.presetSummary).toBe("custom restrictions");
    });

    it("should generate summary for profile with description only", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        profile: {
          description: "Simple profile",
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.profileSummary).toBe("Simple profile");
    });

    it("should generate summary for profile with extends only", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        profile: {
          extends: "senior-dev",
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.profileSummary).toBe("extends: senior-dev");
    });

    it("should generate summary for profile with additional_tools only", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        profile: {
          additional_tools: ["tool1", "tool2", "tool3"],
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.profileSummary).toBe("+3 tools");
    });

    it("should generate summary for profile with denied_tools only", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        profile: {
          denied_tools: ["tool1", "tool2"],
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.profileSummary).toBe("-2 tools");
    });

    it("should generate fallback summary for minimal profile", () => {
      const config: ProjectConfig = {
        configPath: "/test/.gitlab-mcp",
        profile: {
          // Empty profile
        },
      };

      const summary = getProjectConfigSummary(config);

      expect(summary.profileSummary).toBe("custom tool selection");
    });
  });
});
