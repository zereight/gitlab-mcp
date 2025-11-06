#!/usr/bin/env tsx
/**
 * Complex Workflow Example - Build reusable automation
 *
 * This example shows how to compose multiple tools into
 * sophisticated workflows with state management.
 *
 * Run: tsx servers/examples/complex-workflow.ts
 */

import { setupGitLab, gitlab, callMCPTool, closeMCPClient } from '../gitlab/index.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Automated release workflow
 */
async function createReleaseWorkflow(
  projectId: string,
  version: string
) {
  console.log(`\n🚀 Creating release workflow for v${version}...`);

  const results = {
    branch: '',
    mergeRequest: '',
    milestone: ''
  };

  // 1. Create release branch
  console.log('\n1️⃣ Creating release branch...');
  const branch = await gitlab.branches.createBranch({
    projectId,
    branchName: `release/${version}`,
    ref: 'main'
  });
  results.branch = branch.web_url;
  console.log(`✓ Branch: ${branch.name}`);

  // 2. Update version files
  console.log('\n2️⃣ Updating version files...');

  // Get current package.json
  const pkgJson = await gitlab.files.getFile(projectId, 'package.json', 'main');
  const pkg = JSON.parse(pkgJson);
  pkg.version = version;

  // Commit updated package.json
  await gitlab.files.updateFile(
    projectId,
    'package.json',
    JSON.stringify(pkg, null, 2),
    branch.name,
    `chore: bump version to ${version}`
  );
  console.log('✓ Updated package.json');

  // 3. Generate changelog
  console.log('\n3️⃣ Generating changelog...');
  const commits = await gitlab.branches.listCommits({
    projectId,
    ref: 'main',
    perPage: 50
  });

  // Group commits by type
  const changesByType = new Map<string, string[]>();
  for (const commit of commits) {
    const match = commit.title.match(/^(\w+)(?:\([^)]+\))?:/);
    if (match) {
      const type = match[1];
      if (!changesByType.has(type)) {
        changesByType.set(type, []);
      }
      changesByType.get(type)!.push(commit.title);
    }
  }

  // Build changelog content
  let changelog = `# Release ${version}\n\n`;
  changelog += `Released: ${new Date().toISOString().split('T')[0]}\n\n`;

  const typeLabels: Record<string, string> = {
    feat: '🎉 Features',
    fix: '🐛 Bug Fixes',
    docs: '📝 Documentation',
    perf: '⚡ Performance',
    refactor: '♻️  Refactoring',
    test: '✅ Tests',
    chore: '🔧 Chores'
  };

  for (const [type, changes] of changesByType.entries()) {
    const label = typeLabels[type] || type;
    changelog += `## ${label}\n\n`;
    for (const change of changes) {
      changelog += `- ${change}\n`;
    }
    changelog += '\n';
  }

  // Save changelog locally (state persistence)
  await fs.writeFile(`changelog-${version}.md`, changelog);
  console.log(`✓ Generated changelog (saved locally)`);

  // Commit changelog
  await gitlab.files.updateFile(
    projectId,
    'CHANGELOG.md',
    changelog,
    branch.name,
    `docs: update changelog for ${version}`
  );
  console.log('✓ Committed CHANGELOG.md');

  // 4. Create merge request
  console.log('\n4️⃣ Creating merge request...');
  const mr = await gitlab.mergeRequests.createMergeRequest({
    projectId,
    sourceBranch: branch.name,
    targetBranch: 'main',
    title: `Release v${version}`,
    description: `Automated release for version ${version}\n\n${changelog}`,
    labels: ['release'],
    removeSourceBranch: true
  });
  results.mergeRequest = mr.web_url;
  console.log(`✓ MR !${mr.iid}: ${mr.web_url}`);

  // 5. Create milestone
  console.log('\n5️⃣ Creating milestone...');
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
  const milestone = await callMCPTool('create_milestone', {
    projectId,
    title: `v${version}`,
    description: `Release milestone for version ${version}`,
    dueDate: dueDate.toISOString().split('T')[0]
  });
  results.milestone = milestone.web_url;
  console.log(`✓ Milestone: v${version}`);

  // 6. Link related issues to milestone
  console.log('\n6️⃣ Linking issues to milestone...');
  const issues = await gitlab.issues.listIssues({
    projectId,
    state: 'closed',
    labels: ['release-candidate'],
    perPage: 20
  });

  let linkedCount = 0;
  for (const issue of issues) {
    try {
      await gitlab.issues.updateIssue(projectId, issue.iid, {
        milestone: milestone.id
      });
      linkedCount++;
    } catch (error) {
      console.log(`⚠️  Could not link issue #${issue.iid}`);
    }
  }
  console.log(`✓ Linked ${linkedCount} issues to milestone`);

  return results;
}

/**
 * Cleanup workflow - close stale issues
 */
async function cleanupStaleIssues(
  projectId: string,
  daysThreshold: number = 90
) {
  console.log(`\n🧹 Cleanup: Finding issues stale for ${daysThreshold}+ days...`);

  const issues = await gitlab.issues.listIssues({
    projectId,
    state: 'opened',
    perPage: 100
  });

  const cutoffDate = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;
  const staleIssues = issues.filter(issue => {
    const updatedAt = new Date(issue.updated_at).getTime();
    return updatedAt < cutoffDate;
  });

  console.log(`Found ${staleIssues.length} stale issues`);

  for (const issue of staleIssues) {
    const daysOld = Math.floor(
      (Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log(`\nIssue #${issue.iid}: ${issue.title}`);
    console.log(`  Last updated: ${daysOld} days ago`);

    // Add warning comment
    await gitlab.issues.createIssueNote(
      projectId,
      issue.iid,
      `⚠️ This issue has been inactive for ${daysOld} days and will be closed soon if no activity.`
    );
    console.log('  ✓ Added warning comment');

    // Add stale label
    const newLabels = [...(issue.labels || []), 'stale'];
    await gitlab.issues.updateIssue(projectId, issue.iid, {
      labels: newLabels
    });
    console.log('  ✓ Added stale label');
  }

  return staleIssues;
}

async function main() {
  console.log('🏗️  GitLab MCP - Complex Workflow Example\n');

  await setupGitLab();

  const PROJECT_ID = process.env.GITLAB_PROJECT_ID || '123';

  try {
    // Demo 1: Release workflow
    console.log('=' .repeat(60));
    console.log('Demo 1: Automated Release Workflow');
    console.log('=' .repeat(60));

    const version = '1.0.0-example';
    const releaseResults = await createReleaseWorkflow(PROJECT_ID, version);

    console.log('\n✅ Release workflow complete!');
    console.log('Results:');
    console.log(`  Branch: ${releaseResults.branch}`);
    console.log(`  MR: ${releaseResults.mergeRequest}`);
    console.log(`  Milestone: ${releaseResults.milestone}`);

    // Demo 2: Cleanup workflow
    console.log('\n\n' + '='.repeat(60));
    console.log('Demo 2: Stale Issue Cleanup');
    console.log('='.repeat(60));

    const staleIssues = await cleanupStaleIssues(PROJECT_ID, 90);

    console.log(`\n✅ Cleanup complete! Processed ${staleIssues.length} stale issues`);

    console.log('\n\n🎉 Complex workflow demos complete!');
    console.log('\nKey benefits demonstrated:');
    console.log('  ✓ Composed multiple tools into workflows');
    console.log('  ✓ State persistence (saved changelog locally)');
    console.log('  ✓ Error handling and recovery');
    console.log('  ✓ Data processing in execution environment');
    console.log('  ✓ Native control flow (loops, conditionals)');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeMCPClient();
  }
}

main();
