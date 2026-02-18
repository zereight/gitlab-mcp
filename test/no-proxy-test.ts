/**
 * NO_PROXY Test Suite
 * Tests NO_PROXY pattern matching and proxy bypass functionality
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { GitLabClientPool } from '../gitlab-client-pool.js';

console.log('🚫 NO_PROXY Test Suite');
console.log('');

describe('NO_PROXY Pattern Matching', () => {
  test('should bypass proxy for exact hostname match', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: 'gitlab.internal.com',
    });

    // Create agent for the NO_PROXY matched host
    const agent = pool.getOrCreateAgentForUrl('https://gitlab.internal.com/api/v4');
    
    // The agent should NOT be a proxy agent
    // It should be a standard HTTPS agent
    assert.ok(agent, 'Agent should be created');
    assert.strictEqual(agent.constructor.name, 'Agent', 'Should be a standard Agent, not a proxy agent');
  });

  test('should use proxy for non-matching hostname', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: 'gitlab.internal.com',
    });

    // Create agent for a host that should use proxy
    const agent = pool.getOrCreateAgentForUrl('https://gitlab.external.com/api/v4');
    
    // The agent should be a proxy agent
    assert.ok(agent, 'Agent should be created');
    assert.notStrictEqual(agent.constructor.name, 'Agent', 'Should be a proxy agent, not standard Agent');
  });

  test('should bypass proxy for domain suffix match', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: '.internal.com',
    });

    // Test multiple subdomains
    const agent1 = pool.getOrCreateAgentForUrl('https://gitlab.internal.com/api/v4');
    const agent2 = pool.getOrCreateAgentForUrl('https://api.internal.com/api/v4');
    const agent3 = pool.getOrCreateAgentForUrl('https://dev.gitlab.internal.com/api/v4');
    
    assert.strictEqual(agent1.constructor.name, 'Agent', 'gitlab.internal.com should bypass proxy');
    assert.strictEqual(agent2.constructor.name, 'Agent', 'api.internal.com should bypass proxy');
    assert.strictEqual(agent3.constructor.name, 'Agent', 'dev.gitlab.internal.com should bypass proxy');
  });

  test('should bypass proxy for localhost', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: 'localhost,127.0.0.1',
    });

    const agent1 = pool.getOrCreateAgentForUrl('http://localhost:8080/api/v4');
    const agent2 = pool.getOrCreateAgentForUrl('http://127.0.0.1:8080/api/v4');
    
    assert.strictEqual(agent1.constructor.name, 'Agent', 'localhost should bypass proxy');
    assert.strictEqual(agent2.constructor.name, 'Agent', '127.0.0.1 should bypass proxy');
  });

  test('should bypass proxy for wildcard pattern', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: '*',
    });

    const agent = pool.getOrCreateAgentForUrl('https://gitlab.com/api/v4');
    
    assert.strictEqual(agent.constructor.name, 'Agent', 'Wildcard should bypass all proxies');
  });

  test('should handle multiple NO_PROXY patterns', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: 'localhost,.internal.com,192.168.1.1',
    });

    const agent1 = pool.getOrCreateAgentForUrl('http://localhost/api/v4');
    const agent2 = pool.getOrCreateAgentForUrl('https://gitlab.internal.com/api/v4');
    const agent3 = pool.getOrCreateAgentForUrl('http://192.168.1.1/api/v4');
    const agent4 = pool.getOrCreateAgentForUrl('https://gitlab.com/api/v4');
    
    assert.strictEqual(agent1.constructor.name, 'Agent', 'localhost should bypass proxy');
    assert.strictEqual(agent2.constructor.name, 'Agent', '.internal.com should bypass proxy');
    assert.strictEqual(agent3.constructor.name, 'Agent', '192.168.1.1 should bypass proxy');
    assert.notStrictEqual(agent4.constructor.name, 'Agent', 'gitlab.com should use proxy');
  });

  test('should handle NO_PROXY with whitespace', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: ' localhost , .internal.com , 192.168.1.1 ',
    });

    const agent1 = pool.getOrCreateAgentForUrl('http://localhost/api/v4');
    const agent2 = pool.getOrCreateAgentForUrl('https://gitlab.internal.com/api/v4');
    
    assert.strictEqual(agent1.constructor.name, 'Agent', 'Should handle whitespace in NO_PROXY');
    assert.strictEqual(agent2.constructor.name, 'Agent', 'Should handle whitespace in NO_PROXY');
  });

  test('should work without NO_PROXY set', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
    });

    const agent = pool.getOrCreateAgentForUrl('https://gitlab.com/api/v4');
    
    // Should use proxy when NO_PROXY is not set
    assert.notStrictEqual(agent.constructor.name, 'Agent', 'Should use proxy when NO_PROXY is not set');
  });

  test('should work with NO_PROXY set but empty', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: '',
    });

    const agent = pool.getOrCreateAgentForUrl('https://gitlab.com/api/v4');
    
    // Should use proxy when NO_PROXY is empty
    assert.notStrictEqual(agent.constructor.name, 'Agent', 'Should use proxy when NO_PROXY is empty');
  });

  test('should handle port-specific patterns', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: 'gitlab.internal.com:443',
    });

    const agent1 = pool.getOrCreateAgentForUrl('https://gitlab.internal.com/api/v4'); // HTTPS uses port 443 by default
    const agent2 = pool.getOrCreateAgentForUrl('http://gitlab.internal.com/api/v4'); // HTTP uses port 80 by default
    
    assert.strictEqual(agent1.constructor.name, 'Agent', 'Should bypass proxy for matching port');
    assert.notStrictEqual(agent2.constructor.name, 'Agent', 'Should use proxy for non-matching port');
  });

  test('should handle case-insensitive matching', () => {
    const pool = new GitLabClientPool({
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: 'GitLab.Internal.COM',
    });

    const agent1 = pool.getOrCreateAgentForUrl('https://gitlab.internal.com/api/v4');
    const agent2 = pool.getOrCreateAgentForUrl('https://GITLAB.INTERNAL.COM/api/v4');
    
    assert.strictEqual(agent1.constructor.name, 'Agent', 'Should match case-insensitively (lowercase)');
    assert.strictEqual(agent2.constructor.name, 'Agent', 'Should match case-insensitively (uppercase)');
  });
});

console.log('✅ NO_PROXY tests completed');
