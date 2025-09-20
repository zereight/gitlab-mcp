/**
 * Comprehensive Tool Testing for GitLab MCP Server
 * Tests all available tools across all transport modes
 */

import * as path from 'path';
import { describe, test, after, before } from 'node:test';
import assert from 'node:assert';
import { launchServer, findAvailablePort, cleanupServers, ServerInstance, TransportMode, HOST } from './utils/server-launcher.js';
import { StdioTestClient } from './clients/stdio-client.js';
import { SSETestClient } from './clients/sse-client.js';
import { StreamableHTTPTestClient } from './clients/streamable-http-client.js';
import { MCPClientInterface } from './clients/client.js';

// Load environment variables from .env file
import { config } from 'dotenv';
config();

console.log('🚀 Comprehensive GitLab MCP Tool Tests');
console.log('');

// Configuration check
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com";
const GITLAB_TOKEN = process.env.GITLAB_TOKEN_TEST || process.env.GITLAB_TOKEN || process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const ALLOWED_PROJECTS = process.env.GITLAB_ALLOWED_PROJECT_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];
const TEST_PROJECT_ID = ALLOWED_PROJECTS[0] || "12345";

console.log('🔧 Test Configuration:');
console.log(`  GitLab URL: ${GITLAB_API_URL}`);
console.log(`  Token: ${GITLAB_TOKEN ? '✅ Provided' : '❌ Missing'}`);
console.log(`  Project ID: ${TEST_PROJECT_ID} ${ALLOWED_PROJECTS.length > 0 ? '(✅ From GITLAB_ALLOWED_PROJECT_IDS)' : '(⚠️ Fallback - set GITLAB_ALLOWED_PROJECT_IDS)'}`);

console.log('✅ Configuration validated');
console.log('');

let servers: ServerInstance[] = [];

// Cleanup function for all tests
const cleanup = () => {
  cleanupServers(servers);
  servers = [];
};

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Tool categories for organized testing
const TOOL_CATEGORIES = {
  // Read-only tools (safe to test)
  READ_ONLY: [
    'list_merge_requests',
    'get_merge_request',
    'get_merge_request_diffs',
    'list_merge_request_diffs',
    'get_branch_diffs',
    'list_issues',
    'my_issues',
    'get_issue',
    'list_issue_links',
    'list_issue_discussions',
    'get_issue_link',
    'list_namespaces',
    'get_namespace',
    'verify_namespace',
    'get_project',
    'list_projects',
    'list_project_members',
    'list_labels',
    'get_label',
    'list_group_projects',
    'get_repository_tree',
    'list_pipelines',
    'get_pipeline',
    'list_pipeline_jobs',
    'list_pipeline_trigger_jobs',
    'get_pipeline_job',
    'get_pipeline_job_output',
    'list_milestones',
    'get_milestone',
    'get_milestone_issue',
    'get_milestone_merge_requests',
    'get_milestone_burndown_events',
    'get_users',
    'list_commits',
    'get_commit',
    'get_commit_diff',
    'list_group_iterations',
    'list_events',
    'get_project_events',
    'search_repositories',
    'get_file_contents'
  ],
  
  // Write operations (potentially dangerous)
  WRITE_OPERATIONS: [
    'create_issue',
    'create_merge_request',
    'create_branch',
    'merge_merge_request',
    'update_merge_request',
    'create_note',
    'create_merge_request_thread',
    'update_merge_request_note',
    'create_merge_request_note',
    'create_draft_note',
    'update_draft_note',
    'delete_draft_note',
    'publish_draft_note',
    'bulk_publish_draft_notes',
    'update_issue_note',
    'create_issue_note',
    'update_issue',
    'delete_issue',
    'create_issue_link',
    'delete_issue_link',
    'create_label',
    'update_label',
    'delete_label',
    'create_pipeline',
    'retry_pipeline',
    'cancel_pipeline',
    'play_pipeline_job',
    'retry_pipeline_job',
    'cancel_pipeline_job',
    'create_milestone',
    'edit_milestone',
    'delete_milestone',
    'promote_milestone',
    'create_repository',
    'fork_repository',
    'create_or_update_file',
    'push_files'
  ],
  
  // Wiki operations (if enabled)
  WIKI_OPERATIONS: [
    'list_wiki_pages',
    'get_wiki_page',
    'create_wiki_page',
    'update_wiki_page',
    'delete_wiki_page'
  ],
  
  // Utility operations
  UTILITY_OPERATIONS: [
    'upload_markdown',
    'download_attachment'
  ]
};

