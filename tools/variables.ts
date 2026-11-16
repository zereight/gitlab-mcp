/**
 * Variables toolset: the project and group CI/CD variable tool handlers and the
 * GitLab API helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch,
 * GitLab error handling, and the project scope helpers) and hands it over once
 * with configureVariableTools(). The fetch is read at call time, since index.ts
 * replaces it when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  CreateGroupVariableSchema,
  CreateProjectVariableSchema,
  DeleteGroupVariableSchema,
  DeleteProjectVariableSchema,
  GetGroupVariableSchema,
  GetProjectVariableSchema,
  type GitLabCiVariable,
  GitLabCiVariableSchema,
  ListGroupVariablesSchema,
  ListProjectVariablesSchema,
  UpdateGroupVariableSchema,
  UpdateProjectVariableSchema,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { appendFilterParam } from "../utils/tool-args.js";
import { encodeGitLabPathSegment } from "../utils/url.js";

export interface VariableToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
  rejectIfProjectScopedDeployment: (toolName: string) => void;
}

let deps: VariableToolDeps | undefined;

export function configureVariableTools(next: VariableToolDeps): void {
  deps = next;
}

function requireDeps(): VariableToolDeps {
  if (!deps) {
    throw new Error("Variable tools used before configureVariableTools()");
  }
  return deps;
}

const fetch: FetchFn = (input, init) => requireDeps().getFetch()(input, init);

function handleGitLabError(response: UndiciResponse): Promise<void> {
  return requireDeps().handleGitLabError(response);
}

function getEffectiveProjectId(projectId: string): string {
  return requireDeps().getEffectiveProjectId(projectId);
}

function rejectIfProjectScopedDeployment(toolName: string): void {
  requireDeps().rejectIfProjectScopedDeployment(toolName);
}

export interface VariableToolCallParams {
  name: string;
  arguments: unknown;
}

export interface VariableToolResult {
  content: Array<{ type: "text"; text: string }>;
}

// --- CI/CD Variables ---

async function listProjectVariables(
  projectId: string,
  options: Omit<z.infer<typeof ListProjectVariablesSchema>, "project_id"> = {}
): Promise<GitLabCiVariable[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/variables`
  );
  Object.entries(options).forEach(([key, value]) => {
    if (key === "filter" && typeof value === "object" && value !== null) {
      Object.entries(value as Record<string, unknown>).forEach(([filterKey, filterValue]) => {
        appendFilterParam(url.searchParams, `filter[${filterKey}]`, filterValue);
      });
      return;
    }

    appendFilterParam(url.searchParams, key, value);
  });
  const response = await fetch(url.toString(), getFetchConfig());
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabCiVariableSchema).parse(data);
}

async function getProjectVariable(
  projectId: string,
  key: string,
  filter?: { environment_scope: string }
): Promise<GitLabCiVariable> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/variables/${encodeGitLabPathSegment(key)}`
  );
  if (filter?.environment_scope) {
    url.searchParams.append("filter[environment_scope]", filter.environment_scope);
  }
  const response = await fetch(url.toString(), getFetchConfig());
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabCiVariableSchema.parse(data);
}

async function createProjectVariable(
  projectId: string,
  options: Omit<z.infer<typeof CreateProjectVariableSchema>, "project_id">
): Promise<GitLabCiVariable> {
  projectId = decodeURIComponent(projectId);
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/variables`,
    { ...getFetchConfig(), method: "POST", body: JSON.stringify(options) }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabCiVariableSchema.parse(data);
}

async function updateProjectVariable(
  projectId: string,
  key: string,
  options: Omit<z.infer<typeof UpdateProjectVariableSchema>, "project_id" | "key">
): Promise<GitLabCiVariable> {
  projectId = decodeURIComponent(projectId);
  const { filter, ...body } = options;
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/variables/${encodeGitLabPathSegment(key)}`
  );
  if (filter?.environment_scope) {
    url.searchParams.append("filter[environment_scope]", filter.environment_scope);
  }
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(body),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabCiVariableSchema.parse(data);
}

async function deleteProjectVariable(
  projectId: string,
  key: string,
  filter?: { environment_scope: string }
): Promise<void> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/variables/${encodeGitLabPathSegment(key)}`
  );
  if (filter?.environment_scope) {
    url.searchParams.append("filter[environment_scope]", filter.environment_scope);
  }
  const response = await fetch(url.toString(), { ...getFetchConfig(), method: "DELETE" });
  await handleGitLabError(response);
}

async function listGroupVariables(
  groupId: string,
  options: Omit<z.infer<typeof ListGroupVariablesSchema>, "group_id"> = {}
): Promise<GitLabCiVariable[]> {
  const encoded = encodeGitLabPathSegment(groupId);
  const url = new URL(`${getEffectiveApiUrl()}/groups/${encoded}/variables`);
  Object.entries(options).forEach(([key, value]) => {
    if (key === "filter" && typeof value === "object" && value !== null) {
      Object.entries(value as Record<string, unknown>).forEach(([filterKey, filterValue]) => {
        appendFilterParam(url.searchParams, `filter[${filterKey}]`, filterValue);
      });
      return;
    }

    appendFilterParam(url.searchParams, key, value);
  });
  const response = await fetch(url.toString(), getFetchConfig());
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabCiVariableSchema).parse(data);
}

async function getGroupVariable(
  groupId: string,
  key: string,
  filter?: { environment_scope: string }
): Promise<GitLabCiVariable> {
  const encoded = encodeGitLabPathSegment(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encoded}/variables/${encodeGitLabPathSegment(key)}`
  );
  if (filter?.environment_scope) {
    url.searchParams.append("filter[environment_scope]", filter.environment_scope);
  }
  const response = await fetch(url.toString(), getFetchConfig());
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabCiVariableSchema.parse(data);
}

async function createGroupVariable(
  groupId: string,
  options: Omit<z.infer<typeof CreateGroupVariableSchema>, "group_id">
): Promise<GitLabCiVariable> {
  const encoded = encodeGitLabPathSegment(groupId);
  const response = await fetch(`${getEffectiveApiUrl()}/groups/${encoded}/variables`, {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabCiVariableSchema.parse(data);
}

async function updateGroupVariable(
  groupId: string,
  key: string,
  options: Omit<z.infer<typeof UpdateGroupVariableSchema>, "group_id" | "key">
): Promise<GitLabCiVariable> {
  const encoded = encodeGitLabPathSegment(groupId);
  const { filter, ...body } = options;
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encoded}/variables/${encodeGitLabPathSegment(key)}`
  );
  if (filter?.environment_scope) {
    url.searchParams.append("filter[environment_scope]", filter.environment_scope);
  }
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(body),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabCiVariableSchema.parse(data);
}

async function deleteGroupVariable(
  groupId: string,
  key: string,
  filter?: { environment_scope: string }
): Promise<void> {
  const encoded = encodeGitLabPathSegment(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encoded}/variables/${encodeGitLabPathSegment(key)}`
  );
  if (filter?.environment_scope) {
    url.searchParams.append("filter[environment_scope]", filter.environment_scope);
  }
  const response = await fetch(url.toString(), { ...getFetchConfig(), method: "DELETE" });
  await handleGitLabError(response);
}

export async function handleVariableToolCall(
  params: VariableToolCallParams
): Promise<VariableToolResult> {
  switch (params.name) {
    case "list_project_variables": {
      const args = ListProjectVariablesSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const variables = await listProjectVariables(project_id, options);
      return { content: [{ type: "text", text: JSON.stringify(variables) }] };
    }

    case "get_project_variable": {
      const args = GetProjectVariableSchema.parse(params.arguments);
      const variable = await getProjectVariable(args.project_id, args.key, args.filter);
      return { content: [{ type: "text", text: JSON.stringify(variable) }] };
    }

    case "create_project_variable": {
      const args = CreateProjectVariableSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const variable = await createProjectVariable(project_id, options);
      return { content: [{ type: "text", text: JSON.stringify(variable) }] };
    }

    case "update_project_variable": {
      const args = UpdateProjectVariableSchema.parse(params.arguments);
      const { project_id, key, ...options } = args;
      const variable = await updateProjectVariable(project_id, key, options);
      return { content: [{ type: "text", text: JSON.stringify(variable) }] };
    }

    case "delete_project_variable": {
      const args = DeleteProjectVariableSchema.parse(params.arguments);
      await deleteProjectVariable(args.project_id, args.key, args.filter);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: `Variable '${args.key}' deleted from project`,
            }),
          },
        ],
      };
    }

    case "list_group_variables": {
      rejectIfProjectScopedDeployment("list_group_variables");
      const args = ListGroupVariablesSchema.parse(params.arguments);
      const { group_id, ...options } = args;
      const variables = await listGroupVariables(group_id, options);
      return { content: [{ type: "text", text: JSON.stringify(variables) }] };
    }

    case "get_group_variable": {
      rejectIfProjectScopedDeployment("get_group_variable");
      const args = GetGroupVariableSchema.parse(params.arguments);
      const variable = await getGroupVariable(args.group_id, args.key, args.filter);
      return { content: [{ type: "text", text: JSON.stringify(variable) }] };
    }

    case "create_group_variable": {
      rejectIfProjectScopedDeployment("create_group_variable");
      const args = CreateGroupVariableSchema.parse(params.arguments);
      const { group_id, ...options } = args;
      const variable = await createGroupVariable(group_id, options);
      return { content: [{ type: "text", text: JSON.stringify(variable) }] };
    }

    case "update_group_variable": {
      rejectIfProjectScopedDeployment("update_group_variable");
      const args = UpdateGroupVariableSchema.parse(params.arguments);
      const { group_id, key, ...options } = args;
      const variable = await updateGroupVariable(group_id, key, options);
      return { content: [{ type: "text", text: JSON.stringify(variable) }] };
    }

    case "delete_group_variable": {
      rejectIfProjectScopedDeployment("delete_group_variable");
      const args = DeleteGroupVariableSchema.parse(params.arguments);
      await deleteGroupVariable(args.group_id, args.key, args.filter);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: `Variable '${args.key}' deleted from group`,
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
