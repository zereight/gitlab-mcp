/**
 * GitLab MCP Code Execution API
 *
 * This module provides a code-first interface to GitLab MCP tools,
 * enabling efficient tool orchestration with:
 *
 * - Progressive Disclosure: Load tool definitions on-demand
 * - Data Filtering: Process large datasets in execution environment
 * - Control Flow: Use native TypeScript loops, conditionals, error handling
 * - Privacy Preservation: Keep intermediate results in execution environment
 * - State Persistence: Maintain state across operations
 *
 * ## Token Efficiency
 * Traditional MCP loads all tool definitions into context (~150k tokens).
 * This approach loads tools progressively, achieving 98.7% token savings.
 *
 * @see https://www.anthropic.com/engineering/code-execution-with-mcp
 */

// Core utilities
export {
  callMCPTool,
  initializeMCPClient,
  closeMCPClient,
  searchTools,
} from "./callMCPTool.js";

// Type definitions
export * from "./types.js";

// Tool modules - progressive loading
export * from "./tools/issues.js";
export * from "./tools/mergeRequests.js";
export * from "./tools/files.js";
export * from "./tools/branches.js";
export * from "./tools/projects.js";

// Re-export everything for convenience
import * as issues from "./tools/issues.js";
import * as mergeRequests from "./tools/mergeRequests.js";
import * as files from "./tools/files.js";
import * as branches from "./tools/branches.js";
import * as projects from "./tools/projects.js";

/**
 * Organized tool namespaces for cleaner imports
 *
 * @example
 * ```typescript
 * import { gitlab } from './servers/gitlab';
 *
 * // Use namespaced API
 * const issue = await gitlab.issues.create({
 *   projectId: '123',
 *   title: 'Bug report'
 * });
 *
 * const mr = await gitlab.mergeRequests.create({
 *   projectId: '123',
 *   sourceBranch: 'feature',
 *   targetBranch: 'main',
 *   title: 'Add feature'
 * });
 * ```
 */
export const gitlab = {
  issues,
  mergeRequests,
  files,
  branches,
  projects,
};

/**
 * Helper: Initialize and setup MCP client with environment variables
 *
 * Call this at the start of your script:
 *
 * @example
 * ```typescript
 * import { setupGitLab, closeMCPClient } from './servers/gitlab';
 *
 * await setupGitLab();
 *
 * // Use GitLab tools...
 *
 * await closeMCPClient(); // Clean up when done
 * ```
 */
export async function setupGitLab() {
  const { initializeMCPClient } = await import("./callMCPTool.js");
  await initializeMCPClient();
}
