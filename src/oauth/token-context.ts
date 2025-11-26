/**
 * Token Context for OAuth
 *
 * Uses AsyncLocalStorage to provide per-request access to the authenticated
 * user's GitLab token without passing it through function parameters.
 *
 * This pattern allows existing code (like enhancedFetch) to automatically
 * use the correct token for the current request context.
 */

import { AsyncLocalStorage } from "async_hooks";
import { TokenContext } from "./types";

/**
 * AsyncLocalStorage instance for token context
 *
 * Stores the current request's token context, making it accessible
 * from any code running within the request without explicit passing.
 */
const asyncLocalStorage = new AsyncLocalStorage<TokenContext>();

/**
 * Run a function with a specific token context
 *
 * All code executed within the callback (including async operations)
 * will have access to the provided token context via getTokenContext().
 *
 * @param context - Token context for this request
 * @param fn - Function to execute with the context
 * @returns The return value of the function
 *
 * @example
 * ```typescript
 * await runWithTokenContext(
 *   { gitlabToken: 'xxx', gitlabUserId: 123, gitlabUsername: 'user', sessionId: 'abc' },
 *   async () => {
 *     // All code here can call getTokenContext() or getGitLabTokenFromContext()
 *     const projects = await listProjects();
 *   }
 * );
 * ```
 */
export function runWithTokenContext<T>(
  context: TokenContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Get the current token context
 *
 * Returns undefined if called outside of a runWithTokenContext() callback.
 * Use this when you need to optionally use the token context.
 *
 * @returns The current token context, or undefined if not in OAuth mode
 */
export function getTokenContext(): TokenContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the GitLab token from the current context
 *
 * Throws an error if called outside of a runWithTokenContext() callback.
 * Use this in OAuth mode when a token is required.
 *
 * @returns The GitLab access token for the current request
 * @throws Error if no token context is available
 */
export function getGitLabTokenFromContext(): string {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    throw new Error(
      "No OAuth token context available - this code must be called within an authenticated request"
    );
  }
  return context.gitlabToken;
}

/**
 * Get the GitLab user ID from the current context
 *
 * @returns The GitLab user ID, or undefined if not in OAuth context
 */
export function getGitLabUserIdFromContext(): number | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.gitlabUserId;
}

/**
 * Get the GitLab username from the current context
 *
 * @returns The GitLab username, or undefined if not in OAuth context
 */
export function getGitLabUsernameFromContext(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.gitlabUsername;
}

/**
 * Get the session ID from the current context
 *
 * @returns The session ID, or undefined if not in OAuth context
 */
export function getSessionIdFromContext(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.sessionId;
}

/**
 * Check if we're currently in an OAuth context
 *
 * @returns true if a token context is available
 */
export function isInOAuthContext(): boolean {
  return asyncLocalStorage.getStore() !== undefined;
}
