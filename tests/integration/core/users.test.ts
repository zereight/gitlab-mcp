/**
 * GitLab Users API Integration Tests
 * Tests the GetUsersSchema against GitLab 18.3 API using actual handler functions
 */

import { GetUsersSchema } from "../../../src/entities/core/schema-readonly";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("GitLab Users API - GetUsersSchema", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    // Initialize integration test helper
    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("✅ Integration test helper initialized for users API testing");
  });

  it("should validate GetUsersSchema parameters against GitLab API using handler functions", async () => {
    // Test with various parameter combinations
    const testCases = [
      // Basic query
      {},
      // Single username search
      { username: "root" },
      // Search with pagination
      { search: "admin", page: 1, per_page: 5 },
      // Filter active users
      { active: true, per_page: 10 },
      // Filter with multiple parameters
      {
        exclude_internal: true,
        without_project_bots: true,
        per_page: 20,
      },
      // Date range filtering
      {
        created_after: "2023-01-01T00:00:00Z",
        created_before: "2024-12-31T23:59:59Z",
        per_page: 5,
      },
    ];

    for (const params of testCases) {
      console.log(`🔍 Testing users with params:`, params);

      // Validate request schema
      const validationResult = GetUsersSchema.safeParse(params);
      expect(validationResult.success).toBe(true);

      if (validationResult.success) {
        // Use executeTool directly since getUsers convenience method might not work
        const rawData = (await helper.executeTool("get_users", validationResult.data)) as any;

        // Handle both smart search result format and legacy array format
        let data: any[];
        if (Array.isArray(rawData)) {
          // Legacy format: direct array of users
          data = rawData;
        } else if (rawData && Array.isArray(rawData.users)) {
          // Smart search format: object with users array and metadata
          data = rawData.users;
          console.log(`  🔍 Smart search metadata:`, rawData.searchMetadata);
        } else {
          throw new Error(`Unexpected response format: ${typeof rawData}`);
        }

        expect(Array.isArray(data)).toBe(true);
        console.log(`  📊 Retrieved ${data.length} users`);

        // Validate response structure if we have results
        if (data.length > 0) {
          const user = data[0];
          // Required fields as per GitLab 18.3 documentation
          expect(user).toHaveProperty("id");
          expect(user).toHaveProperty("username");
          expect(user).toHaveProperty("name");
          expect(user).toHaveProperty("state");
          expect(user).toHaveProperty("avatar_url");
          expect(user).toHaveProperty("web_url");

          // Validate types
          expect(typeof user.id).toBe("number");
          expect(typeof user.username).toBe("string");
          expect(typeof user.name).toBe("string");
          expect(typeof user.state).toBe("string");
          expect(["active", "blocked", "deactivated"]).toContain(user.state);

          console.log(`  ✅ User structure validated: ${user.username} (${user.state})`);
        }

        // Verify pagination parameters were respected
        if (params.per_page && data.length > 0) {
          expect(data.length).toBeLessThanOrEqual(params.per_page);
        }
      }
    }
  }, 30000); // 30 second timeout for multiple API calls

  it("should handle invalid parameters correctly", async () => {
    const invalidCases = [
      // Invalid types for pagination
      { page: "not-a-number" },
      { per_page: -1 },
      { per_page: 101 }, // Exceeds max
      { page: 0 }, // Min value violation
      // Invalid types for other fields
      { username: 123 }, // Should be string
      { search: [] }, // Should be string
    ];

    for (const params of invalidCases) {
      const validationResult = GetUsersSchema.safeParse(params);
      expect(validationResult.success).toBe(false);
      console.log(`  ✅ Correctly rejected invalid params:`, params);
    }
  });

  it("should correctly handle all filter parameters with handler function", async () => {
    // Test that all documented parameters are accepted
    const allParams = {
      username: "test",
      search: "test",
      active: true,
      external: false,
      blocked: false,
      created_after: "2023-01-01T00:00:00Z",
      created_before: "2024-01-01T00:00:00Z",
      exclude_active: false,
      exclude_external: false,
      exclude_internal: true,
      without_project_bots: true,
      page: 1,
      per_page: 50,
    };

    console.log(`🔍 Testing complete parameter set with handler function`);

    const validationResult = GetUsersSchema.safeParse(allParams);
    expect(validationResult.success).toBe(true);

    // Ensure all parameters are preserved
    if (validationResult.success) {
      expect(Object.keys(validationResult.data).length).toBe(Object.keys(allParams).length);

      // Test that handler accepts all parameters
      const data = (await helper.executeTool("get_users", validationResult.data)) as any[];
      expect(Array.isArray(data)).toBe(true);
      console.log(`  ✅ Handler accepted all parameters, returned ${data.length} users`);
    }
  });
});
