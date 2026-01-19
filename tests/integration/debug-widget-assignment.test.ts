/**
 * Debug Widget Assignment Test
 * Simple test to verify that update_work_item tool works correctly
 */

import { IntegrationTestHelper } from "./helpers/registry-helper";

describe("Debug Widget Assignment", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("✅ Debug widget assignment test helper initialized");
  });

  it("should test update_work_item tool with simple title update", async () => {
    console.log("🔧 Creating a simple work item for testing...");

    // Create a simple epic first
    const epic = (await helper.executeTool("manage_work_item", {
      action: "create",
      namespace: "test",
      title: "Debug Epic for Widget Testing",
      workItemType: "EPIC",
    })) as any;

    expect(epic).toBeDefined();
    expect(epic.id).toBeDefined();
    console.log(`✅ Created debug epic: ${epic.id} - ${epic.title}`);

    // Try a simple title update first
    console.log("🔧 Testing simple title update...");
    const updatedEpic = (await helper.executeTool("manage_work_item", {
      action: "update",
      id: epic.id,
      title: "Updated Debug Epic for Widget Testing",
    })) as any;

    expect(updatedEpic).toBeDefined();
    expect(updatedEpic.title).toBe("Updated Debug Epic for Widget Testing");
    console.log(`✅ Title update successful: ${updatedEpic.title}`);

    // Now test if the tool handles undefined widget parameters gracefully
    console.log("🔧 Testing update with undefined widget parameters...");
    const epicWithUndefined = (await helper.executeTool("manage_work_item", {
      action: "update",
      id: epic.id,
      title: "Epic with Undefined Widgets",
      assigneeIds: undefined,
      labelIds: undefined,
      milestoneId: undefined,
    })) as any;

    expect(epicWithUndefined).toBeDefined();
    expect(epicWithUndefined.title).toBe("Epic with Undefined Widgets");
    console.log(`✅ Update with undefined widgets successful: ${epicWithUndefined.title}`);

    // Clean up
    console.log("🧹 Cleaning up debug epic...");
    await helper.executeTool("manage_work_item", { action: "delete", id: epic.id });
    console.log("✅ Debug epic cleaned up");
  }, 15000);
});
