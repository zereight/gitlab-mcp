/**
 * Pipelines Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { ListPipelinesSchema, GetPipelineSchema } from '../../../src/entities/pipelines/schema-readonly';
import { IntegrationTestHelper } from '../helpers/registry-helper';

describe('Pipelines Schema - GitLab Integration', () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error('GITLAB_TOKEN environment variable is required');
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log('✅ Integration test helper initialized for pipelines testing');
  });

  describe('ListPipelinesSchema', () => {
    it('should validate and test with real project data using handler functions', async () => {
      console.log('🔍 Getting real project for pipelines testing');

      // Get actual project from data lifecycle
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for testing');
        return;
      }

      const testProject = projects[0];
      console.log(`📋 Using project: ${testProject.name} (ID: ${testProject.id})`);

      const validParams = {
        project_id: testProject.id.toString(),
        scope: 'finished' as const,
        status: 'success' as const,
        per_page: 10,
        order_by: 'id' as const,
        sort: 'desc' as const,
      };

      // Validate schema
      const result = ListPipelinesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const pipelines = await helper.executeTool('list_pipelines', result.data) as any[];
        expect(Array.isArray(pipelines)).toBe(true);
        console.log(`📋 Retrieved ${pipelines.length} pipelines via handler`);

        // Validate structure if we have pipelines
        if (pipelines.length > 0) {
          const pipeline = pipelines[0];
          expect(pipeline).toHaveProperty('id');
          expect(pipeline).toHaveProperty('status');
          expect(pipeline).toHaveProperty('ref');
          expect(pipeline).toHaveProperty('sha');
          expect(pipeline).toHaveProperty('source');
          console.log(`✅ Validated pipeline structure: ${pipeline.id} (${pipeline.status})`);
        }
      }

      console.log('✅ ListPipelinesSchema test completed with real data');
    });

    it('should validate scope and status filtering parameters', async () => {
      const testCases = [
        { scope: 'running' as const, status: 'running' as const },
        { scope: 'pending' as const, status: 'pending' as const },
        { scope: 'finished' as const, status: 'success' as const },
        { scope: 'branches' as const, status: 'failed' as const },
        { scope: 'tags' as const, status: 'canceled' as const },
      ];

      for (const testCase of testCases) {
        const result = ListPipelinesSchema.safeParse(testCase);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.scope).toBe(testCase.scope);
          expect(result.data.status).toBe(testCase.status);
        }
      }

      console.log('✅ ListPipelinesSchema validates scope and status combinations');
    });

    it('should validate source and pipeline parameters with real commit data', async () => {
      // Get actual project from data lifecycle
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for pipeline parameter testing');
        return;
      }

      const testProject = projects[0];

      // Get real commits from the repository to use actual SHAs
      const commits = await helper.executeTool('list_commits', {
        project_id: testProject.id.toString(),
        per_page: 1
      }) as any[];

      // Use real commit SHA and ref from data lifecycle
      const realSha = commits.length > 0 ? commits[0].id : undefined;
      const realRef = commits.length > 0 ? (commits[0].message.includes('Initial') ? 'main' : 'main') : 'main';

      const sourceParams = {
        source: 'push' as const,
        ref: realRef,
        sha: realSha,
        yaml_errors: true,
        per_page: 20,
      };

      const result = ListPipelinesSchema.safeParse(sourceParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.source).toBe('push');
        expect(result.data.ref).toBe(realRef);
        if (realSha) {
          expect(result.data.sha).toBe(realSha);
          console.log(`✅ Using real commit SHA from data lifecycle: ${realSha.substring(0, 8)}...`);
        }
        expect(result.data.yaml_errors).toBe(true);
        expect(result.data.per_page).toBe(20);
      }

      console.log('✅ ListPipelinesSchema validates parameters with real commit data from data lifecycle');
    });

    it('should validate date filtering parameters', async () => {
      const dateParams = {
        updated_after: '2023-01-01T00:00:00Z',
        updated_before: '2023-12-31T23:59:59Z',
        order_by: 'updated_at' as const,
        sort: 'asc' as const,
      };

      const result = ListPipelinesSchema.safeParse(dateParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.updated_after).toBe('2023-01-01T00:00:00Z');
        expect(result.data.updated_before).toBe('2023-12-31T23:59:59Z');
        expect(result.data.order_by).toBe('updated_at');
        expect(result.data.sort).toBe('asc');
      }

      console.log('✅ ListPipelinesSchema validates date filtering parameters');
    });

    it('should reject invalid parameters', async () => {
      const invalidParams = {
        scope: 'invalid_scope', // Invalid enum value
        status: 'invalid_status', // Invalid enum value
        source: 'invalid_source', // Invalid enum value
        order_by: 'invalid_field', // Invalid enum value
        sort: 'sideways', // Invalid enum value
        per_page: 150, // Exceeds max of 100
        page: 0, // Below minimum of 1
      };

      const result = ListPipelinesSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log('✅ ListPipelinesSchema correctly rejects invalid parameters');
    });
  });

  describe('GetPipelineSchema', () => {
    it('should validate get pipeline parameters with real data', async () => {
      // Get a project and its pipelines for testing
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for GetPipelineSchema testing');
        return;
      }

      const testProject = projects[0];
      const pipelines = await helper.executeTool('list_pipelines', {
        project_id: testProject.id.toString(),
        per_page: 1
      }) as any[];

      if (pipelines.length === 0) {
        console.log('⚠️  No pipelines found for GetPipelineSchema testing');
        return;
      }

      const testPipeline = pipelines[0];
      const validParams = {
        project_id: testProject.id.toString(),
        pipeline_id: testPipeline.id,
      };

      const result = GetPipelineSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.project_id).toBe(testProject.id.toString());
        expect(result.data.pipeline_id).toBe(testPipeline.id);
      }

      console.log('✅ GetPipelineSchema validates parameters correctly');
    });

    it('should test handler function for single pipeline', async () => {
      // Get a project and its pipelines for testing
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for handler testing');
        return;
      }

      const testProject = projects[0];
      const pipelines = await helper.executeTool('list_pipelines', {
        project_id: testProject.id.toString(),
        per_page: 1
      }) as any[];

      if (pipelines.length === 0) {
        console.log('⚠️  No pipelines found for handler testing');
        return;
      }

      const testPipeline = pipelines[0];
      const params = {
        project_id: testProject.id.toString(),
        pipeline_id: testPipeline.id,
      };

      // Validate parameters first
      const paramResult = GetPipelineSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const pipeline = await helper.executeTool('get_pipeline', paramResult.data) as any;

        // Validate pipeline structure
        expect(pipeline).toHaveProperty('id');
        expect(pipeline).toHaveProperty('status');
        expect(pipeline).toHaveProperty('ref');
        expect(pipeline).toHaveProperty('sha');
        expect(pipeline).toHaveProperty('source');
        expect(pipeline).toHaveProperty('created_at');
        expect(pipeline).toHaveProperty('updated_at');
        expect(pipeline).toHaveProperty('started_at');
        expect(pipeline).toHaveProperty('finished_at');
        expect(pipeline).toHaveProperty('duration');
        expect(pipeline).toHaveProperty('queued_duration');

        console.log(`✅ GetPipelineSchema handler test successful: ${pipeline.id} (${pipeline.status})`);
      }
    });

    it('should validate required pipeline parameters', async () => {
      // Test that valid parameters pass validation
      const validParams = {
        project_id: '123',
        pipeline_id: '456',
      };

      const result = GetPipelineSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.project_id).toBe('123');
        expect(result.data.pipeline_id).toBe('456');
      }

      console.log('✅ GetPipelineSchema validates required parameters correctly');
    });
  });
});