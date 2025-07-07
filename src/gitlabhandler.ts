import { z } from "zod";
import { URL } from "url";
import { Response, RequestInit } from "node-fetch";
import { config } from "./config.js";
import {
  GitLabForkSchema,
  GitLabReferenceSchema,
  GitLabRepositorySchema,
  GitLabIssueSchema,
  GitLabMergeRequestSchema,
  GitLabContentSchema,
  GitLabCreateUpdateFileResponseSchema,
  GitLabSearchResponseSchema,
  GitLabTreeSchema,
  GitLabCommitSchema,
  GitLabNamespaceSchema,
  GitLabNamespaceExistsResponseSchema,
  GitLabProjectSchema,
  GitLabLabelSchema,
  GitLabUserSchema,
  GitLabUsersResponseSchema,
  CreateRepositoryOptionsSchema,
  CreateIssueOptionsSchema,
  CreateMergeRequestOptionsSchema,
  CreateBranchOptionsSchema,
  GitLabDiffSchema,
  GitLabIssueLinkSchema,
  GitLabIssueWithLinkDetailsSchema,
  GitLabDiscussionNoteSchema,
  GitLabDiscussionSchema,
  PaginatedDiscussionsResponseSchema,
  GitLabWikiPageSchema,
  GitLabTreeItemSchema,
  GitLabPipelineSchema,
  GitLabPipelineJobSchema,
  GitLabMilestonesSchema,
  GitLabCompareResultSchema,
  type GitLabFork,
  type GitLabReference,
  type GitLabRepository,
  type GitLabIssue,
  type GitLabMergeRequest,
  type GitLabContent,
  type GitLabCreateUpdateFileResponse,
  type GitLabSearchResponse,
  type GitLabTree,
  type GitLabCommit,
  type FileOperation,
  type GitLabMergeRequestDiff,
  type GitLabIssueLink,
  type GitLabIssueWithLinkDetails,
  type GitLabNamespace,
  type GitLabNamespaceExistsResponse,
  type GitLabProject,
  type GitLabLabel,
  type GitLabUser,
  type GitLabUsersResponse,
  type GitLabPipeline,
  type ListPipelinesOptions,
  type GetPipelineOptions,
  type ListPipelineJobsOptions,
  type CreatePipelineOptions,
  type RetryPipelineOptions,
  type CancelPipelineOptions,
  type GitLabPipelineJob,
  type GitLabMilestones,
  type ListProjectMilestonesOptions,
  type GetProjectMilestoneOptions,
  type CreateProjectMilestoneOptions,
  type EditProjectMilestoneOptions,
  type DeleteProjectMilestoneOptions,
  type GetMilestoneIssuesOptions,
  type GetMilestoneMergeRequestsOptions,
  type PromoteProjectMilestoneOptions,
  type GetMilestoneBurndownEventsOptions,
  type GitLabDiscussionNote,
  type GitLabDiscussion,
  type PaginatedDiscussionsResponse,
  type PaginationOptions,
  type MergeRequestThreadPosition,
  type GetWikiPageOptions,
  type CreateWikiPageOptions,
  type UpdateWikiPageOptions,
  type DeleteWikiPageOptions,
  type GitLabWikiPage,
  type GitLabTreeItem,
  type GetRepositoryTreeOptions,
  type GitLabCompareResult,
  type ListWikiPagesOptions,
  type ListCommitsOptions,
  type GetCommitOptions,
  type GetCommitDiffOptions,
  ListProjectMilestonesSchema,
  UpdateMergeRequestSchema,
  ListIssuesSchema,
  UpdateIssueSchema,
  ListMergeRequestsSchema,
  ListLabelsSchema,
  UpdateLabelSchema,
  ListGroupProjectsSchema,
  ListProjectsSchema,
  CreateLabelSchema,
  CreateProjectMilestoneSchema,
  EditProjectMilestoneSchema,
} from "./schemas.js";
import {GitlabSession} from "./gitlabsession.js";

export class GitlabHandler extends GitlabSession {

  /**
   * Utility function for handling GitLab API errors
   */
  async handleGitLabError(response: Response): Promise<void> {
    if (!response.ok) {
      const errorBody = await response.text();
      // Check specifically for Rate Limit error
      if (response.status === 403 && errorBody.includes("User API Key Rate limit exceeded")) {
        console.error("GitLab API Rate Limit Exceeded:", errorBody);
        console.log("User API Key Rate limit exceeded. Please try again later.");
        throw new Error(`GitLab API Rate Limit Exceeded: ${errorBody}`);
      } else {
        // Handle other API errors
        throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
      }
    }
  }

  /**
   * Get effective project ID based on config or provided ID
   */
  getEffectiveProjectId(projectId: string): string {
    return config.GITLAB_PROJECT_ID || projectId;
  }

