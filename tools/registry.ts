import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { toJSONSchema } from "../utils/schema.js";
import {
  USE_GITLAB_WIKI,
  USE_MILESTONE,
  USE_PIPELINE,
} from "../config.js";
import {
  ApproveMergeRequestSchema,
  BulkPublishDraftNotesSchema,
  CancelPipelineJobSchema,
  CancelPipelineSchema,
  ConvertWorkItemTypeSchema,
  CreateBranchSchema,
  CreateDraftNoteSchema,
  CreateGroupWikiPageSchema,
  CreateIssueLinkSchema,
  CreateIssueNoteSchema,
  CreateIssueSchema,
  CreateLabelSchema,
  CreateMergeRequestDiscussionNoteSchema,
  CreateMergeRequestNoteSchema,
  CreateMergeRequestSchema,
  CreateMergeRequestThreadSchema,
  CreateNoteSchema,
  CreateOrUpdateFileSchema,
  CreatePipelineSchema,
  CreateProjectMilestoneSchema,
  CreateReleaseEvidenceSchema,
  CreateReleaseSchema,
  CreateRepositorySchema,
  CreateTimelineEventSchema,
  CreateWikiPageSchema,
  CreateWorkItemNoteSchema,
  CreateWorkItemSchema,
  DeleteDraftNoteSchema,
  DeleteGroupWikiPageSchema,
  DeleteIssueLinkSchema,
  DeleteIssueSchema,
  DeleteLabelSchema,
  DeleteMergeRequestDiscussionNoteSchema,
  DeleteMergeRequestNoteSchema,
  DeleteProjectMilestoneSchema,
  DeleteReleaseSchema,
  DeleteWikiPageSchema,
  DownloadAttachmentSchema,
  DownloadJobArtifactsSchema,
  DownloadReleaseAssetSchema,
  EditProjectMilestoneSchema,
  ExecuteGraphQLSchema,
  ForkRepositorySchema,
  GetBranchDiffsSchema,
  GetCommitDiffSchema,
  GetCommitSchema,
  GetDeploymentSchema,
  GetDraftNoteSchema,
  GetEnvironmentSchema,
  GetFileContentsSchema,
  GetGroupWikiPageSchema,
  GetIssueLinkSchema,
  GetIssueSchema,
  GetJobArtifactFileSchema,
  GetLabelSchema,
  GetMergeRequestApprovalStateSchema,
  GetMergeRequestConflictsSchema,
  GetMergeRequestDiffsSchema,
  GetMergeRequestFileDiffSchema,
  GetMergeRequestNoteSchema,
  GetMergeRequestNotesSchema,
  GetMergeRequestSchema,
  GetMergeRequestVersionSchema,
  GetMilestoneBurndownEventsSchema,
  GetMilestoneIssuesSchema,
  GetMilestoneMergeRequestsSchema,
  GetNamespaceSchema,
  GetPipelineJobOutputSchema,
  GetPipelineSchema,
  GetProjectEventsSchema,
  GetProjectMilestoneSchema,
  GetProjectSchema,
  GetReleaseSchema,
  GetRepositoryTreeSchema,
  GetTimelineEventsSchema,
  GetUsersSchema,
  GetWebhookEventSchema,
  GetWikiPageSchema,
  GetWorkItemSchema,
  ListCommitsSchema,
  ListCustomFieldDefinitionsSchema,
  ListDeploymentsSchema,
  ListDraftNotesSchema,
  ListEnvironmentsSchema,
  ListEventsSchema,
  ListGroupIterationsSchema,
  ListGroupProjectsSchema,
  ListGroupWikiPagesSchema,
  ListIssueDiscussionsSchema,
  ListIssueLinksSchema,
  ListIssuesSchema,
  ListJobArtifactsSchema,
  ListLabelsSchema,
  ListMergeRequestChangedFilesSchema,
  ListMergeRequestDiffsSchema,
  ListMergeRequestDiscussionsSchema,
  ListMergeRequestVersionsSchema,
  ListMergeRequestsSchema,
  ListNamespacesSchema,
  ListPipelineJobsSchema,
  ListPipelineTriggerJobsSchema,
  ListPipelinesSchema,
  ListProjectMembersSchema,
  ListProjectMilestonesSchema,
  ListProjectsSchema,
  ListReleasesSchema,
  ListWebhookEventsSchema,
  ListWebhooksSchema,
  ListWikiPagesSchema,
  ListWorkItemNotesSchema,
  ListWorkItemStatusesSchema,
  ListWorkItemsSchema,
  MarkdownUploadSchema,
  MergeMergeRequestSchema,
  MoveWorkItemSchema,
  MyIssuesSchema,
  PlayPipelineJobSchema,
  PromoteProjectMilestoneSchema,
  PublishDraftNoteSchema,
  PushFilesSchema,
  ResolveMergeRequestThreadSchema,
  RetryPipelineJobSchema,
  RetryPipelineSchema,
  SearchCodeSchema,
  SearchGroupCodeSchema,
  SearchProjectCodeSchema,
  SearchRepositoriesSchema,
  UnapproveMergeRequestSchema,
  UpdateDraftNoteSchema,
  UpdateGroupWikiPageSchema,
  UpdateIssueNoteSchema,
  UpdateIssueSchema,
  UpdateLabelSchema,
  UpdateMergeRequestDiscussionNoteSchema,
  UpdateMergeRequestNoteSchema,
  UpdateMergeRequestSchema,
  UpdateReleaseSchema,
  UpdateWikiPageSchema,
  UpdateWorkItemSchema,
  VerifyNamespaceSchema,
} from "../schemas.js";


