/**
 * Repository Schema Tests - Dependent on Data Lifecycle
 *
 * CRITICAL: This test file CANNOT run standalone!
 * Must run after data-lifecycle.test.ts with --runInBand
 *
 * Dependencies:
 * - Requires test group, project, repository, files, branches, tags from lifecycle
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
import { GetRepositoryTreeSchema } from '../../../src/entities/files/schema-readonly';

describe('🌳 Repository Schema - Using Lifecycle Data', () => {
  let testData: any;
  let testProject: any;

  beforeAll(async () => {
    // This will throw if lifecycle tests haven't run
    testData = requireTestData();
    testProject = getTestProject();

    console.log(`🔗 Using lifecycle data: Project ${testProject.id}, Files: ${testData.repository?.files?.length}, Tags: ${testData.repository?.tags?.length}`);
  });

  describe('GetRepositoryTreeSchema', () => {
    it('should validate basic repository tree parameters', async () => {
      const validParams = {
        project_id: testProject.id.toString(),
        ref: 'main',
        path: '',
        recursive: false,
        per_page: 20,
      };

      const result = GetRepositoryTreeSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.project_id).toBe(testProject.id.toString());
        expect(result.data.ref).toBe('main');
        expect(result.data.path).toBe('');
        expect(result.data.recursive).toBe(false);
        expect(result.data.per_page).toBe(20);
      }

      console.log('✅ GetRepositoryTreeSchema validates basic parameters correctly');
    });

    it('should make successful API request with lifecycle data', async () => {
      const params = {
        project_id: testProject.id.toString(),
        ref: 'main',
        path: '',
        per_page: 20,
      };

      const paramResult = GetRepositoryTreeSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (!paramResult.success) return;

      // Build query string from validated parameters
      const queryParams = new URLSearchParams();
      Object.entries(paramResult.data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'project_id') {
          queryParams.set(key, String(value));
        }
      });

      const response = await fetch(`${GITLAB_API_URL}/api/v4/projects/${testProject.id}/repository/tree?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${GITLAB_TOKEN}`,
        },
      });

      expect(response.ok).toBe(true);
      const treeItems = await response.json();
      expect(Array.isArray(treeItems)).toBe(true);

      // Should find the files created by lifecycle tests
      expect(treeItems.length).toBeGreaterThan(0);

      // Validate tree structure with expected files from lifecycle
      const itemNames = treeItems.map((item: any) => item.name);
      expect(itemNames).toContain('README.md');
      expect(itemNames).toContain('src');
      expect(itemNames).toContain('docs');
      expect(itemNames).toContain('.gitignore');

      // Validate tree item structure
      for (const item of treeItems.slice(0, 3)) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('path');
        expect(item).toHaveProperty('mode');
        expect(['tree', 'blob']).toContain(item.type);
      }

      console.log(`✅ GetRepositoryTreeSchema API request successful with ${treeItems.length} tree items from lifecycle data`);
    });

    it('should validate recursive tree parameters', async () => {
      const recursiveParams = {
        project_id: testProject.id.toString(),
        ref: 'main',
        recursive: true,
        per_page: 100,
      };

      const result = GetRepositoryTreeSchema.safeParse(recursiveParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.recursive).toBe(true);
        expect(result.data.per_page).toBe(100);
      }

      console.log('✅ GetRepositoryTreeSchema validates recursive parameters correctly');
    });

    it('should validate path-specific tree parameters', async () => {
      const pathParams = {
        project_id: testProject.id.toString(),
        ref: 'main',
        path: 'src',
        per_page: 10,
      };

      const result = GetRepositoryTreeSchema.safeParse(pathParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.path).toBe('src');
      }

      console.log('✅ GetRepositoryTreeSchema validates path-specific parameters correctly');
    });

    it('should reject invalid tree parameters', async () => {
      const invalidParams = {
        project_id: '', // Empty string
        ref: '', // Empty ref
        per_page: -1, // Negative per_page
        recursive: 'invalid' as any, // Invalid boolean
      };

      const result = GetRepositoryTreeSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log('✅ GetRepositoryTreeSchema correctly rejects invalid parameters');
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
        ref: 'main',
        path: '',
        per_page: 10,
      };

      const paramResult = GetRepositoryTreeSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      console.log('✅ DEFAULT_PROJECT test completed (project exists)');
    });
  });

  describe('File Content Operations', () => {
    it('should successfully test file operations with lifecycle data', async () => {
      // Test file content fetching using files created by lifecycle
      expect(testData.repository?.files?.length).toBeGreaterThan(0);

      const fileName = 'README.md';
      const response = await fetch(`${GITLAB_API_URL}/api/v4/projects/${testProject.id}/repository/files/${encodeURIComponent(fileName)}?ref=main`, {
        headers: {
          'Authorization': `Bearer ${GITLAB_TOKEN}`,
        },
      });

      expect(response.ok).toBe(true);
      const fileData = await response.json();

      expect(fileData).toHaveProperty('file_name', fileName);
      expect(fileData).toHaveProperty('file_path', fileName);
      expect(fileData).toHaveProperty('content');
      expect(fileData).toHaveProperty('encoding');

      console.log(`✅ File content operations successful with lifecycle file: ${fileName}`);
    });
  });

  describe('Repository References', () => {
    it('should successfully test branches with lifecycle data', async () => {
      // Test branch listing using branches created by lifecycle
      expect(testData.repository?.branches?.length).toBeGreaterThan(0);

      const response = await fetch(`${GITLAB_API_URL}/api/v4/projects/${testProject.id}/repository/branches`, {
        headers: {
          'Authorization': `Bearer ${GITLAB_TOKEN}`,
        },
      });

      expect(response.ok).toBe(true);
      const branches = await response.json();
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeGreaterThan(0);

      // Should include main branch plus feature branches from lifecycle
      const branchNames = branches.map((b: any) => b.name);
      expect(branchNames).toContain('main');

      console.log(`✅ Repository branches successful with ${branches.length} branches from lifecycle data`);
    });

    it('should successfully test tags with lifecycle data', async () => {
      // Test tag listing using tags created by lifecycle
      expect(testData.repository?.tags?.length).toBeGreaterThan(0);

      const response = await fetch(`${GITLAB_API_URL}/api/v4/projects/${testProject.id}/repository/tags`, {
        headers: {
          'Authorization': `Bearer ${GITLAB_TOKEN}`,
        },
      });

      expect(response.ok).toBe(true);
      const tags = await response.json();
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);

      // Validate tag structure
      for (const tag of tags.slice(0, 2)) {
        expect(tag).toHaveProperty('name');
        expect(tag).toHaveProperty('message');
        expect(tag).toHaveProperty('commit');
      }

      console.log(`✅ Repository tags successful with ${tags.length} tags from lifecycle data`);
    });
  });
});