#!/usr/bin/env node

// Comprehensive test to find vulnerabilities with "resolved_on_default_branch": false
import { spawn } from 'child_process';

const child = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    GITLAB_PERSONAL_ACCESS_TOKEN: 'BXz2RUsdvggHkypZsfsW',
    GITLAB_API_URL: 'https://gitlab.agodadev.io'
  }
});

// Test with different states to find unresolved vulnerabilities
const testRequest = {
  jsonrpc: "2.0",
  id: 5,
  method: "tools/call",
  params: {
    name: "list_vulnerabilities",
    arguments: {
      project_id: "connectivity/jtb-downloader",
      per_page: 100,
      state: "detected"  // Try specifically "detected" state which might have unresolved ones
    }
  }
};

console.log('Searching for vulnerabilities in "detected" state...');
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
        if (response.id === 5) {
          console.log('\n=== All States Vulnerability Search Results ===');
          
          if (response.error) {
            console.log('❌ Error occurred:');
            console.log(JSON.stringify(response.error, null, 2));
          } else if (response.result) {
            console.log('✅ Tool executed successfully!');
            
            const vulnerabilities = JSON.parse(response.result.content[0].text);
            console.log(`\nVulnerabilities in "detected" state: ${vulnerabilities.length}`);
            
            // Analyze the resolved_on_default_branch distribution
            const resolvedTrue = vulnerabilities.filter(v => v.resolved_on_default_branch === true);
            const resolvedFalse = vulnerabilities.filter(v => v.resolved_on_default_branch === false);
            const resolvedUndefined = vulnerabilities.filter(v => v.resolved_on_default_branch === undefined);
            
            console.log(`\nResolution Status Breakdown:`);
            console.log(`- resolved_on_default_branch: true = ${resolvedTrue.length}`);
            console.log(`- resolved_on_default_branch: false = ${resolvedFalse.length}`);
            console.log(`- resolved_on_default_branch: undefined = ${resolvedUndefined.length}`);
            
            // Show different states
            const stateGroups = {};
            vulnerabilities.forEach(v => {
              stateGroups[v.state] = (stateGroups[v.state] || 0) + 1;
            });
            
            console.log(`\nState Distribution:`);
            Object.entries(stateGroups).forEach(([state, count]) => {
              console.log(`- ${state}: ${count}`);
            });
            
            // If we have unresolved ones, show them
            if (resolvedFalse.length > 0) {
              console.log(`\n🔍 Found ${resolvedFalse.length} unresolved vulnerabilities:`);
              resolvedFalse.slice(0, 5).forEach((vuln, index) => {
                console.log(`\n--- Unresolved Vulnerability ${index + 1} ---`);
                console.log(`ID: ${vuln.id}`);
                console.log(`Title: ${vuln.title}`);
                console.log(`Severity: ${vuln.severity}`);
                console.log(`State: ${vuln.state}`);
                console.log(`Report Type: ${vuln.report_type}`);
                console.log(`Resolved on Default Branch: ${vuln.resolved_on_default_branch}`);
                console.log(`Project Default Branch: ${vuln.project_default_branch || 'undefined'}`);
                
                if (vuln.finding && vuln.finding.location) {
                  console.log(`File: ${vuln.finding.location.file}`);
                  if (vuln.finding.location.start_line) {
                    console.log(`Line: ${vuln.finding.location.start_line}`);
                  }
                }
              });
            } else {
              console.log(`\n📋 No vulnerabilities with resolved_on_default_branch: false found.`);
              console.log(`\nThis suggests that:`);
              console.log(`1. All vulnerabilities have been resolved on the default branch`);
              console.log(`2. Or the project has very good security practices`);
              console.log(`3. Or vulnerabilities are being actively managed`);
              
              // Show a sample to verify the data structure
              if (vulnerabilities.length > 0) {
                const sample = vulnerabilities[0];
                console.log(`\n📋 Sample vulnerability structure:`);
                console.log(`ID: ${sample.id}`);
                console.log(`State: ${sample.state}`);
                console.log(`Resolved on Default Branch: ${sample.resolved_on_default_branch}`);
                console.log(`Project Default Branch: ${sample.project_default_branch || 'undefined'}`);
                console.log(`Created: ${sample.created_at}`);
                console.log(`Updated: ${sample.updated_at}`);
              }
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