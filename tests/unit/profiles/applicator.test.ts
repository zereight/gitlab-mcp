/**
 * Unit tests for Profile Applicator
 * Tests applying profile settings to environment variables
 */

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

// Mock fs for ProfileLoader validation
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  mkdirSync: jest.fn(),
}));

describe("Profile Applicator", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Create a fresh copy of environment
    process.env = { ...originalEnv };

    // Clear all profile-related env vars
    const profileEnvVars = [
      "GITLAB_API_URL",
      "GITLAB_TOKEN",
      "GITLAB_OAUTH_CLIENT_ID",
      "GITLAB_OAUTH_CLIENT_SECRET",
      "OAUTH_ENABLED",
      "GITLAB_AUTH_COOKIE_PATH",
      "GITLAB_READ_ONLY_MODE",
      "GITLAB_ALLOWED_PROJECT_IDS",
      "GITLAB_ALLOWED_GROUP_IDS",
      "GITLAB_ALLOWED_TOOLS",
      "GITLAB_DENIED_TOOLS_REGEX",
      "GITLAB_DENIED_ACTIONS",
      "GITLAB_DEFAULT_NAMESPACE",
      "USE_GITLAB_WIKI",
      "USE_MILESTONE",
      "USE_PIPELINE",
      "USE_LABELS",
      "USE_MRS",
      "USE_FILES",
      "USE_VARIABLES",
      "USE_WORKITEMS",
      "USE_WEBHOOKS",
      "USE_SNIPPETS",
      "USE_INTEGRATIONS",
      "GITLAB_API_TIMEOUT_MS",
      "SKIP_TLS_VERIFY",
      "SSL_CERT_PATH",
      "SSL_KEY_PATH",
      "GITLAB_CA_CERT_PATH",
      "GITLAB_PROJECT_ID",
      "GITLAB_PROFILE",
    ];
    for (const envVar of profileEnvVars) {
      delete process.env[envVar];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("applyProfile", () => {
    it("should apply basic PAT profile settings", async () => {
      // Set the token env var that profile references
      process.env.MY_TOKEN = "test-token-value";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: {
          type: "pat",
          token_env: "MY_TOKEN",
        },
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      const result = await applyProfile(profile, "test-profile");

      expect(result.success).toBe(true);
      expect(result.profileName).toBe("test-profile");
      expect(result.host).toBe("gitlab.example.com");

      // Check environment variables were set
      expect(process.env.GITLAB_API_URL).toBe("https://gitlab.example.com");
      expect(process.env.GITLAB_TOKEN).toBe("test-token-value");
    });

    it("should apply custom api_url when provided", async () => {
      process.env.MY_TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        api_url: "https://custom.gitlab.example.com/api/v4",
        auth: {
          type: "pat",
          token_env: "MY_TOKEN",
        },
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "test");

      expect(process.env.GITLAB_API_URL).toBe("https://custom.gitlab.example.com/api/v4");
    });

    it("should apply OAuth profile settings", async () => {
      process.env.OAUTH_CLIENT = "client-id";
      process.env.OAUTH_SECRET = "client-secret";

      const profile: Profile = {
        host: "gitlab.company.com",
        auth: {
          type: "oauth",
          client_id_env: "OAUTH_CLIENT",
          client_secret_env: "OAUTH_SECRET",
        },
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "oauth-profile");

      expect(process.env.GITLAB_OAUTH_CLIENT_ID).toBe("client-id");
      expect(process.env.GITLAB_OAUTH_CLIENT_SECRET).toBe("client-secret");
      expect(process.env.OAUTH_ENABLED).toBe("true");
    });

    it("should apply cookie auth profile settings", async () => {
      const profile: Profile = {
        host: "gitlab.local",
        auth: {
          type: "cookie",
          cookie_path: "/path/to/cookies.txt",
        },
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "cookie-profile");

      expect(process.env.GITLAB_AUTH_COOKIE_PATH).toBe("/path/to/cookies.txt");
    });

    it("should apply read_only setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        read_only: true,
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "readonly");

      expect(process.env.GITLAB_READ_ONLY_MODE).toBe("true");
    });

    it("should apply allowed_projects setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        allowed_projects: ["project1", "project2", "team/project3"],
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "restricted");

      expect(process.env.GITLAB_ALLOWED_PROJECT_IDS).toBe("project1,project2,team/project3");
    });

    it("should apply denied_tools_regex setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_tools_regex: "^manage_|^create_",
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "limited");

      expect(process.env.GITLAB_DENIED_TOOLS_REGEX).toBe("^manage_|^create_");
    });

    it("should apply denied_actions setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_actions: ["manage_repository:delete", "manage_webhook:create"],
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "safe");

      expect(process.env.GITLAB_DENIED_ACTIONS).toBe(
        "manage_repository:delete,manage_webhook:create"
      );
    });

    it("should apply feature flags", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        features: {
          wiki: true,
          milestones: false,
          pipelines: true,
          labels: true,
          mrs: true,
          files: false,
          variables: false,
          workitems: true,
          webhooks: false,
          snippets: true,
          integrations: false,
        },
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      const result = await applyProfile(profile, "features");

      expect(process.env.USE_GITLAB_WIKI).toBe("true");
      expect(process.env.USE_MILESTONE).toBe("false");
      expect(process.env.USE_PIPELINE).toBe("true");
      expect(process.env.USE_LABELS).toBe("true");
      expect(process.env.USE_MRS).toBe("true");
      expect(process.env.USE_FILES).toBe("false");
      expect(process.env.USE_VARIABLES).toBe("false");
      expect(process.env.USE_WORKITEMS).toBe("true");
      expect(process.env.USE_WEBHOOKS).toBe("false");
      expect(process.env.USE_SNIPPETS).toBe("true");
      expect(process.env.USE_INTEGRATIONS).toBe("false");

      // All feature flags should be in appliedSettings
      expect(result.appliedSettings).toContain("USE_GITLAB_WIKI=true");
      expect(result.appliedSettings).toContain("USE_VARIABLES=false");
    });

    it("should apply timeout_ms setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        timeout_ms: 60000,
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "timeout");

      expect(process.env.GITLAB_API_TIMEOUT_MS).toBe("60000");
    });

    it("should apply TLS settings", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        skip_tls_verify: true,
        ssl_cert_path: "/path/to/cert.pem",
        ssl_key_path: "/path/to/key.pem",
        ca_cert_path: "/path/to/ca.pem",
      };

      // Mock fs.existsSync to return true for cert paths
      const fs = require("fs");
      fs.existsSync.mockReturnValue(true);

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "tls");

      expect(process.env.SKIP_TLS_VERIFY).toBe("true");
      expect(process.env.SSL_CERT_PATH).toBe("/path/to/cert.pem");
      expect(process.env.SSL_KEY_PATH).toBe("/path/to/key.pem");
      expect(process.env.GITLAB_CA_CERT_PATH).toBe("/path/to/ca.pem");
    });

    it("should apply default_project setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        default_project: "myteam/frontend",
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      await applyProfile(profile, "default");

      expect(process.env.GITLAB_PROJECT_ID).toBe("myteam/frontend");
    });

    it("should apply allowed_groups setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        allowed_groups: ["group1", "group2", "nested/group3"],
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      const result = await applyProfile(profile, "groups-restricted");

      expect(process.env.GITLAB_ALLOWED_GROUP_IDS).toBe("group1,group2,nested/group3");
      expect(result.appliedSettings).toContain(
        "GITLAB_ALLOWED_GROUP_IDS=group1,group2,nested/group3"
      );
    });

    it("should apply allowed_tools setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        allowed_tools: ["browse_projects", "browse_commits", "get_users"],
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      const result = await applyProfile(profile, "tools-whitelist");

      expect(process.env.GITLAB_ALLOWED_TOOLS).toBe("browse_projects,browse_commits,get_users");
      expect(result.appliedSettings).toContain(
        "GITLAB_ALLOWED_TOOLS=browse_projects,browse_commits,get_users"
      );
    });

    it("should apply default_namespace setting", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        default_namespace: "myteam",
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      const result = await applyProfile(profile, "namespace-default");

      expect(process.env.GITLAB_DEFAULT_NAMESPACE).toBe("myteam");
      expect(result.appliedSettings).toContain("GITLAB_DEFAULT_NAMESPACE=myteam");
    });

    it("should return validation errors for invalid profile", async () => {
      process.env.TOKEN = "token";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        denied_tools_regex: "[invalid(", // Invalid regex
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      const result = await applyProfile(profile, "invalid");

      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    it("should log warnings but continue when profile has validation warnings", async () => {
      // Token env var is NOT set, which should trigger a warning
      // (but not an error since the token could be set later)
      delete process.env.MISSING_TOKEN;

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "MISSING_TOKEN" },
      };

      const { logger } = await import("../../../src/logger");
      const { applyProfile } = await import("../../../src/profiles/applicator");
      const result = await applyProfile(profile, "warning-profile");

      // Should succeed despite warnings
      expect(result.success).toBe(true);
      expect(result.validation.warnings.length).toBeGreaterThan(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should track all applied settings", async () => {
      process.env.MY_TOKEN = "token-value";

      const profile: Profile = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "MY_TOKEN" },
        read_only: true,
        timeout_ms: 30000,
      };

      const { applyProfile } = await import("../../../src/profiles/applicator");
      const result = await applyProfile(profile, "tracked");

      expect(result.appliedSettings).toContain("GITLAB_API_URL=https://gitlab.example.com");
      expect(result.appliedSettings).toContain("GITLAB_TOKEN=<from MY_TOKEN>");
      expect(result.appliedSettings).toContain("GITLAB_READ_ONLY_MODE=true");
      expect(result.appliedSettings).toContain("GITLAB_API_TIMEOUT_MS=30000");
    });
  });

  describe("tryApplyProfileFromEnv", () => {
    it("should return undefined when no profile specified", async () => {
      // No CLI arg, no GITLAB_PROFILE env var, no default in config
      const fs = require("fs");
      fs.existsSync.mockReturnValue(false);

      const { tryApplyProfileFromEnv } = await import("../../../src/profiles/applicator");
      const result = await tryApplyProfileFromEnv();

      expect(result).toBeUndefined();
    });

    it("should apply profile from CLI argument", async () => {
      process.env.WORK_TOKEN = "work-token";

      // Mock fs for profile loading
      const yaml = require("yaml");
      const fs = require("fs");
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        yaml.stringify({
          profiles: {
            work: {
              host: "gitlab.work.com",
              auth: { type: "pat", token_env: "WORK_TOKEN" },
            },
          },
        })
      );

      const { tryApplyProfileFromEnv } = await import("../../../src/profiles/applicator");
      const result = await tryApplyProfileFromEnv("work");

      expect(result).toBeDefined();
      // Check it's a profile result (has profileName, not presetName)
      expect("profileName" in result!).toBe(true);
      expect((result as { profileName: string }).profileName).toBe("work");
      expect(process.env.GITLAB_API_URL).toBe("https://gitlab.work.com");
    });

    it("should apply profile from GITLAB_PROFILE env var when no CLI arg", async () => {
      process.env.GITLAB_PROFILE = "personal";
      process.env.PERSONAL_TOKEN = "personal-token";

      const yaml = require("yaml");
      const fs = require("fs");
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        yaml.stringify({
          profiles: {
            personal: {
              host: "gitlab.com",
              auth: { type: "pat", token_env: "PERSONAL_TOKEN" },
            },
          },
        })
      );

      const { tryApplyProfileFromEnv } = await import("../../../src/profiles/applicator");
      const result = await tryApplyProfileFromEnv(); // No CLI arg

      expect(result).toBeDefined();
      // Check it's a profile result (has profileName, not presetName)
      expect("profileName" in result!).toBe(true);
      expect((result as { profileName: string }).profileName).toBe("personal");
    });

    it("should throw error for non-existent profile", async () => {
      const fs = require("fs");
      fs.existsSync.mockReturnValue(false);

      const { tryApplyProfileFromEnv } = await import("../../../src/profiles/applicator");

      await expect(tryApplyProfileFromEnv("nonexistent")).rejects.toThrow();
    });

    it("should apply preset from CLI argument when no matching profile", async () => {
      // Set up env for preset (presets require existing connection config)
      process.env.GITLAB_API_URL = "https://gitlab.example.com";
      process.env.GITLAB_TOKEN = "existing-token";

      const yaml = require("yaml");
      const fs = require("fs");

      // First call to existsSync checks user config - return false
      // Second call checks builtin preset dir - return true
      // Third call checks preset file - return true
      fs.existsSync
        .mockReturnValueOnce(false) // User config doesn't exist
        .mockReturnValueOnce(true) // Builtin dir exists
        .mockReturnValueOnce(true); // Preset file exists

      // readFileSync for preset YAML
      fs.readFileSync.mockReturnValue(
        yaml.stringify({
          description: "Test preset",
          read_only: true,
          features: {
            wiki: true,
            pipelines: false,
          },
        })
      );

      const { tryApplyProfileFromEnv } = await import("../../../src/profiles/applicator");
      const result = await tryApplyProfileFromEnv("testpreset");

      expect(result).toBeDefined();
      // Check it's a preset result (has presetName, not profileName)
      expect("presetName" in result!).toBe(true);
      expect((result as { presetName: string }).presetName).toBe("testpreset");
      expect(process.env.GITLAB_READ_ONLY_MODE).toBe("true");
    });
  });

  describe("applyPreset", () => {
    it("should apply preset with read_only setting", async () => {
      const preset: Preset = {
        read_only: true,
        features: {},
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const result = await applyPreset(preset, "readonly-preset");

      expect(result.success).toBe(true);
      expect(result.presetName).toBe("readonly-preset");
      expect(process.env.GITLAB_READ_ONLY_MODE).toBe("true");
      expect(result.appliedSettings).toContain("GITLAB_READ_ONLY_MODE=true");
    });

    it("should apply preset with denied_tools_regex", async () => {
      const preset: Preset = {
        denied_tools_regex: "^manage_|^create_",
        features: {},
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const result = await applyPreset(preset, "limited-preset");

      expect(result.success).toBe(true);
      expect(process.env.GITLAB_DENIED_TOOLS_REGEX).toBe("^manage_|^create_");
    });

    it("should apply preset with denied_actions", async () => {
      const preset: Preset = {
        denied_actions: ["manage_repository:delete", "manage_webhook:create"],
        features: {},
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const result = await applyPreset(preset, "safe-preset");

      expect(result.success).toBe(true);
      expect(process.env.GITLAB_DENIED_ACTIONS).toBe(
        "manage_repository:delete,manage_webhook:create"
      );
    });

    it("should apply preset with allowed_tools whitelist", async () => {
      const preset: Preset = {
        allowed_tools: ["browse_projects", "browse_commits", "get_users"],
        features: {},
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const result = await applyPreset(preset, "whitelist-preset");

      expect(result.success).toBe(true);
      expect(process.env.GITLAB_ALLOWED_TOOLS).toBe("browse_projects,browse_commits,get_users");
    });

    it("should apply preset with feature flags", async () => {
      const preset: Preset = {
        features: {
          wiki: true,
          milestones: false,
          pipelines: true,
          variables: false,
        },
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const result = await applyPreset(preset, "features-preset");

      expect(result.success).toBe(true);
      expect(process.env.USE_GITLAB_WIKI).toBe("true");
      expect(process.env.USE_MILESTONE).toBe("false");
      expect(process.env.USE_PIPELINE).toBe("true");
      expect(process.env.USE_VARIABLES).toBe("false");
    });

    it("should apply preset with timeout_ms", async () => {
      const preset: Preset = {
        timeout_ms: 45000,
        features: {},
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const result = await applyPreset(preset, "timeout-preset");

      expect(result.success).toBe(true);
      expect(process.env.GITLAB_API_TIMEOUT_MS).toBe("45000");
    });

    it("should return validation errors for invalid preset", async () => {
      const preset: Preset = {
        denied_tools_regex: "[invalid(",
        features: {},
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const result = await applyPreset(preset, "invalid-preset");

      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    it("should warn when GITLAB_API_URL and GITLAB_TOKEN not set", async () => {
      // Ensure env vars are not set
      delete process.env.GITLAB_API_URL;
      delete process.env.GITLAB_TOKEN;

      const preset: Preset = {
        read_only: true,
        features: {},
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const { logger } = await import("../../../src/logger");

      await applyPreset(preset, "no-auth-preset");

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        { preset: "no-auth-preset" },
        "Preset applied but GITLAB_API_URL/GITLAB_TOKEN not set - connection may fail"
      );
    });

    it("should apply full preset with all settings", async () => {
      const preset: Preset = {
        description: "Full test preset",
        read_only: true,
        denied_tools_regex: "^delete_",
        allowed_tools: ["browse_projects"],
        denied_actions: ["manage_repository:delete"],
        timeout_ms: 30000,
        features: {
          wiki: true,
          pipelines: false,
        },
      };

      const { applyPreset } = await import("../../../src/profiles/applicator");
      const result = await applyPreset(preset, "full-preset");

      expect(result.success).toBe(true);
      expect(result.appliedSettings.length).toBeGreaterThan(5);
      expect(process.env.GITLAB_READ_ONLY_MODE).toBe("true");
      expect(process.env.GITLAB_DENIED_TOOLS_REGEX).toBe("^delete_");
      expect(process.env.GITLAB_ALLOWED_TOOLS).toBe("browse_projects");
      expect(process.env.GITLAB_DENIED_ACTIONS).toBe("manage_repository:delete");
      expect(process.env.GITLAB_API_TIMEOUT_MS).toBe("30000");
    });
  });

  describe("loadAndApplyProfile", () => {
    it("should load and apply a profile by name", async () => {
      process.env.WORK_TOKEN = "work-token-value";

      const yaml = require("yaml");
      const fs = require("fs");
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        yaml.stringify({
          profiles: {
            work: {
              host: "gitlab.work.com",
              auth: { type: "pat", token_env: "WORK_TOKEN" },
              read_only: true,
            },
          },
        })
      );

      const { loadAndApplyProfile } = await import("../../../src/profiles/applicator");
      const result = await loadAndApplyProfile("work");

      expect(result.success).toBe(true);
      expect(result.profileName).toBe("work");
      expect(result.host).toBe("gitlab.work.com");
      expect(process.env.GITLAB_API_URL).toBe("https://gitlab.work.com");
      expect(process.env.GITLAB_TOKEN).toBe("work-token-value");
      expect(process.env.GITLAB_READ_ONLY_MODE).toBe("true");
    });

    it("should throw error for non-existent profile", async () => {
      const fs = require("fs");
      fs.existsSync.mockReturnValue(false);

      const { loadAndApplyProfile } = await import("../../../src/profiles/applicator");

      await expect(loadAndApplyProfile("nonexistent")).rejects.toThrow();
    });
  });

  describe("loadAndApplyPreset", () => {
    it("should load and apply a preset by name", async () => {
      const yaml = require("yaml");
      const fs = require("fs");

      // Mock file system for preset loading
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        yaml.stringify({
          description: "Readonly preset",
          read_only: true,
          denied_tools_regex: "^manage_",
          features: {
            wiki: true,
            variables: false,
          },
        })
      );

      const { loadAndApplyPreset } = await import("../../../src/profiles/applicator");
      const result = await loadAndApplyPreset("readonly");

      expect(result.success).toBe(true);
      expect(result.presetName).toBe("readonly");
      expect(process.env.GITLAB_READ_ONLY_MODE).toBe("true");
      expect(process.env.GITLAB_DENIED_TOOLS_REGEX).toBe("^manage_");
    });

    it("should throw error for non-existent preset", async () => {
      const fs = require("fs");
      fs.existsSync.mockReturnValue(false);

      const { loadAndApplyPreset } = await import("../../../src/profiles/applicator");

      await expect(loadAndApplyPreset("nonexistent")).rejects.toThrow();
    });
  });
});
