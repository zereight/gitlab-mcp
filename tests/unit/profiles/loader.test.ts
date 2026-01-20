/**
 * Unit tests for ProfileLoader class
 * Tests loading profiles from user config and presets from built-in directory
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { ProfileLoader } from "../../../src/profiles/loader";
import { Profile, Preset } from "../../../src/profiles/types";

// Mock logger
jest.mock("../../../src/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fs module
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

describe("ProfileLoader", () => {
  const testUserConfigPath = "/test/config/profiles.yaml";
  const testBuiltinDir = "/test/builtin";

  let loader: ProfileLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    loader = new ProfileLoader(testUserConfigPath, testBuiltinDir);
  });

  describe("loadProfile", () => {
    it("should load a valid user profile", async () => {
      const profileConfig = {
        profiles: {
          work: {
            host: "gitlab.company.com",
            auth: { type: "pat", token_env: "WORK_TOKEN" },
            read_only: false,
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      const profile = await loader.loadProfile("work");

      expect(profile.host).toBe("gitlab.company.com");
      expect(profile.auth.type).toBe("pat");
      expect(profile.read_only).toBe(false);
    });

    it("should cache loaded profiles", async () => {
      const profileConfig = {
        profiles: {
          cached: {
            host: "gitlab.example.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      // Load twice
      const profile1 = await loader.loadProfile("cached");
      const profile2 = await loader.loadProfile("cached");

      // Should be same reference (cached)
      expect(profile1).toBe(profile2);
      // readFileSync should only be called once for config
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it("should use config cache when loading multiple different profiles", async () => {
      const profileConfig = {
        profiles: {
          first: {
            host: "gitlab.first.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
          second: {
            host: "gitlab.second.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      // Load two different profiles
      const profile1 = await loader.loadProfile("first");
      const profile2 = await loader.loadProfile("second");

      // Different profiles should have different hosts
      expect(profile1.host).toBe("gitlab.first.com");
      expect(profile2.host).toBe("gitlab.second.com");

      // Config file should only be read once (config cache hit on second load)
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it("should throw error for non-existent profile", async () => {
      const profileConfig = {
        profiles: {
          existing: {
            host: "gitlab.example.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      await expect(loader.loadProfile("nonexistent")).rejects.toThrow(
        "Profile 'nonexistent' not found"
      );
    });

    it("should throw error when user config file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(loader.loadProfile("any")).rejects.toThrow("Profile 'any' not found");
    });

    it("should throw error for invalid YAML", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid: yaml: content:");

      await expect(loader.loadProfile("any")).rejects.toThrow("Invalid profiles config");
    });
  });

  describe("loadPreset", () => {
    it("should load a valid built-in preset", async () => {
      const presetContent = yaml.stringify({
        description: "Read-only preset",
        read_only: true,
        denied_tools_regex: "^manage_",
        features: { wiki: true, variables: false },
      });

      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        return p === path.join(testBuiltinDir, "readonly.yaml");
      });
      mockFs.readFileSync.mockReturnValue(presetContent);

      const preset = await loader.loadPreset("readonly");

      expect(preset.description).toBe("Read-only preset");
      expect(preset.read_only).toBe(true);
      expect(preset.denied_tools_regex).toBe("^manage_");
    });

    it("should cache loaded presets", async () => {
      const presetContent = yaml.stringify({
        description: "Cached preset",
        features: { wiki: true },
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(presetContent);

      const preset1 = await loader.loadPreset("cached");
      const preset2 = await loader.loadPreset("cached");

      expect(preset1).toBe(preset2);
    });

    it("should throw error for non-existent preset", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(loader.loadPreset("nonexistent")).rejects.toThrow(
        "Preset 'nonexistent' not found in built-in presets"
      );
    });

    it("should throw error for invalid preset YAML", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid: yaml: content:");

      await expect(loader.loadPreset("invalid")).rejects.toThrow(
        "Invalid built-in preset 'invalid'"
      );
    });
  });

  describe("loadAny", () => {
    it("should return profile when name matches user profile", async () => {
      const profileConfig = {
        profiles: {
          work: {
            host: "gitlab.company.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      const result = await loader.loadAny("work");

      expect(result.type).toBe("profile");
      expect((result.data as Profile).host).toBe("gitlab.company.com");
    });

    it("should return preset when name matches built-in preset", async () => {
      // First call: user config does not exist
      // Second call: preset exists
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr === testUserConfigPath) return false;
        if (pathStr === path.join(testBuiltinDir, "readonly.yaml")) return true;
        return false;
      });

      const presetContent = yaml.stringify({
        description: "Readonly preset",
        read_only: true,
        features: { wiki: true },
      });
      mockFs.readFileSync.mockReturnValue(presetContent);

      const result = await loader.loadAny("readonly");

      expect(result.type).toBe("preset");
      expect((result.data as Preset).read_only).toBe(true);
    });

    it("should throw error when name not found as profile or preset", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(loader.loadAny("unknown")).rejects.toThrow(
        "'unknown' not found as user profile or built-in preset"
      );
    });
  });

  describe("getDefaultProfileName", () => {
    it("should return default_profile from config", async () => {
      const profileConfig = {
        profiles: {
          work: {
            host: "gitlab.company.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
        default_profile: "work",
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      const defaultName = await loader.getDefaultProfileName();

      expect(defaultName).toBe("work");
    });

    it("should return undefined when no default_profile set", async () => {
      const profileConfig = {
        profiles: {
          work: {
            host: "gitlab.company.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      const defaultName = await loader.getDefaultProfileName();

      expect(defaultName).toBeUndefined();
    });

    it("should return undefined when config file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const defaultName = await loader.getDefaultProfileName();

      expect(defaultName).toBeUndefined();
    });
  });

  describe("listProfiles", () => {
    it("should list user profiles and built-in presets", async () => {
      // User profiles config
      const profileConfig = {
        profiles: {
          work: {
            host: "gitlab.company.com",
            auth: { type: "pat", token_env: "TOKEN" },
            read_only: false,
          },
        },
      };

      // Built-in presets
      const readonlyPreset = yaml.stringify({
        description: "Readonly preset",
        read_only: true,
        features: {},
      });

      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        return (
          pathStr === testUserConfigPath ||
          pathStr === testBuiltinDir ||
          pathStr.endsWith("readonly.yaml")
        );
      });

      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = p.toString();
        if (pathStr === testUserConfigPath) {
          return yaml.stringify(profileConfig);
        }
        return readonlyPreset;
      });

      (mockFs.readdirSync as jest.Mock).mockReturnValue(["readonly.yaml"]);

      const profiles = await loader.listProfiles();

      // Should have user profile first, then preset
      expect(profiles.length).toBe(2);

      // User profile
      const workProfile = profiles.find(p => p.name === "work");
      expect(workProfile).toBeDefined();
      expect(workProfile?.isPreset).toBe(false);
      expect(workProfile?.isBuiltIn).toBe(false);
      expect(workProfile?.host).toBe("gitlab.company.com");

      // Built-in preset
      const readonlyProfile = profiles.find(p => p.name === "readonly");
      expect(readonlyProfile).toBeDefined();
      expect(readonlyProfile?.isPreset).toBe(true);
      expect(readonlyProfile?.isBuiltIn).toBe(true);
      expect(readonlyProfile?.host).toBeUndefined(); // Presets don't have host
    });

    it("should sort user profiles before presets", async () => {
      const profileConfig = {
        profiles: {
          zzz: {
            host: "gitlab.example.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      const presetContent = yaml.stringify({
        description: "AAA preset",
        features: {},
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = p.toString();
        if (pathStr === testUserConfigPath) {
          return yaml.stringify(profileConfig);
        }
        return presetContent;
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(["aaa.yaml"]);

      const profiles = await loader.listProfiles();

      // User profile (zzz) should come before preset (aaa)
      expect(profiles[0].name).toBe("zzz");
      expect(profiles[0].isPreset).toBe(false);
      expect(profiles[1].name).toBe("aaa");
      expect(profiles[1].isPreset).toBe(true);
    });

    it("should sort profiles alphabetically within the same category", async () => {
      const profileConfig = {
        profiles: {
          zebra: {
            host: "gitlab.zebra.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
          alpha: {
            host: "gitlab.alpha.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
          mike: {
            host: "gitlab.mike.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr === testUserConfigPath) return true;
        if (pathStr === testBuiltinDir) return false;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      const profiles = await loader.listProfiles();

      // Should be sorted alphabetically: alpha, mike, zebra
      expect(profiles.length).toBe(3);
      expect(profiles[0].name).toBe("alpha");
      expect(profiles[1].name).toBe("mike");
      expect(profiles[2].name).toBe("zebra");
    });

    it("should handle empty profiles list when no user config exists", async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        // User config doesn't exist, builtin dir exists
        if (pathStr === testUserConfigPath) return false;
        if (pathStr === testBuiltinDir) return true;
        return pathStr.endsWith(".yaml");
      });

      const presetContent = yaml.stringify({
        description: "Test preset",
        features: {},
      });
      mockFs.readFileSync.mockReturnValue(presetContent);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(["test.yaml"]);

      const profiles = await loader.listProfiles();

      // Should only have preset, no user profiles
      expect(profiles.length).toBe(1);
      expect(profiles[0].isPreset).toBe(true);
    });

    it("should handle empty presets when builtin dir does not exist", async () => {
      const profileConfig = {
        profiles: {
          work: {
            host: "gitlab.example.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        // User config exists, builtin dir doesn't
        if (pathStr === testUserConfigPath) return true;
        if (pathStr === testBuiltinDir) return false;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      const profiles = await loader.listProfiles();

      // Should only have user profile, no presets
      expect(profiles.length).toBe(1);
      expect(profiles[0].isPreset).toBe(false);
    });

    it("should skip invalid presets and continue", async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr === testUserConfigPath) return false;
        return true; // Builtin dir and all files exist
      });

      // First preset is valid, second is invalid
      let callCount = 0;
      mockFs.readFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return yaml.stringify({ description: "Valid preset", features: {} });
        }
        return "invalid: yaml: content:"; // Invalid YAML
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(["valid.yaml", "invalid.yaml"]);

      const profiles = await loader.listProfiles();

      // Should only have the valid preset
      expect(profiles.length).toBe(1);
      expect(profiles[0].name).toBe("valid");
    });
  });

  describe("validateProfile", () => {
    it("should validate profile with existing env vars", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "MY_TOKEN" },
      };

      // Set the env var
      process.env.MY_TOKEN = "test-token";

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);

      // Cleanup
      delete process.env.MY_TOKEN;
    });

    it("should warn when token env var is not set", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "MISSING_TOKEN" },
      };

      // Ensure env var is not set
      delete process.env.MISSING_TOKEN;

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(true); // Warnings don't invalidate
      expect(result.warnings).toContain("Environment variable 'MISSING_TOKEN' is not set");
    });

    it("should error on invalid denied_tools_regex", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_tools_regex: "[invalid(",
      };

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid regex"))).toBe(true);
    });

    it("should error on invalid denied_actions format", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_actions: ["manage_repository:delete", "invalid_action"], // Missing colon
      };

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid denied_action format"))).toBe(true);
    });

    it("should error on denied_actions with empty tool part", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_actions: [":action"], // Empty tool
      };

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid denied_action format"))).toBe(true);
    });

    it("should error on denied_actions with empty action part", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_actions: ["tool:"], // Empty action
      };

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid denied_action format"))).toBe(true);
    });

    it("should error on denied_actions with only colon", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_actions: [":"], // Both empty
      };

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid denied_action format"))).toBe(true);
    });

    it("should warn on denied_actions with extra whitespace", async () => {
      process.env.TOKEN = "test-token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_actions: ["tool : action", " tool:action ", "tool:action"], // Various whitespace
      };

      const result = await loader.validateProfile(profile);

      // Should be valid but with warnings
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBe(2); // Two entries have extra whitespace
      expect(result.warnings.some(w => w.includes("extra whitespace"))).toBe(true);
    });

    it("should error when SSL cert path does not exist", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        ssl_cert_path: "/nonexistent/cert.pem",
      };

      mockFs.existsSync.mockReturnValue(false);

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("SSL certificate not found"))).toBe(true);
    });

    it("should error when SSL key path does not exist", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        ssl_key_path: "/nonexistent/key.pem",
      };

      mockFs.existsSync.mockReturnValue(false);

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("SSL key not found"))).toBe(true);
    });

    it("should error when CA cert path does not exist", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        ca_cert_path: "/nonexistent/ca.pem",
      };

      mockFs.existsSync.mockReturnValue(false);

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("CA certificate not found"))).toBe(true);
    });

    it("should warn when OAuth client_id_env is not set", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: {
          type: "oauth",
          client_id_env: "MISSING_CLIENT_ID",
          client_secret_env: "OAUTH_SECRET",
        },
      };

      // Set secret but not client ID
      process.env.OAUTH_SECRET = "secret";
      delete process.env.MISSING_CLIENT_ID;

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Environment variable 'MISSING_CLIENT_ID' is not set");

      delete process.env.OAUTH_SECRET;
    });

    it("should warn when OAuth client_secret_env is not set", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: {
          type: "oauth",
          client_id_env: "OAUTH_CLIENT_ID",
          client_secret_env: "MISSING_SECRET",
        },
      };

      // Set client ID but not secret
      process.env.OAUTH_CLIENT_ID = "client-id";
      delete process.env.MISSING_SECRET;

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Environment variable 'MISSING_SECRET' is not set");

      delete process.env.OAUTH_CLIENT_ID;
    });

    it("should error when cookie path does not exist", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: {
          type: "cookie",
          cookie_path: "/nonexistent/cookies.txt",
        },
      };

      mockFs.existsSync.mockReturnValue(false);

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Cookie file not found"))).toBe(true);
    });

    it("should pass validation when all OAuth env vars are set", async () => {
      const profile: Profile = {
        host: "gitlab.example.com",
        auth: {
          type: "oauth",
          client_id_env: "OAUTH_ID",
          client_secret_env: "OAUTH_SECRET",
        },
      };

      process.env.OAUTH_ID = "id";
      process.env.OAUTH_SECRET = "secret";

      const result = await loader.validateProfile(profile);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);

      delete process.env.OAUTH_ID;
      delete process.env.OAUTH_SECRET;
    });
  });

  describe("validatePreset", () => {
    it("should validate valid preset", async () => {
      const preset: Preset = {
        description: "Test preset",
        read_only: true,
        features: { wiki: true },
      };

      const result = await loader.validatePreset(preset);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should error on invalid denied_tools_regex", async () => {
      const preset: Preset = {
        denied_tools_regex: "[invalid(",
        features: {},
      };

      const result = await loader.validatePreset(preset);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid regex"))).toBe(true);
    });

    it("should error on invalid denied_actions format", async () => {
      const preset: Preset = {
        denied_actions: ["no_colon_here"],
        features: {},
      };

      const result = await loader.validatePreset(preset);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid denied_action format"))).toBe(true);
    });

    it("should error on preset denied_actions with empty parts", async () => {
      // Test all edge cases: empty tool, empty action, both empty
      const testCases = [":action", "tool:", ":"];

      for (const action of testCases) {
        const preset: Preset = {
          denied_actions: [action],
          features: {},
        };

        const result = await loader.validatePreset(preset);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes("Invalid denied_action format"))).toBe(true);
      }
    });
  });

  describe("clearCache", () => {
    it("should clear all caches", async () => {
      // Load something to populate cache
      const profileConfig = {
        profiles: {
          test: {
            host: "gitlab.example.com",
            auth: { type: "pat", token_env: "TOKEN" },
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.stringify(profileConfig));

      await loader.loadProfile("test");

      // Clear and reload
      loader.clearCache();

      // Should read from file again
      await loader.loadProfile("test");

      // readFileSync should be called twice now (once before clear, once after)
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe("static methods", () => {
    it("getUserConfigPath should return expected path", () => {
      const configPath = ProfileLoader.getUserConfigPath();
      expect(configPath).toContain(".config");
      expect(configPath).toContain("gitlab-mcp");
      expect(configPath).toContain("profiles.yaml");
    });

    it("ensureConfigDir should create directory if not exists", () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => undefined);

      ProfileLoader.ensureConfigDir();

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    it("ensureConfigDir should not create directory if exists", () => {
      mockFs.existsSync.mockReturnValue(true);

      ProfileLoader.ensureConfigDir();

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("standalone functions", () => {
    it("getProfileNameFromEnv should return GITLAB_PROFILE env var", async () => {
      const originalEnv = process.env.GITLAB_PROFILE;
      process.env.GITLAB_PROFILE = "my-profile";

      const { getProfileNameFromEnv } = await import("../../../src/profiles/loader");
      const result = getProfileNameFromEnv();

      expect(result).toBe("my-profile");

      if (originalEnv !== undefined) {
        process.env.GITLAB_PROFILE = originalEnv;
      } else {
        delete process.env.GITLAB_PROFILE;
      }
    });

    it("getProfileNameFromEnv should return undefined when env var not set", async () => {
      const originalEnv = process.env.GITLAB_PROFILE;
      delete process.env.GITLAB_PROFILE;

      const { getProfileNameFromEnv } = await import("../../../src/profiles/loader");
      const result = getProfileNameFromEnv();

      expect(result).toBeUndefined();

      if (originalEnv !== undefined) {
        process.env.GITLAB_PROFILE = originalEnv;
      }
    });
  });
});
