#!/usr/bin/env tsx
/**
 * Control Flow Example - Native TypeScript loops and conditionals
 *
 * This example demonstrates using native programming constructs
 * instead of chaining individual tool calls through the model.
 *
 * Run: tsx servers/examples/control-flow.ts
 */

import { setupGitLab, gitlab, closeMCPClient } from '../gitlab/index.js';

async function main() {
  console.log('🔄 GitLab MCP - Control Flow Example\n');

  await setupGitLab();

  const PROJECT_ID = process.env.GITLAB_PROJECT_ID || '123';

  try {
    // Fetch all open merge requests
    console.log('Fetching open merge requests...');
    const mrs = await gitlab.mergeRequests.listMergeRequests({
      projectId: PROJECT_ID,
      state: 'opened'
    });
    console.log(`✓ Found ${mrs.length} open MRs\n`);

    // Native control flow: loops, conditionals, error handling
    console.log('Processing merge requests...\n');

    for (const mr of mrs) {
      console.log(`\n📝 MR !${mr.iid}: ${mr.title}`);
      console.log(`   Source: ${mr.source_branch} → ${mr.target_branch}`);
      console.log(`   Status: ${mr.merge_status}`);
      console.log(`   State: ${mr.state}`);

      // Conditional logic
      if (mr.state !== 'opened') {
        console.log('   ⏭️  Skipping (not open)');
        continue;
      }

      // Check if ready to merge
      if (mr.merge_status === 'can_be_merged') {
        console.log('   ✅ Can be merged');

        // Get discussions to check for approval
        try {
          const discussions = await gitlab.mergeRequests.getMergeRequestDiscussions(
            PROJECT_ID,
            mr.iid
          );

          const hasUnresolvedThreads = discussions.some(
            (d: any) => !d.individual_note && d.notes.some((n: any) => n.resolvable && !n.resolved)
          );

          if (hasUnresolvedThreads) {
            console.log('   ⚠️  Has unresolved threads - skipping auto-merge');
          } else {
            console.log('   🎯 Ready for auto-merge!');

            // In a real scenario, you might auto-merge here:
            // await gitlab.mergeRequests.mergeMergeRequest({
            //   projectId: PROJECT_ID,
            //   mergeRequestIid: mr.iid,
            //   squash: true,
            //   removeSourceBranch: true
            // });
            // console.log('   ✓ Merged successfully');
          }
        } catch (error) {
          console.error('   ❌ Error checking discussions:', error);
          // Continue processing other MRs even if one fails
          continue;
        }
      } else {
        console.log(`   ⏸️  Cannot merge: ${mr.merge_status}`);
      }
    }

    // Another control flow example: batch processing
    console.log('\n\n📦 Batch Processing Example:');

    const staleLabels = ['stale', 'needs-update', 'waiting-for-response'];

    for (const label of staleLabels) {
      console.log(`\nProcessing label: ${label}`);

      const issues = await gitlab.issues.listIssues({
        projectId: PROJECT_ID,
        state: 'opened',
        labels: [label],
        perPage: 10
      });

      console.log(`  Found ${issues.length} issues`);

      // Process each issue
      for (const issue of issues) {
        // Check age
        const daysOld = Math.floor(
          (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysOld > 90) {
          console.log(`  Issue #${issue.iid}: ${daysOld} days old - consider closing`);

          // Could auto-close or add comment
          // await gitlab.issues.createIssueNote(
          //   PROJECT_ID,
          //   issue.iid,
          //   'This issue has been stale for 90+ days. Consider closing if no longer relevant.'
          // );
        }
      }
    }

    console.log('\n\n✅ Control flow demo complete!');
    console.log('Benefits: Native loops, conditionals, error handling, no chaining tool calls');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeMCPClient();
  }
}

main();
