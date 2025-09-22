#!/usr/bin/env node

// Simple API validation script for PR testing
import fetch from "node-fetch";
import dotenv from "dotenv";

// .env 파일 로드
dotenv.config();

const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com";
const GITLAB_TOKEN = process.env.GITLAB_TOKEN_TEST || process.env.GITLAB_TOKEN;
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID;

async function validateGitLabAPI() {
  console.log("🔍 Validating GitLab API connection...\n");

  if (!GITLAB_TOKEN) {
    console.warn("⚠️  No GitLab token provided. Skipping API validation.");
    console.log("Set GITLAB_TOKEN_TEST or GITLAB_TOKEN to enable API validation.\n");
    return true;
  }

  if (!TEST_PROJECT_ID) {
    console.warn("⚠️  No test project ID provided. Skipping API validation.");
    console.log("Set TEST_PROJECT_ID to enable API validation.\n");
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

      if (test.validate(data)) {
        console.log(`✅ ${test.name} - PASSED\n`);
        
        // If we found pipelines, save the first one for additional testing
        if (test.name === "List pipelines" && data.length > 0) {
          firstPipelineId = data[0].id;
        }
      } else {
        console.log(`❌ ${test.name} - FAILED (invalid response format)\n`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED`);
      console.log(`   Error: ${error.message}\n`);
      allPassed = false;
    }
  }

  // Test pipeline-specific endpoints if we have a pipeline ID
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

        if (test.validate(data)) {
          console.log(`✅ ${test.name} - PASSED\n`);
        } else {
          console.log(`❌ ${test.name} - FAILED (invalid response format)\n`);
          allPassed = false;
        }
      } catch (error) {
        console.log(`❌ ${test.name} - FAILED`);
        console.log(`   Error: ${error.message}\n`);
        allPassed = false;
      }
    }
  }

  if (allPassed) {
    console.log("✅ All API validation tests passed!");
  } else {
    console.log("❌ Some API validation tests failed!");
  }

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
