import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';

describe('User-Agent Header Tests', () => {
  let mockServer: MockGitLabServer;
  let mockPort: number;
  
  before(async () => {
    mockPort = await findMockServerPort();
    mockServer = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockServer.start();
    
    // Add custom route to capture User-Agent header
    mockServer.addMockHandler('get', '/user', (req, res) => {
      const userAgent = req.headers['user-agent'];
      res.json({
        id: 1,
        username: 'test_user',
        name: 'Test User',
        user_agent: userAgent
      });
    });
  });
  
  after(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });
  
  test('User-Agent header should be set in API requests', async () => {
    // Import node-fetch to make a test request
    const fetch = (await import('node-fetch')).default;
    
    // Make a request to the mock server to verify User-Agent is set
    const response = await fetch(`http://127.0.0.1:${mockPort}/api/v4/user`, {
      headers: {
        'Authorization': `Bearer ${MOCK_TOKEN}`,
        'User-Agent': 'gitlab-mcp-server/2.0.23 (node-fetch)'
      }
    });
    
    const data = await response.json() as any;
    assert.ok(data.user_agent, 'User-Agent header should be present');
    assert.ok(data.user_agent.includes('gitlab-mcp-server'), 'User-Agent should include "gitlab-mcp-server"');
    assert.ok(data.user_agent.includes('node-fetch'), 'User-Agent should include "node-fetch"');
  });
});
