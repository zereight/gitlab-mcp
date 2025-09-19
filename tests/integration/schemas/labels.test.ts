/**
 * Labels Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { ListLabelsSchema, GetLabelSchema } from '../../../src/entities/labels/schema-readonly';
import { IntegrationTestHelper } from '../helpers/registry-helper';

describe('Labels Schema - GitLab Integration', () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error('GITLAB_TOKEN environment variable is required');
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log('✅ Integration test helper initialized for labels testing');
  });

  describe('ListLabelsSchema', () => {
    it('should validate and test with real project data using handler functions', async () => {
      console.log('🔍 Getting real project for labels testing');

      // Get actual project from data lifecycle
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for testing');
        return;
      }

      const testProject = projects[0];
      console.log(`📋 Using project: ${testProject.name} (ID: ${testProject.id})`);

      const validParams = {
        namespacePath: testProject.path_with_namespace,
        with_counts: true,
        include_ancestor_groups: true,
        per_page: 10,
      };

      // Validate schema
      const result = ListLabelsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const labels = await helper.executeTool('list_labels', result.data) as any[];
        expect(Array.isArray(labels)).toBe(true);
        console.log(`📋 Retrieved ${labels.length} labels via handler`);

        // Validate structure if we have labels
        if (labels.length > 0) {
          const label = labels[0];
          expect(label).toHaveProperty('id');
          expect(label).toHaveProperty('name');
          expect(label).toHaveProperty('color');
          expect(label).toHaveProperty('description');
          console.log(`✅ Validated label structure: ${label.name}`);
        }
      }

      console.log('✅ ListLabelsSchema test completed with real data');
    });

    it('should validate group-level labels', async () => {
      // Get a group for testing
      const namespaces = await helper.executeTool('list_namespaces', { per_page: 1 }) as any[];
      if (namespaces.length === 0) {
        console.log('⚠️  No namespaces available for group labels testing');
        return;
      }

      const testGroup = namespaces.find(ns => ns.kind === 'group');
      if (!testGroup) {
        console.log('⚠️  No groups found for group labels testing');
        return;
      }

      const validParams = {
        group_id: testGroup.id.toString(),
        with_counts: true,
        per_page: 5,
      };

      const result = ListLabelsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const labels = await helper.executeTool('list_labels', result.data) as any[];
        expect(Array.isArray(labels)).toBe(true);
        console.log(`📋 Retrieved ${labels.length} group labels via handler`);
      }

      console.log('✅ ListLabelsSchema group-level test completed');
    });

    it('should validate search and filtering parameters', async () => {
      // Get actual project for validation
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for search parameter testing');
        return;
      }

      const testProject = projects[0];
      const searchParams = {
        namespacePath: testProject.path_with_namespace, // Use correct namespacePath from schema
        search: 'bug',
        with_counts: true,
      };

      const result = ListLabelsSchema.safeParse(searchParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.search).toBe('bug');
        expect(result.data.with_counts).toBe(true);
        expect(result.data.namespacePath).toBe(testProject.path_with_namespace);
      }

      console.log('✅ ListLabelsSchema validates search parameters');
    });

    it('should reject invalid parameters', async () => {
      const invalidParams = {
        per_page: 150, // Exceeds max of 100
        page: 0, // Below minimum of 1
        with_counts: 'invalid', // Should be boolean
      };

      const result = ListLabelsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log('✅ ListLabelsSchema correctly rejects invalid parameters');
    });
  });

  describe('GetLabelSchema', () => {
    it('should validate get label parameters with real data', async () => {
      // Get a project and its labels for testing
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for GetLabelSchema testing');
        return;
      }

      const testProject = projects[0];
      const labels = await helper.executeTool('list_labels', {
        namespacePath: testProject.path_with_namespace,
        per_page: 1
      }) as any[];

      if (labels.length === 0) {
        console.log('⚠️  No labels found for GetLabelSchema testing');
        return;
      }

      const testLabel = labels[0];
      const validParams = {
        namespacePath: testProject.path_with_namespace,
        label_id: testLabel.id.toString(),
      };

      const result = GetLabelSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.namespacePath).toBe(testProject.path_with_namespace);
        expect(result.data.label_id).toBe(testLabel.id.toString());
      }

      console.log('✅ GetLabelSchema validates parameters correctly');
    });

    it('should test handler function for single label', async () => {
      // Get a project and its labels for testing
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for handler testing');
        return;
      }

      const testProject = projects[0];
      const labels = await helper.executeTool('list_labels', {
        namespacePath: testProject.path_with_namespace,
        per_page: 1
      }) as any[];

      if (labels.length === 0) {
        console.log('⚠️  No labels found for handler testing');
        return;
      }

      const testLabel = labels[0];
      const params = {
        namespacePath: testProject.path_with_namespace,
        label_id: testLabel.id.toString(),
      };

      // Validate parameters first
      const paramResult = GetLabelSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const label = await helper.executeTool('get_label', paramResult.data) as any;

        // Validate label structure
        expect(label).toHaveProperty('id');
        expect(label).toHaveProperty('name');
        expect(label).toHaveProperty('color');
        expect(label).toHaveProperty('description');

        console.log(`✅ GetLabelSchema handler test successful: ${label.name}`);
      }
    });

    it('should reject invalid label parameters', async () => {
      const invalidParams = {
        project_id: '', // Empty project ID
        label_id: -1, // Invalid label ID
      };

      const result = GetLabelSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log('✅ GetLabelSchema correctly rejects invalid parameters');
    });
  });

  // Note: Create, Update, Delete schemas are not in schema-readonly
  // These operations use handler functions directly
});