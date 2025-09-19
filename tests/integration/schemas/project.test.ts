/**
 * Project Schema Integration Tests
 * Tests GitLabProjectSchema against real GitLab 18.3 API responses
 */

import { GitLabProjectSchema } from '../../../src/entities/shared';
import { CreateRepositorySchema } from '../../../src/entities/core/schema';
import { IntegrationTestHelper } from '../helpers/registry-helper';

describe('Project Schema - GitLab 18.3 Integration', () => {
  let helper: IntegrationTestHelper;
  const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
  const GITLAB_API_URL = process.env.GITLAB_API_URL;
  const TEST_GROUP = process.env.TEST_GROUP;

  let testTimestamp: string;
  let testGroupId: string | null = null;
  let createdTestGroup = false; // Track if we created the group
  let createdProjects: string[] = [];

  beforeAll(async () => {
    if (process.env.INTEGRATION_TESTS_ENABLED !== 'true') {
      console.log('⚠️  Skipping integration tests - .env.test not found or integration tests disabled');
      return;
    }

    if (!GITLAB_TOKEN) {
      throw new Error('GITLAB_TOKEN environment variable is required');
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log('✅ Integration test helper initialized for project schema testing');
    if (!GITLAB_API_URL) {
      throw new Error('GITLAB_API_URL environment variable is required for integration tests');
    }
    if (!TEST_GROUP) {
      throw new Error('TEST_GROUP environment variable is required for integration tests');
    }

    testTimestamp = Date.now().toString();

    // Verify if TEST_GROUP exists, create if necessary following ZERO DATA VALIDATION RULE
    console.log(`🔍 Checking if test group '${TEST_GROUP}' exists...`);

    try {
      const checkGroupResponse = await fetch(`${GITLAB_API_URL}/api/v4/groups/${encodeURIComponent(TEST_GROUP)}`, {
        headers: {
          'Authorization': `Bearer ${GITLAB_TOKEN}`,
        },
      });

      if (checkGroupResponse.ok) {
        const existingGroup = await checkGroupResponse.json();
        testGroupId = existingGroup.id;
        console.log(`✅ Found existing test group: ${existingGroup.name} (ID: ${existingGroup.id})`);
      } else if (checkGroupResponse.status === 404) {
        console.log(`🔧 Creating test group '${TEST_GROUP}' for project schema validation...`);

        const groupData = {
          name: TEST_GROUP,
          path: TEST_GROUP,
          description: `Test group for project schema validation - ${testTimestamp}`,
          visibility: 'private',
        };

        const createGroupResponse = await fetch(`${GITLAB_API_URL}/api/v4/groups`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(groupData),
        });

        if (createGroupResponse.ok) {
          const group = await createGroupResponse.json();
          testGroupId = group.id;
          createdTestGroup = true;
          console.log(`✅ Created test group: ${group.name} (ID: ${group.id})`);
        } else {
          const errorBody = await createGroupResponse.text();
          console.log(`⚠️  Could not create group: ${createGroupResponse.status} - ${errorBody}`);
        }
      } else {
        const errorBody = await checkGroupResponse.text();
        console.log(`⚠️  Error checking group: ${checkGroupResponse.status} - ${errorBody}`);
      }
    } catch (error) {
      console.log(`⚠️  Error with group operations:`, error);
    }

    // Create test projects in the test group
    if (testGroupId) {
      console.log('🔧 Creating test projects in the test group...');

      const projectsToCreate = [
        {
          name: `test-project-1-${testTimestamp}`,
          path: `test-project-1-${testTimestamp}`,
          description: `Test project 1 for schema validation - ${testTimestamp}`,
          visibility: 'private',
          namespace_id: testGroupId,
        },
        {
          name: `test-project-2-${testTimestamp}`,
          path: `test-project-2-${testTimestamp}`,
          description: `Test project 2 for schema validation - ${testTimestamp}`,
          visibility: 'private',
          namespace_id: testGroupId,
        }
      ];

      for (const projectData of projectsToCreate) {
        try {
          const response = await fetch(`${GITLAB_API_URL}/api/v4/projects`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GITLAB_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(projectData),
          });

          if (response.ok) {
            const project = await response.json();
            createdProjects.push(project.id);
            console.log(`✅ Created test project: ${project.name} (ID: ${project.id})`);
          } else {
            const errorBody = await response.text();
            console.log(`⚠️  Could not create project ${projectData.name}: ${response.status} - ${errorBody}`);
          }
        } catch (error) {
          console.log(`⚠️  Error creating project ${projectData.name}:`, error);
        }
      }
    }

    console.log(`✅ Project test setup complete - created ${createdProjects.length} test projects in group ${testGroupId}`);
  });

  afterAll(async () => {
    // Clean up created projects first
    if (createdProjects.length > 0) {
      console.log('🧹 Cleaning up test projects...');

      for (const projectId of createdProjects) {
        try {
          const response = await fetch(`${GITLAB_API_URL}/api/v4/projects/${projectId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${GITLAB_TOKEN}`,
            },
          });

          if (response.ok || response.status === 404) {
            console.log(`✅ Cleaned up test project: ${projectId}`);
          } else {
            console.log(`⚠️  Could not delete project ${projectId}: ${response.status}`);
          }
        } catch (error) {
          console.log(`⚠️  Error deleting project ${projectId}:`, error);
        }
      }
    }

    // Clean up test group only if we created it during this test run
    if (createdTestGroup && testGroupId) {
      console.log(`🧹 Cleaning up test group '${TEST_GROUP}' (ID: ${testGroupId}) that was created during test...`);

      try {
        const response = await fetch(`${GITLAB_API_URL}/api/v4/groups/${testGroupId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${GITLAB_TOKEN}`,
          },
        });

        if (response.ok || response.status === 404) {
          console.log(`✅ Cleaned up test group '${TEST_GROUP}': ${testGroupId}`);
        } else {
          console.log(`⚠️  Could not delete group '${TEST_GROUP}' ${testGroupId}: ${response.status}`);
        }
      } catch (error) {
        console.log(`⚠️  Error deleting group '${TEST_GROUP}' ${testGroupId}:`, error);
      }
    } else if (testGroupId && !createdTestGroup) {
      console.log(`ℹ️  Test group '${TEST_GROUP}' (ID: ${testGroupId}) existed before test - not deleting`);
    }
  });

  it('should validate CreateRepositorySchema against test project creation parameters', async () => {
    if (process.env.INTEGRATION_TESTS_ENABLED !== 'true') {
      console.log('⚠️  Skipping test - integration tests disabled');
      return;
    }

    const testProjectData = {
      name: `schema-test-project-${testTimestamp}`,
      path: `schema-test-project-${testTimestamp}`,
      description: `Schema test project for validation - ${testTimestamp}`,
      visibility: 'private' as const,
      namespacePath: TEST_GROUP,
      issues_enabled: true,
      merge_requests_enabled: true,
      wiki_enabled: false,
      jobs_enabled: true,
      snippets_enabled: false,
    };

    // Validate the schema against project creation parameters
    const result = CreateRepositorySchema.safeParse(testProjectData);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.name).toBe(testProjectData.name);
      expect(result.data.visibility).toBe('private');
      expect(result.data.namespacePath).toBe(testProjectData.namespacePath);
    }

    console.log('✅ CreateRepositorySchema validates project creation parameters correctly');
  });

  it('should validate real GitLab project API response using created test projects', async () => {
    if (process.env.INTEGRATION_TESTS_ENABLED !== 'true') {
      console.log('⚠️  Skipping test - integration tests disabled');
      return;
    }

    if (createdProjects.length === 0) {
      console.log('⚠️  Skipping test - no test projects were created');
      return;
    }

    const testProjectId = createdProjects[0];
    console.log('🔍 GetProjectSchema - Testing against real GitLab API');
    console.log(`📋 Project ID: ${testProjectId}`);

    // Fetch real project data from GitLab 18.3 instance (with correct API prefix)
    const apiUrl = `${GITLAB_API_URL}/api/v4/projects/${testProjectId}`;
    console.log(`🔍 API URL: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITLAB_TOKEN}`,
      },
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ API Error Response:', errorBody);
      throw new Error(`GitLab API request failed: ${response.status} ${response.statusText}`);
    }

    const projectData = await response.json();
    console.log(`📋 Retrieved project: ${projectData.name} (ID: ${projectData.id})`);

    // Validate the schema against real API response
    const result = GitLabProjectSchema.safeParse(projectData);

    if (!result.success) {
      console.error('Schema validation failed:', result.error);
      console.error('Project data keys:', Object.keys(projectData));
      throw new Error(`Schema validation failed: ${JSON.stringify(result.error.issues, null, 2)}`);
    }

    // Verify key project fields are present and structured correctly
    expect(result.data.id).toBeDefined();
    expect(result.data.name).toBeDefined();
    expect(result.data.path).toBeDefined();
    expect(result.data.path_with_namespace).toBeDefined();
    expect(result.data.visibility).toMatch(/^(private|internal|public)$/);
    expect(result.data.namespace).toBeDefined();
    expect(result.data.namespace.full_path).toBeDefined();

    console.log('✅ GitLabProjectSchema successfully validated against GitLab 18.3 API response');
  }, 30000);

  it('should handle missing optional fields gracefully', async () => {
    // Get real project structure from API and test with minimal required fields
    // Use handler function instead of direct API call
    const projects = await helper.executeTool('list_projects', { per_page: 1 }) as any[];
    if (projects.length === 0) {
      console.log('⚠️  No projects available for minimal fields testing');
      return;
    }

    const realProject = projects[0];
    // Create minimal version based on real project structure
    const minimalProject = {
      id: realProject.id.toString(), // Use real project ID from data lifecycle
      description: null,
      name: 'test project',
      name_with_namespace: 'group / test project',
      path: 'test-project',
      path_with_namespace: 'group/test-project',
      created_at: '2023-01-01T00:00:00.000Z',
      default_branch: 'main',
      tag_list: [],
      topics: [],
      ssh_url_to_repo: 'git@example.com:group/test-project.git',
      http_url_to_repo: 'https://example.com/group/test-project.git',
      web_url: 'https://example.com/group/test-project',
      forks_count: 0,
      avatar_url: null,
      star_count: 0,
      last_activity_at: '2023-01-01T00:00:00.000Z',
      visibility: 'public' as const,
      namespace: {
        id: '456',
        name: 'group',
        path: 'group',
        kind: 'group',
        full_path: 'group',
        parent_id: null,
        web_url: 'https://example.com/groups/group',
      },
      _links: {
        self: `https://gitlab.example.com/api/v4/projects/${realProject.id}`,
        issues: `https://gitlab.example.com/api/v4/projects/${realProject.id}/issues`,
        merge_requests: `https://gitlab.example.com/api/v4/projects/${realProject.id}/merge_requests`,
        repo_branches: `https://gitlab.example.com/api/v4/projects/${realProject.id}/repository/branches`,
        labels: `https://gitlab.example.com/api/v4/projects/${realProject.id}/labels`,
        events: `https://gitlab.example.com/api/v4/projects/${realProject.id}/events`,
        members: `https://gitlab.example.com/api/v4/projects/${realProject.id}/members`,
      },
      marked_for_deletion_at: null,
      empty_repo: false,
      archived: false,
      issues_enabled: true,
      merge_requests_enabled: true,
      wiki_enabled: true,
      jobs_enabled: true,
      snippets_enabled: true,
      issues_access_level: 'enabled',
      repository_access_level: 'enabled',
      merge_requests_access_level: 'enabled',
      wiki_access_level: 'enabled',
      builds_access_level: 'enabled',
      snippets_access_level: 'enabled',
      updated_at: '2023-01-01T00:00:00.000Z',
    };

    const result = GitLabProjectSchema.safeParse(minimalProject);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.name).toBe('test project');
      expect(result.data.visibility).toBe('public');
    }

    console.log('✅ GitLabProjectSchema handles minimal project data correctly');
  });
});