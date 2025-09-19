/**
 * Merge Requests Schema Tests - Dependent on Data Lifecycle
 *
 * CRITICAL: This test file CANNOT run standalone!
 * Must run after data-lifecycle.test.ts with --runInBand
 *
 * Dependencies:
 * - Requires test group, project, and merge requests from lifecycle
 * - Uses real data created by lifecycle chain
 * - No individual data creation or cleanup
 */

import {
  GITLAB_TOKEN,
  GITLAB_API_URL,
  GITLAB_PROJECT_ID,
  requireTestData,
  getTestProject,
} from '../../setup/testConfig';
import { ListMergeRequestsSchema } from '../../../src/entities/mrs/schema-readonly';

describe('🔀 Merge Requests Schema - Using Lifecycle Data', () => {
  let testData: any;
  let testProject: any;

  beforeAll(async () => {
    // This will throw if lifecycle tests haven't run
    testData = requireTestData();
    testProject = getTestProject();

    console.log(`🔗 Using lifecycle data: Project ${testProject.id}, MRs: ${testData.mergeRequests?.length}`);
  });

  describe('ListMergeRequestsSchema', () => {
    it('should validate basic list merge requests parameters', async () => {
      const validParams = {
        project_id: testProject.id.toString(),
        state: 'all' as const,
        per_page: 10,
        order_by: 'updated_at' as const,
        sort: 'desc' as const,
      };

      const result = ListMergeRequestsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.project_id).toBe(testProject.id.toString());
        expect(result.data.state).toBe('all');
        expect(result.data.per_page).toBe(10);
        expect(result.data.order_by).toBe('updated_at');
        expect(result.data.sort).toBe('desc');
      }

      console.log('✅ ListMergeRequestsSchema validates basic parameters correctly');
    });

    it('should make successful API request with lifecycle data', async () => {
      const params = {
        project_id: testProject.id.toString(),
        state: 'all' as const,
        per_page: 10,
      };

      const paramResult = ListMergeRequestsSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (!paramResult.success) return;

      // Build query string from validated parameters
      const queryParams = new URLSearchParams();
      Object.entries(paramResult.data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'project_id') {
          queryParams.set(key, String(value));
        }
      });

      const response = await fetch(`${GITLAB_API_URL}/api/v4/projects/${testProject.id}/merge_requests?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${GITLAB_TOKEN}`,
        },
      });

      expect(response.ok).toBe(true);
      const mergeRequests = await response.json();
      expect(Array.isArray(mergeRequests)).toBe(true);

      // Should find the MRs created by lifecycle tests
      expect(mergeRequests.length).toBeGreaterThan(0);

      // Validate merge request structure
      for (const mr of mergeRequests.slice(0, 2)) {
        expect(mr).toHaveProperty('id');
        expect(mr).toHaveProperty('iid');
        expect(mr).toHaveProperty('project_id', testProject.id);
        expect(mr).toHaveProperty('title');
        expect(mr).toHaveProperty('state');
        expect(mr).toHaveProperty('source_branch');
        expect(mr).toHaveProperty('target_branch');
        expect(mr).toHaveProperty('author');
        expect(mr.author).toHaveProperty('username');
      }

      console.log(`✅ ListMergeRequestsSchema API request successful with ${mergeRequests.length} MRs from lifecycle data`);
    });

    it('should validate advanced filtering parameters', async () => {
      const advancedParams = {
        project_id: testProject.id.toString(),
        state: 'opened' as const,
        labels: ['feature', 'bug'],
        with_labels_details: true,
        with_merge_status_recheck: true,
        created_after: '2023-01-01T00:00:00.000Z',
        created_before: '2025-12-31T23:59:59.999Z',
        updated_after: '2023-01-01T00:00:00.000Z',
        updated_before: '2025-12-31T23:59:59.999Z',
        order_by: 'created_at' as const,
        sort: 'asc' as const,
        milestone: 'v1.0',
        view: 'simple' as const,
        my_reaction_emoji: 'thumbsup',
        source_branch: 'feature/test',
        target_branch: 'main',
        search: 'feature',
        in: 'title' as const,
        wip: 'no' as const,
        not: {
          labels: ['deprecated'],
          milestone: 'archived',
          author_id: 999,
          author_username: 'test-user',
          assignee_id: 888,
          assignee_username: 'another-user',
          reviewer_id: 777,
          reviewer_username: 'reviewer-user',
        },
        environment: 'production',
        deployed_before: '2025-01-01T00:00:00.000Z',
        deployed_after: '2024-01-01T00:00:00.000Z',
        per_page: 50,
        page: 1,
      };

      const result = ListMergeRequestsSchema.safeParse(advancedParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.state).toBe('opened');
        expect(result.data.labels).toEqual(['feature', 'bug']);
        expect(result.data.with_labels_details).toBe(true);
        expect(result.data.not?.labels).toEqual(['deprecated']);
        expect(result.data.per_page).toBe(50);
      }

      console.log('✅ ListMergeRequestsSchema validates advanced filtering parameters');
    });

    it('should reject invalid parameters', async () => {
      const invalidParams = {
        project_id: '', // Empty string
        state: 'invalid_state' as any,
        per_page: -1, // Negative number
        order_by: 'invalid_field' as any,
        sort: 'invalid_direction' as any,
      };

      const result = ListMergeRequestsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log('✅ ListMergeRequestsSchema correctly rejects invalid parameters');
    });

    it('should test DEFAULT_PROJECT soft fail scenario', async () => {
      // This is the soft fail test for DEFAULT_PROJECT
      if (!GITLAB_PROJECT_ID) {
        console.log(`⚠️  Skipping DEFAULT_PROJECT test - GITLAB_PROJECT_ID not configured`);
        return;
      }

      const projectCheckResponse = await fetch(`${GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(GITLAB_PROJECT_ID)}`, {
        headers: {
          'Authorization': `Bearer ${GITLAB_TOKEN}`,
        },
      });

      if (!projectCheckResponse.ok) {
        console.log(`⚠️  Skipping DEFAULT_PROJECT test - project '${GITLAB_PROJECT_ID}' doesn't exist`);
        return;
      }

      // If we get here, the default project exists, so test with it
      const params = {
        project_id: GITLAB_PROJECT_ID,
        state: 'all' as const,
        per_page: 5,
      };

      const paramResult = ListMergeRequestsSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      console.log('✅ DEFAULT_PROJECT test completed (project exists)');
    });
  });
});