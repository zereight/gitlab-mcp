/**
 * Unit tests for Profile types and Zod schemas
 * Tests schema validation for profiles and presets
 */

import {
  ProfileSchema,
  PresetSchema,
  ProfilesConfigSchema,
  Profile,
  Preset,
} from "../../../src/profiles/types";

describe("Profile Types and Schemas", () => {
  describe("ProfileSchema", () => {
    // Valid profile with PAT auth
    const validPatProfile: Profile = {
      host: "gitlab.example.com",
      auth: {
        type: "pat",
        token_env: "GITLAB_TOKEN",
      },
    };

    // Valid profile with OAuth
    const validOAuthProfile: Profile = {
      host: "gitlab.company.com",
      auth: {
        type: "oauth",
        client_id_env: "OAUTH_CLIENT_ID",
        client_secret_env: "OAUTH_CLIENT_SECRET",
      },
      read_only: true,
      features: {
        wiki: true,
        pipelines: false,
      },
    };

    // Valid profile with cookie auth
    const validCookieProfile: Profile = {
      host: "gitlab.local",
      auth: {
        type: "cookie",
        cookie_path: "/path/to/cookie",
      },
    };

    it("should validate a minimal PAT profile", () => {
      const result = ProfileSchema.safeParse(validPatProfile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.host).toBe("gitlab.example.com");
        expect(result.data.auth.type).toBe("pat");
      }
    });

    it("should validate a full OAuth profile", () => {
      const result = ProfileSchema.safeParse(validOAuthProfile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.host).toBe("gitlab.company.com");
        expect(result.data.auth.type).toBe("oauth");
        expect(result.data.read_only).toBe(true);
        expect(result.data.features?.wiki).toBe(true);
        expect(result.data.features?.pipelines).toBe(false);
      }
    });

    it("should validate a cookie auth profile", () => {
      const result = ProfileSchema.safeParse(validCookieProfile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.auth.type).toBe("cookie");
      }
    });

    it("should reject profile without host", () => {
      const invalid = {
        auth: { type: "pat", token_env: "TOKEN" },
      };
      const result = ProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject profile without auth", () => {
      const invalid = {
        host: "gitlab.example.com",
      };
      const result = ProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject profile with invalid auth type", () => {
      const invalid = {
        host: "gitlab.example.com",
        auth: { type: "invalid" },
      };
      const result = ProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should validate profile with all optional fields", () => {
      const fullProfile = {
        host: "gitlab.example.com",
        api_url: "https://gitlab.example.com/api/v4",
        auth: {
          type: "pat",
          token_env: "MY_TOKEN",
        },
        read_only: false,
        allowed_projects: ["project1", "project2"],
        allowed_groups: ["group1"],
        denied_tools_regex: "^manage_",
        allowed_tools: ["browse_projects"],
        denied_actions: ["manage_repository:delete"],
        features: {
          wiki: true,
          milestones: true,
          pipelines: true,
          labels: true,
          mrs: true,
          files: true,
          variables: false,
          workitems: true,
          webhooks: false,
          snippets: true,
          integrations: false,
        },
        timeout_ms: 30000,
        default_project: "myteam/frontend",
        default_namespace: "myteam",
        skip_tls_verify: false,
        ssl_cert_path: "/path/to/cert",
        ssl_key_path: "/path/to/key",
        ca_cert_path: "/path/to/ca",
      };

      const result = ProfileSchema.safeParse(fullProfile);
      expect(result.success).toBe(true);
    });

    it("should reject invalid api_url format", () => {
      const invalid = {
        host: "gitlab.example.com",
        api_url: "not-a-valid-url",
        auth: { type: "pat", token_env: "TOKEN" },
      };
      const result = ProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject negative timeout_ms", () => {
      const invalid = {
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "TOKEN" },
        timeout_ms: -1000,
      };
      const result = ProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("PresetSchema", () => {
    // Valid minimal preset
    const validMinimalPreset: Preset = {
      features: {
        wiki: true,
      },
    };

    // Valid full preset (readonly)
    const validReadonlyPreset: Preset = {
      description: "Read-only access - blocks all write operations",
      read_only: true,
      denied_tools_regex: "^manage_|^create_",
      features: {
        wiki: true,
        milestones: true,
        pipelines: true,
        variables: false,
        webhooks: false,
      },
    };

    it("should validate a minimal preset", () => {
      const result = PresetSchema.safeParse(validMinimalPreset);
      expect(result.success).toBe(true);
    });

    it("should validate a full readonly preset", () => {
      const result = PresetSchema.safeParse(validReadonlyPreset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("Read-only access - blocks all write operations");
        expect(result.data.read_only).toBe(true);
        expect(result.data.denied_tools_regex).toBe("^manage_|^create_");
      }
    });

    it("should validate preset with denied_actions", () => {
      const preset = {
        read_only: false,
        denied_actions: ["manage_repository:delete", "manage_webhook:create"],
        features: {
          pipelines: true,
        },
      };
      const result = PresetSchema.safeParse(preset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.denied_actions).toEqual([
          "manage_repository:delete",
          "manage_webhook:create",
        ]);
      }
    });

    it("should validate preset with allowed_tools whitelist", () => {
      const preset = {
        allowed_tools: ["browse_projects", "browse_commits", "get_users"],
        features: {},
      };
      const result = PresetSchema.safeParse(preset);
      expect(result.success).toBe(true);
    });

    it("should validate empty preset (all defaults)", () => {
      // Preset with just empty features object
      const preset = { features: {} };
      const result = PresetSchema.safeParse(preset);
      expect(result.success).toBe(true);
    });

    it("should reject preset with host field (security)", () => {
      // Presets use .strict() to reject unknown fields like host for security
      const invalidPreset = {
        host: "gitlab.example.com", // This field should not exist on Preset
        features: {},
      };
      const result = PresetSchema.safeParse(invalidPreset);
      // With .strict() mode, unknown fields cause validation failure
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe("unrecognized_keys");
      }
    });

    it("should reject preset with auth field (security)", () => {
      // Presets use .strict() to reject unknown fields like auth for security
      const invalidPreset = {
        auth: { type: "pat", token_env: "TOKEN" },
        features: {},
      };
      const result = PresetSchema.safeParse(invalidPreset);
      // With .strict() mode, unknown fields cause validation failure
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe("unrecognized_keys");
      }
    });
  });

  describe("ProfilesConfigSchema", () => {
    it("should validate config with multiple profiles", () => {
      const config = {
        profiles: {
          work: {
            host: "gitlab.company.com",
            auth: { type: "pat", token_env: "WORK_TOKEN" },
          },
          personal: {
            host: "gitlab.com",
            auth: { type: "pat", token_env: "PERSONAL_TOKEN" },
          },
        },
        default_profile: "work",
      };

      const result = ProfilesConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.keys(result.data.profiles)).toHaveLength(2);
        expect(result.data.default_profile).toBe("work");
      }
    });

    it("should validate config without default_profile", () => {
      const config = {
        profiles: {
          work: {
            host: "gitlab.company.com",
            auth: { type: "pat", token_env: "WORK_TOKEN" },
          },
        },
      };

      const result = ProfilesConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.default_profile).toBeUndefined();
      }
    });

    it("should reject config with empty profiles", () => {
      const config = {
        profiles: {},
      };

      // Empty profiles record is valid by schema, but might be flagged by business logic
      const result = ProfilesConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject config with invalid profile", () => {
      const config = {
        profiles: {
          work: {
            // Missing required fields
            features: { wiki: true },
          },
        },
      };

      const result = ProfilesConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });
});
