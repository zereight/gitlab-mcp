#!/usr/bin/env node

// Test the mr_notes tool with real GitLab API call for MR #3324
import { spawn } from 'child_process';

const child = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    GITLAB_PERSONAL_ACCESS_TOKEN: 'BXz2RUsdvggHkypZsfsW',
    GITLAB_API_URL: 'https://gitlab.agodadev.io'
  }
});

// Test the mr_notes tool with MR #3324
const testRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "mr_notes",
    arguments: {
      project_id: "connectivity/jtb-downloader",
      merge_request_iid: 3324
    }
  }
};

console.log('Testing mr_notes tool with MR #3324...');
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
        if (response.id === 2) {
          console.log('\n=== MR Notes Tool Test Results ===');
          
          if (response.error) {
            console.log('❌ Error occurred:');
            console.log(JSON.stringify(response.error, null, 2));
          } else if (response.result) {
            console.log('✅ Tool executed successfully!');
            
            const notes = JSON.parse(response.result.content[0].text);
            console.log(`\nFound ${notes.length} unresolved diff notes:`);
            
            if (notes.length > 0) {
              notes.forEach((note, index) => {
                console.log(`\n--- Note ${index + 1} ---`);
                console.log(`ID: ${note.id}`);
                console.log(`Type: ${note.type}`);
                console.log(`Author: ${note.author.name} (@${note.author.username})`);
                console.log(`Created: ${note.created_at}`);
                console.log(`Resolvable: ${note.resolvable}`);
                console.log(`Resolved: ${note.resolved}`);
                console.log(`Body: ${note.body.substring(0, 100)}${note.body.length > 100 ? '...' : ''}`);
                
                if (note.position) {
                  console.log(`File: ${note.position.new_path || note.position.old_path}`);
                  console.log(`Line: ${note.position.new_line || note.position.old_line}`);
                }
              });
            } else {
              console.log('✅ No unresolved diff notes found - all comments are resolved!');
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

// Timeout after 10 seconds
setTimeout(() => {
  console.log('❌ Timeout - killing process');
  child.kill();
  process.exit(1);
}, 10000); 