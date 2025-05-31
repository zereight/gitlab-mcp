import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testListTools() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env: {
      ...process.env,
      GITLAB_API_URL: 'http://gitlab.agodadev.io/api/v4',
      GITLAB_PERSONAL_ACCESS_TOKEN: 'BXz2RUsdvggHkypZsfsW'
    }
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // List all tools
    console.log('\n📋 Listing all available tools...');
    const result = await client.request({
      method: 'tools/list',
      params: {}
    });

    console.log('Available tools:');
    result.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name} - ${tool.description}`);
    });

    // Check if get_vulnerability_by_id exists
    const vulnerabilityTool = result.tools.find(t => t.name === 'get_vulnerability_by_id');
    if (vulnerabilityTool) {
      console.log('\n✅ get_vulnerability_by_id tool found!');
      console.log('Schema:', JSON.stringify(vulnerabilityTool.inputSchema, null, 2));
    } else {
      console.log('\n❌ get_vulnerability_by_id tool NOT found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

testListTools(); 