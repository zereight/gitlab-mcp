/**
 * GitLab Projects & Repository Management Tools
 */

import { callMCPTool } from "../callMCPTool.js";
import type { GitLabProject, SearchRepositoriesInput } from "../types.js";

/**
 * Search for GitLab projects
 *
 * Data filtering: Search and filter in execution environment
 *
 * @example
 * ```typescript
 * const projects = await searchRepositories({
 *   query: 'my-app',
 *   visibility: 'private',
 *   orderBy: 'last_activity_at',
 *   sort: 'desc'
 * });
 *
 * // Filter to only recently active projects
 * const activeProjects = projects.filter(p => {
 *   const daysSinceUpdate = (Date.now() - new Date(p.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
 *   return daysSinceUpdate < 30;
 * });
 * ```
 */
export async function searchRepositories(
  input: SearchRepositoriesInput
): Promise<GitLabProject[]> {
  return callMCPTool<GitLabProject[]>("search_repositories", input);
}

/**
 * Create a new GitLab project
 *
 * @example
 * ```typescript
 * const project = await createRepository({
 *   name: 'my-new-project',
 *   description: 'A new project',
 *   visibility: 'private',
 *   initialize_with_readme: true
 * });
 * console.log(`Created project: ${project.web_url}`);
 * ```
 */
export async function createRepository(input: {
  name: string;
  path?: string;
  namespaceId?: string;
  description?: string;
  visibility?: "private" | "internal" | "public";
  initialize_with_readme?: boolean;
  default_branch?: string;
}): Promise<GitLabProject> {
  return callMCPTool<GitLabProject>("create_repository", input);
}

/**
 * Get project details
 */
export async function getProject(
  projectIdOrPath: string
): Promise<GitLabProject> {
  return callMCPTool<GitLabProject>("get_project", {
    projectId: projectIdOrPath,
  });
}

/**
 * List projects accessible by current user
 */
export async function listProjects(input?: {
  visibility?: "private" | "internal" | "public";
  owned?: boolean;
  membership?: boolean;
  starred?: boolean;
  orderBy?: string;
  sort?: "asc" | "desc";
  perPage?: number;
  page?: number;
}): Promise<GitLabProject[]> {
  return callMCPTool<GitLabProject[]>("list_projects", input || {});
}

/**
 * Fork a repository
 *
 * @example
 * ```typescript
 * const fork = await forkRepository({
 *   projectId: '123',
 *   namespace: 'my-namespace'
 * });
 * console.log(`Forked to: ${fork.web_url}`);
 * ```
 */
export async function forkRepository(input: {
  projectId: string;
  namespace?: string;
  path?: string;
  name?: string;
}): Promise<GitLabProject> {
  return callMCPTool<GitLabProject>("fork_repository", input);
}

/**
 * List project members
 */
export async function listProjectMembers(
  projectId: string
): Promise<any[]> {
  return callMCPTool<any[]>("list_project_members", {
    projectId,
  });
}

/**
 * List namespaces available to current user
 */
export async function listNamespaces(): Promise<any[]> {
  return callMCPTool<any[]>("list_namespaces", {});
}

/**
 * Get namespace details
 */
export async function getNamespace(
  namespaceIdOrPath: string
): Promise<any> {
  return callMCPTool("get_namespace", {
    namespaceId: namespaceIdOrPath,
  });
}

/**
 * Verify if a namespace path exists
 */
export async function verifyNamespace(
  path: string
): Promise<{ exists: boolean }> {
  return callMCPTool<{ exists: boolean }>("verify_namespace", {
    path,
  });
}
