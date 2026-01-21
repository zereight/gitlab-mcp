/**
 * Shared Test Configuration
 *
 * Exports environment variables and test data state for all integration tests.
 * All test files should import from here instead of using process.env directly.
 */

// Environment configuration
export const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
export const GITLAB_API_URL = process.env.GITLAB_API_URL;
export const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID; // Only for DEFAULT_PROJECT tests

if (!GITLAB_TOKEN || !GITLAB_API_URL) {
  console.warn("⚠️  GITLAB_TOKEN and GITLAB_API_URL are required for integration tests");
}

// Test data state interface
export interface TestDataState {
  user?: any;
  group?: any;
  project?: any;
  repository?: {
    branches: any[];
    files: any[];
    tags: any[];
  };
  workItems?: any[]; // PROJECT-level work items (Issues, Tasks, Bugs)
  groupWorkItems?: any[]; // GROUP-level work items (Epics)
  subgroup?: any; // Subgroup for testing epic hierarchy
  childEpic?: any; // Child epic in subgroup
  mergeRequests?: any[];
  milestones?: any[];
  labels?: any[];
  todos?: any[];
  discussionThread?: any;
}

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Use persistent file storage to share data across test files (Jest creates separate contexts)
const TEST_DATA_FILE = path.join(os.tmpdir(), "gitlab-mcp-test-data.json");

// Use global state to share data across all test files in the same Jest process
declare global {
  var TEST_DATA_STATE: TestDataState;
}

// Initialize global state if not exists
if (!global.TEST_DATA_STATE) {
  global.TEST_DATA_STATE = {};
}

export const getTestData = (): TestDataState => {
  // Try global state first (for same file)
  if (global.TEST_DATA_STATE && Object.keys(global.TEST_DATA_STATE).length > 0) {
    return global.TEST_DATA_STATE;
  }

  // Fall back to persistent file (for cross-file sharing)
  try {
    if (fs.existsSync(TEST_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(TEST_DATA_FILE, "utf8"));
      global.TEST_DATA_STATE = data; // Cache in global state
      return data;
    }
  } catch (error) {
    console.warn("⚠️ Could not read test data file:", error);
  }

  return {};
};

export const setTestData = (data: TestDataState): void => {
  global.TEST_DATA_STATE = { ...global.TEST_DATA_STATE, ...data };
  // Persist to file for cross-file sharing
  try {
    fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(global.TEST_DATA_STATE, null, 2));
  } catch (error) {
    console.warn("⚠️ Could not write test data file:", error);
  }
};

export const updateTestData = (updates: Partial<TestDataState>): void => {
  global.TEST_DATA_STATE = { ...global.TEST_DATA_STATE, ...updates };
  // Persist to file for cross-file sharing
  try {
    fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(global.TEST_DATA_STATE, null, 2));
  } catch (error) {
    console.warn("⚠️ Could not write test data file:", error);
  }
};

// Helper functions for common test operations
export const requireTestData = () => {
  const data = getTestData();
  if (!data.project?.id || !data.group?.id) {
    throw new Error(
      "Test data not available. Make sure to run data-lifecycle.test.ts first with --runInBand"
    );
  }
  return data;
};

export const getTestProject = () => {
  const data = requireTestData();
  return data.project;
};

export const getTestGroup = () => {
  const data = requireTestData();
  return data.group;
};
