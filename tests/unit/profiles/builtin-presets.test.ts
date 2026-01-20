/**
 * Unit tests for built-in presets
 * Validates that all preset YAML files conform to the schema
 * and contain no host/auth (security requirement)
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { PresetSchema, Preset } from "../../../src/profiles/types";

// Mock logger to suppress output during tests
jest.mock("../../../src/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Built-in Presets", () => {
  const builtinDir = path.join(__dirname, "../../../src/profiles/builtin");

  // Get all yaml files in the builtin directory
  const presetFiles = fs.readdirSync(builtinDir).filter(f => f.endsWith(".yaml"));

  describe("all presets should be valid", () => {
    it.each(presetFiles)("%s should conform to PresetSchema", filename => {
      const filepath = path.join(builtinDir, filename);
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content);

      const result = PresetSchema.safeParse(parsed);
      if (!result.success) {
        console.error(`Validation errors for ${filename}:`, result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it.each(presetFiles)("%s should have a description", filename => {
      const filepath = path.join(builtinDir, filename);
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      expect(parsed.description).toBeDefined();
      expect(parsed.description?.length).toBeGreaterThan(0);
    });

    it.each(presetFiles)("%s should NOT contain host (security)", filename => {
      const filepath = path.join(builtinDir, filename);
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content);

      // Presets must NEVER contain host/auth
      expect(parsed.host).toBeUndefined();
    });

    it.each(presetFiles)("%s should NOT contain auth (security)", filename => {
      const filepath = path.join(builtinDir, filename);
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content);

      // Presets must NEVER contain host/auth
      expect(parsed.auth).toBeUndefined();
    });

    it.each(presetFiles)("%s should have valid denied_tools_regex if present", filename => {
      const filepath = path.join(builtinDir, filename);
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      if (parsed.denied_tools_regex) {
        expect(() => new RegExp(parsed.denied_tools_regex!)).not.toThrow();
      }
    });

    it.each(presetFiles)("%s should have valid denied_actions format if present", filename => {
      const filepath = path.join(builtinDir, filename);
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      if (parsed.denied_actions) {
        for (const action of parsed.denied_actions) {
          // Format: tool:action
          expect(action).toMatch(/^[a-z_]+:[a-z_]+$/);
        }
      }
    });
  });

  describe("specific preset validations", () => {
    it("readonly.yaml should have read_only: true", () => {
      const filepath = path.join(builtinDir, "readonly.yaml");
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      expect(parsed.read_only).toBe(true);
    });

    it("admin.yaml should have all features enabled", () => {
      const filepath = path.join(builtinDir, "admin.yaml");
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      expect(parsed.features?.wiki).toBe(true);
      expect(parsed.features?.pipelines).toBe(true);
      expect(parsed.features?.variables).toBe(true);
      expect(parsed.features?.webhooks).toBe(true);
      expect(parsed.features?.integrations).toBe(true);
    });

    it("junior-dev.yaml should have pipelines disabled", () => {
      const filepath = path.join(builtinDir, "junior-dev.yaml");
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      expect(parsed.features?.pipelines).toBe(false);
      expect(parsed.features?.variables).toBe(false);
    });

    it("devops.yaml should have pipelines and variables enabled", () => {
      const filepath = path.join(builtinDir, "devops.yaml");
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      expect(parsed.features?.pipelines).toBe(true);
      expect(parsed.features?.variables).toBe(true);
      expect(parsed.features?.webhooks).toBe(true);
    });

    it("pm.yaml should have files disabled", () => {
      const filepath = path.join(builtinDir, "pm.yaml");
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      expect(parsed.features?.files).toBe(false);
      expect(parsed.features?.pipelines).toBe(false);
    });

    it("ci.yaml should have minimal features for automation", () => {
      const filepath = path.join(builtinDir, "ci.yaml");
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      expect(parsed.features?.pipelines).toBe(true);
      expect(parsed.features?.files).toBe(true);
      expect(parsed.features?.variables).toBe(true);
      expect(parsed.features?.wiki).toBe(false);
      expect(parsed.features?.workitems).toBe(false);
    });

    it("gitlab-com.yaml should have rate-limit friendly restrictions", () => {
      const filepath = path.join(builtinDir, "gitlab-com.yaml");
      const content = fs.readFileSync(filepath, "utf8");
      const parsed = yaml.parse(content) as Preset;

      expect(parsed.features?.webhooks).toBe(false);
      expect(parsed.features?.integrations).toBe(false);
      expect(parsed.denied_actions).toBeDefined();
      expect(parsed.denied_actions?.length).toBeGreaterThan(0);
    });
  });
});