// Define all available tools
export const allTools = [
  {
    name: "merge_merge_request",
    description: "Merge a merge request in a GitLab project",
    inputSchema: toJSONSchema(MergeMergeRequestSchema),
  },
  {
    name: "approve_merge_request",
    description: "Approve a merge request. Requires appropriate permissions.",
    inputSchema: toJSONSchema(ApproveMergeRequestSchema),
  },
  {
    name: "unapprove_merge_request",
    description: "Unapprove a previously approved merge request. Requires appropriate permissions.",
    inputSchema: toJSONSchema(UnapproveMergeRequestSchema),
  },
  {
    name: "get_merge_request_approval_state",
    description:
      "Get merge request approval details including approvers (uses approval_state when available, falls back to approvals endpoint)",
    inputSchema: toJSONSchema(GetMergeRequestApprovalStateSchema),
  },
  {
    name: "get_merge_request_conflicts",
    description:
      "Get the conflicts of a merge request in a GitLab project",
    inputSchema: toJSONSchema(GetMergeRequestConflictsSchema),
  },
  {
    name: "execute_graphql",
    description: "Execute a GitLab GraphQL query",
    inputSchema: zodToJsonSchema(ExecuteGraphQLSchema),
  },
  {
    name: "create_or_update_file",
    description: "Create or update a single file in a GitLab project",
    inputSchema: toJSONSchema(CreateOrUpdateFileSchema),
  },
  {
    name: "search_repositories",
    description: "Search for GitLab projects",
    inputSchema: toJSONSchema(SearchRepositoriesSchema),
  },
  {
    name: "create_repository",
    description: "Create a new GitLab project",
    inputSchema: toJSONSchema(CreateRepositorySchema),
  },
  {
    name: "get_file_contents",
    description: "Get the contents of a file or directory from a GitLab project",
    inputSchema: toJSONSchema(GetFileContentsSchema),
  },
  {
    name: "push_files",
    description: "Push multiple files to a GitLab project in a single commit",
    inputSchema: toJSONSchema(PushFilesSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue in a GitLab project",
    inputSchema: toJSONSchema(CreateIssueSchema),
  },
  {
    name: "create_merge_request",
    description: "Create a new merge request in a GitLab project",
    inputSchema: toJSONSchema(CreateMergeRequestSchema),
  },
  {
    name: "fork_repository",
    description: "Fork a GitLab project to your account or specified namespace",
    inputSchema: toJSONSchema(ForkRepositorySchema),
  },
  {
    name: "create_branch",
    description: "Create a new branch in a GitLab project",
    inputSchema: toJSONSchema(CreateBranchSchema),
  },
  {
    name: "get_merge_request",
    description:
      "Get details of a merge request with compact deployment, commit addition, and approval summaries (Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(GetMergeRequestSchema),
  },
  {
    name: "get_merge_request_diffs",
    description:
      "Get the changes/diffs of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(GetMergeRequestDiffsSchema),
  },
  {
    name: "list_merge_request_changed_files",
    description:
      "STEP 1 of code review workflow. " +
      "Returns ONLY the list of changed file paths in a merge request — WITHOUT diff content. " +
      "Call this first to get file paths, then call get_merge_request_file_diff with multiple files in a single batched call (recommended 3-5 files per call). " +
      "This avoids loading the entire diff payload at once and reduces API calls. " +
      "Supports excluded_file_patterns filtering using regex. " +
      "Returns: new_path, old_path, new_file, deleted_file, renamed_file flags for each file. " +
      "(Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(ListMergeRequestChangedFilesSchema),
  },
  {
    name: "list_merge_request_diffs",
    description:
      "List merge request diffs with pagination support (Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(ListMergeRequestDiffsSchema),
  },
  {
    name: "get_merge_request_file_diff",
    description:
      "STEP 2 of code review workflow. " +
      "Get diffs for one or more files from a merge request. " +
      "Call list_merge_request_changed_files first to get file paths, then pass them as an array to fetch their diffs efficiently. " +
      "Batching multiple files (recommended 3-5) is supported and preferred over individual requests. " +
      "Returns an array of results - one per requested file path. Files not found are returned with error messages. " +
      "(Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(GetMergeRequestFileDiffSchema),
  },
  {
    name: "list_merge_request_versions",
    description: "List all versions of a merge request",
    inputSchema: toJSONSchema(ListMergeRequestVersionsSchema),
  },
  {
    name: "get_merge_request_version",
    description: "Get a specific version of a merge request",
    inputSchema: toJSONSchema(GetMergeRequestVersionSchema),
  },
  {
    name: "get_branch_diffs",
    description: "Get the changes/diffs between two branches or commits in a GitLab project",
    inputSchema: toJSONSchema(GetBranchDiffsSchema),
  },
  {
    name: "update_merge_request",
    description: "Update a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(UpdateMergeRequestSchema),
  },
  {
    name: "create_note",
    description: "Create a new note (comment) to an issue or merge request",
    inputSchema: toJSONSchema(CreateNoteSchema),
  },
  {
    name: "create_merge_request_thread",
    description: "Create a new thread on a merge request",
    inputSchema: toJSONSchema(CreateMergeRequestThreadSchema),
  },
  {
    name: "resolve_merge_request_thread",
    description: "Resolve a thread on a merge request",
    inputSchema: toJSONSchema(ResolveMergeRequestThreadSchema),
  },
  {
    name: "mr_discussions",
    description: "List discussion items for a merge request",
    inputSchema: toJSONSchema(ListMergeRequestDiscussionsSchema),
  },
  {
    name: "delete_merge_request_discussion_note",
    description: "Delete a discussion note on a merge request",
    inputSchema: toJSONSchema(DeleteMergeRequestDiscussionNoteSchema),
  },
  {
    name: "update_merge_request_discussion_note",
    description: "Update a discussion note on a merge request",
    inputSchema: toJSONSchema(UpdateMergeRequestDiscussionNoteSchema),
  },
  {
    name: "create_merge_request_discussion_note",
    description: "Add a new discussion note to an existing merge request thread",
    inputSchema: toJSONSchema(CreateMergeRequestDiscussionNoteSchema),
  },
  {
    name: "create_merge_request_note",
    description: "Add a new note to a merge request",
    inputSchema: toJSONSchema(CreateMergeRequestNoteSchema),
  },
  {
    name: "delete_merge_request_note",
    description: "Delete an existing merge request note",
    inputSchema: toJSONSchema(DeleteMergeRequestNoteSchema),
  },
  {
    name: "get_merge_request_note",
    description: "Get a specific note for a merge request",
    inputSchema: toJSONSchema(GetMergeRequestNoteSchema),
  },
  {
    name: "get_merge_request_notes",
    description: "List notes for a merge request",
    inputSchema: toJSONSchema(GetMergeRequestNotesSchema),
  },
  {
    name: "update_merge_request_note",
    description: "Modify an existing merge request note",
    inputSchema: toJSONSchema(UpdateMergeRequestNoteSchema),
  },
  {
    name: "get_draft_note",
    description: "Get a single draft note from a merge request",
    inputSchema: toJSONSchema(GetDraftNoteSchema),
  },
  {
    name: "list_draft_notes",
    description: "List draft notes for a merge request",
    inputSchema: toJSONSchema(ListDraftNotesSchema),
  },
  {
    name: "create_draft_note",
    description: "Create a draft note for a merge request",
    inputSchema: toJSONSchema(CreateDraftNoteSchema),
  },
  {
    name: "update_draft_note",
    description: "Update an existing draft note",
    inputSchema: toJSONSchema(UpdateDraftNoteSchema),
  },
  {
    name: "delete_draft_note",
    description: "Delete a draft note",
    inputSchema: toJSONSchema(DeleteDraftNoteSchema),
  },
  {
    name: "publish_draft_note",
    description: "Publish a single draft note",
    inputSchema: toJSONSchema(PublishDraftNoteSchema),
  },
  {
    name: "bulk_publish_draft_notes",
    description: "Publish all draft notes for a merge request",
    inputSchema: toJSONSchema(BulkPublishDraftNotesSchema),
  },
  {
    name: "update_issue_note",
    description: "Modify an existing issue thread note",
    inputSchema: toJSONSchema(UpdateIssueNoteSchema),
  },
  {
    name: "create_issue_note",
    description: "Add a note to an issue. Creates a top-level comment, or replies to a discussion thread if discussion_id is provided",
    inputSchema: toJSONSchema(CreateIssueNoteSchema),
  },
  {
    name: "list_issues",
    description:
      "List issues (default: created by current user only; use scope='all' for all accessible issues)",
    inputSchema: toJSONSchema(ListIssuesSchema),
  },
  {
    name: "my_issues",
    description: "List issues assigned to the authenticated user (defaults to open issues)",
    inputSchema: toJSONSchema(MyIssuesSchema),
  },
  {
    name: "get_issue",
    description: "Get details of a specific issue in a GitLab project",
    inputSchema: toJSONSchema(GetIssueSchema),
  },
  {
    name: "update_issue",
    description: "Update an issue in a GitLab project",
    inputSchema: toJSONSchema(UpdateIssueSchema),
  },
  {
    name: "delete_issue",
    description: "Delete an issue from a GitLab project",
    inputSchema: toJSONSchema(DeleteIssueSchema),
  },
  {
    name: "list_issue_links",
    description: "List all issue links for a specific issue",
    inputSchema: toJSONSchema(ListIssueLinksSchema),
  },
  {
    name: "list_issue_discussions",
    description: "List discussions for an issue in a GitLab project",
    inputSchema: toJSONSchema(ListIssueDiscussionsSchema),
  },
  {
    name: "get_issue_link",
    description: "Get a specific issue link",
    inputSchema: toJSONSchema(GetIssueLinkSchema),
  },
  {
    name: "create_issue_link",
    description: "Create an issue link between two issues",
    inputSchema: toJSONSchema(CreateIssueLinkSchema),
  },
  {
    name: "delete_issue_link",
    description: "Delete an issue link",
    inputSchema: toJSONSchema(DeleteIssueLinkSchema),
  },
  {
    name: "list_namespaces",
    description: "List all namespaces available to the current user",
    inputSchema: toJSONSchema(ListNamespacesSchema),
  },
  {
    name: "get_namespace",
    description: "Get details of a namespace by ID or path",
    inputSchema: toJSONSchema(GetNamespaceSchema),
  },
  {
    name: "verify_namespace",
    description: "Verify if a namespace path exists",
    inputSchema: toJSONSchema(VerifyNamespaceSchema),
  },
  {
    name: "get_project",
    description: "Get details of a specific project",
    inputSchema: toJSONSchema(GetProjectSchema),
  },
  {
    name: "list_projects",
    description: "List projects accessible by the current user",
    inputSchema: toJSONSchema(ListProjectsSchema),
  },
  {
    name: "list_project_members",
    description: "List members of a GitLab project",
    inputSchema: toJSONSchema(ListProjectMembersSchema),
  },
  {
    name: "list_labels",
    description: "List labels for a project",
    inputSchema: toJSONSchema(ListLabelsSchema),
  },
  {
    name: "get_label",
    description: "Get a single label from a project",
    inputSchema: toJSONSchema(GetLabelSchema),
  },
  {
    name: "create_label",
    description: "Create a new label in a project",
    inputSchema: toJSONSchema(CreateLabelSchema),
  },
  {
    name: "update_label",
    description: "Update an existing label in a project",
    inputSchema: toJSONSchema(UpdateLabelSchema),
  },
  {
    name: "delete_label",
    description: "Delete a label from a project",
    inputSchema: toJSONSchema(DeleteLabelSchema),
  },
  {
    name: "list_group_projects",
    description: "List projects in a GitLab group with filtering options",
    inputSchema: toJSONSchema(ListGroupProjectsSchema),
  },
  {
    name: "list_wiki_pages",
    description: "List wiki pages in a GitLab project",
    inputSchema: toJSONSchema(ListWikiPagesSchema),
  },
  {
    name: "get_wiki_page",
    description: "Get details of a specific wiki page",
    inputSchema: toJSONSchema(GetWikiPageSchema),
  },
  {
    name: "create_wiki_page",
    description: "Create a new wiki page in a GitLab project",
    inputSchema: toJSONSchema(CreateWikiPageSchema),
  },
  {
    name: "update_wiki_page",
    description: "Update an existing wiki page in a GitLab project",
    inputSchema: toJSONSchema(UpdateWikiPageSchema),
  },
  {
    name: "delete_wiki_page",
    description: "Delete a wiki page from a GitLab project",
    inputSchema: toJSONSchema(DeleteWikiPageSchema),
  },
  {
    name: "list_group_wiki_pages",
    description: "List wiki pages in a GitLab group",
    inputSchema: toJSONSchema(ListGroupWikiPagesSchema),
  },
  {
    name: "get_group_wiki_page",
    description: "Get details of a specific group wiki page",
    inputSchema: toJSONSchema(GetGroupWikiPageSchema),
  },
  {
    name: "create_group_wiki_page",
    description: "Create a new wiki page in a GitLab group",
    inputSchema: toJSONSchema(CreateGroupWikiPageSchema),
  },
  {
    name: "update_group_wiki_page",
    description: "Update an existing wiki page in a GitLab group",
    inputSchema: toJSONSchema(UpdateGroupWikiPageSchema),
  },
  {
    name: "delete_group_wiki_page",
    description: "Delete a wiki page from a GitLab group",
    inputSchema: toJSONSchema(DeleteGroupWikiPageSchema),
  },
  {
    name: "get_repository_tree",
    description: "Get the repository tree for a GitLab project (list files and directories)",
    inputSchema: toJSONSchema(GetRepositoryTreeSchema),
  },
  {
    name: "list_pipelines",
    description: "List pipelines in a GitLab project with filtering options",
    inputSchema: toJSONSchema(ListPipelinesSchema),
  },
  {
    name: "get_pipeline",
    description: "Get details of a specific pipeline in a GitLab project",
    inputSchema: toJSONSchema(GetPipelineSchema),
  },
  {
    name: "list_deployments",
    description: "List deployments in a GitLab project with filtering options",
    inputSchema: toJSONSchema(ListDeploymentsSchema),
  },
  {
    name: "get_deployment",
    description: "Get details of a specific deployment in a GitLab project",
    inputSchema: toJSONSchema(GetDeploymentSchema),
  },
  {
    name: "list_environments",
    description: "List environments in a GitLab project",
    inputSchema: toJSONSchema(ListEnvironmentsSchema),
  },
  {
    name: "get_environment",
    description: "Get details of a specific environment in a GitLab project",
    inputSchema: toJSONSchema(GetEnvironmentSchema),
  },
  {
    name: "list_pipeline_jobs",
    description: "List all jobs in a specific pipeline",
    inputSchema: toJSONSchema(ListPipelineJobsSchema),
  },
  {
    name: "list_pipeline_trigger_jobs",
    description:
      "List all trigger jobs (bridges) in a specific pipeline that trigger downstream pipelines",
    inputSchema: toJSONSchema(ListPipelineTriggerJobsSchema),
  },
  {
    name: "get_pipeline_job",
    description: "Get details of a GitLab pipeline job number",
    inputSchema: toJSONSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "get_pipeline_job_output",
    description:
      "Get the output/trace of a GitLab pipeline job with optional pagination to limit context window usage",
    inputSchema: toJSONSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "create_pipeline",
    description: "Create a new pipeline for a branch or tag",
    inputSchema: toJSONSchema(CreatePipelineSchema),
  },
  {
    name: "retry_pipeline",
    description: "Retry a failed or canceled pipeline",
    inputSchema: toJSONSchema(RetryPipelineSchema),
  },
  {
    name: "cancel_pipeline",
    description: "Cancel a running pipeline",
    inputSchema: toJSONSchema(CancelPipelineSchema),
  },
  {
    name: "play_pipeline_job",
    description: "Run a manual pipeline job",
    inputSchema: toJSONSchema(PlayPipelineJobSchema),
  },
  {
    name: "retry_pipeline_job",
    description: "Retry a failed or canceled pipeline job",
    inputSchema: toJSONSchema(RetryPipelineJobSchema),
  },
  {
    name: "cancel_pipeline_job",
    description: "Cancel a running pipeline job",
    inputSchema: toJSONSchema(CancelPipelineJobSchema),
  },
  {
    name: "list_job_artifacts",
    description: "List artifact files in a job's artifacts archive. Returns file names, paths, types, and sizes.",
    inputSchema: toJSONSchema(ListJobArtifactsSchema),
  },
  {
    name: "download_job_artifacts",
    description:
      "Download the entire artifact archive (zip) for a job to a local path. Returns the saved file path.",
    inputSchema: toJSONSchema(DownloadJobArtifactsSchema),
  },
  {
    name: "get_job_artifact_file",
    description:
      "Get the content of a single file from a job's artifacts by its path within the archive",
    inputSchema: toJSONSchema(GetJobArtifactFileSchema),
  },
  {
    name: "list_merge_requests",
    description:
      "List merge requests. Without project_id, lists MRs assigned to the authenticated user by default (use scope='all' for all accessible MRs). With project_id, lists MRs for that specific project.",
    inputSchema: toJSONSchema(ListMergeRequestsSchema),
  },
  {
    name: "list_milestones",
    description: "List milestones in a GitLab project with filtering options",
    inputSchema: toJSONSchema(ListProjectMilestonesSchema),
  },
  {
    name: "get_milestone",
    description: "Get details of a specific milestone",
    inputSchema: toJSONSchema(GetProjectMilestoneSchema),
  },
  {
    name: "create_milestone",
    description: "Create a new milestone in a GitLab project",
    inputSchema: toJSONSchema(CreateProjectMilestoneSchema),
  },
  {
    name: "edit_milestone",
    description: "Edit an existing milestone in a GitLab project",
    inputSchema: toJSONSchema(EditProjectMilestoneSchema),
  },
  {
    name: "delete_milestone",
    description: "Delete a milestone from a GitLab project",
    inputSchema: toJSONSchema(DeleteProjectMilestoneSchema),
  },
  {
    name: "get_milestone_issue",
    description: "Get issues associated with a specific milestone",
    inputSchema: toJSONSchema(GetMilestoneIssuesSchema),
  },
  {
    name: "get_milestone_merge_requests",
    description: "Get merge requests associated with a specific milestone",
    inputSchema: toJSONSchema(GetMilestoneMergeRequestsSchema),
  },
  {
    name: "promote_milestone",
    description: "Promote a milestone to the next stage",
    inputSchema: toJSONSchema(PromoteProjectMilestoneSchema),
  },
  {
    name: "get_milestone_burndown_events",
    description: "Get burndown events for a specific milestone",
    inputSchema: toJSONSchema(GetMilestoneBurndownEventsSchema),
  },
  {
    name: "get_users",
    description: "Get GitLab user details by usernames",
    inputSchema: toJSONSchema(GetUsersSchema),
  },
  {
    name: "list_commits",
    description: "List repository commits with filtering options",
    inputSchema: toJSONSchema(ListCommitsSchema),
  },
  {
    name: "get_commit",
    description: "Get details of a specific commit",
    inputSchema: toJSONSchema(GetCommitSchema),
  },
  {
    name: "get_commit_diff",
    description: "Get changes/diffs of a specific commit",
    inputSchema: toJSONSchema(GetCommitDiffSchema),
  },
  {
    name: "list_group_iterations",
    description: "List group iterations with filtering options",
    inputSchema: toJSONSchema(ListGroupIterationsSchema),
  },
  {
    name: "upload_markdown",
    description: "Upload a file to a GitLab project for use in markdown content",
    inputSchema: toJSONSchema(MarkdownUploadSchema),
  },
  {
    name: "download_attachment",
    description:
      "Download an uploaded file from a GitLab project by secret and filename. Image files (png, jpg, gif, webp, svg, bmp, ico) are returned inline as base64 image content so the AI can view them directly. Non-image files are saved to disk. Use local_path to force saving image files to disk instead.",
    inputSchema: toJSONSchema(DownloadAttachmentSchema),
  },
  {
    name: "list_events",
    description:
      "List all events for the currently authenticated user. Note: before/after parameters accept date format YYYY-MM-DD only",
    inputSchema: toJSONSchema(ListEventsSchema),
  },
  {
    name: "get_project_events",
    description:
      "List all visible events for a specified project. Note: before/after parameters accept date format YYYY-MM-DD only",
    inputSchema: toJSONSchema(GetProjectEventsSchema),
  },
  {
    name: "list_releases",
    description: "List all releases for a project",
    inputSchema: toJSONSchema(ListReleasesSchema),
  },
  {
    name: "get_release",
    description: "Get a release by tag name",
    inputSchema: toJSONSchema(GetReleaseSchema),
  },
  {
    name: "create_release",
    description: "Create a new release in a GitLab project",
    inputSchema: toJSONSchema(CreateReleaseSchema),
  },
  {
    name: "update_release",
    description: "Update an existing release in a GitLab project",
    inputSchema: toJSONSchema(UpdateReleaseSchema),
  },
  {
    name: "delete_release",
    description: "Delete a release from a GitLab project (does not delete the associated tag)",
    inputSchema: toJSONSchema(DeleteReleaseSchema),
  },
  {
    name: "create_release_evidence",
    description: "Create release evidence for an existing release (GitLab Premium/Ultimate only)",
    inputSchema: toJSONSchema(CreateReleaseEvidenceSchema),
  },
  {
    name: "download_release_asset",
    description: "Download a release asset file by direct asset path",
    inputSchema: toJSONSchema(DownloadReleaseAssetSchema),
  },
  // --- Work item tools (GraphQL-based) ---
  {
    name: "get_work_item",
    description:
      "Get a single work item with full details including status, hierarchy (parent/children), type, labels, assignees, and all widgets.",
    inputSchema: toJSONSchema(GetWorkItemSchema),
  },
  {
    name: "list_work_items",
    description:
      "List work items in a project with filters (type, state, search, assignees, labels). Returns items with status and hierarchy info.",
    inputSchema: toJSONSchema(ListWorkItemsSchema),
  },
  {
    name: "create_work_item",
    description:
      "Create a new work item (issue, task, incident, test_case, epic, key_result, objective, requirement, ticket). Supports setting title, description, labels, assignees, weight, parent, health status, start/due dates, milestone, and confidentiality.",
    inputSchema: toJSONSchema(CreateWorkItemSchema),
  },
  {
    name: "update_work_item",
    description:
      "Update a work item. Can modify title, description, labels, assignees, weight, state, status, parent hierarchy, children, health status, start/due dates, milestone, confidentiality, linked items, and custom fields.",
    inputSchema: toJSONSchema(UpdateWorkItemSchema),
  },
  {
    name: "convert_work_item_type",
    description:
      "Convert a work item to a different type (e.g. issue to task, task to incident).",
    inputSchema: toJSONSchema(ConvertWorkItemTypeSchema),
  },
  {
    name: "list_work_item_statuses",
    description:
      "List available statuses for a work item type in a project. Requires GitLab Premium/Ultimate with configurable statuses.",
    inputSchema: toJSONSchema(ListWorkItemStatusesSchema),
  },
  {
    name: "list_custom_field_definitions",
    description:
      "List available custom field definitions for a work item type in a project. Returns field names, types, and IDs needed for setting custom fields via update_work_item.",
    inputSchema: toJSONSchema(ListCustomFieldDefinitionsSchema),
  },
  {
    name: "move_work_item",
    description:
      "Move a work item (issue, task, etc.) to a different project. Uses GitLab GraphQL issueMove mutation.",
    inputSchema: toJSONSchema(MoveWorkItemSchema),
  },
  {
    name: "list_work_item_notes",
    description:
      "List notes and discussions on a work item. Returns threaded discussions with author, body, timestamps, and system/internal flags.",
    inputSchema: toJSONSchema(ListWorkItemNotesSchema),
  },
  {
    name: "create_work_item_note",
    description:
      "Add a note/comment to a work item. Supports Markdown, internal notes, and threaded replies.",
    inputSchema: toJSONSchema(CreateWorkItemNoteSchema),
  },
  // --- Incident timeline event tools ---
  {
    name: "get_timeline_events",
    description:
      "List timeline events for an incident. Returns chronological events with notes, timestamps, and tags (Start time, End time, Impact detected, etc.).",
    inputSchema: toJSONSchema(GetTimelineEventsSchema),
  },
  {
    name: "create_timeline_event",
    description:
      "Create a timeline event on an incident. Supports tags: 'Start time', 'End time', 'Impact detected', 'Response initiated', 'Impact mitigated', 'Cause identified'.",
    inputSchema: toJSONSchema(CreateTimelineEventSchema),
  },
  {
    name: "list_webhooks",
    description:
      "List all configured webhooks for a GitLab project or group. Provide either project_id or group_id.",
    inputSchema: toJSONSchema(ListWebhooksSchema),
  },
  {
    name: "list_webhook_events",
    description:
      "List recent webhook events (past 7 days) for a project or group webhook. Use summary mode for overview, then get_webhook_event for full details.",
    inputSchema: toJSONSchema(ListWebhookEventsSchema),
  },
  {
    name: "get_webhook_event",
    description:
      "Get full details of a specific webhook event by ID, including request/response payloads. Searches up to 500 most recent events.",
    inputSchema: toJSONSchema(GetWebhookEventSchema),
  },
  {
    name: "search_code",
    description:
      "Search for code across all projects on the GitLab instance (requires advanced search or exact code search to be enabled). If exact code search (Zoekt) is enabled, the search query supports rich syntax including file:, lang:, sym: filters.",
    inputSchema: toJSONSchema(SearchCodeSchema),
  },
  {
    name: "search_project_code",
    description:
      "Search for code within a specific GitLab project (requires advanced search or exact code search to be enabled). If exact code search (Zoekt) is enabled, the search query supports rich syntax including file:, lang:, sym: filters.",
    inputSchema: toJSONSchema(SearchProjectCodeSchema),
  },
  {
    name: "search_group_code",
    description:
      "Search for code within a specific GitLab group (requires advanced search or exact code search to be enabled). If exact code search (Zoekt) is enabled, the search query supports rich syntax including file:, lang:, sym: filters.",
    inputSchema: toJSONSchema(SearchGroupCodeSchema),
  },
];

// Define which tools are read-only
export const readOnlyTools = new Set([
  "search_repositories",
  "search_code",
  "search_project_code",
  "search_group_code",
  "execute_graphql",
  "get_file_contents",
  "get_merge_request",
  "get_merge_request_diffs",
  "list_merge_request_changed_files",
  "list_merge_request_diffs",
  "get_merge_request_file_diff",
  "list_merge_request_versions",
  "get_merge_request_version",
  "get_branch_diffs",
  "get_merge_request_note",
  "get_merge_request_notes",
  "get_draft_note",
  "list_draft_notes",
  "mr_discussions",
  "list_issues",
  "my_issues",
  "list_merge_requests",
  "get_issue",
  "list_issue_links",
  "list_issue_discussions",
  "get_issue_link",
  "list_namespaces",
  "get_namespace",
  "verify_namespace",
  "get_project",
  "list_projects",
  "list_project_members",
  "get_pipeline",
  "list_pipelines",
  "list_deployments",
  "get_deployment",
  "list_environments",
  "get_environment",
  "list_pipeline_jobs",
  "list_pipeline_trigger_jobs",
  "get_pipeline_job",
  "get_pipeline_job_output",
  "list_job_artifacts",
  "download_job_artifacts",
  "get_job_artifact_file",
  "list_labels",
  "get_label",
  "list_group_projects",
  "get_repository_tree",
  "list_milestones",
  "get_milestone",
  "get_milestone_issue",
  "get_milestone_merge_requests",
  "get_milestone_burndown_events",
  "list_wiki_pages",
  "get_wiki_page",
  "list_group_wiki_pages",
  "get_group_wiki_page",
  "get_users",
  "list_commits",
  "get_commit",
  "get_commit_diff",
  "list_group_iterations",
  "get_group_iteration",
  "download_attachment",
  "list_events",
  "get_project_events",
  "list_releases",
  "get_release",
  "download_release_asset",
  "get_merge_request_approval_state",
  "get_work_item",
  "list_work_items",
  "list_work_item_statuses",
  "list_custom_field_definitions",
  "list_work_item_notes",
  "get_timeline_events",
  "get_merge_request_conflicts",
  "list_webhooks",
  "list_webhook_events",
  "get_webhook_event",
]);

// Define which tools are related to wiki and can be toggled by USE_GITLAB_WIKI
export const wikiToolNames = new Set([
  "list_wiki_pages",
  "get_wiki_page",
  "create_wiki_page",
  "update_wiki_page",
  "delete_wiki_page",
  "list_group_wiki_pages",
  "get_group_wiki_page",
  "create_group_wiki_page",
  "update_group_wiki_page",
  "delete_group_wiki_page",
  "upload_wiki_attachment",
]);

// Define which tools are related to milestones and can be toggled by USE_MILESTONE
export const milestoneToolNames = new Set([
  "list_milestones",
  "get_milestone",
  "create_milestone",
  "edit_milestone",
  "delete_milestone",
  "get_milestone_issue",
  "get_milestone_merge_requests",
  "promote_milestone",
  "get_milestone_burndown_events",
]);

// Define which tools are related to pipelines and can be toggled by USE_PIPELINE
export const pipelineToolNames = new Set([
  "list_pipelines",
  "get_pipeline",
  "list_deployments",
  "get_deployment",
  "list_environments",
  "get_environment",
  "list_pipeline_jobs",
  "list_pipeline_trigger_jobs",
  "get_pipeline_job",
  "get_pipeline_job_output",
  "create_pipeline",
  "retry_pipeline",
  "cancel_pipeline",
  "play_pipeline_job",
  "retry_pipeline_job",
  "cancel_pipeline_job",
  "list_job_artifacts",
  "download_job_artifacts",
  "get_job_artifact_file",
]);

// --- Toolset definitions ---

export type ToolsetId =
  | "merge_requests"
  | "issues"
  | "repositories"
  | "branches"
  | "projects"
  | "labels"
  | "pipelines"
  | "milestones"
  | "wiki"
  | "releases"
  | "users"
  | "workitems"
  | "webhooks"
  | "search";

export interface ToolsetDefinition {
  readonly id: ToolsetId;
  readonly isDefault: boolean;
  readonly tools: ReadonlySet<string>;
}

export const TOOLSET_DEFINITIONS: readonly ToolsetDefinition[] = [
  {
    id: "merge_requests",
    isDefault: true,
    tools: new Set([
      "merge_merge_request",
      "approve_merge_request",
      "unapprove_merge_request",
      "get_merge_request_approval_state",
      "get_merge_request_conflicts",
      "get_merge_request",
      "get_merge_request_diffs",
      "list_merge_request_changed_files",
      "list_merge_request_diffs",
      "get_merge_request_file_diff",
      "list_merge_request_versions",
      "get_merge_request_version",
      "update_merge_request",
      "create_merge_request",
      "list_merge_requests",
      "get_branch_diffs",
      "mr_discussions",
      "create_merge_request_note",
      "update_merge_request_note",
      "delete_merge_request_note",
      "get_merge_request_note",
      "get_merge_request_notes",
      "delete_merge_request_discussion_note",
      "update_merge_request_discussion_note",
      "create_merge_request_discussion_note",
      "get_draft_note",
      "list_draft_notes",
      "create_draft_note",
      "update_draft_note",
      "delete_draft_note",
      "publish_draft_note",
      "bulk_publish_draft_notes",
      "create_merge_request_thread",
      "resolve_merge_request_thread",
    ]),
  },
  {
    id: "issues",
    isDefault: true,
    tools: new Set([
      "create_issue",
      "list_issues",
      "my_issues",
      "get_issue",
      "update_issue",
      "delete_issue",
      "create_issue_note",
      "update_issue_note",
      "list_issue_links",
      "list_issue_discussions",
      "get_issue_link",
      "create_issue_link",
      "delete_issue_link",
      "create_note",
    ]),
  },
  {
    id: "repositories",
    isDefault: true,
    tools: new Set([
      "search_repositories",
      "create_repository",
      "get_file_contents",
      "push_files",
      "create_or_update_file",
      "fork_repository",
      "get_repository_tree",
    ]),
  },
  {
    id: "branches",
    isDefault: true,
    tools: new Set([
      "create_branch",
      "list_commits",
      "get_commit",
      "get_commit_diff",
    ]),
  },
  {
    id: "projects",
    isDefault: true,
    tools: new Set([
      "get_project",
      "list_projects",
      "list_project_members",
      "list_namespaces",
      "get_namespace",
      "verify_namespace",
      "list_group_projects",
      "list_group_iterations",
    ]),
  },
  {
    id: "labels",
    isDefault: true,
    tools: new Set([
      "list_labels",
      "get_label",
      "create_label",
      "update_label",
      "delete_label",
    ]),
  },
  {
    id: "pipelines",
    isDefault: true,
    tools: new Set([
      "list_pipelines",
      "get_pipeline",
      "list_deployments",
      "get_deployment",
      "list_environments",
      "get_environment",
      "list_pipeline_jobs",
      "list_pipeline_trigger_jobs",
      "get_pipeline_job",
      "get_pipeline_job_output",
      "create_pipeline",
      "retry_pipeline",
      "cancel_pipeline",
      "play_pipeline_job",
      "retry_pipeline_job",
      "cancel_pipeline_job",
      "list_job_artifacts",
      "download_job_artifacts",
      "get_job_artifact_file",
    ]),
  },
  {
    id: "milestones",
    isDefault: true,
    tools: new Set([
      "list_milestones",
      "get_milestone",
      "create_milestone",
      "edit_milestone",
      "delete_milestone",
      "get_milestone_issue",
      "get_milestone_merge_requests",
      "promote_milestone",
      "get_milestone_burndown_events",
    ]),
  },
  {
    id: "wiki",
    isDefault: true,
    tools: new Set([
      "list_wiki_pages",
      "get_wiki_page",
      "create_wiki_page",
      "update_wiki_page",
      "delete_wiki_page",
      "list_group_wiki_pages",
      "get_group_wiki_page",
      "create_group_wiki_page",
      "update_group_wiki_page",
      "delete_group_wiki_page",
    ]),
  },
  {
    id: "releases",
    isDefault: true,
    tools: new Set([
      "list_releases",
      "get_release",
      "create_release",
      "update_release",
      "delete_release",
      "create_release_evidence",
      "download_release_asset",
    ]),
  },
  {
    id: "users",
    isDefault: true,
    tools: new Set([
      "get_users",
      "list_events",
      "get_project_events",
      "upload_markdown",
      "download_attachment",
    ]),
  },
  {
    id: "workitems",
    isDefault: false,
    tools: new Set([
      "get_work_item",
      "list_work_items",
      "create_work_item",
      "update_work_item",
      "convert_work_item_type",
      "list_work_item_statuses",
      "list_custom_field_definitions",
      "move_work_item",
      "list_work_item_notes",
      "create_work_item_note",
      "get_timeline_events",
      "create_timeline_event",
    ]),
  },
  {
    id: "webhooks",
    isDefault: false,
    tools: new Set([
      "list_webhooks",
      "list_webhook_events",
      "get_webhook_event",
    ]),
  },
  {
    id: "search",
    isDefault: false,
    tools: new Set(["search_code", "search_project_code", "search_group_code"]),
  },
] as const;

// Derived lookup: tool name → toolset ID
export const TOOLSET_BY_TOOL_NAME = new Map<string, ToolsetId>();
for (const def of TOOLSET_DEFINITIONS) {
  for (const tool of def.tools) {
    if (TOOLSET_BY_TOOL_NAME.has(tool)) {
      console.warn(
        `Tool "${tool}" is defined in multiple toolsets: "${TOOLSET_BY_TOOL_NAME.get(tool)}" and "${def.id}"`
      );
    }
    TOOLSET_BY_TOOL_NAME.set(tool, def.id);
  }
}

export const DEFAULT_TOOLSET_IDS: ReadonlySet<ToolsetId> = new Set(
  TOOLSET_DEFINITIONS.filter(d => d.isDefault).map(d => d.id)
);

export const ALL_TOOLSET_IDS: ReadonlySet<ToolsetId> = new Set(
  TOOLSET_DEFINITIONS.map(d => d.id)
);

export function parseEnabledToolsets(raw: string | undefined): ReadonlySet<ToolsetId> {
  if (!raw || raw.trim() === "") {
    return DEFAULT_TOOLSET_IDS;
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "all") {
    return ALL_TOOLSET_IDS;
  }
  const selected = new Set(
    trimmed
      .split(",")
      .map(s => s.trim())
      .filter((s): s is ToolsetId => ALL_TOOLSET_IDS.has(s as ToolsetId))
  );
  if (selected.size === 0) {
    console.warn(
      `No valid toolsets found in configuration (${raw}). Falling back to default toolsets.`
    );
    return DEFAULT_TOOLSET_IDS;
  }
  return selected;
}

export function parseIndividualTools(raw: string | undefined): ReadonlySet<string> {
  if (!raw || raw.trim() === "") {
    return new Set();
  }
  const allToolNames = new Set(allTools.map((t: { name: string }) => t.name));
  const parsed = raw
    .trim()
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const unknown = parsed.filter(name => !allToolNames.has(name));
  if (unknown.length > 0) {
    console.warn(`Unknown tool names in GITLAB_TOOLS (will be ignored): ${unknown.join(", ")}`);
  }
  return new Set(parsed);
}

export function buildFeatureFlagOverrides(): ReadonlySet<string> {
  const overrides = new Set<string>();
  if (USE_GITLAB_WIKI) {
    for (const t of wikiToolNames) overrides.add(t);
  }
  if (USE_MILESTONE) {
    for (const t of milestoneToolNames) overrides.add(t);
  }
  if (USE_PIPELINE) {
    for (const t of pipelineToolNames) overrides.add(t);
  }
  return overrides;
}

export function isToolInEnabledToolset(
  toolName: string,
  enabledToolsets: ReadonlySet<ToolsetId>
): boolean {
  const toolsetId = TOOLSET_BY_TOOL_NAME.get(toolName);
  // Tools not in any toolset (e.g. execute_graphql) are excluded by default
  if (toolsetId === undefined) return false;
  return enabledToolsets.has(toolsetId);
}

