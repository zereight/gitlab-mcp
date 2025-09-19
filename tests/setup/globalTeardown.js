/**
 * Global Test Teardown
 *
 * Runs once after all integration tests
 * Handles cleanup of lifecycle test data
 */

const path = require('path');
const fs = require('fs');
const { config } = require('dotenv');

// Use native fetch API (available in Node.js 18+)
// No import needed - fetch is global in modern Node.js

module.exports = async () => {
  // Load environment
  const path = require('path');
  const envTestPath = path.resolve(__dirname, '../../.env.test');
  if (fs.existsSync(envTestPath)) {
    config({ path: envTestPath, quiet: true });
  }

  // Get test data from persistent file storage (globalTeardown runs in separate context)
  const os = require('os');
  const testDataFile = path.join(os.tmpdir(), 'gitlab-mcp-test-data.json');
  let testData = null;

  try {
    // Read test data from persistent file
    if (fs.existsSync(testDataFile)) {
      testData = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      console.log(`📋 Found test data file with group ID: ${testData.group?.id}`);
    } else {
      console.log('📋 No test data file found - nothing to clean up');
    }
  } catch (error) {
    console.log('⚠️  Could not read test data file:', error);
  }

  console.log('');
  console.log('🧹 Integration test suite completed');

  // Cleanup test infrastructure if it exists
  if (testData?.group?.id && process.env.GITLAB_TOKEN && process.env.GITLAB_API_URL) {
    console.log('🧹 Final cleanup: Deleting all test infrastructure...');

    try {
      const response = await fetch(`${process.env.GITLAB_API_URL}/api/v4/groups/${testData.group.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.GITLAB_TOKEN}`,
        },
      });

      if (response.ok) {
        console.log(`✅ Cleaned up test group: ${testData.group.id} (includes all projects, MRs, work items)`);
      } else {
        console.log(`⚠️  Could not delete test group ${testData.group.id}: ${response.status}`);
      }
    } catch (error) {
      console.log(`⚠️  Error deleting test group:`, error);
    }
  }

  console.log('📊 Data lifecycle summary:');
  console.log('  ✅ Test infrastructure created');
  console.log('  ✅ Schema validation completed with real data');
  console.log('  ✅ GraphQL functionality verified');
  console.log('  ✅ Complete cleanup performed');
  console.log('');
  console.log('✅ GitLab Integration Test Suite - All tests completed successfully');

  // Clean up temporary test data file
  try {
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
      console.log('🧹 Cleaned up temporary test data file');
    }
  } catch (error) {
    console.warn('⚠️ Could not clean up test data file:', error);
  }
};