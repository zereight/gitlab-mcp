#!/usr/bin/env node

// Test the mr_discussions tool with real GitLab API call for MR #3324
import { spawn } from 'child_process';

const child = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    GITLAB_PERSONAL_ACCESS_TOKEN: 'BXz2RUsdvggHkypZsfsW',
    GITLAB_API_URL: 'https://gitlab.agodadev.io'
  }
});

// Test the mr_discussions tool with MR #3336
const testRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "mr_discussions",
    arguments: {
      project_id: "connectivity/jtb-downloader",
      merge_request_iid: 3336
    }
  }
};

console.log('Testing mr_discussions tool with MR #3336 (with pagination support)...');
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
          console.log('\n=== MR Discussions Tool Test Results ===');
          
          if (response.error) {
            console.log('❌ Error occurred:');
            console.log(JSON.stringify(response.error, null, 2));
          } else if (response.result) {
            console.log('✅ Tool executed successfully!');
            
            const discussions = JSON.parse(response.result.content[0].text);
            console.log(`\nFound ${discussions.length} discussions:`);
            
            if (discussions.length > 0) {
              discussions.forEach((discussion, index) => {
                console.log(`\n--- Discussion ${index + 1} ---`);
                console.log(`ID: ${discussion.id}`);
                console.log(`Individual Note: ${discussion.individual_note}`);
                console.log(`Notes Count: ${discussion.notes.length}`);
                
                if (discussion.notes.length > 0) {
                  const firstNote = discussion.notes[0];
                  console.log(`First Note Author: ${firstNote.author.name} (@${firstNote.author.username})`);
                  console.log(`First Note Created: ${firstNote.created_at}`);
                  console.log(`First Note Body: ${firstNote.body.substring(0, 100)}${firstNote.body.length > 100 ? '...' : ''}`);
                  
                  if (firstNote.position) {
                    console.log(`File: ${firstNote.position.new_path || firstNote.position.old_path}`);
                    console.log(`Line: ${firstNote.position.new_line || firstNote.position.old_line}`);
                  }
                }
              });
            } else {
              console.log('ℹ️ No discussions found for this merge request');
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