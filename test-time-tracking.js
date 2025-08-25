#!/usr/bin/env node

// Test script for Time Tracking functionality
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set environment variables
process.env.GITLAB_PERSONAL_ACCESS_TOKEN = 'glpat-Kz5k0wGIn-H7ZGyd5Ea9Om86MQp1OjZoaGIK.01.100lj5xfz';
process.env.GITLAB_API_URL = 'https://gitlab.com/api/v4';
process.env.LOG_LEVEL = 'info';

console.log('🧪 Testing GitLab MCP Time Tracking Extensions...\n');

// Test 1: List available tools
console.log('📋 Test 1: Listing available tools...');
const listToolsMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list"
};

const serverPath = join(__dirname, 'build', 'index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  
  if (errorOutput) {
    console.log('📝 Server logs:');
    console.log(errorOutput);
  }
  
  if (output) {
    try {
      const response = JSON.parse(output);
      if (response.result && response.result.tools) {
        const timeTrackingTools = response.result.tools.filter(tool => 
          tool.name.includes('time') || 
          ['add_time_spent', 'get_time_tracking', 'update_time_estimate', 'list_time_entries', 'delete_time_entry'].includes(tool.name)
        );
        
        console.log(`✅ Found ${timeTrackingTools.length} Time Tracking tools:`);
        timeTrackingTools.forEach(tool => {
          console.log(`   - ${tool.name}: ${tool.description}`);
        });
      } else {
        console.log('❌ No tools found in response');
      }
    } catch (e) {
      console.log('❌ Failed to parse server response:', e.message);
      console.log('Raw output:', output);
    }
  } else {
    console.log('❌ No output received from server');
  }
});

// Send the request
server.stdin.write(JSON.stringify(listToolsMessage) + '\n');
server.stdin.end();

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - killing server');
  server.kill();
}, 10000);