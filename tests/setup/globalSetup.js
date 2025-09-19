/**
 * Global Test Setup
 *
 * Runs once before all integration tests
 * Validates environment and prepares for data lifecycle chain
 */

const path = require('path');
const fs = require('fs');
const { config } = require('dotenv');

module.exports = async () => {
  // Load .env.test file first (same as setupTests.ts)
  const envTestPath = path.resolve(__dirname, '../../.env.test');
  if (fs.existsSync(envTestPath)) {
    config({ path: envTestPath, quiet: true });
  }

  console.log('🚀 Starting GitLab Integration Test Suite with Data Lifecycle');
  console.log('📋 Test execution plan:');
  console.log('  1. data-lifecycle.test.ts - Create complete test infrastructure');
  console.log('  2. schemas-dependent/*.test.ts - Test schemas with real data');
  console.log('  3. workitems.test.ts - Test GraphQL with infrastructure');
  console.log('  4. Cleanup all test infrastructure');
  console.log('');

  // Validate required environment variables
  const requiredEnvVars = ['GITLAB_TOKEN', 'GITLAB_API_URL'];
  const missing = requiredEnvVars.filter(env => !process.env[env]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Environment validated - starting test data lifecycle chain');
};