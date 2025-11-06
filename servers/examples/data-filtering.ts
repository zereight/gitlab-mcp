#!/usr/bin/env tsx
/**
 * Data Filtering Example - Process large datasets in execution environment
 *
 * This example shows how to fetch large datasets and process them locally,
 * returning only summaries to the model - achieving significant token savings.
 *
 * Run: tsx servers/examples/data-filtering.ts
 */

import { setupGitLab, gitlab, closeMCPClient } from '../gitlab/index.js';

async function main() {
  console.log('📊 GitLab MCP - Data Filtering Example\n');

  await setupGitLab();

  const PROJECT_ID = process.env.GITLAB_PROJECT_ID || '123';

  try {
    // Fetch all open issues (potentially large dataset)
    console.log('Fetching all open issues...');
    const issues = await gitlab.issues.listIssues({
      projectId: PROJECT_ID,
      state: 'opened',
      perPage: 100
    });
    console.log(`✓ Fetched ${issues.length} open issues\n`);

    // ⚡ Key benefit: Process data in execution environment
    // This filtering happens locally - doesn't pass all data through model

    // Analyze by labels
    const labelStats = new Map<string, number>();
    for (const issue of issues) {
      if (issue.labels) {
        for (const label of issue.labels) {
          labelStats.set(label, (labelStats.get(label) || 0) + 1);
        }
      }
    }

    // Analyze by author
    const authorStats = new Map<string, number>();
    for (const issue of issues) {
      const author = issue.author.username;
      authorStats.set(author, (authorStats.get(author) || 0) + 1);
    }

    // Find issues without assignees
    const unassignedIssues = issues.filter(
      issue => !issue.assignees || issue.assignees.length === 0
    );

    // Find stale issues (no updates in 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const staleIssues = issues.filter(issue => {
      const updatedAt = new Date(issue.updated_at).getTime();
      return updatedAt < thirtyDaysAgo;
    });

    // 📈 Output summary (not full data)
    console.log('📊 Issue Analysis:');
    console.log(`Total open issues: ${issues.length}`);
    console.log(`Unassigned issues: ${unassignedIssues.length}`);
    console.log(`Stale issues (30+ days): ${staleIssues.length}\n`);

    console.log('🏷️  Top Labels:');
    const sortedLabels = Array.from(labelStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [label, count] of sortedLabels) {
      console.log(`  ${label}: ${count}`);
    }

    console.log('\n👥 Top Authors:');
    const sortedAuthors = Array.from(authorStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [author, count] of sortedAuthors) {
      console.log(`  ${author}: ${count}`);
    }

    // ⚡ Token savings: Instead of passing ~150k tokens of issue data,
    // we only return this small summary (~500 tokens) - 99.7% savings!

    console.log('\n✅ Analysis complete - only summary data returned to model');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeMCPClient();
  }
}

main();
