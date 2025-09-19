/**
 * Jest setup file for integration tests
 * Loads environment variables from .env.test for real GitLab API testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Check if .env.test exists and load it
const envTestPath = path.resolve(__dirname, '../../.env.test');

if (fs.existsSync(envTestPath)) {
  // Load .env.test file
  config({ path: envTestPath, quiet: true });

  // Set flag to indicate integration tests can run
  process.env.INTEGRATION_TESTS_ENABLED = 'true';

  // Enable feature flags by default if not explicitly set
  if (!process.env.USE_WORKITEMS) process.env.USE_WORKITEMS = 'true';
  if (!process.env.USE_MILESTONE) process.env.USE_MILESTONE = 'true';
  if (!process.env.USE_PIPELINE) process.env.USE_PIPELINE = 'true';
  if (!process.env.USE_GITLAB_WIKI) process.env.USE_GITLAB_WIKI = 'true';
  if (!process.env.USE_LABELS) process.env.USE_LABELS = 'true';
  if (!process.env.USE_MRS) process.env.USE_MRS = 'true';
  if (!process.env.USE_FILES) process.env.USE_FILES = 'true';
  if (!process.env.USE_VARIABLES) process.env.USE_VARIABLES = 'true';

  console.log('🔧 Integration test environment loaded from .env.test');
  console.log(`   GitLab URL: ${process.env.GITLAB_API_URL}`);
  console.log(`   Features enabled: workitems=${process.env.USE_WORKITEMS}, milestones=${process.env.USE_MILESTONE}, pipelines=${process.env.USE_PIPELINE}`);
} else {
  console.log('⚠️  .env.test not found - Integration tests disabled');
  console.log('   Create .env.test with GitLab credentials to enable integration tests');
  process.env.INTEGRATION_TESTS_ENABLED = 'false';
}

// Global test timeout for integration tests
jest.setTimeout(30000);