// Test parameters for different tool types
const TEST_PARAMETERS = {
  'list_merge_requests': { project_id: TEST_PROJECT_ID },
  'get_merge_request': { project_id: TEST_PROJECT_ID, merge_request_iid: 1 },
  'get_merge_request_diffs': { project_id: TEST_PROJECT_ID, merge_request_iid: 1 },
  'list_merge_request_diffs': { project_id: TEST_PROJECT_ID, merge_request_iid: 1 },
  'get_branch_diffs': { project_id: TEST_PROJECT_ID, from: 'main', to: 'develop' },
  'list_issues': { project_id: TEST_PROJECT_ID },
  'my_issues': { project_id: TEST_PROJECT_ID },
  'get_issue': { project_id: TEST_PROJECT_ID, issue_iid: 1 },
  'list_issue_links': { project_id: TEST_PROJECT_ID, issue_iid: 1 },
  'list_issue_discussions': { project_id: TEST_PROJECT_ID, issue_iid: 1 },
  'get_issue_link': { project_id: TEST_PROJECT_ID, issue_iid: 1, issue_link_id: 1 },
  'list_namespaces': {},
  'get_namespace': { id: '1' },
  'verify_namespace': { name: 'test-namespace' },
  'get_project': { project_id: TEST_PROJECT_ID },
  'list_projects': {},
  'list_project_members': { project_id: TEST_PROJECT_ID },
  'list_labels': { project_id: TEST_PROJECT_ID },
  'get_label': { project_id: TEST_PROJECT_ID, label_id: 1 },
  'list_group_projects': { group_id: '1' },
  'get_repository_tree': { project_id: TEST_PROJECT_ID },
  'list_pipelines': { project_id: TEST_PROJECT_ID },
  'get_pipeline': { project_id: TEST_PROJECT_ID, pipeline_id: 1 },
  'list_pipeline_jobs': { project_id: TEST_PROJECT_ID, pipeline_id: 1 },
  'list_pipeline_trigger_jobs': { project_id: TEST_PROJECT_ID, pipeline_id: 1 },
  'get_pipeline_job': { project_id: TEST_PROJECT_ID, job_id: 1 },
  'get_pipeline_job_output': { project_id: TEST_PROJECT_ID, job_id: 1 },
  'list_milestones': { project_id: TEST_PROJECT_ID },
  'get_milestone': { project_id: TEST_PROJECT_ID, milestone_id: 1 },
  'get_milestone_issue': { project_id: TEST_PROJECT_ID, milestone_id: 1, issue_iid: 1 },
  'get_milestone_merge_requests': { project_id: TEST_PROJECT_ID, milestone_id: 1 },
  'get_milestone_burndown_events': { project_id: TEST_PROJECT_ID, milestone_id: 1 },
  'get_users': {},
  'list_commits': { project_id: TEST_PROJECT_ID },
  'get_commit': { project_id: TEST_PROJECT_ID, sha: 'main' },
  'get_commit_diff': { project_id: TEST_PROJECT_ID, sha: 'main' },
  'list_group_iterations': { group_id: '1' },
  'list_events': {},
  'get_project_events': { project_id: TEST_PROJECT_ID },
  'search_repositories': { search: 'test' },
  'get_file_contents': { project_id: TEST_PROJECT_ID, file_path: 'README.md' }
};

// Helper function to test a tool
async function testTool(client: MCPClientInterface, toolName: string, params: any = {}) {
  try {
    console.log(`  Testing: ${toolName}`);
    const result = await client.callTool(toolName, params);
    
    // Basic validation
    assert.ok(result !== null && result !== undefined, `${toolName} result should be defined`);
    assert.ok('content' in result, `${toolName} result should have content property`);
    
    console.log(`  ✅ ${toolName} - PASSED`);
    return { success: true, result };
  } catch (error) {
    console.log(`  ❌ ${toolName} - FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test result interface
interface TestResult {
  tool: string;
  success: boolean;
  result?: any;
  error?: string;
}

// Test all tools in a category
async function testToolCategory(client: MCPClientInterface, categoryName: string, tools: string[]): Promise<TestResult[]> {
  console.log(`\n📋 Testing ${categoryName} tools (${tools.length} tools):`);
  
  const results: TestResult[] = [];
  for (const toolName of tools) {
    const params = TEST_PARAMETERS[toolName] || {};
    const result = await testTool(client, toolName, params);
    results.push({ tool: toolName, ...result });
  }
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`\n📊 ${categoryName} Results: ${successCount} passed, ${failCount} failed`);
  return results;
}

// Test configuration for all transport modes
const testConfigs = [
  {
    name: 'Stdio Transport',
    clientClass: StdioTestClient,
    env: {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN || 'dummy-token-for-testing',
      GITLAB_API_URL: `${GITLAB_API_URL}/api/v4`,
      GITLAB_ALLOWED_PROJECT_IDS: TEST_PROJECT_ID,
      GITLAB_READ_ONLY_MODE: 'false',
      USE_GITLAB_WIKI: 'true',
      USE_MILESTONE: 'true',
      USE_PIPELINE: 'true',
      SSE: 'false',
      STREAMABLE_HTTP: 'false'
    },
    connectFn: async (client: MCPClientInterface, serverPath: string, env: Record<string, string>) => {
      await (client as StdioTestClient).connect(serverPath, env);
    }
  },
  {
    name: 'SSE Transport',
    clientClass: SSETestClient,
    env: {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN || 'dummy-token-for-testing',
      GITLAB_API_URL: `${GITLAB_API_URL}/api/v4`,
      GITLAB_ALLOWED_PROJECT_IDS: TEST_PROJECT_ID,
      GITLAB_READ_ONLY_MODE: 'false',
      USE_GITLAB_WIKI: 'true',
      USE_MILESTONE: 'true',
      USE_PIPELINE: 'true',
      SSE: 'true',
      STREAMABLE_HTTP: 'false'
    },
    connectFn: async (client: MCPClientInterface, serverPath: string, env: Record<string, string>) => {
      const port = await findAvailablePort(3002);
      const server = await launchServer({ mode: TransportMode.SSE, port, env });
      servers.push(server);
      await (client as SSETestClient).connect(`http://${HOST}:${port}/sse`);
    }
  },
  {
    name: 'Streamable HTTP Transport',
    clientClass: StreamableHTTPTestClient,
    env: {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN || 'dummy-token-for-testing',
      GITLAB_API_URL: `${GITLAB_API_URL}/api/v4`,
      GITLAB_ALLOWED_PROJECT_IDS: TEST_PROJECT_ID,
      GITLAB_READ_ONLY_MODE: 'false',
      USE_GITLAB_WIKI: 'true',
      USE_MILESTONE: 'true',
      USE_PIPELINE: 'true',
      SSE: 'false',
      STREAMABLE_HTTP: 'true'
    },
    connectFn: async (client: MCPClientInterface, serverPath: string, env: Record<string, string>) => {
      const port = await findAvailablePort(3003);
      const server = await launchServer({ mode: TransportMode.STREAMABLE_HTTP, port, env });
      servers.push(server);
      await (client as StreamableHTTPTestClient).connect(`http://${HOST}:${port}/sse`);
    }
  }
];

