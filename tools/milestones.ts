/**
 * Milestones toolset: the project and group milestone tool handlers and the
 * GitLab API helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch,
 * GitLab error handling, the project allowlist check, and the strict project
 * scope guard) and hands it over once with configureMilestoneTools(). The fetch
 * is read at call time, since index.ts replaces it when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  CreateGroupMilestoneSchema,
  CreateProjectMilestoneSchema,
  DeleteGroupMilestoneSchema,
  DeleteProjectMilestoneSchema,
  EditGroupMilestoneSchema,
  EditProjectMilestoneSchema,
  GetGroupMilestoneBurndownEventsSchema,
  GetGroupMilestoneIssuesSchema,
  GetGroupMilestoneMergeRequestsSchema,
  GetGroupMilestoneSchema,
  GetMilestoneBurndownEventsSchema,
  GetMilestoneIssuesSchema,
  GetMilestoneMergeRequestsSchema,
  GetProjectMilestoneSchema,
  type GitLabGroupMilestones,
  GitLabGroupMilestonesSchema,
  type GitLabIssue,
  GitLabIssueSchema,
  type GitLabMergeRequest,
  GitLabMergeRequestSchema,
  type GitLabMilestones,
  GitLabMilestonesSchema,
  ListGroupMilestonesSchema,
  ListProjectMilestonesSchema,
  PromoteProjectMilestoneSchema,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import {
  appendFilterParams,
  dropBlankArrayEntries,
  isBlankFilterValue,
} from "../utils/tool-args.js";
import { encodeGitLabPathSegment } from "../utils/url.js";

export interface MilestoneToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
  rejectIfStrictProjectScope: (toolName: string) => void;
}

let deps: MilestoneToolDeps | undefined;

export function configureMilestoneTools(next: MilestoneToolDeps): void {
  deps = next;
}

function requireDeps(): MilestoneToolDeps {
  if (!deps) {
    throw new Error("Milestone tools used before configureMilestoneTools()");
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

function rejectIfStrictProjectScope(toolName: string): void {
  requireDeps().rejectIfStrictProjectScope(toolName);
}

export interface MilestoneToolCallParams {
  name: string;
  arguments: unknown;
}

export interface MilestoneToolResult {
  content: Array<{ type: "text"; text: string }>;
}

/**
 * List project milestones in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for listing milestones
 * @returns {Promise<GitLabMilestones[]>} List of milestones
 */
async function listProjectMilestones(
  projectId: string,
  options: Omit<z.infer<typeof ListProjectMilestonesSchema>, "project_id">
): Promise<GitLabMilestones[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/milestones`
  );

  Object.entries(options).forEach(([key, value]) => {
    // Drop blank entries inside arrays so they behave like the scalar blank guard below
    const normalized = dropBlankArrayEntries(value);

    if (isBlankFilterValue(normalized)) {
      return;
    }

    if (key === "iids" && Array.isArray(normalized)) {
      normalized.forEach(iid => {
        url.searchParams.append("iids[]", String(iid));
      });
    } else {
      url.searchParams.append(key, String(normalized));
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMilestonesSchema).parse(data);
}

/**
 * Get a single milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabMilestones>} Milestone details
 */
async function getProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/milestones/${encodeGitLabPathSegment(milestoneId)}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Create a new milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for creating a milestone
 * @returns {Promise<GitLabMilestones>} Created milestone
 */
async function createProjectMilestone(
  projectId: string,
  options: Omit<z.infer<typeof CreateProjectMilestoneSchema>, "project_id">
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/milestones`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Edit an existing milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @param {Object} options - Options for editing a milestone
 * @returns {Promise<GitLabMilestones>} Updated milestone
 */
async function editProjectMilestone(
  projectId: string,
  milestoneId: number | string,
  options: Omit<z.infer<typeof EditProjectMilestoneSchema>, "project_id" | "milestone_id">
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/milestones/${encodeGitLabPathSegment(milestoneId)}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Delete a milestone from a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<void>}
 */
async function deleteProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/milestones/${encodeGitLabPathSegment(milestoneId)}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "DELETE",
  });
  await handleGitLabError(response);
}

/**
 * Get all issues assigned to a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabIssue[]>} List of issues
 */
async function getMilestoneIssues(
  projectId: string,
  milestoneId: number | string,
  options: Omit<z.infer<typeof GetMilestoneIssuesSchema>, "project_id" | "milestone_id"> = {}
): Promise<GitLabIssue[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/milestones/${encodeGitLabPathSegment(milestoneId)}/issues`
  );

  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabIssueSchema).parse(data);
}

/**
 * Get all merge requests assigned to a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabMergeRequest[]>} List of merge requests
 */
async function getMilestoneMergeRequests(
  projectId: string,
  milestoneId: number | string,
  options: Omit<z.infer<typeof GetMilestoneMergeRequestsSchema>, "project_id" | "milestone_id"> = {}
): Promise<GitLabMergeRequest[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(
      getEffectiveProjectId(projectId)
    )}/milestones/${encodeGitLabPathSegment(milestoneId)}/merge_requests`
  );

  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMergeRequestSchema).parse(data);
}

