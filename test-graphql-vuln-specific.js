import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testGraphQLVulnerability() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
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

    // Test GraphQL vulnerability by ID
    console.log('\n📊 Testing GraphQL get_vulnerability_by_id for ID 12094621...');
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'get_vulnerability_by_id',
        arguments: {
          project_id: 'connectivity/jtb-downloader',
          vulnerability_id: '12094621'
        }
      }
    });

    console.log('✅ GraphQL Vulnerability Result:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('GraphQL Error')) {
      console.error('This is a GraphQL API error - check the query structure');
    }
  } finally {
    await client.close();
  }
}

testGraphQLVulnerability(); 