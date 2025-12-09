import { describe, test, after, before } from 'node:test';
import assert from 'node:assert';
import { 
  launchServer, 
  findAvailablePort, 
  ServerInstance, 
  TransportMode,
  HOST 
} from './utils/server-launcher.js';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import { CustomHeaderClient } from './clients/custom-header-client.js';
import { Request, Response } from "express";

const MOCK_TOKEN_DEFAULT = 'glpat-mock-token-default';
const MOCK_TOKEN_HEADER = 'glpat-mock-token-header';

describe('Dynamic Routing and Authentication Scenarios', () => {
  const originalToken = process.env.GITLAB_TOKEN_TEST;

  before(() => {
    process.env.GITLAB_TOKEN_TEST = 'mock-token-for-launcher';
  });

  after(() => {
    if (originalToken) {
      process.env.GITLAB_TOKEN_TEST = originalToken;
    } else {
      delete process.env.GITLAB_TOKEN_TEST;
    }
  });

  // Scenario 1: remote=off, dynamic=off
  describe('Scenario 1: Remote Auth OFF, Dynamic URL OFF', () => {
    let mcpServer: ServerInstance;
    let mcpUrl: string;
    let mockServer: MockGitLabServer;
    const originalProjectId = process.env.TEST_PROJECT_ID;

    before(async () => {
      // Ensure GITLAB_TOKEN_TEST matches what we expect for this scenario
      // to avoid launchServer overwriting GITLAB_PERSONAL_ACCESS_TOKEN with a different value
      process.env.GITLAB_TOKEN_TEST = MOCK_TOKEN_DEFAULT;
      process.env.TEST_PROJECT_ID = '1';
      const mockPort = await findMockServerPort(9021);
      mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN_DEFAULT] });
      await mockServer.start();

      const mcpPort = await findAvailablePort(3021);
      mcpServer = await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port: mcpPort,
        env: {
          GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
          GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN_DEFAULT,
          REMOTE_AUTHORIZATION: "false",
          ENABLE_DYNAMIC_API_URL: "false",
          GITLAB_TOKEN_TEST: MOCK_TOKEN_DEFAULT,
        },
      });
      mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    });

    after(async () => {
      if (originalProjectId) {
        process.env.TEST_PROJECT_ID = originalProjectId;
      } else {
        delete process.env.TEST_PROJECT_ID;
      }
      if (mcpServer) mcpServer.kill();
      if (mockServer) await mockServer.stop();
    });

    test('should ignore headers and use startup config', async () => {
      mockServer.addMockHandler('get', '/projects/1', (req: Request, res: Response) => {
        // index.ts uses Authorization header by default unless GITLAB_IS_OLD is set
        assert.strictEqual(req.headers['authorization'], `Bearer ${MOCK_TOKEN_DEFAULT}`);
        res.json({ id: 1, default_branch: 'main' });
      });

      const client = new CustomHeaderClient({
        headers: {
          'authorization': `Bearer ${MOCK_TOKEN_HEADER}`, // This should be ignored
          'X-GitLab-API-URL': 'http://localhost:9999/api/v4', // This should be ignored
        }
      });
      await client.connect(mcpUrl);
      const result = await client.callTool('get_project', { project_id: "1" });
      assert.ok(result, 'Should get a result from the tool call');
      await client.disconnect();
    });
  });

  // Scenario 2: remote=on, dynamic=off
  describe('Scenario 2: Remote Auth ON, Dynamic URL OFF', () => {
    let mcpServer: ServerInstance;
    let mcpUrl: string;
    let mockServer: MockGitLabServer;

    before(async () => {
      const mockPort = await findMockServerPort(9022);
      mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN_HEADER] });
      await mockServer.start();

      const mcpPort = await findAvailablePort(3022);
      mcpServer = await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port: mcpPort,
        env: {
          GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
          REMOTE_AUTHORIZATION: "true",
          ENABLE_DYNAMIC_API_URL: "false",
        },
      });
      mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    });

    after(async () => {
      if (mcpServer) mcpServer.kill();
      if (mockServer) await mockServer.stop();
    });

    test('should use token from header and ignore dynamic URL', async () => {
      mockServer.addMockHandler('get', '/projects/1', (req: Request, res: Response) => {
        assert.strictEqual(req.headers['authorization'], `Bearer ${MOCK_TOKEN_HEADER}`);
        res.json({ id: 1, default_branch: 'main' });
      });

      const client = new CustomHeaderClient({
        headers: {
          'authorization': `Bearer ${MOCK_TOKEN_HEADER}`,
          'X-GitLab-API-URL': 'http://localhost:9999/api/v4', // This should be ignored
        }
      });
      await client.connect(mcpUrl);
      const result = await client.callTool('get_project', { project_id: "1" });
      assert.ok(result, 'Should get a result from the tool call');
      await client.disconnect();
    });
  });

  // Scenario 3: remote=off, dynamic=on - should be an error
  describe('Scenario 3: Remote Auth OFF, Dynamic URL ON (Error Case)', () => {
    test('should fail to start with an error', async () => {
      await assert.rejects(
        launchServer({
          mode: TransportMode.STREAMABLE_HTTP,
          port: await findAvailablePort(3023),
          env: {
            REMOTE_AUTHORIZATION: "false",
            ENABLE_DYNAMIC_API_URL: "true",
            GITLAB_TOKEN_TEST: "mock-token", // Required to bypass launcher check
          },
        }),
        (err: Error) => {
          // The server process exits with code 1, which launchServer catches and throws as a generic error
          // We can't easily see the stderr output here without modifying launchServer,
          // so we accept the exit code 1 error as success for this negative test.
          return err.message.includes('Server process exited with code 1');
        }
      );
    });
  });

  // Scenario 4: remote=on, dynamic=on
  describe('Scenario 4: Remote Auth ON, Dynamic URL ON', () => {
    let mcpServer: ServerInstance;
    let mcpUrl: string;
    let defaultMockServer: MockGitLabServer;
    let headerMockServer: MockGitLabServer;

    before(async () => {
      const defaultPort = await findMockServerPort(9024);
      defaultMockServer = new MockGitLabServer({ port: defaultPort, validTokens: [MOCK_TOKEN_DEFAULT, MOCK_TOKEN_HEADER] });
      await defaultMockServer.start();

      const headerPort = await findMockServerPort(9025);
      headerMockServer = new MockGitLabServer({ port: headerPort, validTokens: [MOCK_TOKEN_DEFAULT, MOCK_TOKEN_HEADER] });
      await headerMockServer.start();

      const mcpPort = await findAvailablePort(3024);
      mcpServer = await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port: mcpPort,
        env: {
          GITLAB_API_URL: `${defaultMockServer.getUrl()}/api/v4`,
          GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN_DEFAULT,
          REMOTE_AUTHORIZATION: "true",
          ENABLE_DYNAMIC_API_URL: "true",
        },
      });
      mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    });

    after(async () => {
      if (mcpServer) mcpServer.kill();
      if (defaultMockServer) await defaultMockServer.stop();
      if (headerMockServer) await headerMockServer.stop();
    });

    test('should use default URL and token when no headers are provided', async () => {
      defaultMockServer.addMockHandler('get', '/projects/1', (req: Request, res: Response) => {
        assert.strictEqual(req.headers['private-token'], MOCK_TOKEN_DEFAULT);
        res.json(createMockProject(1, 'default-server'));
      });

      const client = new CustomHeaderClient({ headers: { 'private-token': MOCK_TOKEN_DEFAULT } });
      await client.connect(mcpUrl);
      const result = await client.callTool('get_project', { project_id: "1" });
      const resultContent = JSON.parse((result.content[0] as any).text);
      assert.strictEqual(resultContent.description, 'default-server');
      await client.disconnect();
    });

    test('should use custom URL from header and default token', async () => {
      headerMockServer.addMockHandler('get', '/projects/2', (req: Request, res: Response) => {
        assert.strictEqual(req.headers['private-token'], MOCK_TOKEN_DEFAULT);
        res.json(createMockProject(2, 'header-server'));
      });

      const client = new CustomHeaderClient({
        headers: {
          'private-token': MOCK_TOKEN_DEFAULT,
          'X-GitLab-API-URL': `${headerMockServer.getUrl()}/api/v4`,
        }
      });
      await client.connect(mcpUrl);
      const result = await client.callTool('get_project', { project_id: "2" });
      const resultContent = JSON.parse((result.content[0] as any).text);
      assert.strictEqual(resultContent.description, 'header-server');
      await client.disconnect();
    });

    test('should use custom URL and token from headers', async () => {
      headerMockServer.addMockHandler('get', '/projects/3', (req: Request, res: Response) => {
        assert.strictEqual(req.headers['authorization'], `Bearer ${MOCK_TOKEN_HEADER}`);
        res.json(createMockProject(3, 'header-server-with-header-token'));
      });

      const client = new CustomHeaderClient({
        headers: {
          'authorization': `Bearer ${MOCK_TOKEN_HEADER}`,
          'X-GitLab-API-URL': `${headerMockServer.getUrl()}/api/v4`,
        }
      });
      await client.connect(mcpUrl);
      const result = await client.callTool('get_project', { project_id: "3" });
      const resultContent = JSON.parse((result.content[0] as any).text);
      assert.strictEqual(resultContent.description, 'header-server-with-header-token');
      await client.disconnect();
    });

    test('should work with multiple tool calls', async () => {
      const client = new CustomHeaderClient({
        headers: {
          'authorization': `Bearer ${MOCK_TOKEN_HEADER}`,
          'X-GitLab-API-URL': `${headerMockServer.getUrl()}/api/v4`,
        }
      });
      await client.connect(mcpUrl);
      
      await validateToolCalls(client, headerMockServer, MOCK_TOKEN_HEADER);

      await client.disconnect();
    });
  });
});

