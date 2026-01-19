/**
 * Work Items Schema Integration Tests
 * Tests BrowseWorkItemsSchema and ManageWorkItemSchema against real GitLab 18.3 API responses
 */

import { BrowseWorkItemsSchema } from "../../../src/entities/workitems/schema-readonly";
import { ManageWorkItemSchema } from "../../../src/entities/workitems/schema";
import { getTestData } from "../../setup/testConfig";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Work Items Schema - GitLab 18.3 Integration", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    // Initialize integration test helper
    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("✅ Integration test helper initialized for work items testing");
  });

  describe("BrowseWorkItemsSchema", () => {
    it("should validate basic list work items parameters", async () => {
      const testData = getTestData();
      expect(testData.project?.path_with_namespace).toBeDefined();

      const validParams = {
        action: "list" as const,
        namespace: testData.project!.path_with_namespace,
        first: 5,
        types: ["ISSUE" as const, "TASK" as const],
      };

      const result = BrowseWorkItemsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "list") {
        expect(result.data.namespace).toBe(testData.project!.path_with_namespace);
        expect(result.data.first).toBe(5);
        expect(result.data.types).toEqual(["ISSUE", "TASK"]);
      }

      console.log("✅ BrowseWorkItemsSchema validates basic parameters correctly");
    });

    it("should make successful request with validated parameters using handler function", async () => {
      const testData = getTestData();
      expect(testData.project?.path_with_namespace).toBeDefined();

      const params = {
        action: "list" as const,
        namespace: testData.project!.path_with_namespace,
        first: 3,
        types: ["ISSUE" as const],
      };

      // Validate parameters first
      const paramResult = BrowseWorkItemsSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (!paramResult.success) return;

      console.log("🔍 BrowseWorkItemsSchema - Testing list work items using handler function...");
      const result = (await helper.executeTool("browse_work_items", paramResult.data)) as any;

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      console.log(`📋 Found ${result.items.length} work items via handler`);

      // Validate structure if work items exist
      if (result.items.length > 0) {
        const firstWorkItem = result.items[0];
        expect(firstWorkItem).toHaveProperty("id");
        expect(firstWorkItem).toHaveProperty("iid");
        expect(firstWorkItem).toHaveProperty("title");
        expect(firstWorkItem).toHaveProperty("workItemType");
        console.log(`  ✅ Work item: ${firstWorkItem.title} (IID: ${firstWorkItem.iid})`);
      }

      console.log(
        `✅ BrowseWorkItemsSchema API request successful via handler, found ${result.items.length} work items`
      );
    }, 15000);
  });

  describe("BrowseWorkItemsSchema - get action", () => {
    it("should validate get work item parameters", async () => {
      const testData = getTestData();
      expect(testData.workItems).toBeDefined();
      expect(testData.workItems!.length).toBeGreaterThan(0);

      const firstWorkItem = testData.workItems![0];
      const validParams = {
        action: "get" as const,
        id: firstWorkItem.id,
      };

      const result = BrowseWorkItemsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "get") {
        expect(result.data.id).toBe(firstWorkItem.id);
      }

      console.log("✅ BrowseWorkItemsSchema validates parameters correctly");
    });

    it("should make successful GraphQL request for single work item", async () => {
      const testData = getTestData();
      expect(testData.workItems).toBeDefined();
      expect(testData.workItems!.length).toBeGreaterThan(0);

      const firstWorkItem = testData.workItems![0];
      const params = {
        action: "get" as const,
        id: firstWorkItem.id,
      };

      // Validate parameters first
      const paramResult = BrowseWorkItemsSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (!paramResult.success) return;

      console.log("🔍 Getting single work item using handler function...");
      const workItem = (await helper.executeTool("browse_work_items", paramResult.data)) as any;

      expect(workItem).toBeDefined();
      expect(workItem).toHaveProperty("id");
      expect(workItem).toHaveProperty("iid");
      expect(workItem).toHaveProperty("title");
      expect(workItem).toHaveProperty("workItemType");

      console.log(
        `✅ BrowseWorkItemsSchema API request successful via handler: ${workItem.title} (IID: ${workItem.iid})`
      );
    }, 15000);
  });

  describe("CRUD Operations Integration Tests", () => {
    let crudTestWorkItemId: string | null = null;

    it("should create work item via GraphQL API using handler function", async () => {
      const testData = getTestData();
      expect(testData.project?.path_with_namespace).toBeDefined();

      // Create new work item using handler function
      const createParams = {
        action: "create" as const,
        namespace: testData.project!.path_with_namespace,
        title: `Schema Test Work Item ${Date.now()}`,
        workItemType: "ISSUE",
        description: "Test work item created for schema validation",
      };

      // Validate parameters first
      const paramResult = ManageWorkItemSchema.safeParse(createParams);
      expect(paramResult.success).toBe(true);

      if (!paramResult.success) return;

      console.log("🔧 Creating test work item using handler function...");
      const workItem = (await helper.executeTool("manage_work_item", paramResult.data)) as any;

      expect(workItem).toBeDefined();
      expect(workItem).toHaveProperty("id");
      expect(workItem).toHaveProperty("iid");
      expect(workItem).toHaveProperty("title");
      expect(workItem.title).toBe(createParams.title);

      crudTestWorkItemId = workItem.id;

      console.log(
        `✅ ManageWorkItemSchema successful via handler: ${workItem.title} (ID: ${workItem.id}, IID: ${workItem.iid})`
      );
    }, 15000);

    it("should read the created work item via GraphQL API", async () => {
      expect(crudTestWorkItemId).toBeDefined();

      // Test BrowseWorkItemsSchema with actual GraphQL API call
      const getParams = {
        action: "get" as const,
        id: crudTestWorkItemId!,
      };

      const paramResult = BrowseWorkItemsSchema.safeParse(getParams);
      expect(paramResult.success).toBe(true);

      if (!paramResult.success) return;

      console.log("🔍 Reading created work item using handler function...");
      const workItem = (await helper.executeTool("browse_work_items", paramResult.data)) as any;

      expect(workItem).toBeDefined();
      expect(workItem.id).toBe(crudTestWorkItemId);
      expect(workItem).toHaveProperty("iid");
      expect(workItem).toHaveProperty("title");

      console.log(
        `✅ BrowseWorkItemsSchema read successful via handler: ${workItem.title} (ID: ${workItem.id})`
      );
    }, 15000);

    it("should update the work item via GraphQL API", async () => {
      expect(crudTestWorkItemId).toBeDefined();

      // Test ManageWorkItemSchema with required fields for GraphQL
      const updateParams = {
        action: "update" as const,
        id: crudTestWorkItemId!,
        title: `Updated Schema Test Work Item ${Date.now()}`,
        description: "Updated description for schema validation test",
        assigneeIds: [], // Empty array for assignees
      };

      const paramResult = ManageWorkItemSchema.safeParse(updateParams);
      expect(paramResult.success).toBe(true);

      if (!paramResult.success) return;

      console.log("🔧 Updating work item using handler function...");
      const updatedWorkItem = (await helper.executeTool(
        "manage_work_item",
        paramResult.data
      )) as any;

      expect(updatedWorkItem).toBeDefined();
      expect(updatedWorkItem.id).toBe(crudTestWorkItemId);
      expect(updatedWorkItem.title).toBe(updateParams.title);

      console.log(`✅ ManageWorkItemSchema successful via handler: ${updatedWorkItem.title}`);
    }, 15000);

    it("should delete the created work item via GraphQL API", async () => {
      expect(crudTestWorkItemId).toBeDefined();

      // Test ManageWorkItemSchema
      const deleteParams = {
        action: "delete" as const,
        id: crudTestWorkItemId!,
      };

      const paramResult = ManageWorkItemSchema.safeParse(deleteParams);
      expect(paramResult.success).toBe(true);

      if (!paramResult.success) return;

      console.log("🗑️ Deleting test work item using handler function...");
      const result = (await helper.executeTool("manage_work_item", paramResult.data)) as any;

      // Deletion might return different structures depending on implementation
      console.log(`✅ ManageWorkItemSchema successful via handler: ${JSON.stringify(result)}`);

      // Clear the test work item ID since it's been deleted
      crudTestWorkItemId = null;
    }, 15000);
  });
});
