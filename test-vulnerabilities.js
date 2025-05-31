#!/usr/bin/env node

// Test the list_vulnerabilities tool with real GitLab API call for the connectivity/jtb-downloader project
import { spawn } from 'child_process';

const child = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    GITLAB_PERSONAL_ACCESS_TOKEN: 'BXz2RUsdvggHkypZsfsW',
    GITLAB_API_URL: 'https://gitlab.agodadev.io'
  }
});

// Test the list_vulnerabilities tool with connectivity/jtb-downloader project
const testRequest = {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "list_vulnerabilities",
    arguments: {
      project_id: "connectivity/jtb-downloader",
      per_page: 20,
      state: "detected",
      severity: "critical"
    }
  }
};

console.log('Testing list_vulnerabilities tool with connectivity/jtb-downloader project...');
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
        if (response.id === 3) {
          console.log('\n=== List Vulnerabilities Tool Test Results ===');
          
          if (response.error) {
            console.log('❌ Error occurred:');
            console.log(JSON.stringify(response.error, null, 2));
          } else if (response.result) {
            console.log('✅ Tool executed successfully!');
            
            const vulnerabilities = JSON.parse(response.result.content[0].text);
            console.log(`\nFound ${vulnerabilities.length} vulnerabilities:`);
            
            if (vulnerabilities.length > 0) {
              vulnerabilities.forEach((vuln, index) => {
                console.log(`\n--- Vulnerability ${index + 1} ---`);
                console.log(`ID: ${vuln.id}`);
                console.log(`Title: ${vuln.title}`);
                console.log(`Severity: ${vuln.severity}`);
                console.log(`State: ${vuln.state}`);
                console.log(`Report Type: ${vuln.report_type}`);
                console.log(`Confidence: ${vuln.confidence}`);
                console.log(`Created: ${vuln.created_at}`);
                console.log(`Updated: ${vuln.updated_at}`);
                console.log(`Resolved on Default Branch: ${vuln.resolved_on_default_branch}`);
                
                if (vuln.finding && vuln.finding.location) {
                  console.log(`File: ${vuln.finding.location.file}`);
                  console.log(`Line: ${vuln.finding.location.start_line}`);
                }
                
                if (vuln.description) {
                  console.log(`Description: ${vuln.description.substring(0, 100)}${vuln.description.length > 100 ? '...' : ''}`);
                }
              });
            } else {
              console.log('ℹ️ No vulnerabilities found matching the criteria');
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

// Timeout after 15 seconds
setTimeout(() => {
  console.log('❌ Timeout - killing process');
  child.kill();
  process.exit(1);
}, 15000); 