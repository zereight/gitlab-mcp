/**
 * Test suite for getEffectiveProjectId function
 * Tests the behavior of project ID resolution with different environment configurations
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST
} from './utils/server-launcher.js';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import { CustomHeaderClient } from './clients/custom-header-client.js';

// Use the same token that will be passed via GITLAB_TOKEN_TEST environment variable
const MOCK_TOKEN = process.env.GITLAB_TOKEN_TEST || 'glpat-mock-token-12345';
const DEFAULT_PROJECT_ID = '123';
const OTHER_PROJECT_ID = '456';
// Ensure GITLAB_TOKEN_TEST is set for launchServer() validation
if (!process.env.GITLAB_TOKEN_TEST && !process.env.GITLAB_TOKEN) {
  process.env.GITLAB_TOKEN_TEST = MOCK_TOKEN;
}
if (!process.env.TEST_PROJECT_ID) {
  process.env.TEST_PROJECT_ID = DEFAULT_PROJECT_ID;
}

console.log('🔍 Testing getEffectiveProjectId functionality');
console.log('');

describe('getEffectiveProjectId', { concurrency: 1 }, () => {

describe('getEffectiveProjectId - No GITLAB_ALLOWED_PROJECT_IDS', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: CustomHeaderClient;
  let group123Requested = false;
  let group789Requested = false;
  let labelLookupRoots: string[] = [];

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });

    mockGitLab.addMockHandler('get', '/groups/123', (_req, res) => {
      group123Requested = true;
      res.json({
        id: 123,
        name: 'Test Group',
        path: 'test-group',
        full_path: 'test-group',
      });
    });

    mockGitLab.addMockHandler('get', '/projects/789', (_req, res) => {
      res.status(404).json({ message: '404 Project Not Found' });
    });

    mockGitLab.addMockHandler('get', '/groups/789', (_req, res) => {
      group789Requested = true;
      res.json({
        id: 789,
        name: 'Numeric Group',
        path: 'numeric-group',
        full_path: 'numeric-group',
      });
    });

    mockGitLab.addRootHandler('post', '/api/graphql', (req, res) => {
      const { query, variables } = req.body as {
        query: string;
        variables: Record<string, any>;
      };

      if (query.includes('workItemTypes')) {
        res.json({
          data: {
            namespace: {
              workItemTypes: {
                nodes: [{ id: 'gid://gitlab/WorkItems::Type/1', name: 'Issue' }],
              },
            },
          },
        });
        return;
      }

      if (query.includes('workItems(')) {
        assert.ok(query.includes('group(fullPath: $path)'), 'Should query the group GraphQL root');
        assert.strictEqual(variables.path, 'test-group', 'Should use resolved group full_path');
        res.json({
          data: {
            group: {
              workItems: {
                nodes: [
                  {
                    id: 'gid://gitlab/WorkItem/1',
                    iid: '1',
                    title: 'Group work item',
                    state: 'OPEN',
                    webUrl: 'https://gitlab.mock/groups/test-group/-/work_items/1',
                    workItemType: { name: 'Issue' },
                    widgets: [],
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
        return;
      }

      if (query.includes('labels(title:')) {
        assert.ok(query.includes('group(fullPath: $path)'), 'Should resolve labels from Group');
        assert.ok(!query.includes('namespace(fullPath: $path)'), 'Should not query labels from Namespace');
        labelLookupRoots.push('group');
        res.json({
          data: {
            group: { l0: { nodes: [{ id: 'gid://gitlab/GroupLabel/1' }] } },
            users: { nodes: [] },
          },
        });
        return;
      }

      if (query.includes('workItem(iid: $iid)')) {
        res.json({
          data: { namespace: { workItem: { id: 'gid://gitlab/WorkItem/1' } } },
        });
        return;
      }

      if (query.includes('workItemCreate')) {
        assert.deepStrictEqual(variables.labelIds, ['gid://gitlab/GroupLabel/1']);
        res.json({
          data: {
            workItemCreate: {
              workItem: {
                id: 'gid://gitlab/WorkItem/2',
                iid: '2',
                title: variables.title,
                webUrl: 'https://gitlab.mock/groups/test-group/-/work_items/2',
                workItemType: { name: 'Issue' },
              },
              errors: [],
            },
          },
        });
        return;
      }

      if (query.includes('workItemUpdate')) {
        assert.deepStrictEqual(variables.addLabelIds, ['gid://gitlab/GroupLabel/1']);
        res.json({
          data: {
            workItemUpdate: {
              workItem: {
                id: variables.id,
                iid: '1',
                title: 'Updated group work item',
                state: 'OPEN',
                webUrl: 'https://gitlab.mock/groups/test-group/-/work_items/1',
                workItemType: { name: 'Issue' },
                widgets: [],
              },
              errors: [],
            },
          },
        });
        return;
      }

      res.status(500).json({ message: `Unexpected GraphQL query: ${query}` });
    });

    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server WITHOUT GITLAB_ALLOWED_PROJECT_IDS
    const mcpPort = await findAvailablePort(3100);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PROJECT_ID: DEFAULT_PROJECT_ID,
        GITLAB_READ_ONLY_MODE: 'false',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);

    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`Default Project: ${DEFAULT_PROJECT_ID}`);
  });

  after(async () => {
    if (client) {
      await client.disconnect();
    }
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should use GITLAB_PROJECT_ID when no project_id is provided', async () => {
    // Call get_project without specifying project_id
    const result = await client.callTool('get_project', {
      project_id: ''
    });

    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);

    // The mock server should receive a request for the default project
    assert.strictEqual(project.id.toString(), DEFAULT_PROJECT_ID, 'Should use GITLAB_PROJECT_ID as default');
    console.log(`  ✓ Used default project ${DEFAULT_PROJECT_ID} when no project_id provided`);
  });

  test('should prioritize passed project_id over GITLAB_PROJECT_ID', async () => {
    // Call get_project with a different project_id
    const result = await client.callTool('get_project', {
      project_id: OTHER_PROJECT_ID
    });

    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);

    // Should use the passed project_id, not GITLAB_PROJECT_ID
    assert.strictEqual(project.id.toString(), OTHER_PROJECT_ID, 'Should use passed project_id');
    console.log(`  ✓ Used passed project_id ${OTHER_PROJECT_ID} instead of default ${DEFAULT_PROJECT_ID}`);
  });

  test('should resolve explicit numeric group IDs through the groups endpoint', async () => {
    group123Requested = false;

    const result = await client.callTool('list_work_items', {
      project_id: 'group:123',
    });

    assert.ok(group123Requested, 'Should request /groups/123');
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const parsed = JSON.parse(content.text);

    assert.strictEqual(parsed.items.length, 1, 'Should return group work items');
    assert.strictEqual(parsed.items[0].title, 'Group work item');
    console.log('  ✓ Resolved group:123 via /groups/123 when no project allowlist is set');
  });

  test('should resolve labels from the group root when creating group work items', async () => {
    labelLookupRoots = [];

    const result = await client.callTool('create_work_item', {
      project_id: 'group:123',
      title: 'Created group work item',
      labels: ['group-label'],
    });

    assert.deepStrictEqual(labelLookupRoots, ['group']);
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    assert.strictEqual(JSON.parse(content.text).title, 'Created group work item');
    console.log('  ✓ Resolved create labels through group(fullPath:)');
  });

  test('should resolve labels from the group root when updating group work items', async () => {
    labelLookupRoots = [];

    const result = await client.callTool('update_work_item', {
      project_id: 'group:123',
      iid: 1,
      add_labels: ['group-label'],
    });

    assert.deepStrictEqual(labelLookupRoots, ['group']);
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    assert.strictEqual(JSON.parse(content.text).title, 'Updated group work item');
    console.log('  ✓ Resolved update labels through group(fullPath:)');
  });

  test('should not fall back from bare numeric project IDs to groups', async () => {
    group789Requested = false;
    let didThrow = false;

    try {
      await client.callTool('list_work_items', {
        project_id: '789',
      });
    } catch (error) {
      didThrow = true;
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('404'), 'Should surface the project 404');
    }

    assert.ok(didThrow, 'Should have failed on the project 404');
    assert.strictEqual(group789Requested, false, 'Should not request /groups/789');
    console.log('  ✓ Bare numeric ID 789 did not fall back to /groups/789');
  });

  test('should not fall back from explicit numeric project IDs to groups', async () => {
    group789Requested = false;
    let didThrow = false;

    try {
      await client.callTool('list_work_items', {
        project_id: 'project:789',
      });
    } catch (error) {
      didThrow = true;
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('404'), 'Should surface the project 404');
    }

    assert.ok(didThrow, 'Should have failed on the project 404');
    assert.strictEqual(group789Requested, false, 'Should not request /groups/789');
    console.log('  ✓ Explicit project:789 did not fall back to /groups/789');
  });
});

describe('getEffectiveProjectId - With single GITLAB_ALLOWED_PROJECT_IDS', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: CustomHeaderClient;

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server WITH single GITLAB_ALLOWED_PROJECT_IDS
    const mcpPort = await findAvailablePort(3200);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PROJECT_ID: DEFAULT_PROJECT_ID,
        GITLAB_ALLOWED_PROJECT_IDS: DEFAULT_PROJECT_ID,
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);

    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`Allowed Project: ${DEFAULT_PROJECT_ID}`);
  });

  after(async () => {
    if (client) {
      await client.disconnect();
    }
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should use single allowed project as default', async () => {
    const result = await client.callTool('get_project', {
      project_id: ''
    });

    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);

    assert.strictEqual(project.id.toString(), DEFAULT_PROJECT_ID, 'Should use allowed project as default');
    console.log(`  ✓ Used allowed project ${DEFAULT_PROJECT_ID} as default`);
  });

  test('should reject access to non-allowed project', async () => {
    try {
      await client.callTool('get_project', {
        project_id: OTHER_PROJECT_ID
      });
      assert.fail('Should have rejected access to non-allowed project');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('Access denied'), 'Should indicate access denied');
      console.log('  ✓ Correctly rejected access to non-allowed project');
    }
  });

  test('should reject explicit group IDs when GITLAB_ALLOWED_PROJECT_IDS is set', async () => {
    let didThrow = false;

    try {
      await client.callTool('list_work_items', {
        project_id: 'group:123',
      });
    } catch (error) {
      didThrow = true;
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.includes('GITLAB_ALLOWED_PROJECT_IDS') &&
          error.message.includes('project allowlist does not cover groups'),
        'Should explain that project allowlists do not authorize groups'
      );
      console.log('  ✓ Rejected group:123 when GITLAB_ALLOWED_PROJECT_IDS is set');
    }

    assert.ok(didThrow, 'Should have rejected explicit group access');
  });
});

describe('getEffectiveProjectId - With multiple GITLAB_ALLOWED_PROJECT_IDS', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: CustomHeaderClient;

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server WITH multiple GITLAB_ALLOWED_PROJECT_IDS
    const mcpPort = await findAvailablePort(3300);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_ALLOWED_PROJECT_IDS: `${DEFAULT_PROJECT_ID},${OTHER_PROJECT_ID}`,
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);

    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`Allowed Projects: ${DEFAULT_PROJECT_ID},${OTHER_PROJECT_ID}`);
  });

  after(async () => {
    if (client) {
      await client.disconnect();
    }
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should require explicit project_id when multiple projects allowed', async () => {
    try {
      await client.callTool('get_project', {
        project_id: ''
      });
      assert.fail('Should have required explicit project_id');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('Please specify a project ID'), 'Should require project ID');
      console.log('  ✓ Correctly required explicit project_id');
    }
  });

  test('should allow access to first allowed project', async () => {
    const result = await client.callTool('get_project', {
      project_id: DEFAULT_PROJECT_ID
    });

    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);

    assert.strictEqual(project.id.toString(), DEFAULT_PROJECT_ID, 'Should allow first project');
    console.log(`  ✓ Allowed access to first project ${DEFAULT_PROJECT_ID}`);
  });

  test('should allow access to second allowed project', async () => {
    const result = await client.callTool('get_project', {
      project_id: OTHER_PROJECT_ID
    });

    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);

    assert.strictEqual(project.id.toString(), OTHER_PROJECT_ID, 'Should allow second project');
    console.log(`  ✓ Allowed access to second project ${OTHER_PROJECT_ID}`);
  });
});

describe('GITLAB_PROJECT_ID guards repository and group mutators', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: CustomHeaderClient;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    const mcpPort = await findAvailablePort(3400);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PROJECT_ID: DEFAULT_PROJECT_ID,
        GITLAB_TOOLSETS: 'variables',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);
  });

  after(async () => {
    if (client) await client.disconnect();
    cleanupServers(servers);
    if (mockGitLab) await mockGitLab.stop();
  });

  test('should reject create_repository when GITLAB_PROJECT_ID is set', async () => {
    try {
      await client.callTool('create_repository', { name: 'test-repo' });
      assert.fail('Should have rejected create_repository');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('create_repository is not allowed'), 'Should mention create_repository');
    }
  });

  test('should reject fork_repository when GITLAB_PROJECT_ID is set', async () => {
    try {
      await client.callTool('fork_repository', { project_id: '999' });
      assert.fail('Should have rejected fork_repository');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('fork_repository is not allowed'), 'Should mention fork_repository');
    }
  });

  test('should reject create_group when GITLAB_PROJECT_ID is set', async () => {
    try {
      await client.callTool('create_group', { name: 'test-group', path: 'test-group' });
      assert.fail('Should have rejected create_group');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('create_group is not allowed'), 'Should mention create_group');
    }
  });

  test('should reject list_group_variables when GITLAB_PROJECT_ID is set', async () => {
    try {
      await client.callTool('list_group_variables', { group_id: 'my-group' });
      assert.fail('Should have rejected list_group_variables');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('list_group_variables is not allowed'), 'Should mention list_group_variables');
    }
  });

  test('should reject get_group_variable when GITLAB_PROJECT_ID is set', async () => {
    try {
      await client.callTool('get_group_variable', { group_id: 'my-group', key: 'SHARED_SECRET' });
      assert.fail('Should have rejected get_group_variable');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('get_group_variable is not allowed'), 'Should mention get_group_variable');
    }
  });

  test('should allow get_project (non-mutator) when GITLAB_PROJECT_ID is set', async () => {
    const result = await client.callTool('get_project', { project_id: '' });
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);
    assert.strictEqual(project.id.toString(), DEFAULT_PROJECT_ID, 'Should use default project');
  });
});

describe('GITLAB_ALLOWED_PROJECT_IDS guards repository and group mutators (allowlist-only, no GITLAB_PROJECT_ID)', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: CustomHeaderClient;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    const mcpPort = await findAvailablePort(3600);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_ALLOWED_PROJECT_IDS: DEFAULT_PROJECT_ID,
        GITLAB_TOOLSETS: 'variables',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);
  });

  after(async () => {
    if (client) await client.disconnect();
    cleanupServers(servers);
    if (mockGitLab) await mockGitLab.stop();
  });

  test('should reject create_repository with GITLAB_ALLOWED_PROJECT_IDS', async () => {
    try {
      await client.callTool('create_repository', { name: 'test-repo' });
      assert.fail('Should have rejected create_repository');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('create_repository is not allowed'), 'Should mention create_repository');
    }
  });

  test('should reject fork_repository with GITLAB_ALLOWED_PROJECT_IDS', async () => {
    try {
      await client.callTool('fork_repository', { project_id: '999' });
      assert.fail('Should have rejected fork_repository');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('fork_repository is not allowed'), 'Should mention fork_repository');
    }
  });

  test('should reject create_group with GITLAB_ALLOWED_PROJECT_IDS', async () => {
    try {
      await client.callTool('create_group', { name: 'test-group', path: 'test-group' });
      assert.fail('Should have rejected create_group');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('create_group is not allowed'), 'Should mention create_group');
    }
  });

  test('should reject list_group_variables with GITLAB_ALLOWED_PROJECT_IDS', async () => {
    try {
      await client.callTool('list_group_variables', { group_id: 'my-group' });
      assert.fail('Should have rejected list_group_variables');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('list_group_variables is not allowed'), 'Should mention list_group_variables');
    }
  });

  test('should reject get_group_variable with GITLAB_ALLOWED_PROJECT_IDS', async () => {
    try {
      await client.callTool('get_group_variable', { group_id: 'my-group', key: 'SHARED_SECRET' });
      assert.fail('Should have rejected get_group_variable');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('get_group_variable is not allowed'), 'Should mention get_group_variable');
    }
  });

  test('should allow get_project (non-mutator) with GITLAB_ALLOWED_PROJECT_IDS', async () => {
    const result = await client.callTool('get_project', { project_id: '' });
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);
    assert.strictEqual(project.id.toString(), DEFAULT_PROJECT_ID, 'Should use default project');
  });
});

describe('GITLAB_READ_ONLY_MODE enforces read-only for all write tools', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: CustomHeaderClient;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    const mcpPort = await findAvailablePort(3500);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);
  });

  after(async () => {
    if (client) await client.disconnect();
    cleanupServers(servers);
    if (mockGitLab) await mockGitLab.stop();
  });

  test('should reject create_group in read-only mode (no project ID)', async () => {
    try {
      await client.callTool('create_group', { name: 'test-group', path: 'test-group' });
      assert.fail('Should have rejected create_group in read-only mode');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('create_group is not allowed'), 'Should mention create_group');
    }
  });

  test('should reject create_repository in read-only mode', async () => {
    try {
      await client.callTool('create_repository', { name: 'test-repo' });
      assert.fail('Should have rejected create_repository in read-only mode');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('create_repository is not allowed'), 'Should mention create_repository');
    }
  });

  test('should allow get_project (read-only) in read-only mode', async () => {
    const result = await client.callTool('get_project', { project_id: DEFAULT_PROJECT_ID });
    assert.ok(result.content, 'Should have content');
  });
});

describe('GITLAB_PROJECT_ID guards dependency proxy tools', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: CustomHeaderClient;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    const mcpPort = await findAvailablePort(3500);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PROJECT_ID: DEFAULT_PROJECT_ID,
        GITLAB_TOOLSETS: 'dependency_proxy',
      },
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);
  });

  after(async () => {
    if (client) await client.disconnect();
    cleanupServers(servers);
    if (mockGitLab) await mockGitLab.stop();
  });

  test('should reject get_dependency_proxy_settings when GITLAB_PROJECT_ID is set', async () => {
    try {
      await client.callTool('get_dependency_proxy_settings', { group_id: 'my-group' });
      assert.fail('Should have rejected get_dependency_proxy_settings');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.includes('get_dependency_proxy_settings is not allowed'),
        'Should mention get_dependency_proxy_settings'
      );
    }
  });

  test('should reject purge_dependency_proxy_cache when GITLAB_PROJECT_ID is set', async () => {
    try {
      await client.callTool('purge_dependency_proxy_cache', { group_id: 'my-group' });
      assert.fail('Should have rejected purge_dependency_proxy_cache');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.includes('purge_dependency_proxy_cache is not allowed'),
        'Should mention purge_dependency_proxy_cache'
      );
    }
  });
});

}); // end wrapper describe
