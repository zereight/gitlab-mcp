/**
 * Wiki Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { ListWikiPagesSchema, GetWikiPageSchema } from '../../../src/entities/wiki/schema-readonly';
import { IntegrationTestHelper } from '../helpers/registry-helper';

describe('Wiki Schema - GitLab Integration', () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error('GITLAB_TOKEN environment variable is required');
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log('✅ Integration test helper initialized for wiki testing');
  });

  describe('ListWikiPagesSchema', () => {
    it('should validate and test with real project data using handler functions', async () => {
      console.log('🔍 Getting real project for wiki testing');

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
        with_content: true,
        per_page: 10,
      };

      // Validate schema
      const result = ListWikiPagesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const wikiPages = await helper.executeTool('list_wiki_pages', result.data) as any[];
        expect(Array.isArray(wikiPages)).toBe(true);
        console.log(`📋 Retrieved ${wikiPages.length} wiki pages via handler`);

        // Validate structure if we have wiki pages
        if (wikiPages.length > 0) {
          const page = wikiPages[0];
          expect(page).toHaveProperty('title');
          expect(page).toHaveProperty('slug');
          expect(page).toHaveProperty('encoding');
          expect(page).toHaveProperty('format');
          console.log(`✅ Validated wiki page structure: ${page.title}`);
        }
      }

      console.log('✅ ListWikiPagesSchema test completed with real data');
    });

    it('should validate pagination parameters', async () => {
      // Get actual project for validation
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for pagination testing');
        return;
      }

      const testProject = projects[0];
      const paginationParams = {
        namespacePath: testProject.path_with_namespace, // Use namespacePath as expected by schema
        per_page: 5,
        page: 2,
        with_content: false,
      };

      const result = ListWikiPagesSchema.safeParse(paginationParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.per_page).toBe(5);
        expect(result.data.page).toBe(2);
        expect(result.data.with_content).toBe(false);
        expect(result.data.namespacePath).toBe(testProject.path_with_namespace);
      }

      console.log('✅ ListWikiPagesSchema validates pagination parameters');
    });

    it('should reject invalid parameters', async () => {
      const invalidParams = {
        per_page: 150, // Exceeds max of 100
        page: 0, // Below minimum of 1
        with_content: 'invalid', // Should be boolean
      };

      const result = ListWikiPagesSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log('✅ ListWikiPagesSchema correctly rejects invalid parameters');
    });
  });

  describe('GetWikiPageSchema', () => {
    it('should validate get wiki page parameters with real data', async () => {
      // Get a project and its wiki pages for testing
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for GetWikiPageSchema testing');
        return;
      }

      const testProject = projects[0];
      const wikiPages = await helper.executeTool('list_wiki_pages', {
        namespacePath: testProject.path_with_namespace,
        per_page: 1
      }) as any[];

      if (wikiPages.length === 0) {
        console.log('⚠️  No wiki pages found for GetWikiPageSchema testing');
        return;
      }

      const testPage = wikiPages[0];
      const validParams = {
        namespacePath: testProject.path_with_namespace,
        slug: testPage.slug,
      };

      const result = GetWikiPageSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.namespacePath).toBe(testProject.path_with_namespace);
        expect(result.data.slug).toBe(testPage.slug);
      }

      console.log('✅ GetWikiPageSchema validates parameters correctly');
    });

    it('should test handler function for single wiki page', async () => {
      // Get a project and its wiki pages for testing
      const projects = await helper.listProjects({ per_page: 1 }) as any[];
      if (projects.length === 0) {
        console.log('⚠️  No projects available for handler testing');
        return;
      }

      const testProject = projects[0];
      const wikiPages = await helper.executeTool('list_wiki_pages', {
        namespacePath: testProject.path_with_namespace,
        per_page: 1
      }) as any[];

      if (wikiPages.length === 0) {
        console.log('⚠️  No wiki pages found for handler testing');
        return;
      }

      const testPage = wikiPages[0];
      const params = {
        namespacePath: testProject.path_with_namespace,
        slug: testPage.slug,
        render_html: true,
      };

      // Validate parameters first
      const paramResult = GetWikiPageSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const page = await helper.executeTool('get_wiki_page', paramResult.data) as any;

        // Validate wiki page structure
        expect(page).toHaveProperty('title');
        expect(page).toHaveProperty('slug');
        expect(page).toHaveProperty('content');
        expect(page).toHaveProperty('encoding');
        expect(page).toHaveProperty('format');

        console.log(`✅ GetWikiPageSchema handler test successful: ${page.title}`);
      }
    });

    it('should reject invalid wiki page parameters', async () => {
      const invalidParams = {
        // Missing required namespacePath and slug
      };

      const result = GetWikiPageSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log('✅ GetWikiPageSchema correctly rejects invalid parameters');
    });
  });

  // Note: CreateWikiPageSchema is not in schema-readonly
  // Wiki creation uses handler functions directly
});