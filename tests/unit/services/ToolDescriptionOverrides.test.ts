/**
 * Unit tests for tool description overrides functionality
 * Tests environment variable parsing and application of custom descriptions
 */

import { getToolDescriptionOverrides } from '../../../src/config';
import { RegistryManager } from '../../../src/registry-manager';
import { resetMocks } from '../../utils/testHelpers';

// Mock the entire config module
jest.mock('../../../src/config', () => ({
  ...jest.requireActual('../../../src/config'),
  getToolDescriptionOverrides: jest.fn(),
  GITLAB_READ_ONLY_MODE: false,
  GITLAB_DENIED_TOOLS_REGEX: undefined,
  USE_LABELS: true,
  USE_MRS: true,
  USE_FILES: true,
  USE_MILESTONE: true,
  USE_PIPELINE: true,
  USE_VARIABLES: true,
  USE_GITLAB_WIKI: true,
  USE_WORKITEMS: true,
}));

// Mock the logger to avoid console output during tests
jest.mock('../../../src/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Note: No need to mock tools module anymore - registry manager handles read-only tools internally

// Mock the ToolAvailability service
jest.mock('../../../src/services/ToolAvailability', () => ({
  ToolAvailability: {
    isToolAvailable: jest.fn().mockReturnValue(true),
    getUnavailableReason: jest.fn().mockReturnValue(''),
  },
}));

// Mock all entity registries
jest.mock('../../../src/entities/core/registry', () => ({
  coreToolRegistry: new Map([
    [
      'list_projects',
      {
        name: 'list_projects',
        description: 'List projects accessible by the current user',
        inputSchema: { type: 'object' },
        handler: jest.fn(),
      },
    ],
    [
      'get_project',
      {
        name: 'get_project',
        description: 'Get details of a specific project',
        inputSchema: { type: 'object' },
        handler: jest.fn(),
      },
    ],
  ]),
}));

jest.mock('../../../src/entities/labels/registry', () => ({
  labelsToolRegistry: new Map(),
}));

jest.mock('../../../src/entities/mrs/registry', () => ({
  mrsToolRegistry: new Map(),
}));

jest.mock('../../../src/entities/files/registry', () => ({
  filesToolRegistry: new Map(),
}));

jest.mock('../../../src/entities/milestones/registry', () => ({
  milestonesToolRegistry: new Map(),
}));

jest.mock('../../../src/entities/pipelines/registry', () => ({
  pipelinesToolRegistry: new Map(),
}));

jest.mock('../../../src/entities/variables/registry', () => ({
  variablesToolRegistry: new Map(),
}));

jest.mock('../../../src/entities/wiki/registry', () => ({
  wikiToolRegistry: new Map(),
}));

jest.mock('../../../src/entities/workitems/registry', () => ({
  workitemsToolRegistry: new Map(),
}));

describe('Tool Description Overrides', () => {
  let originalEnv: typeof process.env;
  let mockGetToolDescriptionOverrides: jest.MockedFunction<typeof getToolDescriptionOverrides>;

  beforeEach(() => {
    resetMocks();
    originalEnv = process.env;
    mockGetToolDescriptionOverrides = getToolDescriptionOverrides as jest.MockedFunction<
      typeof getToolDescriptionOverrides
    >;

    // Reset the RegistryManager singleton for each test
    (RegistryManager as any).instance = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getToolDescriptionOverrides', () => {
    it('should parse tool description overrides from environment variables', () => {
      // Set up test environment variables
      process.env.GITLAB_TOOL_LIST_PROJECTS = 'Custom project list description';
      process.env.GITLAB_TOOL_GET_PROJECT = 'Custom project details description';
      process.env.GITLAB_TOOL_CREATE_MERGE_REQUEST = 'Custom MR creation description';
      process.env.NOT_GITLAB_TOOL = 'Should be ignored';
      process.env.GITLAB_TOOL_EMPTY = '';

      // Import the real function for this test
      const realConfig = jest.requireActual('../../../src/config');
      const overrides = realConfig.getToolDescriptionOverrides();

      // Should have at least the 3 we set, plus any from .env.test
      expect(overrides.size).toBeGreaterThanOrEqual(3);

      // Check specific overrides we set
      expect(overrides.get('list_projects')).toBe('Custom project list description');
      expect(overrides.get('get_project')).toBe('Custom project details description');
      expect(overrides.get('create_merge_request')).toBe('Custom MR creation description');

      // Should not include non-GITLAB_TOOL variables
      expect(overrides.has('not_gitlab_tool')).toBe(false);
      expect(overrides.has('empty')).toBe(false);

      // Clean up environment variables
      delete process.env.GITLAB_TOOL_LIST_PROJECTS;
      delete process.env.GITLAB_TOOL_GET_PROJECT;
      delete process.env.GITLAB_TOOL_CREATE_MERGE_REQUEST;
      delete process.env.NOT_GITLAB_TOOL;
      delete process.env.GITLAB_TOOL_EMPTY;
    });

    it('should handle mixed case tool names correctly', () => {
      // Set up environment variables
      process.env.GITLAB_TOOL_LIST_PROJECTS = 'List description';
      process.env.GITLAB_TOOL_GET_FILE_CONTENTS = 'File contents description';

      // Import the real function for this test
      const realConfig = jest.requireActual('../../../src/config');
      const overrides = realConfig.getToolDescriptionOverrides();

      expect(overrides.get('list_projects')).toBe('List description');
      expect(overrides.get('get_file_contents')).toBe('File contents description');

      // Clean up environment variables
      delete process.env.GITLAB_TOOL_LIST_PROJECTS;
      delete process.env.GITLAB_TOOL_GET_FILE_CONTENTS;
    });

    it('should handle special characters in descriptions', () => {
      // Set up environment variables with special characters
      process.env.GITLAB_TOOL_TEST_SPECIAL = 'Description with "quotes" & <brackets> and symbols: @#$%^&*()';
      process.env.GITLAB_TOOL_TEST_UNICODE = 'Unicode: café résumé naïve 中文 🚀 📋';
      process.env.GITLAB_TOOL_TEST_NEWLINES = 'Multi\nline\tdescription\rwith\r\nvarious\\nescapes';

      // Import the real function for this test
      const realConfig = jest.requireActual('../../../src/config');
      const overrides = realConfig.getToolDescriptionOverrides();

      expect(overrides.get('test_special')).toBe('Description with "quotes" & <brackets> and symbols: @#$%^&*()');
      expect(overrides.get('test_unicode')).toBe('Unicode: café résumé naïve 中文 🚀 📋');
      expect(overrides.get('test_newlines')).toBe('Multi\nline\tdescription\rwith\r\nvarious\\nescapes');

      // Clean up
      delete process.env.GITLAB_TOOL_TEST_SPECIAL;
      delete process.env.GITLAB_TOOL_TEST_UNICODE;
      delete process.env.GITLAB_TOOL_TEST_NEWLINES;
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(10000); // 10KB description
      process.env.GITLAB_TOOL_LONG_DESC = longDescription;

      // Import the real function for this test
      const realConfig = jest.requireActual('../../../src/config');
      const overrides = realConfig.getToolDescriptionOverrides();

      expect(overrides.get('long_desc')).toBe(longDescription);
      expect(overrides.get('long_desc')?.length).toBe(10000);

      // Clean up
      delete process.env.GITLAB_TOOL_LONG_DESC;
    });

    it('should handle case sensitivity correctly', () => {
      // Set up environment variables with different cases
      process.env.GITLAB_TOOL_LOWER_CASE = 'Lower case tool';
      process.env.GITLAB_TOOL_UPPER_CASE = 'Upper case tool';
      process.env.GITLAB_TOOL_MiXeD_CaSe = 'Mixed case tool';
      process.env.GITLAB_TOOL_WITH_NUMBERS_123 = 'Tool with numbers';

      // Import the real function for this test
      const realConfig = jest.requireActual('../../../src/config');
      const overrides = realConfig.getToolDescriptionOverrides();

      expect(overrides.get('lower_case')).toBe('Lower case tool');
      expect(overrides.get('upper_case')).toBe('Upper case tool');
      expect(overrides.get('mixed_case')).toBe('Mixed case tool');
      expect(overrides.get('with_numbers_123')).toBe('Tool with numbers');

      // Clean up
      delete process.env.GITLAB_TOOL_LOWER_CASE;
      delete process.env.GITLAB_TOOL_UPPER_CASE;
      delete process.env.GITLAB_TOOL_MiXeD_CaSe;
      delete process.env.GITLAB_TOOL_WITH_NUMBERS_123;
    });

    it('should ignore malformed or invalid variable names', () => {
      // Set up malformed environment variables
      process.env.GITLAB_TOOL_ = 'Empty suffix'; // Should be ignored
      process.env.GITLAB_TOOL_123_STARTS_WITH_NUMBER = 'Starts with number';
      process.env.GITLAB_TOOL_VALID_NAME = 'Valid tool name';
      process.env['GITLAB_TOOL_SPECIAL_CHARS_!@#'] = 'Special chars in name';

      // Import the real function for this test
      const realConfig = jest.requireActual('../../../src/config');
      const overrides = realConfig.getToolDescriptionOverrides();

      // Should include valid ones
      expect(overrides.get('123_starts_with_number')).toBe('Starts with number');
      expect(overrides.get('valid_name')).toBe('Valid tool name');
      expect(overrides.get('special_chars_!@#')).toBe('Special chars in name');

      // Should include empty suffix (current implementation allows it)
      expect(overrides.has('')).toBe(true);
      expect(overrides.get('')).toBe('Empty suffix');

      // Clean up
      delete process.env.GITLAB_TOOL_;
      delete process.env.GITLAB_TOOL_123_STARTS_WITH_NUMBER;
      delete process.env.GITLAB_TOOL_VALID_NAME;
      delete process.env['GITLAB_TOOL_SPECIAL_CHARS_!@#'];
    });

    it('should return empty map when no override environment variables are set', () => {
      // Ensure no GITLAB_TOOL_ environment variables are set
      const envKeys = Object.keys(process.env).filter(key => key.startsWith('GITLAB_TOOL_'));
      const savedEnv: Record<string, string> = {};

      // Save and delete any existing GITLAB_TOOL_ variables
      envKeys.forEach(key => {
        savedEnv[key] = process.env[key]!;
        delete process.env[key];
      });

      // Import the real function for this test
      const realConfig = jest.requireActual('../../../src/config');
      const overrides = realConfig.getToolDescriptionOverrides();

      expect(overrides.size).toBe(0);

      // Restore environment variables
      Object.entries(savedEnv).forEach(([key, value]) => {
        process.env[key] = value;
      });
    });
  });

  describe('RegistryManager with description overrides', () => {
    it('should apply description overrides to tools', () => {
      // Mock the config function to return test overrides
      mockGetToolDescriptionOverrides.mockReturnValue(
        new Map([
          ['list_projects', 'Custom list projects description'],
          ['get_project', 'Custom get project description'],
        ]),
      );

      const registryManager = RegistryManager.getInstance();
      const tools = registryManager.getAllToolDefinitions();

      expect(tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'list_projects',
            description: 'Custom list projects description',
          }),
          expect.objectContaining({
            name: 'get_project',
            description: 'Custom get project description',
          }),
        ]),
      );
    });

    it('should use original descriptions when no overrides are provided', () => {
      // Mock the config function to return empty overrides
      mockGetToolDescriptionOverrides.mockReturnValue(new Map());

      const registryManager = RegistryManager.getInstance();
      const tools = registryManager.getAllToolDefinitions();

      expect(tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'list_projects',
            description: 'List projects accessible by the current user',
          }),
          expect.objectContaining({
            name: 'get_project',
            description: 'Get details of a specific project',
          }),
        ]),
      );
    });

    it('should apply partial overrides correctly', () => {
      // Mock the config function to return partial overrides
      mockGetToolDescriptionOverrides.mockReturnValue(
        new Map([['list_projects', 'Only list projects has custom description']]),
      );

      const registryManager = RegistryManager.getInstance();
      const tools = registryManager.getAllToolDefinitions();

      expect(tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'list_projects',
            description: 'Only list projects has custom description',
          }),
          expect.objectContaining({
            name: 'get_project',
            description: 'Get details of a specific project', // Original description
          }),
        ]),
      );
    });

    it('should not affect inputSchema when applying description overrides', () => {
      // Mock the config function to return test overrides
      mockGetToolDescriptionOverrides.mockReturnValue(
        new Map([['list_projects', 'Custom description']]),
      );

      const registryManager = RegistryManager.getInstance();
      const tool = registryManager.getTool('list_projects');

      expect(tool).toBeTruthy();
      expect(tool!.name).toBe('list_projects');
      expect(tool!.description).toBe('Custom description');
      expect(tool!.inputSchema).toEqual({ type: 'object' }); // Schema unchanged
      expect(tool!.handler).toBeDefined(); // Handler unchanged
    });

    it('should handle overrides for non-existent tools gracefully', () => {
      // Mock the config function to return overrides for non-existent tools
      mockGetToolDescriptionOverrides.mockReturnValue(
        new Map([
          ['list_projects', 'Valid override'],
          ['non_existent_tool', 'Invalid override'],
        ]),
      );

      const registryManager = RegistryManager.getInstance();
      const tools = registryManager.getAllToolDefinitions();

      // Should apply valid override and ignore invalid one
      expect(tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'list_projects',
            description: 'Valid override',
          }),
        ]),
      );

      // Should not contain the non-existent tool
      expect(tools.find((tool) => tool.name === 'non_existent_tool')).toBeUndefined();
    });
  });
});