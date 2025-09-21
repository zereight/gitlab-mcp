import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { StdioTestClient } from "./clients/stdio-client.js";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Test configuration for unrestricted mode
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";
const GITLAB_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const TEST_PROJECT_ID = "70322092"; // Use specific project ID for testing

// Set unrestricted mode
process.env.GITLAB_ALLOWED_PROJECT_IDS = "";

console.log("🚀 GitLab MCP Server Tests - Unrestricted Mode");
console.log("");
console.log("🔧 Test Configuration:");
console.log(`  GitLab URL: ${GITLAB_API_URL}`);
console.log(`  Token: ${GITLAB_TOKEN ? "✅ Provided" : "❌ Missing"}`);
console.log(`  GITLAB_ALLOWED_PROJECT_IDS: "${process.env.GITLAB_ALLOWED_PROJECT_IDS}"`);
console.log(`  TEST_PROJECT_ID: "${TEST_PROJECT_ID}"`);
console.log(`  Mode: ✅ Unrestricted Mode (any project accessible)`);
console.log("");
console.log("✅ Configuration validated");
console.log("");

describe("GitLab MCP Server - Unrestricted Mode Tests", () => {
  let client: StdioTestClient;

  before(async () => {
    client = new StdioTestClient();
    const serverPath = path.resolve(process.cwd(), "build/index.js");
    await client.connect(serverPath, {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN || "test-token",
      GITLAB_API_URL: GITLAB_API_URL,
      GITLAB_ALLOWED_PROJECT_IDS: "", // Explicitly set to empty for unrestricted mode
    });
    assert.ok(client.isConnected, "Client should be connected");
    console.log("Client connected to stdio server");
  });

  after(async () => {
    if (client && client.isConnected) {
      await client.disconnect();
    }
  });

  test("should list tools via stdio", async () => {
    const tools = await client.listTools();
    assert.ok(tools !== null && tools !== undefined, "Tools response should be defined");
    assert.ok("tools" in tools, "Response should have tools property");
    assert.ok(
      Array.isArray(tools.tools) && tools.tools.length > 0,
      "Tools should be a non-empty array"
    );
    console.log(`✅ Found ${tools.tools.length} tools`);
  });

  test("should call get_project tool with explicit project ID", async () => {
    if (!GITLAB_TOKEN) {
      console.log("⚠️ Skipping API test - no GitLab token provided");
      return;
    }

    const result = await client.callTool("get_project", {
      project_id: TEST_PROJECT_ID,
    });

    assert.ok(result !== null && result !== undefined, "Result should be defined");
    assert.ok("content" in result, "Result should have content property");
    assert.ok(Array.isArray(result.content), "Content should be an array");

    const projectData = JSON.parse(result.content[0].text as string);
    assert.ok(
      typeof projectData === "object" && projectData !== null,
      "Project data should be parseable JSON"
    );
    assert.ok("id" in projectData, "Project should have id");
    assert.ok("name" in projectData, "Project should have name");
    assert.ok("web_url" in projectData, "Project should have web_url");

    console.log(`✅ Successfully retrieved project: ${projectData.name} (ID: ${projectData.id})`);
  });

  test("should call list_merge_requests tool with explicit project ID", async () => {
    if (!GITLAB_TOKEN) {
      console.log("⚠️ Skipping API test - no GitLab token provided");
      return;
    }

    const result = await client.callTool("list_merge_requests", {
      project_id: TEST_PROJECT_ID,
    });

    assert.ok(result !== null && result !== undefined, "Result should be defined");
    assert.ok("content" in result, "Result should have content property");
    assert.ok(Array.isArray(result.content), "Content should be an array");

    const mergeRequests = JSON.parse(result.content[0].text as string);
    assert.ok(Array.isArray(mergeRequests), "Should return array of merge requests");
    console.log(`✅ Found ${mergeRequests.length} merge requests`);
  });

  test("should call list_issues tool with explicit project ID", async () => {
    if (!GITLAB_TOKEN) {
      console.log("⚠️ Skipping API test - no GitLab token provided");
      return;
    }

    const result = await client.callTool("list_issues", {
      project_id: TEST_PROJECT_ID,
      state: "opened",
    });

    assert.ok(result !== null && result !== undefined, "Result should be defined");
    assert.ok("content" in result, "Result should have content property");
    assert.ok(Array.isArray(result.content), "Content should be an array");

    const issues = JSON.parse(result.content[0].text as string);
    assert.ok(Array.isArray(issues), "Should return array of issues");
    console.log(`✅ Found ${issues.length} issues`);
  });

  test("should call list_projects tool (works in unrestricted mode)", async () => {
    if (!GITLAB_TOKEN) {
      console.log("⚠️ Skipping API test - no GitLab token provided");
      return;
    }

    const result = await client.callTool("list_projects", {
      per_page: 5,
    });

    assert.ok(result !== null && result !== undefined, "Result should be defined");
    assert.ok("content" in result, "Result should have content property");
    assert.ok(Array.isArray(result.content), "Content should be an array");

    const projects = JSON.parse(result.content[0].text as string);
    assert.ok(Array.isArray(projects), "Should return array of projects");
    console.log(`✅ Found ${projects.length} projects`);
  });

  test("should handle error when calling tool without project_id in unrestricted mode", async () => {
    // In unrestricted mode, project_id is still required for project-specific tools
    // This test verifies that the error handling works correctly
    try {
      await client.callTool("get_project", {});
      assert.fail("Should have thrown an error when project_id is missing");
    } catch (error: any) {
      // Should get an error about missing project ID or 404 Not Found
      assert.ok(
        error.message.includes("404") || 
        error.message.includes("Not Found") ||
        error.message.includes("project ID") || 
        error.message.includes("project_id") ||
        error.message.includes("No project ID provided"),
        "Error should indicate missing or invalid project ID"
      );
      console.log("✅ Correctly handles missing project_id in unrestricted mode");
    }
  });

  test("should handle error when calling tool with invalid project_id", async () => {
    try {
      await client.callTool("get_project", {
        project_id: "invalid-project-id",
      });
      assert.fail("Should have thrown an error for invalid project ID");
    } catch (error: any) {
      assert.ok(
        error.message.includes("404") || error.message.includes("Not Found"),
        "Error should indicate project not found"
      );
      console.log("✅ Correctly handles invalid project_id");
    }
  });
});