/**
 * Promote a project milestone to a group milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabGroupMilestones>} Promoted milestone
 */
async function promoteProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabGroupMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/milestones/${encodeGitLabPathSegment(milestoneId)}/promote`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabGroupMilestonesSchema.parse(data);
}

/**
 * Get all burndown chart events for a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<any[]>} Burndown chart events
 */
async function getMilestoneBurndownEvents(
  projectId: string,
  milestoneId: number | string,
  options: Omit<
    z.infer<typeof GetMilestoneBurndownEventsSchema>,
    "project_id" | "milestone_id"
  > = {}
): Promise<any[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(
      getEffectiveProjectId(projectId)
    )}/milestones/${encodeGitLabPathSegment(milestoneId)}/burndown_events`
  );

  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return data as any[];
}

/**
 * List milestones in a GitLab group
 */
async function listGroupMilestones(
  groupId: string,
  options: Omit<z.infer<typeof ListGroupMilestonesSchema>, "group_id">
): Promise<GitLabGroupMilestones[]> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/milestones`
  );

  Object.entries(options).forEach(([key, value]) => {
    // Drop blank entries inside arrays so they behave like the scalar blank guard below
    const normalized = dropBlankArrayEntries(value);

    if (isBlankFilterValue(normalized)) {
      return;
    }

    if (key === "iids" && Array.isArray(normalized)) {
      normalized.forEach(iid => {
        url.searchParams.append("iids[]", String(iid));
      });
    } else {
      url.searchParams.append(key, String(normalized));
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabGroupMilestonesSchema).parse(data);
}

/**
 * Get a single milestone in a GitLab group
 */
async function getGroupMilestone(
  groupId: string,
  milestoneId: number | string
): Promise<GitLabGroupMilestones> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/milestones/${encodeGitLabPathSegment(milestoneId)}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabGroupMilestonesSchema.parse(data);
}

/**
 * Create a new milestone in a GitLab group
 */
async function createGroupMilestone(
  groupId: string,
  options: Omit<z.infer<typeof CreateGroupMilestoneSchema>, "group_id">
): Promise<GitLabGroupMilestones> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/milestones`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabGroupMilestonesSchema.parse(data);
}

/**
 * Edit an existing milestone in a GitLab group
 */
async function editGroupMilestone(
  groupId: string,
  milestoneId: number | string,
  options: Omit<z.infer<typeof EditGroupMilestoneSchema>, "group_id" | "milestone_id">
): Promise<GitLabGroupMilestones> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/milestones/${encodeGitLabPathSegment(milestoneId)}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabGroupMilestonesSchema.parse(data);
}

/**
 * Delete a milestone from a GitLab group
 */
async function deleteGroupMilestone(groupId: string, milestoneId: number | string): Promise<void> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/milestones/${encodeGitLabPathSegment(milestoneId)}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "DELETE",
  });
  await handleGitLabError(response);
}

/**
 * Get all issues assigned to a single group milestone
 */
async function getGroupMilestoneIssues(
  groupId: string,
  milestoneId: number | string,
  options: Omit<z.infer<typeof GetGroupMilestoneIssuesSchema>, "group_id" | "milestone_id"> = {}
): Promise<GitLabIssue[]> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/milestones/${encodeGitLabPathSegment(milestoneId)}/issues`
  );

  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabIssueSchema).parse(data);
}

/**
 * Get all merge requests assigned to a single group milestone
 */
async function getGroupMilestoneMergeRequests(
  groupId: string,
  milestoneId: number | string,
  options: Omit<
    z.infer<typeof GetGroupMilestoneMergeRequestsSchema>,
    "group_id" | "milestone_id"
  > = {}
): Promise<GitLabMergeRequest[]> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/milestones/${encodeGitLabPathSegment(milestoneId)}/merge_requests`
  );

  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMergeRequestSchema).parse(data);
}

/**
 * Get burndown chart events for a group milestone
 */
