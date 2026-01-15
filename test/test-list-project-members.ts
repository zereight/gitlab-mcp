import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';

const directMembers = [
  {
    id: 1,
    username: 'direct-user',
    name: 'Direct User',
    state: 'active',
    avatar_url: null,
    web_url: 'https://gitlab.mock/users/1',
    access_level: 30,
    created_at: '2024-01-01T00:00:00Z'
  }
];

const inheritedMembers = [
  {
    id: 2,
    username: 'inherited-user',
    name: 'Inherited User',
    state: 'active',
    avatar_url: null,
    web_url: 'https://gitlab.mock/users/2',
    access_level: 20,
    created_at: '2024-01-02T00:00:00Z'
  }
];

async function callListProjectMembers(args: Record<string, any> = {}, env: NodeJS.ProcessEnv) {
  return new Promise<any[]>((resolve, reject) => {
    const proc = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...env,
        GITLAB_READ_ONLY_MODE: 'true'
      }
    });

    let output = '';
    let errorOutput = '';
    proc.stdout?.on('data', d => output += d);
    proc.stderr?.on('data', d => errorOutput += d);

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));

      const line = output.split('\n').find(l => l.startsWith('{'));
      if (!line) return reject(new Error('No JSON output found'));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              resolve(JSON.parse(content));
            } catch (e) {
              reject(new Error(`Failed to parse tool output JSON: ${content}`));
            }
          } else {
            resolve(response.result);
          }
        }
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "list_project_members", arguments: args }
    }) + '\n');
  });
}

describe('list_project_members', () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let directEndpointHit = false;
  let inheritedEndpointHit = false;

  before(async () => {
    const mockPort = await findMockServerPort(9000);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();

    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/members`, (req, res) => {
      directEndpointHit = true;
      res.json(directMembers);
    });

    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/members/all`, (req, res) => {
      inheritedEndpointHit = true;
      res.json([...directMembers, ...inheritedMembers]);
    });
  });

  beforeEach(() => {
    directEndpointHit = false;
    inheritedEndpointHit = false;
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test('lists direct project members', async () => {
    const members = await callListProjectMembers({ project_id: TEST_PROJECT_ID }, {
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
    });

    assert.ok(Array.isArray(members), 'Response should be an array');
    assert.strictEqual(members.length, 1, 'Should return direct members');
    assert.strictEqual(members[0].username, 'direct-user');
    assert.strictEqual(directEndpointHit, true, 'Direct members endpoint should be called');
    assert.strictEqual(inheritedEndpointHit, false, 'Inherited members endpoint should not be called');
  });

  test('lists project members including inheritance', async () => {
    const members = await callListProjectMembers(
      { project_id: TEST_PROJECT_ID, include_inheritance: true },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(members), 'Response should be an array');
    assert.strictEqual(members.length, 2, 'Should return inherited members');
    assert.strictEqual(members[1].username, 'inherited-user');
    assert.strictEqual(inheritedEndpointHit, true, 'Inherited members endpoint should be called');
    assert.strictEqual(directEndpointHit, false, 'Direct members endpoint should not be called');
  });
});
