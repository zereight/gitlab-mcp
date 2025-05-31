#!/usr/bin/env node

// Test to verify mr_discussions and mr_notes are both available
import { spawn } from 'child_process';

const child = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send a list tools request
const listToolsRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list"
};

child.stdin.write(JSON.stringify(listToolsRequest) + '\n');

let output = '';
child.stdout.on('data', (data) => {
  output += data.toString();
  
  // Look for the response
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        if (response.id === 1 && response.result) {
          const tools = response.result.tools;
          const toolNames = tools.map(t => t.name);
          
          console.log('Available tools:');
          toolNames.forEach(name => console.log(`  - ${name}`));
          
          console.log('\nVerification:');
          if (toolNames.includes('mr_notes')) {
            console.log('✅ mr_notes tool is available');
          } else {
            console.log('❌ mr_notes tool is missing');
          }
          
          if (toolNames.includes('mr_discussions')) {
            console.log('✅ mr_discussions tool is available');
          } else {
            console.log('❌ mr_discussions tool is missing');
          }
          
          child.kill();
          process.exit(0);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  }
});

child.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

child.on('close', (code) => {
  console.log('Process exited with code:', code);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('Timeout - killing process');
  child.kill();
  process.exit(1);
}, 5000); 