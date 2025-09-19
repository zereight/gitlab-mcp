/**
 * Jest setup file for unit tests
 * DOES NOT load .env.test - unit tests should be isolated from environment
 */

// Set timeout for unit tests
jest.setTimeout(10000);

// Prevent any accidental environment loading
process.env.INTEGRATION_TESTS_ENABLED = 'false';

// Mock environment variables for unit tests to use predictable values
process.env.GITLAB_BASE_URL = '';
process.env.GITLAB_TOKEN = '';
process.env.GITLAB_API_URL = '';

// Disable all feature flags by default for unit tests
process.env.USE_WORKITEMS = 'false';
process.env.USE_MILESTONE = 'false';
process.env.USE_PIPELINE = 'false';
process.env.USE_GITLAB_WIKI = 'false';
process.env.USE_LABELS = 'false';
process.env.USE_MRS = 'false';
process.env.USE_FILES = 'false';
process.env.USE_VARIABLES = 'false';

// Set read-only mode for unit tests to prevent accidental API calls
process.env.GITLAB_READONLY = 'true';

console.log('🧪 Unit test environment initialized - no .env.test loaded');