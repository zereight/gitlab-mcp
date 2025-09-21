#!/usr/bin/env node

// Simple API validation script for PR testing
import fetch from "node-fetch";

const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com";
const GITLAB_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const ALLOWED_PROJECTS = process.env.GITLAB_ALLOWED_PROJECT_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];
const TEST_PROJECT_ID = ALLOWED_PROJECTS[0] || "12345";

async function runTest(test) {
  try {
    console.log(`Testing: ${test.name}`);
    const response = await fetch(test.url, {
      headers: {
        Authorization: `Bearer ${GITLAB_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const passed = test.validate(data);
    
    if (passed) {
      console.log(`✅ ${test.name} - PASSED\n`);
    } else {
      console.log(`❌ ${test.name} - FAILED (invalid response format)\n`);
    }
    
    return { passed, data };
  } catch (error) {
    console.log(`❌ ${test.name} - FAILED`);
    console.log(`   Error: ${error.message}\n`);
    return { passed: false, data: null };
  }
}

async function validateGitLabAPI() {
  console.log("🔍 Validating GitLab API connection...\n");

  if (!GITLAB_TOKEN) {
    console.warn("⚠️  No GitLab token provided. Skipping API validation.");
    console.log("Set GITLAB_PERSONAL_ACCESS_TOKEN to enable API validation.\n");
    return true;
  }

  const tests = [
    {
      name: "Fetch project info",
      url: `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}`,
      validate: data => data.id && data.name,
    },
    {
      name: "List issues",
      url: `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}/issues?per_page=1`,
      validate: data => Array.isArray(data),
    },
    {
      name: "List merge requests",
      url: `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}/merge_requests?per_page=1`,
      validate: data => Array.isArray(data),
    },
    {
      name: "List branches",
      url: `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}/repository/branches?per_page=1`,
      validate: data => Array.isArray(data),
    },
    {
      name: "List pipelines",
      url: `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}/pipelines?per_page=5`,
      validate: data => Array.isArray(data),
    },
  ];

  let allPassed = true;
  let firstPipelineId = null;

  for (const test of tests) {
    const result = await runTest(test);
    allPassed = allPassed && result.passed;
    
    if (test.name === "List pipelines" && result.data?.length > 0) {
      firstPipelineId = result.data[0].id;
    }
  }

  if (firstPipelineId) {
    console.log(`Found pipeline #${firstPipelineId}, testing pipeline-specific endpoints...\n`);
    
    const pipelineTests = [
      {
        name: `Get pipeline #${firstPipelineId} details`,
        url: `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}/pipelines/${firstPipelineId}`,
        validate: data => data.id === firstPipelineId && data.status,
      },
      {
        name: `List pipeline #${firstPipelineId} jobs`,
        url: `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}/pipelines/${firstPipelineId}/jobs`,
        validate: data => Array.isArray(data),
      },
      {
        name: `List pipeline #${firstPipelineId} trigger jobs (bridges)`,
        url: `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}/pipelines/${firstPipelineId}/bridges`,
        validate: data => Array.isArray(data),
      },
    ];

    for (const test of pipelineTests) {
      const result = await runTest(test);
      allPassed = allPassed && result.passed;
    }
  }

  console.log(allPassed ? "✅ All API validation tests passed!" : "❌ Some API validation tests failed!");
  return allPassed;
}

// Run validation
validateGitLabAPI()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });

export { validateGitLabAPI };