// Helper functions to create schema-compliant mock objects
function createMockUser() {
  return {
    id: 1,
    username: 'mock_user',
    name: 'Mock User',
    state: 'active',
    avatar_url: 'https://example.com/avatar.png',
    web_url: 'https://example.com/mock_user'
  };
}

function createMockProject(id: number, description: string = 'Mock Project') {
  return {
    id,
    name: `Project ${id}`,
    path_with_namespace: `group/project-${id}`,
    description,
    visibility: 'private',
    web_url: `https://gitlab.example.com/group/project-${id}`,
    created_at: '2024-01-01T00:00:00Z',
    last_activity_at: '2024-01-01T00:00:00Z',
    default_branch: 'main',
    namespace: {
      id: 1,
      name: 'Group',
      path: 'group',
      kind: 'group',
      full_path: 'group',
      web_url: 'https://gitlab.example.com/group'
    }
  };
}

function createMockIssue(id: number, projectId: number) {
  return {
    id,
    iid: id,
    project_id: projectId,
    title: `Issue ${id}`,
    description: 'Description',
    state: 'opened',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    closed_at: null,
    web_url: `https://gitlab.example.com/group/project-${projectId}/issues/${id}`,
    author: createMockUser(),
    assignees: [],
    labels: [],
    milestone: null,
    user_notes_count: 0,
    upvotes: 0,
    downvotes: 0,
    confidential: false
  };
}

