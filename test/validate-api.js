#!/usr/bin/env node

// Simple API validation script for PR testing
import dotenv from "dotenv";

// .env 파일 로드
dotenv.config();

const DEFAULT_GITLAB_API_URL = "https://gitlab.com";

// Host only. Call sites append `/api/v4`. Accept the same forms as
// utils/url.ts normalizeGitLabApiUrl: with or without a trailing `/api/v4`.
function normalizeGitLabApiBase(rawUrl) {
  const trimmed = (rawUrl ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return DEFAULT_GITLAB_API_URL;
  }
  const withoutVersion = trimmed.endsWith("/api/v4")
    ? trimmed.slice(0, -"/api/v4".length).replace(/\/+$/, "")
    : trimmed;
  return withoutVersion || DEFAULT_GITLAB_API_URL;
}

const GITLAB_API_URL = normalizeGitLabApiBase(process.env.GITLAB_API_URL || DEFAULT_GITLAB_API_URL);
const GITLAB_TOKEN =
  process.env.GITLAB_TOKEN_TEST ||
  process.env.GITLAB_TOKEN ||
  process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID;

// GitLab.com rate-limits a Free-plan user to 100 API requests a minute, shared with
// the live tests that run next. On 429, wait (Retry-After, then RateLimit-Reset, then
// 2^attempt s) in chunks of at most 30 s and send again: at most 5 attempts, and no
// more than 5 minutes of waiting. Other responses are returned as they are.
const RETRY_MAX_ATTEMPTS = 5;
const RETRY_MAX_SLEEP_MS = 30_000;
const RETRY_MAX_TOTAL_WAIT_MS = 5 * 60_000;

function retryDelayMs(response, attempt) {
  const now = Date.now();
  const retryAfter = response.headers.get("retry-after");
  let ms = Number.NaN;
  if (retryAfter !== null && retryAfter.trim() !== "") {
    const seconds = Number(retryAfter);
    ms = Number.isNaN(seconds) ? Date.parse(retryAfter) - now : seconds * 1000;
  }
  const reset = response.headers.get("ratelimit-reset");
  if (Number.isNaN(ms) && reset !== null && reset.trim() !== "") {
    ms = Number(reset) * 1000 - now;
  }
  if (Number.isNaN(ms)) ms = 1000 * 2 ** attempt;
  return Math.max(ms, 0);
}

async function fetchWithRetry(url, init) {
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt + 1 >= RETRY_MAX_ATTEMPTS) return response;
    let wait = retryDelayMs(response, attempt);
    if (waited + wait > RETRY_MAX_TOTAL_WAIT_MS) return response;
    console.error(`   GitLab returned 429; retrying in ${Math.ceil(wait / 1000)}s`);
    waited += wait;
    await response.body?.cancel().catch(() => undefined);
    do {
      const chunk = Math.min(wait, RETRY_MAX_SLEEP_MS);
      await new Promise(resolve => setTimeout(resolve, chunk));
      wait -= chunk;
    } while (wait > 0);
  }
}

// list_tags / get_tag parse responses with GitLabTagSchema from the build output,
// so these live checks validate the real payload against the same schema (#1015).
// Needs `npm run build` first; CI runs it before test:live.
async function validateTagResponses() {
  let GitLabTagSchema;
  try {
    ({ GitLabTagSchema } = await import("../build/schemas.js"));
  } catch (error) {
    console.log("❌ Tag schema checks - FAILED");
    console.log(`   Error: could not load build/schemas.js (${error.code ?? error.message}).`);
    console.log("   Run npm run build first.\n");
    return false;
  }

  const tagsUrl = `${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(TEST_PROJECT_ID)}/repository/tags`;
  const headers = { Authorization: `Bearer ${GITLAB_TOKEN}`, Accept: "application/json" };
  const formatIssues = error =>
    error.issues
      .slice(0, 3)
      .map(issue => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
  let allPassed = true;
  let firstTagName = null;

  try {
    console.log("Testing: List tags (GitLabTagSchema)");
    const response = await fetchWithRetry(`${tagsUrl}?per_page=5`, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const parsed = GitLabTagSchema.array().safeParse(data);
    if (parsed.success) {
      console.log("✅ List tags (GitLabTagSchema) - PASSED\n");
      firstTagName = data[0]?.name ?? null;
    } else {
      console.log("❌ List tags (GitLabTagSchema) - FAILED (schema mismatch)");
      console.log(`   Error: ${formatIssues(parsed.error)}\n`);
      allPassed = false;
    }
  } catch (error) {
    console.log("❌ List tags (GitLabTagSchema) - FAILED");
    console.log(`   Error: ${error.message}\n`);
    allPassed = false;
  }

  if (!firstTagName) {
    // A failed list check was already reported above; only an empty list is a skip.
    if (allPassed) {
      console.log("Skipping: Get tag (project has no tags)\n");
    }
    return allPassed;
  }

  try {
    const name = firstTagName;
    console.log(`Testing: Get tag ${name} (GitLabTagSchema)`);
    const response = await fetchWithRetry(`${tagsUrl}/${encodeURIComponent(name)}`, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const parsed = GitLabTagSchema.safeParse(await response.json());
    if (parsed.success) {
      console.log(`✅ Get tag ${name} (GitLabTagSchema) - PASSED\n`);
    } else {
      console.log(`❌ Get tag ${name} (GitLabTagSchema) - FAILED (schema mismatch)`);
      console.log(`   Error: ${formatIssues(parsed.error)}\n`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ Get tag ${firstTagName} (GitLabTagSchema) - FAILED`);
    console.log(`   Error: ${error.message}\n`);
    allPassed = false;
  }

  return allPassed;
}

async function validateGitLabAPI() {
  console.log("🔍 Validating GitLab API connection...\n");

  if (!GITLAB_TOKEN) {
    console.warn("⚠️  No GitLab token provided. Skipping API validation.");
    console.log(
      "Set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN to enable API validation.\n"
    );
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
      const response = await fetchWithRetry(test.url, {
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
        const response = await fetchWithRetry(test.url, {
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

  if (!(await validateTagResponses())) {
    allPassed = false;
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

export { normalizeGitLabApiBase, validateGitLabAPI };
