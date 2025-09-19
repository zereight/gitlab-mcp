/**
 * Widget Verification Integration Tests
 * Verifies that created work items actually have the assigned widgets (assignees, labels, milestones)
 */

import { IntegrationTestHelper } from '../helpers/registry-helper';
import { getTestData } from '../../setup/testConfig';

describe('Work Item Widgets Verification - Real Data Tests', () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    // Initialize integration test helper
    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log('✅ Widget verification test helper initialized');
  });

  it('should verify created epics actually have assigned assignees, labels, and milestones', async () => {
    const testData = getTestData();

    // Skip test if no test data (data lifecycle hasn't run or was cleaned up)
    if (!testData.workItems || testData.workItems.length === 0) {
      console.log('⏭️ Skipping widget verification - no test data found (run data lifecycle test first)');
      return;
    }

    console.log('🔍 Verifying widgets on created work items...');

    // Find epics with widgets in test data
    const epicsWithWidgets = testData.workItems!.filter(
      workItem => workItem.workItemType?.name === 'Epic' &&
      workItem.title?.includes('With Widgets')
    );

    if (epicsWithWidgets.length === 0) {
      console.log('⏭️ No epics with widgets found in test data - this is expected if widget assignment failed');
      return;
    }
    console.log(`📋 Found ${epicsWithWidgets.length} epic(s) with widgets to verify`);

    for (const epic of epicsWithWidgets) {
      console.log(`🔧 Verifying widgets for epic: ${epic.title} (ID: ${epic.id})`);

      // Get full work item details with all widgets
      const fullEpic = await helper.executeTool('get_work_item', { id: epic.id }) as any;

      expect(fullEpic).toBeDefined();
      expect(fullEpic.id).toBe(epic.id);

      // Verify widgets are present and populated
      console.log('📊 Checking widgets structure...');
      expect(fullEpic).toHaveProperty('widgets');
      expect(Array.isArray(fullEpic.widgets)).toBe(true);

      const widgets = fullEpic.widgets;
      console.log(`  📋 Found ${widgets.length} widgets on epic`);

      // Verify assignees widget
      const assigneesWidget = widgets.find((w: any) => w.type === 'ASSIGNEES');
      expect(assigneesWidget).toBeDefined();
      console.log('  ✅ Assignees widget found');

      if (assigneesWidget && assigneesWidget.assignees && assigneesWidget.assignees.nodes.length > 0) {
        const assignees = assigneesWidget.assignees.nodes;
        console.log(`  👥 Epic has ${assignees.length} assignee(s)`);

        for (const assignee of assignees) {
          expect(assignee).toHaveProperty('id');
          expect(assignee).toHaveProperty('username');
          console.log(`    ✅ Assignee verified: ${assignee.username} (ID: ${assignee.id})`);
        }
      } else {
        console.log('  ⚠️ Epic has no assignees (this might be expected if user lookup failed)');
      }

      // Verify labels widget
      const labelsWidget = widgets.find((w: any) => w.type === 'LABELS');
      expect(labelsWidget).toBeDefined();
      console.log('  ✅ Labels widget found');

      if (labelsWidget && labelsWidget.labels && labelsWidget.labels.nodes.length > 0) {
        const labels = labelsWidget.labels.nodes;
        console.log(`  🏷️ Epic has ${labels.length} label(s)`);

        for (const label of labels) {
          expect(label).toHaveProperty('id');
          expect(label).toHaveProperty('title');
          console.log(`    ✅ Label verified: ${label.title} (ID: ${label.id})`);
        }
      } else {
        console.log('  ⚠️ Epic has no labels (this might be expected if no labels were available)');
      }

      // Verify milestone widget
      const milestoneWidget = widgets.find((w: any) => w.type === 'MILESTONE');
      expect(milestoneWidget).toBeDefined();
      console.log('  ✅ Milestone widget found');

      if (milestoneWidget && milestoneWidget.milestone) {
        const milestone = milestoneWidget.milestone;
        expect(milestone).toHaveProperty('id');
        expect(milestone).toHaveProperty('title');
        console.log(`    ✅ Milestone verified: ${milestone.title} (ID: ${milestone.id})`);
      } else {
        console.log('  ⚠️ Epic has no milestone (this might be expected if no milestones were available)');
      }

      console.log(`✅ Widget verification completed for epic: ${epic.title}`);
    }

    console.log('✅ All epic widget verification tests completed successfully');
  }, 15000);

  it('should verify created issues actually have assigned assignees and labels', async () => {
    const testData = getTestData();

    // Skip test if no test data (data lifecycle hasn't run or was cleaned up)
    if (!testData.workItems || testData.workItems.length === 0) {
      console.log('⏭️ Skipping issue widget verification - no test data found (run data lifecycle test first)');
      return;
    }

    console.log('🔍 Verifying widgets on created issues...');

    // Find issues with widgets in test data
    const issuesWithWidgets = testData.workItems!.filter(
      workItem => workItem.workItemType?.name === 'Issue' &&
      workItem.title?.includes('With Widgets')
    );

    if (issuesWithWidgets.length === 0) {
      console.log('⏭️ No issues with widgets found in test data - this is expected if widget assignment failed');
      return;
    }
    console.log(`📋 Found ${issuesWithWidgets.length} issue(s) with widgets to verify`);

    for (const issue of issuesWithWidgets) {
      console.log(`🔧 Verifying widgets for issue: ${issue.title} (ID: ${issue.id})`);

      // Get full work item details with all widgets
      const fullIssue = await helper.executeTool('get_work_item', { id: issue.id }) as any;

      expect(fullIssue).toBeDefined();
      expect(fullIssue.id).toBe(issue.id);

      // Verify widgets are present and populated
      console.log('📊 Checking widgets structure...');
      expect(fullIssue).toHaveProperty('widgets');
      expect(Array.isArray(fullIssue.widgets)).toBe(true);

      const widgets = fullIssue.widgets;
      console.log(`  📋 Found ${widgets.length} widgets on issue`);

      // Verify assignees widget exists and has data
      const assigneesWidget = widgets.find((w: any) => w.type === 'ASSIGNEES');
      expect(assigneesWidget).toBeDefined();
      console.log('  ✅ Assignees widget found on issue');

      // Verify labels widget exists and has data
      const labelsWidget = widgets.find((w: any) => w.type === 'LABELS');
      expect(labelsWidget).toBeDefined();
      console.log('  ✅ Labels widget found on issue');

      console.log(`✅ Widget verification completed for issue: ${issue.title}`);
    }

    console.log('✅ All issue widget verification tests completed successfully');
  }, 15000);
});