  /**
   * Create a fork of a GitLab project
   */
  async forkProject(projectId: string, namespace?: string): Promise<GitLabFork> {
    projectId = decodeURIComponent(projectId);
    const effectiveProjectId = this.getEffectiveProjectId(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/fork`);

    if (namespace) {
      url.searchParams.append("namespace", namespace);
    }

    const response = await this.fetch(url.toString(), {

      method: "POST",
    });

    if (response.status === 409) {
      throw new Error("Project already exists in the target namespace");
    }

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabForkSchema.parse(data);
  }

  /**
   * Create a new branch in a GitLab project
   */
  async createBranch(
    projectId: string,
    options: z.infer<typeof CreateBranchOptionsSchema>
  ): Promise<GitLabReference> {
    projectId = decodeURIComponent(projectId);
    const effectiveProjectId = this.getEffectiveProjectId(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/repository/branches`
    );

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify({
        branch: options.name,
        ref: options.ref,
      }),
    });

    await this.handleGitLabError(response);
    return GitLabReferenceSchema.parse(await response.json());
  }

  /**
   * Get the default branch for a GitLab project
   */
  async getDefaultBranchRef(projectId: string): Promise<string> {
    projectId = decodeURIComponent(projectId);
    const effectiveProjectId = this.getEffectiveProjectId(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}`);

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const project = GitLabRepositorySchema.parse(await response.json());
    return project.default_branch ?? "main";
  }

  /**
   * Get the contents of a file from a GitLab project
   */
  async getFileContents(
    projectId: string,
    filePath: string,
    ref?: string
  ): Promise<GitLabContent> {
    projectId = decodeURIComponent(projectId);
    const effectiveProjectId = this.getEffectiveProjectId(projectId);
    const encodedPath = encodeURIComponent(filePath);

    if (!ref) {
      ref = await this.getDefaultBranchRef(projectId);
    }

    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/repository/files/${encodedPath}`
    );

    url.searchParams.append("ref", ref);

    const response = await this.fetch(url.toString(), {});

    if (response.status === 404) {
      throw new Error(`File not found: ${filePath}`);
    }

    await this.handleGitLabError(response);
    const data = await response.json();
    const parsedData = GitLabContentSchema.parse(data);

    // Decode Base64 content to UTF-8
    if (!Array.isArray(parsedData) && parsedData.content) {
      parsedData.content = Buffer.from(parsedData.content, "base64").toString("utf8");
      parsedData.encoding = "utf8";
    }

    return parsedData;
  }

  /**
   * Create a new issue in a GitLab project
   */
  async createIssue(
    projectId: string,
    options: z.infer<typeof CreateIssueOptionsSchema>
  ): Promise<GitLabIssue> {
    projectId = decodeURIComponent(projectId);
    const effectiveProjectId = this.getEffectiveProjectId(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/issues`);

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify({
        title: options.title,
        description: options.description,
        assignee_ids: options.assignee_ids,
        milestone_id: options.milestone_id,
        labels: options.labels?.join(","),
      }),
    });

    if (response.status === 400) {
      const errorBody = await response.text();
      throw new Error(`Invalid request: ${errorBody}`);
    }

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabIssueSchema.parse(data);
  }

  /**
   * List issues in a GitLab project
   */
  async listIssues(
    projectId: string,
    options: Omit<z.infer<typeof ListIssuesSchema>, "project_id"> = {}
  ): Promise<GitLabIssue[]> {
    projectId = decodeURIComponent(projectId);
    const effectiveProjectId = this.getEffectiveProjectId(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(effectiveProjectId)}/issues`);

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        const keys = ["labels", "assignee_username"];
        if (keys.includes(key)) {
          if (Array.isArray(value)) {
            value.forEach(label => {
              url.searchParams.append(`${key}[]`, label.toString());
            });
          } else {
            url.searchParams.append(`${key}[]`, value.toString());
          }
        } else {
          url.searchParams.append(key, value.toString());
        }
      }
    });

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabIssueSchema).parse(data);
  }

  /**
   * List merge requests in a GitLab project with optional filtering
   */
  async listMergeRequests(
    projectId: string,
    options: Omit<z.infer<typeof ListMergeRequestsSchema>, "project_id"> = {}
  ): Promise<GitLabMergeRequest[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/merge_requests`);

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === "labels" && Array.isArray(value)) {
          url.searchParams.append(key, value.join(","));
        } else {
          url.searchParams.append(key, value.toString());
        }
      }
    });

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabMergeRequestSchema).parse(data);
  }

  /**
   * Get a single issue from a GitLab project
   */
  async getIssue(projectId: string, issueIid: number): Promise<GitLabIssue> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/issues/${issueIid}`
    );

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabIssueSchema.parse(data);
  }

  /**
   * Update an issue in a GitLab project
   */
  async updateIssue(
    projectId: string,
    issueIid: number,
    options: Omit<z.infer<typeof UpdateIssueSchema>, "project_id" | "issue_iid">
  ): Promise<GitLabIssue> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/issues/${issueIid}`
    );

    const body: Record<string, any> = { ...options };
    if (body.labels && Array.isArray(body.labels)) {
      body.labels = body.labels.join(",");
    }

    const response = await this.fetch(url.toString(), {

      method: "PUT",
      body: JSON.stringify(body),
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabIssueSchema.parse(data);
  }

  /**
   * Delete an issue from a GitLab project
   */
  async deleteIssue(projectId: string, issueIid: number): Promise<void> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/issues/${issueIid}`
    );

    const response = await this.fetch(url.toString(), {

      method: "DELETE",
    });

    await this.handleGitLabError(response);
  }

  /**
   * List all issue links for a specific issue
   */
  async listIssueLinks(
    projectId: string,
    issueIid: number
  ): Promise<GitLabIssueWithLinkDetails[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/issues/${issueIid}/links`
    );

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabIssueWithLinkDetailsSchema).parse(data);
  }

  /**
   * Get a specific issue link
   */
  async getIssueLink(
    projectId: string,
    issueIid: number,
    issueLinkId: number
  ): Promise<GitLabIssueLink> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/issues/${issueIid}/links/${issueLinkId}`
    );

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabIssueLinkSchema.parse(data);
  }

  /**
   * Create an issue link between two issues
   */
  async createIssueLink(
    projectId: string,
    issueIid: number,
    targetProjectId: string,
    targetIssueIid: number,
    linkType: "relates_to" | "blocks" | "is_blocked_by" = "relates_to"
  ): Promise<GitLabIssueLink> {
    projectId = decodeURIComponent(projectId);
    targetProjectId = decodeURIComponent(targetProjectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/issues/${issueIid}/links`
    );

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify({
        target_project_id: targetProjectId,
        target_issue_iid: targetIssueIid,
        link_type: linkType,
      }),
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabIssueLinkSchema.parse(data);
  }

  /**
   * Delete an issue link
   */
  async deleteIssueLink(
    projectId: string,
    issueIid: number,
    issueLinkId: number
  ): Promise<void> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/issues/${issueIid}/links/${issueLinkId}`
    );

    const response = await this.fetch(url.toString(), {

      method: "DELETE",
    });

    await this.handleGitLabError(response);
  }

  /**
   * Create a new merge request in a GitLab project
   */
  async createMergeRequest(
    projectId: string,
    options: z.infer<typeof CreateMergeRequestOptionsSchema>
  ): Promise<GitLabMergeRequest> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/merge_requests`);

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify({
        title: options.title,
        description: options.description,
        source_branch: options.source_branch,
        target_branch: options.target_branch,
        assignee_ids: options.assignee_ids,
        reviewer_ids: options.reviewer_ids,
        labels: options.labels?.join(","),
        allow_collaboration: options.allow_collaboration,
        draft: options.draft,
        remove_source_branch: options.remove_source_branch,
        squash: options.squash,
      }),
    });

    if (response.status === 400) {
      const errorBody = await response.text();
      throw new Error(`Invalid request: ${errorBody}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    return GitLabMergeRequestSchema.parse(data);
  }

  /**
   * Shared helper function for listing discussions
   */
  async listDiscussions(
    projectId: string,
    resourceType: "issues" | "merge_requests",
    resourceIid: number,
    options: PaginationOptions = {}
  ): Promise<PaginatedDiscussionsResponse> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/${resourceType}/${resourceIid}/discussions`
    );

    if (options.page) {
      url.searchParams.append("page", options.page.toString());
    }
    if (options.per_page) {
      url.searchParams.append("per_page", options.per_page.toString());
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const discussions = await response.json();

    const pagination = {
      x_next_page: response.headers.get("x-next-page")
        ? parseInt(response.headers.get("x-next-page")!)
        : null,
      x_page: response.headers.get("x-page") ? parseInt(response.headers.get("x-page")!) : undefined,
      x_per_page: response.headers.get("x-per-page")
        ? parseInt(response.headers.get("x-per-page")!)
        : undefined,
      x_prev_page: response.headers.get("x-prev-page")
        ? parseInt(response.headers.get("x-prev-page")!)
        : null,
      x_total: response.headers.get("x-total") ? parseInt(response.headers.get("x-total")!) : null,
      x_total_pages: response.headers.get("x-total-pages")
        ? parseInt(response.headers.get("x-total-pages")!)
        : null,
    };

    return PaginatedDiscussionsResponseSchema.parse({
      items: discussions,
      pagination: pagination,
    });
  }

  /**
   * List merge request discussion items
   */
  async listMergeRequestDiscussions(
    projectId: string,
    mergeRequestIid: number,
    options: PaginationOptions = {}
  ): Promise<PaginatedDiscussionsResponse> {
    return this.listDiscussions(projectId, "merge_requests", mergeRequestIid, options);
  }

  /**
   * List discussions for an issue
   */
  async listIssueDiscussions(
    projectId: string,
    issueIid: number,
    options: PaginationOptions = {}
  ): Promise<PaginatedDiscussionsResponse> {
    return this.listDiscussions(projectId, "issues", issueIid, options);
  }

  /**
   * Modify an existing merge request thread note
   */
  async updateMergeRequestNote(
    projectId: string,
    mergeRequestIid: number,
    discussionId: string,
    noteId: number,
    body?: string,
    resolved?: boolean
  ): Promise<GitLabDiscussionNote> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/merge_requests/${mergeRequestIid}/discussions/${discussionId}/notes/${noteId}`
    );

    const payload: { body?: string; resolved?: boolean } = {};
    if (body !== undefined) {
      payload.body = body;
    } else if (resolved !== undefined) {
      payload.resolved = resolved;
    }

    const response = await this.fetch(url.toString(), {

      method: "PUT",
      body: JSON.stringify(payload),
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabDiscussionNoteSchema.parse(data);
  }

  /**
   * Update an issue discussion note
   */
  async updateIssueNote(
    projectId: string,
    issueIid: number,
    discussionId: string,
    noteId: number,
    body: string
  ): Promise<GitLabDiscussionNote> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/issues/${issueIid}/discussions/${discussionId}/notes/${noteId}`
    );

    const payload = { body };

    const response = await this.fetch(url.toString(), {

      method: "PUT",
      body: JSON.stringify(payload),
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabDiscussionNoteSchema.parse(data);
  }

  /**
   * Create a note in an issue discussion
   */
  async createIssueNote(
    projectId: string,
    issueIid: number,
    discussionId: string,
    body: string,
    createdAt?: string
  ): Promise<GitLabDiscussionNote> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/issues/${issueIid}/discussions/${discussionId}/notes`
    );

    const payload: { body: string; created_at?: string } = { body };
    if (createdAt) {
      payload.created_at = createdAt;
    }

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify(payload),
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabDiscussionNoteSchema.parse(data);
  }

  /**
   * Add a new note to an existing merge request thread
   */
  async createMergeRequestNote(
    projectId: string,
    mergeRequestIid: number,
    discussionId: string,
    body: string,
    createdAt?: string
  ): Promise<GitLabDiscussionNote> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/merge_requests/${mergeRequestIid}/discussions/${discussionId}/notes`
    );

    const payload: { body: string; created_at?: string } = { body };
    if (createdAt) {
      payload.created_at = createdAt;
    }

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify(payload),
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabDiscussionNoteSchema.parse(data);
  }

  /**
   * Create or update a file in a GitLab project
   */
  async createOrUpdateFile(
    projectId: string,
    filePath: string,
    content: string,
    commitMessage: string,
    branch: string,
    previousPath?: string,
    last_commit_id?: string,
    commit_id?: string
  ): Promise<GitLabCreateUpdateFileResponse> {
    projectId = decodeURIComponent(projectId);
    const encodedPath = encodeURIComponent(filePath);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/repository/files/${encodedPath}`
    );

    const body: Record<string, any> = {
      branch,
      content,
      commit_message: commitMessage,
      encoding: "text",
      ...(previousPath ? { previous_path: previousPath } : {}),
    };

    let method = "POST";
    try {
      const fileData = await this.getFileContents(projectId, filePath, branch);
      method = "PUT";

      if (!Array.isArray(fileData)) {
        if (!commit_id && fileData.commit_id) {
          body.commit_id = fileData.commit_id;
        } else if (commit_id) {
          body.commit_id = commit_id;
        }

        if (!last_commit_id && fileData.last_commit_id) {
          body.last_commit_id = fileData.last_commit_id;
        } else if (last_commit_id) {
          body.last_commit_id = last_commit_id;
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("File not found"))) {
        throw error;
      }
      if (commit_id) {
        body.commit_id = commit_id;
      }
      if (last_commit_id) {
        body.last_commit_id = last_commit_id;
      }
    }

    const response = await this.fetch(url.toString(), {

      method,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    return GitLabCreateUpdateFileResponseSchema.parse(data);
  }

  /**
   * Create a tree structure in a GitLab project repository
   */
  async createTree(
    projectId: string,
    files: FileOperation[],
    ref?: string
  ): Promise<GitLabTree> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/repository/tree`
    );

    if (ref) {
      url.searchParams.append("ref", ref);
    }

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify({
        files: files.map(file => ({
          file_path: file.path,
          content: file.content,
          encoding: "text",
        })),
      }),
    });

    if (response.status === 400) {
      const errorBody = await response.text();
      throw new Error(`Invalid request: ${errorBody}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    return GitLabTreeSchema.parse(data);
  }

  /**
   * Create a commit in a GitLab project repository
   */
  async createCommit(
    projectId: string,
    message: string,
    branch: string,
    actions: FileOperation[]
  ): Promise<GitLabCommit> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/repository/commits`
    );

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify({
        branch,
        commit_message: message,
        actions: actions.map(action => ({
          action: "create",
          file_path: action.path,
          content: action.content,
          encoding: "text",
        })),
      }),
    });

    if (response.status === 400) {
      const errorBody = await response.text();
      throw new Error(`Invalid request: ${errorBody}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    return GitLabCommitSchema.parse(data);
  }

  /**
   * Search for GitLab projects
   */
  async searchProjects(
    query: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<GitLabSearchResponse> {
    const url = new URL(`${config.GITLAB_API_URL}/projects`);
    url.searchParams.append("search", query);
    url.searchParams.append("page", page.toString());
    url.searchParams.append("per_page", perPage.toString());
    url.searchParams.append("order_by", "id");
    url.searchParams.append("sort", "desc");

    const response = await this.fetch(url.toString(), {});

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const projects = (await response.json()) as GitLabRepository[];
    const totalCount = response.headers.get("x-total");
    const totalPages = response.headers.get("x-total-pages");

    const count = totalCount ? parseInt(totalCount) : projects.length;

    return GitLabSearchResponseSchema.parse({
      count,
      total_pages: totalPages ? parseInt(totalPages) : Math.ceil(count / perPage),
      current_page: page,
      items: projects,
    });
  }

  /**
   * Create a new GitLab repository
   */
  async createRepository(
    options: z.infer<typeof CreateRepositoryOptionsSchema>
  ): Promise<GitLabRepository> {
    const response = await this.fetch(`${config.GITLAB_API_URL}/projects`, {

      method: "POST",
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        visibility: options.visibility,
        initialize_with_readme: options.initialize_with_readme,
        default_branch: "main",
        path: options.name.toLowerCase().replace(/\s+/g, "-"),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    return GitLabRepositorySchema.parse(data);
  }

  /**
   * Get merge request details
   */
  async getMergeRequest(
    projectId: string,
    mergeRequestIid?: number,
    branchName?: string
  ): Promise<GitLabMergeRequest> {
    projectId = decodeURIComponent(projectId);
    let url: URL;

    if (mergeRequestIid) {
      url = new URL(
        `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/merge_requests/${mergeRequestIid}`
      );
    } else if (branchName) {
      url = new URL(
        `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/merge_requests?source_branch=${encodeURIComponent(branchName)}`
      );
    } else {
      throw new Error("Either mergeRequestIid or branchName must be provided");
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return GitLabMergeRequestSchema.parse(data[0]);
    }

    return GitLabMergeRequestSchema.parse(data);
  }

  /**
   * Get merge request changes/diffs
   */
  async getMergeRequestDiffs(
    projectId: string,
    mergeRequestIid?: number,
    branchName?: string,
    view?: "inline" | "parallel"
  ): Promise<GitLabMergeRequestDiff[]> {
    projectId = decodeURIComponent(projectId);
    if (!mergeRequestIid && !branchName) {
      throw new Error("Either mergeRequestIid or branchName must be provided");
    }

    if (branchName && !mergeRequestIid) {
      const mergeRequest = await this.getMergeRequest(projectId, undefined, branchName);
      mergeRequestIid = mergeRequest.iid;
    }

    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/merge_requests/${mergeRequestIid}/changes`
    );

    if (view) {
      url.searchParams.append("view", view);
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = (await response.json()) as { changes: unknown };
    return z.array(GitLabDiffSchema).parse(data.changes);
  }

  /**
   * Get merge request changes with detailed information
   */
  async listMergeRequestDiffs(
    projectId: string,
    mergeRequestIid?: number,
    branchName?: string,
    page?: number,
    perPage?: number,
    unidiff?: boolean
  ): Promise<any> {
    projectId = decodeURIComponent(projectId);
    if (!mergeRequestIid && !branchName) {
      throw new Error("Either mergeRequestIid or branchName must be provided");
    }

    if (branchName && !mergeRequestIid) {
      const mergeRequest = await this.getMergeRequest(projectId, undefined, branchName);
      mergeRequestIid = mergeRequest.iid;
    }

    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/merge_requests/${mergeRequestIid}/diffs`
    );

    if (page) {
      url.searchParams.append("page", page.toString());
    }

    if (perPage) {
      url.searchParams.append("per_page", perPage.toString());
    }

    if (unidiff) {
      url.searchParams.append("unidiff", "true");
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    return await response.json();
  }

  /**
   * Get branch comparison diffs
   */
  async getBranchDiffs(
    projectId: string,
    from: string,
    to: string,
    straight?: boolean
  ): Promise<GitLabCompareResult> {
    projectId = decodeURIComponent(projectId);

    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/repository/compare`
    );

    url.searchParams.append("from", from);
    url.searchParams.append("to", to);

    if (straight !== undefined) {
      url.searchParams.append("straight", straight.toString());
    }

    const response = await this.fetch(url.toString(), {});

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const data = await response.json();
    return GitLabCompareResultSchema.parse(data);
  }

  /**
   * Update a merge request
   */
  async updateMergeRequest(
    projectId: string,
    options: Omit<
    z.infer<typeof UpdateMergeRequestSchema>,
    "project_id" | "merge_request_iid" | "source_branch"
    >,
    mergeRequestIid?: number,
    branchName?: string
  ): Promise<GitLabMergeRequest> {
    projectId = decodeURIComponent(projectId);
    if (!mergeRequestIid && !branchName) {
      throw new Error("Either mergeRequestIid or branchName must be provided");
    }

    if (branchName && !mergeRequestIid) {
      const mergeRequest = await this.getMergeRequest(projectId, undefined, branchName);
      mergeRequestIid = mergeRequest.iid;
    }

    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/merge_requests/${mergeRequestIid}`
    );

    const response = await this.fetch(url.toString(), {

      method: "PUT",
      body: JSON.stringify(options),
    });

    await this.handleGitLabError(response);
    return GitLabMergeRequestSchema.parse(await response.json());
  }

  /**
   * Create a new note (comment) on an issue or merge request
   */
  async createNote(
    projectId: string,
    noteableType: "issue" | "merge_request",
    noteableIid: number,
    body: string
  ): Promise<any> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/${noteableType}s/${noteableIid}/notes`
    );

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return await response.json();
  }

  /**
   * Create a new thread on a merge request
   */
  async createMergeRequestThread(
    projectId: string,
    mergeRequestIid: number,
    body: string,
    position?: MergeRequestThreadPosition,
    createdAt?: string
  ): Promise<GitLabDiscussion> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
this.getEffectiveProjectId(projectId)
)}/merge_requests/${mergeRequestIid}/discussions`
    );

    const payload: Record<string, any> = { body };

    if (position) {
      payload.position = position;
    }

    if (createdAt) {
      payload.created_at = createdAt;
    }

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify(payload),
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabDiscussionSchema.parse(data);
  }

  /**
   * List all namespaces
   */
  async listNamespaces(options: {
    search?: string;
    owned_only?: boolean;
    top_level_only?: boolean;
  }): Promise<GitLabNamespace[]> {
const url = new URL(`${config.GITLAB_API_URL}/namespaces`);

    if (options.search) {
      url.searchParams.append("search", options.search);
    }

    if (options.owned_only) {
      url.searchParams.append("owned_only", "true");
    }

    if (options.top_level_only) {
      url.searchParams.append("top_level_only", "true");
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabNamespaceSchema).parse(data);
  }

  /**
   * Get details on a namespace
   */
  async getNamespace(id: string): Promise<GitLabNamespace> {
    const url = new URL(`${config.GITLAB_API_URL}/namespaces/${encodeURIComponent(id)}`);

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabNamespaceSchema.parse(data);
  }

  /**
   * Verify if a namespace exists
   */
  async verifyNamespaceExistence(
    namespacePath: string,
    parentId?: number
  ): Promise<GitLabNamespaceExistsResponse> {
    const url = new URL(`${config.GITLAB_API_URL}/namespaces/${encodeURIComponent(namespacePath)}/exists`);

    if (parentId) {
      url.searchParams.append("parent_id", parentId.toString());
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabNamespaceExistsResponseSchema.parse(data);
  }

  /**
   * Get a single project
   */
  async getProject(
    projectId: string,
    options: {
      license?: boolean;
      statistics?: boolean;
      with_custom_attributes?: boolean;
    } = {}
  ): Promise<GitLabProject> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}`);

    if (options.license) {
      url.searchParams.append("license", "true");
    }

    if (options.statistics) {
      url.searchParams.append("statistics", "true");
    }

    if (options.with_custom_attributes) {
      url.searchParams.append("with_custom_attributes", "true");
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabRepositorySchema.parse(data);
  }

  /**
   * List projects
   */
  async listProjects(
    options: z.infer<typeof ListProjectsSchema> = {}
  ): Promise<GitLabProject[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined && value !== null) {
        if (typeof value === "boolean") {
          params.append(key, value ? "true" : "false");
        } else {
          params.append(key, String(value));
        }
      }
    }

    const response = await this.fetch(`${config.GITLAB_API_URL}/projects?${params.toString()}`, {});

    await this.handleGitLabError(response);

    const data = await response.json();
    return z.array(GitLabProjectSchema).parse(data);
  }

  /**
   * List labels for a project
   */
  async listLabels(
    projectId: string,
    options: Omit<z.infer<typeof ListLabelsSchema>, "project_id"> = {}
  ): Promise<GitLabLabel[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/labels`);

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (typeof value === "boolean") {
          url.searchParams.append(key, value ? "true" : "false");
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);

    const data = await response.json();
    return data as GitLabLabel[];
  }

  /**
   * Get a single label from a project
   */
  async getLabel(
    projectId: string,
    labelId: number | string,
    includeAncestorGroups?: boolean
  ): Promise<GitLabLabel> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
        this.getEffectiveProjectId(projectId)
      )}/labels/${encodeURIComponent(String(labelId))}`
    );

    if (includeAncestorGroups !== undefined) {
      url.searchParams.append("include_ancestor_groups", includeAncestorGroups ? "true" : "false");
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);

    const data = await response.json();
    return data as GitLabLabel;
  }

  /**
   * Create a new label in a project
   */
  async createLabel(
    projectId: string,
    options: Omit<z.infer<typeof CreateLabelSchema>, "project_id">
  ): Promise<GitLabLabel> {
    projectId = decodeURIComponent(projectId);
    const response = await this.fetch(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/labels`,
      {

        method: "POST",
        body: JSON.stringify(options),
      }
    );

    await this.handleGitLabError(response);

    const data = await response.json();
    return data as GitLabLabel;
  }

  /**
   * Update an existing label in a project
   */
  async updateLabel(
    projectId: string,
    labelId: number | string,
    options: Omit<z.infer<typeof UpdateLabelSchema>, "project_id" | "label_id">
  ): Promise<GitLabLabel> {
    projectId = decodeURIComponent(projectId);
    const response = await this.fetch(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
        this.getEffectiveProjectId(projectId)
      )}/labels/${encodeURIComponent(String(labelId))}`,
      {

        method: "PUT",
        body: JSON.stringify(options),
      }
    );

    await this.handleGitLabError(response);

    const data = await response.json();
    return data as GitLabLabel;
  }

  /**
   * Delete a label from a project
   */
  async deleteLabel(projectId: string, labelId: number | string): Promise<void> {
    projectId = decodeURIComponent(projectId);
    const response = await this.fetch(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
        this.getEffectiveProjectId(projectId)
      )}/labels/${encodeURIComponent(String(labelId))}`,
      {

        method: "DELETE",
      }
    );

    await this.handleGitLabError(response);
  }

  /**
   * List all projects in a GitLab group
   */
  async listGroupProjects(
    options: z.infer<typeof ListGroupProjectsSchema>
  ): Promise<GitLabProject[]> {
    const url = new URL(`${config.GITLAB_API_URL}/groups/${encodeURIComponent(options.group_id)}/projects`);

    if (options.include_subgroups) url.searchParams.append("include_subgroups", "true");
    if (options.search) url.searchParams.append("search", options.search);
    if (options.order_by) url.searchParams.append("order_by", options.order_by);
    if (options.sort) url.searchParams.append("sort", options.sort);
    if (options.page) url.searchParams.append("page", options.page.toString());
    if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
    if (options.archived !== undefined)
      url.searchParams.append("archived", options.archived.toString());
    if (options.visibility) url.searchParams.append("visibility", options.visibility);
    if (options.with_issues_enabled !== undefined)
      url.searchParams.append("with_issues_enabled", options.with_issues_enabled.toString());
    if (options.with_merge_requests_enabled !== undefined)
      url.searchParams.append(
        "with_merge_requests_enabled",
        options.with_merge_requests_enabled.toString()
      );
    if (options.min_access_level !== undefined)
      url.searchParams.append("min_access_level", options.min_access_level.toString());
    if (options.with_programming_language)
      url.searchParams.append("with_programming_language", options.with_programming_language);
    if (options.starred !== undefined) url.searchParams.append("starred", options.starred.toString());
    if (options.statistics !== undefined)
      url.searchParams.append("statistics", options.statistics.toString());
    if (options.with_custom_attributes !== undefined)
      url.searchParams.append("with_custom_attributes", options.with_custom_attributes.toString());
    if (options.with_security_reports !== undefined)
      url.searchParams.append("with_security_reports", options.with_security_reports.toString());

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const projects = await response.json();
    return GitLabProjectSchema.array().parse(projects);
  }

  // Wiki API helper methods
  /**
   * List wiki pages in a project
   */
  async listWikiPages(
    projectId: string,
    options: Omit<ListWikiPagesOptions, "project_id"> = {}
  ): Promise<GitLabWikiPage[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/wikis`);
    if (options.page) url.searchParams.append("page", options.page.toString());
    if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
    if (options.with_content)
      url.searchParams.append("with_content", options.with_content.toString());
    const response = await this.fetch(url.toString(), {});
    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabWikiPageSchema.array().parse(data);
  }

  /**
   * Get a specific wiki page
   */
  async getWikiPage(projectId: string, slug: string): Promise<GitLabWikiPage> {
    projectId = decodeURIComponent(projectId);
    const response = await this.fetch(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
      {},
    );
    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabWikiPageSchema.parse(data);
  }

  /**
   * Create a new wiki page
   */
  async createWikiPage(
    projectId: string,
    title: string,
    content: string,
    format?: string
  ): Promise<GitLabWikiPage> {
    projectId = decodeURIComponent(projectId);
    const body: Record<string, any> = { title, content };
    if (format) body.format = format;
    const response = await this.fetch(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/wikis`,
      {

        method: "POST",
        body: JSON.stringify(body),
      }
    );
    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabWikiPageSchema.parse(data);
  }

  /**
   * Update an existing wiki page
   */
  async updateWikiPage(
    projectId: string,
    slug: string,
    title?: string,
    content?: string,
    format?: string
  ): Promise<GitLabWikiPage> {
    projectId = decodeURIComponent(projectId);
    const body: Record<string, any> = {};
    if (title) body.title = title;
    if (content) body.content = content;
    if (format) body.format = format;
    const response = await this.fetch(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
      {

        method: "PUT",
        body: JSON.stringify(body),
      }
    );
    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabWikiPageSchema.parse(data);
  }

  /**
   * Delete a wiki page
   */
  async deleteWikiPage(projectId: string, slug: string): Promise<void> {
    projectId = decodeURIComponent(projectId);
    const response = await this.fetch(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
      {

        method: "DELETE",
      }
    );
    await this.handleGitLabError(response);
  }

  /**
   * List pipelines in a GitLab project
   */
  async listPipelines(
    projectId: string,
    options: Omit<ListPipelinesOptions, "project_id"> = {}
  ): Promise<GitLabPipeline[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/pipelines`);

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value.toString());
      }
    });

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabPipelineSchema).parse(data);
  }

  /**
   * Get details of a specific pipeline
   */
  async getPipeline(projectId: string, pipelineId: number): Promise<GitLabPipeline> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/pipelines/${pipelineId}`
    );

    const response = await this.fetch(url.toString(), {});

    if (response.status === 404) {
      throw new Error(`Pipeline not found`);
    }

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabPipelineSchema.parse(data);
  }

  /**
   * List all jobs in a specific pipeline
   */
  async listPipelineJobs(
    projectId: string,
    pipelineId: number,
    options: Omit<ListPipelineJobsOptions, "project_id" | "pipeline_id"> = {}
  ): Promise<GitLabPipelineJob[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/jobs`
    );

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (typeof value === "boolean") {
          url.searchParams.append(key, value ? "true" : "false");
        } else {
          url.searchParams.append(key, value.toString());
        }
      }
    });

    const response = await this.fetch(url.toString(), {});

    if (response.status === 404) {
      throw new Error(`Pipeline not found`);
    }

    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabPipelineJobSchema).parse(data);
  }

  /**
   * Get a specific pipeline job
   */
  async getPipelineJob(projectId: string, jobId: number): Promise<GitLabPipelineJob> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/jobs/${jobId}`);

    const response = await this.fetch(url.toString(), {});

    if (response.status === 404) {
      throw new Error(`Job not found`);
    }

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabPipelineJobSchema.parse(data);
  }

  /**
   * Get the output/trace of a pipeline job
   */
  async getPipelineJobOutput(projectId: string, jobId: number, limit?: number, offset?: number): Promise<string> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/jobs/${jobId}/trace`
    );

    const response = await this.fetch(url.toString(), {
      headers: {
        Accept: "text/plain",
      },
    });

    if (response.status === 404) {
      throw new Error(`Job trace not found or job is not finished yet`);
    }

    await this.handleGitLabError(response);
    const fullTrace = await response.text();

    // Apply client-side pagination
    if (limit !== undefined || offset !== undefined) {
      const lines = fullTrace.split('\n');
      const startOffset = offset || 0;
      const maxLines = limit || 1000;

      const startIndex = Math.max(0, lines.length - startOffset - maxLines);
      const endIndex = lines.length - startOffset;

      const selectedLines = lines.slice(startIndex, endIndex);
      const result = selectedLines.join('\n');

      if (startIndex > 0 || endIndex < lines.length) {
        const totalLines = lines.length;
        const shownLines = selectedLines.length;
        const skippedFromStart = startIndex;
        const skippedFromEnd = startOffset;

        return `[Log truncated: showing ${shownLines} of ${totalLines} lines, skipped ${skippedFromStart} from start, ${skippedFromEnd} from end]\n\n${result}`;
      }

      return result;
    }

    return fullTrace;
  }

  /**
   * Create a new pipeline
   */
  async createPipeline(
    projectId: string,
    ref: string,
    variables?: Array<{ key: string; value: string }>
  ): Promise<GitLabPipeline> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/pipeline`);

    const body: any = { ref };
    if (variables && variables.length > 0) {
      body.variables = variables
    }

    const response = await this.fetch(url.toString(), {
      method: "POST",
      body: JSON.stringify(body),
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabPipelineSchema.parse(data);
  }

  /**
   * Retry a pipeline
   */
  async retryPipeline(projectId: string, pipelineId: number): Promise<GitLabPipeline> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/retry`
    );

    const response = await this.fetch(url.toString(), {
      method: "POST",
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabPipelineSchema.parse(data);
  }

  /**
   * Cancel a pipeline
   */
  async cancelPipeline(projectId: string, pipelineId: number): Promise<GitLabPipeline> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/cancel`
    );

    const response = await this.fetch(url.toString(), {
      method: "POST",
    });

    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabPipelineSchema.parse(data);
  }

  /**
   * Get the repository tree for a project
   */
  async getRepositoryTree(options: GetRepositoryTreeOptions): Promise<GitLabTreeItem[]> {
    options.project_id = decodeURIComponent(options.project_id);
    const queryParams = new URLSearchParams();
    if (options.path) queryParams.append("path", options.path);
    if (options.ref) queryParams.append("ref", options.ref);
    if (options.recursive) queryParams.append("recursive", "true");
    if (options.per_page) queryParams.append("per_page", options.per_page.toString());
    if (options.page_token) queryParams.append("page_token", options.page_token);
    if (options.pagination) queryParams.append("pagination", options.pagination);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.IS_OLD) {
      headers["Private-Token"] = `${config.GITLAB_PERSONAL_ACCESS_TOKEN}`;
    } else {
      headers["Authorization"] = `Bearer ${config.GITLAB_PERSONAL_ACCESS_TOKEN}`;
    }
    const response = await this.fetch(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
        options.project_id
      )}/repository/tree?${queryParams.toString()}`,
      {
        headers,
      }
    );

    if (response.status === 404) {
      throw new Error("Repository or path not found");
    }

    if (!response.ok) {
      throw new Error(`Failed to get repository tree: ${response.statusText}`);
    }

    const data = await response.json();
    return z.array(GitLabTreeItemSchema).parse(data);
  }

  /**
   * List project milestones in a GitLab project
   */
  async listProjectMilestones(
    projectId: string,
    options: Omit<z.infer<typeof ListProjectMilestonesSchema>, "project_id">
  ): Promise<GitLabMilestones[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/milestones`);

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === "iids" && Array.isArray(value) && value.length > 0) {
          value.forEach(iid => {
            url.searchParams.append("iids[]", iid.toString());
          });
        } else if (value !== undefined) {
          url.searchParams.append(key, value.toString());
        }
      }
    });

    const response = await this.fetch(url.toString(), {});
    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabMilestonesSchema).parse(data);
  }

  /**
   * Get a single milestone in a GitLab project
   */
  async getProjectMilestone(
    projectId: string,
    milestoneId: number
  ): Promise<GitLabMilestones> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
    );

    const response = await this.fetch(url.toString(), {});
    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabMilestonesSchema.parse(data);
  }

  /**
   * Create a new milestone in a GitLab project
   */
  async createProjectMilestone(
    projectId: string,
    options: Omit<z.infer<typeof CreateProjectMilestoneSchema>, "project_id">
  ): Promise<GitLabMilestones> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(`${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/milestones`);

    const response = await this.fetch(url.toString(), {

      method: "POST",
      body: JSON.stringify(options),
    });
    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabMilestonesSchema.parse(data);
  }

  /**
   * Edit an existing milestone in a GitLab project
   */
  async editProjectMilestone(
    projectId: string,
    milestoneId: number,
    options: Omit<z.infer<typeof EditProjectMilestoneSchema>, "project_id" | "milestone_id">
  ): Promise<GitLabMilestones> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
    );

    const response = await this.fetch(url.toString(), {

      method: "PUT",
      body: JSON.stringify(options),
    });
    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabMilestonesSchema.parse(data);
  }

  /**
   * Delete a milestone from a GitLab project
   */
  async deleteProjectMilestone(projectId: string, milestoneId: number): Promise<void> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
    );

    const response = await this.fetch(url.toString(), {

      method: "DELETE",
    });
    await this.handleGitLabError(response);
  }

  /**
   * Get all issues assigned to a single milestone
   */
  async getMilestoneIssues(projectId: string, milestoneId: number): Promise<GitLabIssue[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/milestones/${milestoneId}/issues`
    );

    const response = await this.fetch(url.toString(), {});
    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabIssueSchema).parse(data);
  }

  /**
   * Get all merge requests assigned to a single milestone
   */
  async getMilestoneMergeRequests(
    projectId: string,
    milestoneId: number
  ): Promise<GitLabMergeRequest[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
        this.getEffectiveProjectId(projectId)
      )}/milestones/${milestoneId}/merge_requests`
    );

    const response = await this.fetch(url.toString(), {});
    await this.handleGitLabError(response);
    const data = await response.json();
    return z.array(GitLabMergeRequestSchema).parse(data);
  }

  /**
   * Promote a project milestone to a group milestone
   */
  async promoteProjectMilestone(
    projectId: string,
    milestoneId: number
  ): Promise<GitLabMilestones> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/milestones/${milestoneId}/promote`
    );

    const response = await this.fetch(url.toString(), {

      method: "POST",
    });
    await this.handleGitLabError(response);
    const data = await response.json();
    return GitLabMilestonesSchema.parse(data);
  }

  /**
   * Get all burndown chart events for a single milestone
   */
  async getMilestoneBurndownEvents(projectId: string, milestoneId: number): Promise<any[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(
        this.getEffectiveProjectId(projectId)
      )}/milestones/${milestoneId}/burndown_events`
    );

    const response = await this.fetch(url.toString(), {});
    await this.handleGitLabError(response);
    const data = await response.json();
    return data as any[];
  }

  /**
   * Get a single user from GitLab
   */
  async getUser(username: string): Promise<GitLabUser | null> {
    try {
      const url = new URL(`${config.GITLAB_API_URL}/users`);
      url.searchParams.append("username", username);

      const response = await this.fetch(url.toString(), {

      });

      await this.handleGitLabError(response);

      const users = await response.json();

      if (Array.isArray(users) && users.length > 0) {
        const exactMatch = users.find(user => user.username === username);
        if (exactMatch) {
          return GitLabUserSchema.parse(exactMatch);
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching user by username '${username}':`, error);
      return null;
    }
  }

  /**
   * Get multiple users from GitLab
   */
  async getUsers(usernames: string[]): Promise<GitLabUsersResponse> {
    const users: Record<string, GitLabUser | null> = {};

    for (const username of usernames) {
      try {
        const user = await this.getUser(username);
        users[username] = user;
      } catch (error) {
        console.error(`Error processing username '${username}':`, error);
        users[username] = null;
      }
    }

    return GitLabUsersResponseSchema.parse(users);
  }

  /**
   * List repository commits
   */
  async listCommits(
    projectId: string,
    options: Omit<ListCommitsOptions, "project_id"> = {}
  ): Promise<GitLabCommit[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/repository/commits`
    );

    if (options.ref_name) url.searchParams.append("ref_name", options.ref_name);
    if (options.since) url.searchParams.append("since", options.since);
    if (options.until) url.searchParams.append("until", options.until);
    if (options.path) url.searchParams.append("path", options.path);
    if (options.author) url.searchParams.append("author", options.author);
    if (options.all) url.searchParams.append("all", options.all.toString());
    if (options.with_stats) url.searchParams.append("with_stats", options.with_stats.toString());
    if (options.first_parent) url.searchParams.append("first_parent", options.first_parent.toString());
    if (options.order) url.searchParams.append("order", options.order);
    if (options.trailers) url.searchParams.append("trailers", options.trailers.toString());
    if (options.page) url.searchParams.append("page", options.page.toString());
    if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);

    const data = await response.json();
    return z.array(GitLabCommitSchema).parse(data);
  }

  /**
   * Get a single commit
   */
  async getCommit(
    projectId: string,
    sha: string,
    stats?: boolean
  ): Promise<GitLabCommit> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/repository/commits/${encodeURIComponent(sha)}`
    );

    if (stats) {
      url.searchParams.append("stats", "true");
    }

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);

    const data = await response.json();
    return GitLabCommitSchema.parse(data);
  }

  /**
   * Get commit diff
   */
  async getCommitDiff(
    projectId: string,
    sha: string
  ): Promise<GitLabMergeRequestDiff[]> {
    projectId = decodeURIComponent(projectId);
    const url = new URL(
      `${config.GITLAB_API_URL}/projects/${encodeURIComponent(this.getEffectiveProjectId(projectId))}/repository/commits/${encodeURIComponent(sha)}/diff`
    );

    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);

    const data = await response.json();
    return z.array(GitLabDiffSchema).parse(data);
  }

  /**
   * Get details of the current authenticated User
   */
  async getCurrentUser(): Promise<GitLabUser> {
    const url = new URL(`${config.GITLAB_API_URL}/user`);
    const response = await this.fetch(url.toString(), {});

    await this.handleGitLabError(response);

    const data = await response.json();
    return GitLabUserSchema.parse(data);
  }
}