function createMockMergeRequest(id: number, projectId: number) {
  return {
    id,
    iid: id,
    project_id: projectId,
    title: `MR ${id}`,
    description: 'Description',
    state: 'opened',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    merged_at: null,
    closed_at: null,
    merge_commit_sha: null,
    web_url: `https://gitlab.example.com/group/project-${projectId}/merge_requests/${id}`,
    author: createMockUser(),
    source_branch: 'feature',
    target_branch: 'main',
    draft: false,
    work_in_progress: false,
    merge_status: 'can_be_merged'
  };
}

function createMockPipeline(id: number, projectId: number) {
  return {
    id,
    project_id: projectId,
    sha: 'sha123',
    ref: 'main',
    status: 'success',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    web_url: `https://gitlab.example.com/group/project-${projectId}/pipelines/${id}`,
    user: createMockUser()
  };
}

function createMockCommit(id: string) {
  return {
    id,
    short_id: id.substring(0, 8),
    title: 'Commit message',
    author_name: 'Mock User',
    author_email: 'mock@example.com',
    authored_date: '2024-01-01T00:00:00Z',
    committer_name: 'Mock User',
    committer_email: 'mock@example.com',
    committed_date: '2024-01-01T00:00:00Z',
    message: 'Commit message',
    parent_ids: [],
    web_url: `https://gitlab.example.com/commit/${id}`
  };
}

