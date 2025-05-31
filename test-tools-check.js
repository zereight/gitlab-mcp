#!/usr/bin/env node

// Test to check if tools are working and new GraphQL tool is available
import { spawn } from 'child_process';

const child = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    GITLAB_PERSONAL_ACCESS_TOKEN: 'BXz2RUsdvggHkypZsfsW',
    GITLAB_API_URL: 'https://gitlab.agodadev.io'
  }
});

// Test the tools list
const testRequest = {
  jsonrpc: "2.0",
  id: 8,
  method: "tools/list",
  params: {}
};

console.log('🔧 Testing tools list...');
console.log('Request:', JSON.stringify(testRequest, null, 2));

child.stdin.write(JSON.stringify(testRequest) + '\n');

let output = '';
child.stdout.on('data', (data) => {
  output += data.toString();
  
  // Look for the response
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        if (response.id === 8) {
          console.log('\n=== Tools List Results ===');
          
          if (response.error) {
            console.log('❌ Error occurred:');
            console.log(JSON.stringify(response.error, null, 2));
          } else if (response.result) {
            console.log('✅ Tools list executed successfully!');
            
            const tools = response.result.tools;
            console.log(`\nAvailable tools (${tools.length}):`);
            
            tools.forEach((tool, index) => {
              console.log(`${index + 1}. ${tool.name} - ${tool.description}`);
            });
            
            // Check if our new tool is available
            const vulnerabilityTool = tools.find(t => t.name === 'get_vulnerability_by_id');
            if (vulnerabilityTool) {
              console.log(`\n🎯 Found GraphQL vulnerability tool!`);
              console.log(`Name: ${vulnerabilityTool.name}`);
              console.log(`Description: ${vulnerabilityTool.description}`);
            } else {
              console.log(`\n❌ GraphQL vulnerability tool not found in tools list`);
            }
          }
          
          child.kill();
          process.exit(0);
        }
      } catch (e) {
        // Ignore JSON parse errors for non-JSON lines
      }
    }
  }
});

child.stderr.on('data', (data) => {
  const errorText = data.toString();
  if (!errorText.includes('GitLab MCP Server')) {
    console.error('Error:', errorText);
  }
});

child.on('close', (code) => {
  if (code !== 0) {
    console.log('Process exited with code:', code);
  }
});

// Timeout after 20 seconds
setTimeout(() => {
  console.log('❌ Timeout - killing process');
  child.kill();
  process.exit(1);
}, 20000); 