async function getGroupMilestoneBurndownEvents(
  groupId: string,
  milestoneId: number | string,
  options: Omit<
    z.infer<typeof GetGroupMilestoneBurndownEventsSchema>,
    "group_id" | "milestone_id"
  > = {}
): Promise<any[]> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/milestones/${encodeGitLabPathSegment(milestoneId)}/burndown_events`
  );

  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return data as any[];
}

export async function handleMilestoneToolCall(
  params: MilestoneToolCallParams
): Promise<MilestoneToolResult> {
  switch (params.name) {
    case "list_milestones": {
      const { project_id, ...options } = ListProjectMilestonesSchema.parse(params.arguments);
      const milestones = await listProjectMilestones(project_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestones),
          },
        ],
      };
    }

    case "get_milestone": {
      const { project_id, milestone_id } = GetProjectMilestoneSchema.parse(params.arguments);
      const milestone = await getProjectMilestone(project_id, milestone_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestone),
          },
        ],
      };
    }

    case "create_milestone": {
      const { project_id, ...options } = CreateProjectMilestoneSchema.parse(params.arguments);
      const milestone = await createProjectMilestone(project_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestone),
          },
        ],
      };
    }

    case "edit_milestone": {
      const { project_id, milestone_id, ...options } = EditProjectMilestoneSchema.parse(
        params.arguments
      );
      const milestone = await editProjectMilestone(project_id, milestone_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestone),
          },
        ],
      };
    }

    case "delete_milestone": {
      const { project_id, milestone_id } = DeleteProjectMilestoneSchema.parse(params.arguments);
      await deleteProjectMilestone(project_id, milestone_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "Milestone deleted successfully",
            }),
          },
        ],
      };
    }

    case "get_milestone_issue": {
      const { project_id, milestone_id, ...options } = GetMilestoneIssuesSchema.parse(
        params.arguments
      );
      const issues = await getMilestoneIssues(project_id, milestone_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issues),
          },
        ],
      };
    }

    case "get_milestone_merge_requests": {
      const { project_id, milestone_id, ...options } = GetMilestoneMergeRequestsSchema.parse(
        params.arguments
      );
      const mergeRequests = await getMilestoneMergeRequests(project_id, milestone_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(mergeRequests),
          },
        ],
      };
    }

    case "promote_milestone": {
      const { project_id, milestone_id } = PromoteProjectMilestoneSchema.parse(params.arguments);
      const milestone = await promoteProjectMilestone(project_id, milestone_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestone),
          },
        ],
      };
    }

    case "get_milestone_burndown_events": {
      const { project_id, milestone_id, ...options } = GetMilestoneBurndownEventsSchema.parse(
        params.arguments
      );
      const events = await getMilestoneBurndownEvents(project_id, milestone_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(events),
          },
        ],
      };
    }

    case "list_group_milestones": {
      rejectIfStrictProjectScope("list_group_milestones");
      const { group_id, ...options } = ListGroupMilestonesSchema.parse(params.arguments);
      const milestones = await listGroupMilestones(group_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestones),
          },
        ],
      };
    }

    case "get_group_milestone": {
      rejectIfStrictProjectScope("get_group_milestone");
      const { group_id, milestone_id } = GetGroupMilestoneSchema.parse(params.arguments);
      const milestone = await getGroupMilestone(group_id, milestone_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestone),
          },
        ],
      };
    }

    case "create_group_milestone": {
      rejectIfStrictProjectScope("create_group_milestone");
      const { group_id, ...options } = CreateGroupMilestoneSchema.parse(params.arguments);
      const milestone = await createGroupMilestone(group_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestone),
          },
        ],
      };
    }

    case "edit_group_milestone": {
      rejectIfStrictProjectScope("edit_group_milestone");
      const { group_id, milestone_id, ...options } = EditGroupMilestoneSchema.parse(
        params.arguments
      );
      const milestone = await editGroupMilestone(group_id, milestone_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(milestone),
          },
        ],
      };
    }

    case "delete_group_milestone": {
      rejectIfStrictProjectScope("delete_group_milestone");
      const { group_id, milestone_id } = DeleteGroupMilestoneSchema.parse(params.arguments);
      await deleteGroupMilestone(group_id, milestone_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "Group milestone deleted successfully",
            }),
          },
        ],
      };
    }

    case "get_group_milestone_issue": {
      rejectIfStrictProjectScope("get_group_milestone_issue");
      const { group_id, milestone_id, ...options } = GetGroupMilestoneIssuesSchema.parse(
        params.arguments
      );
      const issues = await getGroupMilestoneIssues(group_id, milestone_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issues),
          },
        ],
      };
    }

    case "get_group_milestone_merge_requests": {
      rejectIfStrictProjectScope("get_group_milestone_merge_requests");
      const { group_id, milestone_id, ...options } = GetGroupMilestoneMergeRequestsSchema.parse(
        params.arguments
      );
      const mergeRequests = await getGroupMilestoneMergeRequests(group_id, milestone_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(mergeRequests),
          },
        ],
      };
    }

    case "get_group_milestone_burndown_events": {
      rejectIfStrictProjectScope("get_group_milestone_burndown_events");
      const { group_id, milestone_id, ...options } = GetGroupMilestoneBurndownEventsSchema.parse(
        params.arguments
      );
      const events = await getGroupMilestoneBurndownEvents(group_id, milestone_id, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(events),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