function createMockLabel(id: number) {
  return {
    id,
    name: `Label ${id}`,
    color: '#FF0000',
    text_color: '#FFFFFF',
    description: 'Label description',
    open_issues_count: 0,
    closed_issues_count: 0,
    open_merge_requests_count: 0,
    subscribed: false,
    priority: null,
    is_project_label: true
  };
}

function createMockTreeItem(id: string) {
  return {
    id,
    name: 'file.txt',
    type: 'blob',
    path: 'file.txt',
    mode: '100644'
  };
}

async function validateToolCalls(client: CustomHeaderClient, mockServer: MockGitLabServer, expectedToken: string) {
  const toolsToTest = [
    { name: 'get_project', params: { project_id: '1' } },
    { name: 'list_issues', params: { project_id: '1' } },
    { name: 'get_merge_request', params: { project_id: '1', merge_request_iid: '1' } },
    { name: 'list_merge_requests', params: { project_id: '1' } },
    { name: 'get_repository_tree', params: { project_id: '1' } },
    { name: 'list_labels', params: { project_id: '1' } },
    { name: 'list_pipelines', params: { project_id: '1' } },
    { name: 'list_commits', params: { project_id: '1' } },
  ];

  for (const tool of toolsToTest) {
    mockServer.clearCustomHandlers();
    
    let mockPath = '';
    let mockResponse: any;

    switch (tool.name) {
      case 'get_project':
        mockPath = '/projects/1';
        mockResponse = createMockProject(1, 'mock-response');
        break;
      case 'list_issues':
        mockPath = '/projects/1/issues';
        mockResponse = [createMockIssue(1, 1)];
        break;
      case 'get_merge_request':
        mockPath = '/projects/1/merge_requests/1';
        mockResponse = createMockMergeRequest(1, 1);
        break;
      case 'list_merge_requests':
        mockPath = '/projects/1/merge_requests';
        mockResponse = [createMockMergeRequest(1, 1)];
        break;
      case 'get_repository_tree':
        mockPath = '/projects/1/repository/tree';
        mockResponse = [createMockTreeItem('blob1')];
        break;
      case 'list_labels':
        mockPath = '/projects/1/labels';
        mockResponse = [createMockLabel(1)];
        break;
      case 'list_pipelines':
        mockPath = '/projects/1/pipelines';
        mockResponse = [createMockPipeline(1, 1)];
        break;
      case 'list_commits':
        mockPath = '/projects/1/repository/commits';
        mockResponse = [createMockCommit('sha1')];
        break;
      default:
        throw new Error(`Unknown tool: ${tool.name}`);
    }

    mockServer.addMockHandler('get', mockPath, (req: Request, res: Response) => {
      if (req.headers['authorization']) {
        assert.strictEqual(req.headers['authorization'], `Bearer ${expectedToken}`);
      } else {
        assert.strictEqual(req.headers['private-token'], expectedToken);
      }
      res.json(mockResponse);
    });

    const result = await client.callTool(tool.name, tool.params);
    const resultContent = JSON.parse((result.content[0] as any).text);
    
    // Basic validation that we got the expected object back
    if (Array.isArray(mockResponse)) {
      assert.ok(Array.isArray(resultContent));
      assert.strictEqual(resultContent.length, mockResponse.length);
      // Check ID of first item
      if (resultContent[0].id) {
        assert.strictEqual(String(resultContent[0].id), String(mockResponse[0].id));
      }
    } else {
      assert.strictEqual(String(resultContent.id), String(mockResponse.id));
      if (tool.name === 'get_project') {
        assert.strictEqual(resultContent.description, 'mock-response');
      }
    }
  }
}