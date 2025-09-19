/**
 * Unit tests for config.ts
 * Tests environment variable handling, URL normalization, and package info loading
 */

import * as path from 'path';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('config.ts', () => {
  const originalEnv = process.env;
  const originalCwd = process.cwd;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset process.env to clean state
    process.env = { ...originalEnv };

    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/test/project');

    // Reset fs mock to default behavior
    mockFs.readFileSync.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.cwd = originalCwd;
  });

  describe('environment variable parsing', () => {
    it('should parse boolean environment variables correctly', () => {
      process.env.GITLAB_IS_OLD = 'true';
      process.env.GITLAB_READ_ONLY_MODE = 'true';
      process.env.SKIP_TLS_VERIFY = 'true';

      const config = require('../../src/config');

      expect(config.IS_OLD).toBe(true);
      expect(config.GITLAB_READ_ONLY_MODE).toBe(true);
      expect(config.SKIP_TLS_VERIFY).toBe(true);
    });

    it('should handle false boolean environment variables', () => {
      process.env.GITLAB_IS_OLD = 'false';
      process.env.GITLAB_READ_ONLY_MODE = 'false';
      process.env.SKIP_TLS_VERIFY = 'false';

      const config = require('../../src/config');

      expect(config.IS_OLD).toBe(false);
      expect(config.GITLAB_READ_ONLY_MODE).toBe(false);
      expect(config.SKIP_TLS_VERIFY).toBe(false);
    });

    it('should handle feature flags that default to true', () => {
      // These should default to true when not set or not 'false'
      delete process.env.USE_GITLAB_WIKI;
      delete process.env.USE_MILESTONE;
      delete process.env.USE_PIPELINE;
      delete process.env.USE_WORKITEMS;
      delete process.env.USE_LABELS;
      delete process.env.USE_MRS;
      delete process.env.USE_FILES;
      delete process.env.USE_VARIABLES;

      const config = require('../../src/config');

      expect(config.USE_GITLAB_WIKI).toBe(true);
      expect(config.USE_MILESTONE).toBe(true);
      expect(config.USE_PIPELINE).toBe(true);
      expect(config.USE_WORKITEMS).toBe(true);
      expect(config.USE_LABELS).toBe(true);
      expect(config.USE_MRS).toBe(true);
      expect(config.USE_FILES).toBe(true);
      expect(config.USE_VARIABLES).toBe(true);
    });

    it('should disable features when explicitly set to false', () => {
      process.env.USE_GITLAB_WIKI = 'false';
      process.env.USE_MILESTONE = 'false';
      process.env.USE_PIPELINE = 'false';
      process.env.USE_WORKITEMS = 'false';
      process.env.USE_LABELS = 'false';
      process.env.USE_MRS = 'false';
      process.env.USE_FILES = 'false';
      process.env.USE_VARIABLES = 'false';

      const config = require('../../src/config');

      expect(config.USE_GITLAB_WIKI).toBe(false);
      expect(config.USE_MILESTONE).toBe(false);
      expect(config.USE_PIPELINE).toBe(false);
      expect(config.USE_WORKITEMS).toBe(false);
      expect(config.USE_LABELS).toBe(false);
      expect(config.USE_MRS).toBe(false);
      expect(config.USE_FILES).toBe(false);
      expect(config.USE_VARIABLES).toBe(false);
    });

    it('should parse GITLAB_DENIED_TOOLS_REGEX as RegExp', () => {
      process.env.GITLAB_DENIED_TOOLS_REGEX = '^list_';

      const config = require('../../src/config');

      expect(config.GITLAB_DENIED_TOOLS_REGEX).toBeInstanceOf(RegExp);
      expect(config.GITLAB_DENIED_TOOLS_REGEX.source).toBe('^list_');
    });

    it('should handle undefined GITLAB_DENIED_TOOLS_REGEX', () => {
      delete process.env.GITLAB_DENIED_TOOLS_REGEX;

      const config = require('../../src/config');

      expect(config.GITLAB_DENIED_TOOLS_REGEX).toBeUndefined();
    });

    it('should parse HOST and PORT with defaults', () => {
      delete process.env.HOST;
      delete process.env.PORT;

      const config = require('../../src/config');

      expect(config.HOST).toBe('0.0.0.0');
      expect(config.PORT).toBe(3002);
    });

    it('should use custom HOST and PORT when set', () => {
      process.env.HOST = 'localhost';
      process.env.PORT = '8080';

      const config = require('../../src/config');

      expect(config.HOST).toBe('localhost');
      expect(config.PORT).toBe('8080');
    });

    it('should parse GITLAB_ALLOWED_PROJECT_IDS as array', () => {
      process.env.GITLAB_ALLOWED_PROJECT_IDS = '123, 456 , 789';

      const config = require('../../src/config');

      expect(config.GITLAB_ALLOWED_PROJECT_IDS).toEqual(['123', '456', '789']);
    });

    it('should handle empty GITLAB_ALLOWED_PROJECT_IDS', () => {
      delete process.env.GITLAB_ALLOWED_PROJECT_IDS;

      const config = require('../../src/config');

      expect(config.GITLAB_ALLOWED_PROJECT_IDS).toEqual([]);
    });
  });

  describe('GitLab URL normalization', () => {
    it('should default to gitlab.com when no URL provided', () => {
      delete process.env.GITLAB_API_URL;

      const config = require('../../src/config');

      expect(config.GITLAB_BASE_URL).toBe('https://gitlab.com');
      expect(config.GITLAB_API_URL).toBe('https://gitlab.com/api/v4');
    });

    it('should remove trailing slash from URL', () => {
      process.env.GITLAB_API_URL = 'https://gitlab.example.com/';

      const config = require('../../src/config');

      expect(config.GITLAB_BASE_URL).toBe('https://gitlab.example.com');
      expect(config.GITLAB_API_URL).toBe('https://gitlab.example.com/api/v4');
    });

    it('should remove /api/v4 suffix if accidentally added', () => {
      process.env.GITLAB_API_URL = 'https://gitlab.example.com/api/v4';

      const config = require('../../src/config');

      expect(config.GITLAB_BASE_URL).toBe('https://gitlab.example.com');
      expect(config.GITLAB_API_URL).toBe('https://gitlab.example.com/api/v4');
    });

    it('should handle URL with both trailing slash and /api/v4', () => {
      process.env.GITLAB_API_URL = 'https://gitlab.example.com/api/v4/';

      const config = require('../../src/config');

      expect(config.GITLAB_BASE_URL).toBe('https://gitlab.example.com');
      expect(config.GITLAB_API_URL).toBe('https://gitlab.example.com/api/v4');
    });

    it('should preserve custom URL as-is when properly formatted', () => {
      process.env.GITLAB_API_URL = 'https://gitlab.example.com';

      const config = require('../../src/config');

      expect(config.GITLAB_BASE_URL).toBe('https://gitlab.example.com');
      expect(config.GITLAB_API_URL).toBe('https://gitlab.example.com/api/v4');
    });
  });

  describe('getEffectiveProjectId', () => {
    it('should return GITLAB_PROJECT_ID when set', () => {
      process.env.GITLAB_PROJECT_ID = '999';

      const config = require('../../src/config');

      expect(config.getEffectiveProjectId('123')).toBe('999');
    });

    it('should return provided project ID when no restrictions', () => {
      delete process.env.GITLAB_PROJECT_ID;
      delete process.env.GITLAB_ALLOWED_PROJECT_IDS;

      const config = require('../../src/config');

      expect(config.getEffectiveProjectId('123')).toBe('123');
    });

    it('should allow project ID when in allowed list', () => {
      delete process.env.GITLAB_PROJECT_ID;
      process.env.GITLAB_ALLOWED_PROJECT_IDS = '123,456,789';

      const config = require('../../src/config');

      expect(config.getEffectiveProjectId('456')).toBe('456');
    });

    it('should throw error when project ID not in allowed list', () => {
      delete process.env.GITLAB_PROJECT_ID;
      process.env.GITLAB_ALLOWED_PROJECT_IDS = '123,456,789';

      const config = require('../../src/config');

      expect(() => config.getEffectiveProjectId('999')).toThrow(
        'Project ID 999 is not allowed. Allowed project IDs: 123, 456, 789'
      );
    });

    it('should prioritize GITLAB_PROJECT_ID over allowed list', () => {
      process.env.GITLAB_PROJECT_ID = '999';
      process.env.GITLAB_ALLOWED_PROJECT_IDS = '123,456,789';

      const config = require('../../src/config');

      expect(config.getEffectiveProjectId('456')).toBe('999');
    });
  });

  describe('package info loading', () => {
    it('should load package info from filesystem', () => {
      // Since config.ts loads at module time, we test that it doesn't crash
      // and has reasonable default values
      const config = require('../../src/config');

      expect(config.packageName).toBeDefined();
      expect(config.packageVersion).toBeDefined();
      expect(typeof config.packageName).toBe('string');
      expect(typeof config.packageVersion).toBe('string');
    });

    it('should have package name fallback', () => {
      const config = require('../../src/config');

      // Should have either a real package name or the default
      expect(config.packageName.length).toBeGreaterThan(0);
    });

    it('should have package version fallback', () => {
      const config = require('../../src/config');

      // Should have either a real version or 'unknown'
      expect(config.packageVersion.length).toBeGreaterThan(0);
    });
  });

  describe('getToolDescriptionOverrides', () => {
    it('should parse tool description overrides from environment variables', () => {
      process.env.GITLAB_TOOL_LIST_PROJECTS = 'Custom project listing tool';
      process.env.GITLAB_TOOL_GET_PROJECT = 'Custom project details tool';
      process.env.GITLAB_TOOL_CREATE_ISSUE = 'Custom issue creation tool';
      // Non-tool env var should be ignored
      process.env.GITLAB_API_URL = 'https://gitlab.example.com';

      const config = require('../../src/config');
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.get('list_projects')).toBe('Custom project listing tool');
      expect(overrides.get('get_project')).toBe('Custom project details tool');
      expect(overrides.get('create_issue')).toBe('Custom issue creation tool');
      expect(overrides.has('api_url')).toBe(false);
    });

    it('should handle empty tool override values', () => {
      process.env.GITLAB_TOOL_LIST_PROJECTS = '';
      process.env.GITLAB_TOOL_GET_PROJECT = 'Valid description';

      const config = require('../../src/config');
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.has('list_projects')).toBe(false);
      expect(overrides.get('get_project')).toBe('Valid description');
    });

    it('should return empty map when no tool overrides exist', () => {
      // Clear all GITLAB_TOOL_ env vars
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('GITLAB_TOOL_')) {
          delete process.env[key];
        }
      }

      const config = require('../../src/config');
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.size).toBe(0);
    });

    it('should convert tool names to lowercase', () => {
      process.env.GITLAB_TOOL_LIST_PROJECTS = 'List projects tool';
      process.env.GITLAB_TOOL_GET_USER_DETAILS = 'Get user details tool';

      const config = require('../../src/config');
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.get('list_projects')).toBe('List projects tool');
      expect(overrides.get('get_user_details')).toBe('Get user details tool');
    });

    it('should handle undefined process.env values', () => {
      // Ensure process.env has some undefined values
      process.env.GITLAB_TOOL_VALID = 'Valid tool';
      process.env.GITLAB_TOOL_UNDEFINED = undefined;

      const config = require('../../src/config');
      const overrides = config.getToolDescriptionOverrides();

      expect(overrides.get('valid')).toBe('Valid tool');
      expect(overrides.has('undefined')).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle completely empty environment', () => {
      // Clear all environment variables
      process.env = {};

      expect(() => require('../../src/config')).not.toThrow();
    });

    it('should handle null and undefined environment values', () => {
      process.env.GITLAB_TOKEN = undefined;
      process.env.GITLAB_API_URL = null as any;

      const config = require('../../src/config');

      expect(config.GITLAB_TOKEN).toBeUndefined();
      expect(config.GITLAB_BASE_URL).toBe('https://gitlab.com');
    });

    it('should handle very long environment variable values', () => {
      const longValue = 'a'.repeat(10000);
      process.env.GITLAB_TOKEN = longValue;
      process.env.GITLAB_TOOL_LONG_NAME = longValue;

      const config = require('../../src/config');

      expect(config.GITLAB_TOKEN).toBe(longValue);

      const overrides = config.getToolDescriptionOverrides();
      expect(overrides.get('long_name')).toBe(longValue);
    });

    it('should handle special characters in environment variables', () => {
      process.env.GITLAB_API_URL = 'https://gitlab.example.com/special-chars/@#$%';
      process.env.GITLAB_TOOL_SPECIAL = 'Tool with special chars: @#$%^&*()';

      const config = require('../../src/config');

      expect(config.GITLAB_BASE_URL).toBe('https://gitlab.example.com/special-chars/@#$%');

      const overrides = config.getToolDescriptionOverrides();
      expect(overrides.get('special')).toBe('Tool with special chars: @#$%^&*()');
    });
  });
});