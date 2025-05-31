#!/usr/bin/env node

// Test to find vulnerabilities with "resolved_on_default_branch": false
import { spawn } from 'child_process';

const child = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    GITLAB_PERSONAL_ACCESS_TOKEN: 'BXz2RUsdvggHkypZsfsW',
    GITLAB_API_URL: 'https://gitlab.agodadev.io'
  }
});

// Test without filters to get all vulnerabilities, then filter for unresolved ones
const testRequest = {
  jsonrpc: "2.0",
  id: 4,
  method: "tools/call",
  params: {
    name: "list_vulnerabilities",
    arguments: {
      project_id: "connectivity/jtb-downloader",
      per_page: 100  // Get more results to find unresolved ones
      // No state or severity filters to see all vulnerabilities
    }
  }
};

console.log('Looking for vulnerabilities with "resolved_on_default_branch": false...');
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
        if (response.id === 4) {
          console.log('\n=== Unresolved Vulnerabilities Search Results ===');
          
          if (response.error) {
            console.log('❌ Error occurred:');
            console.log(JSON.stringify(response.error, null, 2));
          } else if (response.result) {
            console.log('✅ Tool executed successfully!');
            
            const allVulnerabilities = JSON.parse(response.result.content[0].text);
            console.log(`\nTotal vulnerabilities found: ${allVulnerabilities.length}`);
            
            // Filter for unresolved vulnerabilities
            const unresolvedVulns = allVulnerabilities.filter(vuln => 
              vuln.resolved_on_default_branch === false
            );
            
            console.log(`\nUnresolved vulnerabilities (resolved_on_default_branch: false): ${unresolvedVulns.length}`);
            
            if (unresolvedVulns.length > 0) {
              unresolvedVulns.forEach((vuln, index) => {
                console.log(`\n--- Unresolved Vulnerability ${index + 1} ---`);
                console.log(`ID: ${vuln.id}`);
                console.log(`Title: ${vuln.title}`);
                console.log(`Severity: ${vuln.severity}`);
                console.log(`State: ${vuln.state}`);
                console.log(`Report Type: ${vuln.report_type}`);
                console.log(`Confidence: ${vuln.confidence}`);
                console.log(`Resolved on Default Branch: ${vuln.resolved_on_default_branch}`);
                console.log(`Created: ${vuln.created_at}`);
                console.log(`Updated: ${vuln.updated_at}`);
                
                if (vuln.finding && vuln.finding.location) {
                  console.log(`File: ${vuln.finding.location.file}`);
                  if (vuln.finding.location.start_line) {
                    console.log(`Line: ${vuln.finding.location.start_line}`);
                  }
                }
                
                if (vuln.description) {
                  console.log(`Description: ${vuln.description.substring(0, 150)}${vuln.description.length > 150 ? '...' : ''}`);
                }
              });
            } else {
              console.log('ℹ️ No unresolved vulnerabilities found');
              
              // Show some examples of resolved ones for comparison
              const resolvedVulns = allVulnerabilities.filter(vuln => 
                vuln.resolved_on_default_branch === true
              ).slice(0, 3);
              
              console.log(`\nFor comparison, here are 3 resolved vulnerabilities:`);
              resolvedVulns.forEach((vuln, index) => {
                console.log(`\n--- Resolved Example ${index + 1} ---`);
                console.log(`ID: ${vuln.id}`);
                console.log(`Title: ${vuln.title}`);
                console.log(`Severity: ${vuln.severity}`);
                console.log(`State: ${vuln.state}`);
                console.log(`Resolved on Default Branch: ${vuln.resolved_on_default_branch}`);
              });
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