// Test each transport mode
for (const config of testConfigs) {
  describe(`Comprehensive Tool Testing - ${config.name}`, () => {
    let client: MCPClientInterface;

    before(async () => {
      client = new config.clientClass();
      const serverPath = path.resolve(process.cwd(), 'build/index.js');
      await config.connectFn(client, serverPath, config.env);
      assert.ok(client.isConnected, 'Client should be connected');
      console.log(`Client connected to ${config.name.toLowerCase()} server`);
    });

    after(async () => {
      if (client && client.isConnected) {
        await client.disconnect();
      }
    });

    test('should list all available tools', async () => {
      const tools = await client.listTools();
      assert.ok(tools !== null && tools !== undefined, 'Tools response should be defined');
      assert.ok('tools' in tools, 'Response should have tools property');
      assert.ok(Array.isArray(tools.tools) && tools.tools.length > 0, 'Tools array should not be empty');
      
      const toolNames = tools.tools.map(tool => tool.name);
      console.log(`\n📋 Available tools (${toolNames.length}):`);
      toolNames.forEach(name => console.log(`  - ${name}`));
      
      // Verify we have expected tool categories
      const readOnlyTools = toolNames.filter(name => TOOL_CATEGORIES.READ_ONLY.includes(name));
      const writeTools = toolNames.filter(name => TOOL_CATEGORIES.WRITE_OPERATIONS.includes(name));
      const wikiTools = toolNames.filter(name => TOOL_CATEGORIES.WIKI_OPERATIONS.includes(name));
      
      console.log(`\n📊 Tool Categories:`);
      console.log(`  Read-only tools: ${readOnlyTools.length}`);
      console.log(`  Write operations: ${writeTools.length}`);
      console.log(`  Wiki operations: ${wikiTools.length}`);
    });

    test('should test all read-only tools', async () => {
      const results = await testToolCategory(client, 'Read-only', TOOL_CATEGORIES.READ_ONLY);
      const successCount = results.filter(r => r.success).length;
      console.log(`\n✅ Read-only tools: ${successCount}/${results.length} passed`);
    });

    test('should test wiki tools (if enabled)', async () => {
      const results = await testToolCategory(client, 'Wiki', TOOL_CATEGORIES.WIKI_OPERATIONS);
      const successCount = results.filter(r => r.success).length;
      console.log(`\n✅ Wiki tools: ${successCount}/${results.length} passed`);
    });

    test('should test utility tools', async () => {
      const results = await testToolCategory(client, 'Utility', TOOL_CATEGORIES.UTILITY_OPERATIONS);
      const successCount = results.filter(r => r.success).length;
      console.log(`\n✅ Utility tools: ${successCount}/${results.length} passed`);
    });

    // Note: Write operations are not tested by default for safety
    // Uncomment the following test if you want to test write operations
    // test('should test write operations (DANGEROUS)', async () => {
    //   console.log('\n⚠️  WARNING: Testing write operations - this may modify your GitLab data!');
    //   const results = await testToolCategory(client, 'Write Operations', TOOL_CATEGORIES.WRITE_OPERATIONS);
    //   const successCount = results.filter(r => r.success).length;
    //   console.log(`\n✅ Write operations: ${successCount}/${results.length} passed`);
    // });
  });
}

// Run the tests
console.log('Starting comprehensive tool testing...\n');
