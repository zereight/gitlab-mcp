#!/usr/bin/env tsx
/**
 * Basic Usage Example - GitLab MCP Code Execution
 *
 * This example demonstrates the fundamental pattern of using
 * GitLab MCP with code execution for efficient tool orchestration.
 *
 * Run: tsx servers/examples/basic-usage.ts
 */

import { setupGitLab, gitlab, closeMCPClient } from '../gitlab/index.js';

async function main() {
  console.log('🚀 GitLab MCP Code Execution - Basic Usage\n');

  // Initialize MCP client (call once at startup)
  await setupGitLab();

  // Example project ID - replace with your actual project ID
  const PROJECT_ID = process.env.GITLAB_PROJECT_ID || '123';

  try {
    // 1. Create an issue
    console.log('1️⃣ Creating issue...');
    const issue = await gitlab.issues.createIssue({
      projectId: PROJECT_ID,
      title: 'Example: Code execution with MCP',
      description: `This issue was created using the code execution pattern.

## Benefits
- Progressive tool loading
- In-environment data processing
- Native control flow
- 98.7% token savings`,
      labels: ['example', 'automation']
    });
    console.log(`✓ Created issue #${issue.iid}: ${issue.web_url}\n`);

    // 2. Create a branch
    console.log('2️⃣ Creating branch...');
    const branch = await gitlab.branches.createBranch({
      projectId: PROJECT_ID,
      branchName: `example/code-execution-${Date.now()}`,
      ref: 'main'
    });
    console.log(`✓ Created branch: ${branch.name}\n`);

    // 3. Create a file
    console.log('3️⃣ Creating file...');
    await gitlab.files.createOrUpdateFile({
      projectId: PROJECT_ID,
      filePath: 'EXAMPLE.md',
      content: '# Code Execution Example\n\nThis file was created using GitLab MCP code execution.',
      branch: branch.name,
      commitMessage: 'docs: add code execution example'
    });
    console.log('✓ Created file: EXAMPLE.md\n');

    // 4. Create merge request
    console.log('4️⃣ Creating merge request...');
    const mr = await gitlab.mergeRequests.createMergeRequest({
      projectId: PROJECT_ID,
      sourceBranch: branch.name,
      targetBranch: 'main',
      title: 'Example: Add code execution demo',
      description: `Closes #${issue.iid}\n\nThis MR demonstrates the code execution pattern.`,
      removeSourceBranch: true
    });
    console.log(`✓ Created MR !${mr.iid}: ${mr.web_url}\n`);

    console.log('✅ Demo completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    // Clean up MCP client connection
    await closeMCPClient();
  }
}

main();
