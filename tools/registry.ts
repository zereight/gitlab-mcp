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
  CreateIssueEmojiReactionSchema,
  CreateIssueNoteEmojiReactionSchema,
  ListIssueEmojiReactionsSchema,
  ListIssueNoteEmojiReactionsSchema,
  CreateLabelSchema,
  MarkAllTodosDoneSchema,
  ListTodosSchema,
  MarkTodoDoneSchema,
  CreateMergeRequestDiscussionNoteSchema,
  CreateMergeRequestEmojiReactionSchema,
  ListMergeRequestEmojiReactionsSchema,
  ListMergeRequestNoteEmojiReactionsSchema,
  CreateMergeRequestNoteSchema,
  CreateMergeRequestNoteEmojiReactionSchema,
  CreateMergeRequestSchema,
  CreateMergeRequestThreadSchema,
  CreateNoteSchema,
  CreateCommitStatusSchema,
  CreateOrUpdateFileSchema,
  CreatePipelineSchema,
  CreateProjectMilestoneSchema,
  CreateReleaseEvidenceSchema,
  CreateReleaseSchema,
  CreateRepositorySchema,
  CreateTagSchema,
  CreateTimelineEventSchema,
  CreateWikiPageSchema,
  CreateWorkItemNoteSchema,
  CreateWorkItemEmojiReactionSchema,
  CreateWorkItemNoteEmojiReactionSchema,
  ListWorkItemEmojiReactionsSchema,
  ListWorkItemNoteEmojiReactionsSchema,
  CreateWorkItemSchema,
  DeleteDraftNoteSchema,
  DeleteGroupWikiPageSchema,
  DeleteIssueLinkSchema,
  DeleteIssueSchema,
  DeleteIssueEmojiReactionSchema,
  DeleteIssueNoteEmojiReactionSchema,
  DeleteLabelSchema,
  DeleteMergeRequestDiscussionNoteSchema,
  DeleteMergeRequestNoteSchema,
  DeleteMergeRequestEmojiReactionSchema,
  DeleteMergeRequestNoteEmojiReactionSchema,
  DeleteProjectMilestoneSchema,
  DeleteReleaseSchema,
  DeleteTagSchema,
  DeleteWikiPageSchema,
  DeleteWorkItemEmojiReactionSchema,
  DeleteWorkItemNoteEmojiReactionSchema,
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
  GetTagSchema,
  GetTagSignatureSchema,
  GetTimelineEventsSchema,
  GetUsersSchema,
  GetWebhookEventSchema,
  GetWikiPageSchema,
  GetWorkItemSchema,
  ListCommitsSchema,
  ListCommitStatusesSchema,
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
  ValidateCiLintSchema,
  ValidateProjectCiLintSchema,
  ListPipelinesSchema,
  ListProjectMembersSchema,
  ListProjectMilestonesSchema,
  ListProjectsSchema,
  ListReleasesSchema,
  ListTagsSchema,
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
    description: "Merge a merge request",
    inputSchema: toJSONSchema(MergeMergeRequestSchema),
  },
  {
    name: "approve_merge_request",
    description: "Approve a merge request",
    inputSchema: toJSONSchema(ApproveMergeRequestSchema),
  },
  {
    name: "unapprove_merge_request",
    description: "Unapprove a merge request",
    inputSchema: toJSONSchema(UnapproveMergeRequestSchema),
  },
  {
    name: "get_merge_request_approval_state",
    description: "Get merge request approval details including approvers",
    inputSchema: toJSONSchema(GetMergeRequestApprovalStateSchema),
  },
  {
    name: "get_merge_request_conflicts",
    description: "Get the conflicts of a merge request",
    inputSchema: toJSONSchema(GetMergeRequestConflictsSchema),
  },
  {
    name: "execute_graphql",
    description: "Execute a GitLab GraphQL query",
    inputSchema: zodToJsonSchema(ExecuteGraphQLSchema),
  },
  {
    name: "create_or_update_file",
    description: "Create or update a file in a GitLab project",
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
    description: "Get contents of a file or directory from a GitLab project",
    inputSchema: toJSONSchema(GetFileContentsSchema),
  },
  {
    name: "push_files",
    description: "Push multiple files in a single commit",
    inputSchema: toJSONSchema(PushFilesSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue",
    inputSchema: toJSONSchema(CreateIssueSchema),
  },
  {
    name: "create_merge_request",
    description: "Create a new merge request",
    inputSchema: toJSONSchema(CreateMergeRequestSchema),
  },
  {
    name: "fork_repository",
    description: "Fork a project to your account or specified namespace",
    inputSchema: toJSONSchema(ForkRepositorySchema),
  },
  {
    name: "create_branch",
    description: "Create a new branch",
    inputSchema: toJSONSchema(CreateBranchSchema),
  },
  {
    name: "get_merge_request",
    description: "Get details of a merge request (mergeRequestIid or branchName required)",
    inputSchema: toJSONSchema(GetMergeRequestSchema),
  },
  {
    name: "get_merge_request_diffs",
    description: "Get the changes/diffs of a merge request (mergeRequestIid or branchName required)",
    inputSchema: toJSONSchema(GetMergeRequestDiffsSchema),
  },
  {
    name: "list_merge_request_changed_files",
    description: "List changed file paths in a merge request without diff content (mergeRequestIid or branchName required)",
    inputSchema: toJSONSchema(ListMergeRequestChangedFilesSchema),
  },
  {
    name: "list_merge_request_diffs",
    description: "List merge request diffs with pagination (mergeRequestIid or branchName required)",
    inputSchema: toJSONSchema(ListMergeRequestDiffsSchema),
  },
  {
    name: "get_merge_request_file_diff",
    description: "Get diffs for specific files from a merge request (mergeRequestIid or branchName required)",
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
    description: "Get diffs between two branches or commits",
    inputSchema: toJSONSchema(GetBranchDiffsSchema),
  },
  {
    name: "update_merge_request",
    description: "Update a merge request (mergeRequestIid or branchName required)",
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
  // --- Merge request emoji reaction tools ---
  {
    name: "list_merge_request_emoji_reactions",
    description: "List all emoji reactions on a merge request",
    inputSchema: toJSONSchema(ListMergeRequestEmojiReactionsSchema),
  },
  {
    name: "list_merge_request_note_emoji_reactions",
    description: "List all emoji reactions on a merge request note. Pass discussion_id for discussion thread replies.",
    inputSchema: toJSONSchema(ListMergeRequestNoteEmojiReactionsSchema),
  },
  {
    name: "create_merge_request_emoji_reaction",
    description: "Add an emoji reaction to a merge request (e.g. thumbsup, rocket, eyes)",
    inputSchema: toJSONSchema(CreateMergeRequestEmojiReactionSchema),
  },
  {
    name: "delete_merge_request_emoji_reaction",
    description: "Remove an emoji reaction from a merge request",
    inputSchema: toJSONSchema(DeleteMergeRequestEmojiReactionSchema),
  },
  {
    name: "create_merge_request_note_emoji_reaction",
    description: "Add an emoji reaction to a merge request note. Pass discussion_id for discussion thread replies.",
    inputSchema: toJSONSchema(CreateMergeRequestNoteEmojiReactionSchema),
  },
  {
    name: "delete_merge_request_note_emoji_reaction",
    description: "Remove an emoji reaction from a merge request note. Pass discussion_id for discussion thread replies.",
    inputSchema: toJSONSchema(DeleteMergeRequestNoteEmojiReactionSchema),
  },
  {
    name: "update_issue_note",
    description: "Modify an existing issue thread note",
    inputSchema: toJSONSchema(UpdateIssueNoteSchema),
  },
  {
    name: "create_issue_note",
    description: "Add a note to an issue, optionally replying to a discussion thread",
    inputSchema: toJSONSchema(CreateIssueNoteSchema),
  },
  // --- Issue emoji reaction tools ---
  {
    name: "list_issue_emoji_reactions",
    description: "List all emoji reactions on an issue",
    inputSchema: toJSONSchema(ListIssueEmojiReactionsSchema),
  },
  {
    name: "list_issue_note_emoji_reactions",
    description: "List all emoji reactions on an issue note. Pass discussion_id for discussion thread replies.",
    inputSchema: toJSONSchema(ListIssueNoteEmojiReactionsSchema),
  },
  {
    name: "create_issue_emoji_reaction",
    description: "Add an emoji reaction to an issue (e.g. thumbsup, rocket, eyes)",
    inputSchema: toJSONSchema(CreateIssueEmojiReactionSchema),
  },
  {
    name: "delete_issue_emoji_reaction",
    description: "Remove an emoji reaction from an issue",
    inputSchema: toJSONSchema(DeleteIssueEmojiReactionSchema),
  },
  {
    name: "create_issue_note_emoji_reaction",
    description: "Add an emoji reaction to an issue note. Pass discussion_id for discussion thread replies.",
    inputSchema: toJSONSchema(CreateIssueNoteEmojiReactionSchema),
  },
  {
    name: "delete_issue_note_emoji_reaction",
    description: "Remove an emoji reaction from an issue note. Pass discussion_id for discussion thread replies.",
    inputSchema: toJSONSchema(DeleteIssueNoteEmojiReactionSchema),
  },
  {
    name: "list_issues",
    description: "List issues (default: created by current user; use scope='all' for all)",
    inputSchema: toJSONSchema(ListIssuesSchema),
  },
  {
    name: "my_issues",
    description: "List issues assigned to the authenticated user",
    inputSchema: toJSONSchema(MyIssuesSchema),
  },
  {
    name: "get_issue",
    description: "Get details of a specific issue",
    inputSchema: toJSONSchema(GetIssueSchema),
  },
  {
    name: "update_issue",
    description: "Update an issue",
    inputSchema: toJSONSchema(UpdateIssueSchema),
  },
  {
    name: "delete_issue",
    description: "Delete an issue",
    inputSchema: toJSONSchema(DeleteIssueSchema),
  },
  {
    name: "list_todos",
    description: "List GitLab to-do items for the current user",
    inputSchema: toJSONSchema(ListTodosSchema),
  },
  {
    name: "mark_todo_done",
    description: "Mark a GitLab to-do item as done",
    inputSchema: toJSONSchema(MarkTodoDoneSchema),
  },
  {
    name: "mark_all_todos_done",
    description: "Mark all pending GitLab to-do items as done for the current user",
    inputSchema: toJSONSchema(MarkAllTodosDoneSchema),
  },
  {
    name: "list_issue_links",
    description: "List all issue links for a specific issue",
    inputSchema: toJSONSchema(ListIssueLinksSchema),
  },
  {
    name: "list_issue_discussions",
    description: "List discussions for an issue",
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
    description: "List projects in a group",
    inputSchema: toJSONSchema(ListGroupProjectsSchema),
  },
  {
    name: "list_wiki_pages",
    description: "List wiki pages in a project",
    inputSchema: toJSONSchema(ListWikiPagesSchema),
  },
  {
    name: "get_wiki_page",
    description: "Get details of a specific wiki page",
    inputSchema: toJSONSchema(GetWikiPageSchema),
  },
  {
    name: "create_wiki_page",
    description: "Create a wiki page in a project",
    inputSchema: toJSONSchema(CreateWikiPageSchema),
  },
  {
    name: "update_wiki_page",
    description: "Update a wiki page in a project",
    inputSchema: toJSONSchema(UpdateWikiPageSchema),
  },
  {
    name: "delete_wiki_page",
    description: "Delete a wiki page from a project",
    inputSchema: toJSONSchema(DeleteWikiPageSchema),
  },
  {
    name: "list_group_wiki_pages",
    description: "List wiki pages in a group",
    inputSchema: toJSONSchema(ListGroupWikiPagesSchema),
  },
  {
    name: "get_group_wiki_page",
    description: "Get details of a specific group wiki page",
    inputSchema: toJSONSchema(GetGroupWikiPageSchema),
  },
  {
    name: "create_group_wiki_page",
    description: "Create a wiki page in a group",
    inputSchema: toJSONSchema(CreateGroupWikiPageSchema),
  },
  {
    name: "update_group_wiki_page",
    description: "Update a wiki page in a group",
    inputSchema: toJSONSchema(UpdateGroupWikiPageSchema),
  },
  {
    name: "delete_group_wiki_page",
    description: "Delete a wiki page from a group",
    inputSchema: toJSONSchema(DeleteGroupWikiPageSchema),
  },
  {
    name: "get_repository_tree",
    description: "List files and directories in a repository",
    inputSchema: toJSONSchema(GetRepositoryTreeSchema),
  },
  {
    name: "list_pipelines",
    description: "List pipelines with filtering options",
    inputSchema: toJSONSchema(ListPipelinesSchema),
  },
  {
    name: "get_pipeline",
    description: "Get details of a specific pipeline",
    inputSchema: toJSONSchema(GetPipelineSchema),
  },
  {
    name: "list_deployments",
    description: "List deployments with filtering options",
    inputSchema: toJSONSchema(ListDeploymentsSchema),
  },
  {
    name: "get_deployment",
    description: "Get details of a specific deployment",
    inputSchema: toJSONSchema(GetDeploymentSchema),
  },
  {
    name: "list_environments",
    description: "List environments in a project",
    inputSchema: toJSONSchema(ListEnvironmentsSchema),
  },
  {
    name: "get_environment",
    description: "Get details of a specific environment",
    inputSchema: toJSONSchema(GetEnvironmentSchema),
  },
  {
    name: "list_pipeline_jobs",
    description: "List all jobs in a specific pipeline",
    inputSchema: toJSONSchema(ListPipelineJobsSchema),
  },
  {
    name: "list_pipeline_trigger_jobs",
    description: "List trigger jobs (bridges) in a pipeline",
    inputSchema: toJSONSchema(ListPipelineTriggerJobsSchema),
  },
  {
    name: "get_pipeline_job",
    description: "Get details of a GitLab pipeline job number",
    inputSchema: toJSONSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "get_pipeline_job_output",
    description: "Get the output/trace of a pipeline job with optional pagination",
    inputSchema: toJSONSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "validate_ci_lint",
    description: "Validate provided GitLab CI/CD YAML content for a project",
    inputSchema: toJSONSchema(ValidateCiLintSchema),
  },
  {
    name: "validate_project_ci_lint",
    description: "Validate an existing .gitlab-ci.yml configuration for a project",
    inputSchema: toJSONSchema(ValidateProjectCiLintSchema),
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
    description: "List artifact files in a job's archive",
    inputSchema: toJSONSchema(ListJobArtifactsSchema),
  },
  {
    name: "download_job_artifacts",
    description: "Download job artifact archive (zip) to a local path",
    inputSchema: toJSONSchema(DownloadJobArtifactsSchema),
  },
  {
    name: "get_job_artifact_file",
    description: "Get content of a single file from a job's artifacts",
    inputSchema: toJSONSchema(GetJobArtifactFileSchema),
  },
  {
    name: "list_merge_requests",
    description: "List merge requests (without project_id: user's MRs; with project_id: project MRs)",
    inputSchema: toJSONSchema(ListMergeRequestsSchema),
  },
  {
    name: "list_milestones",
    description: "List milestones with filtering options",
    inputSchema: toJSONSchema(ListProjectMilestonesSchema),
  },
  {
    name: "get_milestone",
    description: "Get details of a specific milestone",
    inputSchema: toJSONSchema(GetProjectMilestoneSchema),
  },
  {
    name: "create_milestone",
    description: "Create a new milestone",
    inputSchema: toJSONSchema(CreateProjectMilestoneSchema),
  },
  {
    name: "edit_milestone",
    description: "Edit an existing milestone",
    inputSchema: toJSONSchema(EditProjectMilestoneSchema),
  },
  {
    name: "delete_milestone",
    description: "Delete a milestone",
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
    name: "list_commit_statuses",
    description: "List statuses for a commit",
    inputSchema: toJSONSchema(ListCommitStatusesSchema),
  },
  {
    name: "create_commit_status",
    description: "Create or update the status of a commit",
    inputSchema: toJSONSchema(CreateCommitStatusSchema),
  },
  {
    name: "list_group_iterations",
    description: "List group iterations with filtering options",
    inputSchema: toJSONSchema(ListGroupIterationsSchema),
  },
  {
    name: "upload_markdown",
    description: "Upload a file for use in markdown content",
    inputSchema: toJSONSchema(MarkdownUploadSchema),
  },
  {
    name: "download_attachment",
    description: "Download an uploaded file from a project (images returned as base64; use local_path to save to disk)",
    inputSchema: toJSONSchema(DownloadAttachmentSchema),
  },
  {
    name: "list_events",
    description: "List events for the authenticated user (before/after: YYYY-MM-DD)",
    inputSchema: toJSONSchema(ListEventsSchema),
  },
  {
    name: "get_project_events",
    description: "List events for a project (before/after: YYYY-MM-DD)",
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
    description: "Create a new release",
    inputSchema: toJSONSchema(CreateReleaseSchema),
  },
  {
    name: "update_release",
    description: "Update an existing release",
    inputSchema: toJSONSchema(UpdateReleaseSchema),
  },
  {
    name: "delete_release",
    description: "Delete a release (does not delete the tag)",
    inputSchema: toJSONSchema(DeleteReleaseSchema),
  },
  {
    name: "create_release_evidence",
    description: "Create release evidence (Premium/Ultimate)",
    inputSchema: toJSONSchema(CreateReleaseEvidenceSchema),
  },
  {
    name: "download_release_asset",
    description: "Download a release asset file by direct asset path",
    inputSchema: toJSONSchema(DownloadReleaseAssetSchema),
  },
  {
    name: "list_tags",
    description: "List repository tags for a project",
    inputSchema: toJSONSchema(ListTagsSchema),
  },
  {
    name: "get_tag",
    description: "Get a repository tag by name",
    inputSchema: toJSONSchema(GetTagSchema),
  },
  {
    name: "create_tag",
    description: "Create a new repository tag",
    inputSchema: toJSONSchema(CreateTagSchema),
  },
  {
    name: "delete_tag",
    description: "Delete a repository tag",
    inputSchema: toJSONSchema(DeleteTagSchema),
  },
  {
    name: "get_tag_signature",
    description: "Get the X.509 signature of a signed tag (404 if unsigned)",
    inputSchema: toJSONSchema(GetTagSignatureSchema),
  },
  // --- Work item tools (GraphQL-based) ---
  {
    name: "get_work_item",
    description: "Get a work item with full details including status, hierarchy, type, and widgets",
    inputSchema: toJSONSchema(GetWorkItemSchema),
  },
  {
    name: "list_work_items",
    description: "List work items with filters (type, state, search, assignees, labels)",
    inputSchema: toJSONSchema(ListWorkItemsSchema),
  },
  {
    name: "create_work_item",
    description: "Create a work item (issue, task, incident, epic, etc.) with full field support",
    inputSchema: toJSONSchema(CreateWorkItemSchema),
  },
  {
    name: "update_work_item",
    description: "Update a work item (title, description, labels, assignees, state, parent, custom fields, etc.)",
    inputSchema: toJSONSchema(UpdateWorkItemSchema),
  },
  {
    name: "convert_work_item_type",
    description: "Convert a work item to a different type",
    inputSchema: toJSONSchema(ConvertWorkItemTypeSchema),
  },
  {
    name: "list_work_item_statuses",
    description: "List available statuses for a work item type (Premium/Ultimate)",
    inputSchema: toJSONSchema(ListWorkItemStatusesSchema),
  },
  {
    name: "list_custom_field_definitions",
    description: "List custom field definitions for a work item type",
    inputSchema: toJSONSchema(ListCustomFieldDefinitionsSchema),
  },
  {
    name: "move_work_item",
    description: "Move a work item to a different project",
    inputSchema: toJSONSchema(MoveWorkItemSchema),
  },
  {
    name: "list_work_item_notes",
    description: "List notes and discussions on a work item",
    inputSchema: toJSONSchema(ListWorkItemNotesSchema),
  },
  {
    name: "create_work_item_note",
    description: "Add a note to a work item (supports Markdown, internal notes, threads)",
    inputSchema: toJSONSchema(CreateWorkItemNoteSchema),
  },
  // --- Work item emoji reaction tools (GraphQL-based) ---
  {
    name: "list_work_item_emoji_reactions",
    description: "List all emoji reactions on a work item",
    inputSchema: toJSONSchema(ListWorkItemEmojiReactionsSchema),
  },
  {
    name: "list_work_item_note_emoji_reactions",
    description: "List all emoji reactions on a work item note (comment, thread, or thread reply)",
    inputSchema: toJSONSchema(ListWorkItemNoteEmojiReactionsSchema),
  },
  {
    name: "create_work_item_emoji_reaction",
    description: "Add an emoji reaction to a work item (e.g. thumbsup, rocket, eyes)",
    inputSchema: toJSONSchema(CreateWorkItemEmojiReactionSchema),
  },
  {
    name: "delete_work_item_emoji_reaction",
    description: "Remove an emoji reaction from a work item",
    inputSchema: toJSONSchema(DeleteWorkItemEmojiReactionSchema),
  },
  {
    name: "create_work_item_note_emoji_reaction",
    description: "Add an emoji reaction to a work item note (comment, thread, or thread reply)",
    inputSchema: toJSONSchema(CreateWorkItemNoteEmojiReactionSchema),
  },
  {
    name: "delete_work_item_note_emoji_reaction",
    description: "Remove an emoji reaction from a work item note (comment, thread, or thread reply)",
    inputSchema: toJSONSchema(DeleteWorkItemNoteEmojiReactionSchema),
  },
  // --- Incident timeline event tools ---
  {
    name: "get_timeline_events",
    description: "List timeline events for an incident",
    inputSchema: toJSONSchema(GetTimelineEventsSchema),
  },
  {
    name: "create_timeline_event",
    description: "Create a timeline event on an incident",
    inputSchema: toJSONSchema(CreateTimelineEventSchema),
  },
  {
    name: "list_webhooks",
    description: "List webhooks for a project or group",
    inputSchema: toJSONSchema(ListWebhooksSchema),
  },
  {
    name: "list_webhook_events",
    description: "List recent webhook events (past 7 days)",
    inputSchema: toJSONSchema(ListWebhookEventsSchema),
  },
  {
    name: "get_webhook_event",
    description: "Get full details of a specific webhook event",
    inputSchema: toJSONSchema(GetWebhookEventSchema),
  },
  {
    name: "search_code",
    description: "Search for code across all projects (requires advanced search or Zoekt)",
    inputSchema: toJSONSchema(SearchCodeSchema),
  },
  {
    name: "search_project_code",
    description: "Search for code within a specific project (requires advanced search or Zoekt)",
    inputSchema: toJSONSchema(SearchProjectCodeSchema),
  },
  {
    name: "search_group_code",
    description: "Search for code within a specific group (requires advanced search or Zoekt)",
    inputSchema: toJSONSchema(SearchGroupCodeSchema),
  },
  // --- Meta tool: Dynamic tool discovery ---
  {
    name: "discover_tools",
    description:
      "Discover and activate additional tool categories for this session. Call without arguments to see available categories.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description:
            "Toolset category to activate (e.g. 'pipelines', 'wiki'). Omit to list available categories.",
        },
      },
    },
  },
];

// Define which tools are read-only
export const readOnlyTools = new Set([
  "discover_tools",
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
  "list_todos",
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
  "validate_ci_lint",
  "validate_project_ci_lint",
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
  "list_commit_statuses",
  "list_group_iterations",
  "get_group_iteration",
  "download_attachment",
  "list_events",
  "get_project_events",
  "list_releases",
  "get_release",
  "download_release_asset",
  "list_tags",
  "get_tag",
  "get_tag_signature",
  "get_merge_request_approval_state",
  "get_work_item",
  "list_work_items",
  "list_work_item_statuses",
  "list_custom_field_definitions",
  "list_work_item_notes",
  "list_merge_request_emoji_reactions",
  "list_merge_request_note_emoji_reactions",
  "list_issue_emoji_reactions",
  "list_issue_note_emoji_reactions",
  "list_work_item_emoji_reactions",
  "list_work_item_note_emoji_reactions",
  "get_timeline_events",
  "get_merge_request_conflicts",
  "list_webhooks",
  "list_webhook_events",
  "get_webhook_event",
]);

// Define which tools are destructive (data loss potential)
export const destructiveTools = new Set([
  "delete_issue",
  "delete_issue_link",
  "delete_label",
  "delete_wiki_page",
  "delete_group_wiki_page",
  "delete_milestone",
  "delete_release",
  "delete_tag",
  "delete_merge_request_note",
  "delete_merge_request_discussion_note",
  "delete_draft_note",
  "delete_merge_request_emoji_reaction",
  "delete_merge_request_note_emoji_reaction",
  "delete_issue_emoji_reaction",
  "delete_issue_note_emoji_reaction",
  "delete_work_item_emoji_reaction",
  "delete_work_item_note_emoji_reaction",
  "merge_merge_request",
  "push_files",
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
  "validate_ci_lint",
  "validate_project_ci_lint",
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
  | "ci"
  | "pipelines"
  | "milestones"
  | "wiki"
  | "releases"
  | "tags"
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
      "list_merge_request_emoji_reactions",
      "list_merge_request_note_emoji_reactions",
      "create_merge_request_emoji_reaction",
      "delete_merge_request_emoji_reaction",
      "create_merge_request_note_emoji_reaction",
      "delete_merge_request_note_emoji_reaction",
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
      "list_todos",
      "mark_todo_done",
      "mark_all_todos_done",
      "create_issue_note",
      "update_issue_note",
      "list_issue_links",
      "list_issue_discussions",
      "get_issue_link",
      "create_issue_link",
      "delete_issue_link",
      "create_note",
      "list_issue_emoji_reactions",
      "list_issue_note_emoji_reactions",
      "create_issue_emoji_reaction",
      "delete_issue_emoji_reaction",
      "create_issue_note_emoji_reaction",
      "delete_issue_note_emoji_reaction",
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
      "list_commit_statuses",
      "create_commit_status",
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
    id: "ci",
    isDefault: true,
    tools: new Set(["validate_ci_lint", "validate_project_ci_lint"]),
  },
  {
    id: "pipelines",
    isDefault: false,
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
    isDefault: false,
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
    isDefault: false,
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
    isDefault: false,
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
    id: "tags",
    isDefault: false,
    tools: new Set([
      "list_tags",
      "get_tag",
      "create_tag",
      "delete_tag",
      "get_tag_signature",
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
      "list_work_item_emoji_reactions",
      "list_work_item_note_emoji_reactions",
      "create_work_item_emoji_reaction",
      "delete_work_item_emoji_reaction",
      "create_work_item_note_emoji_reaction",
      "delete_work_item_note_emoji_reaction",
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

// Update discover_tools description with all known categories (must be after TOOLSET_DEFINITIONS)
const discoverTool = allTools.find(t => t.name === "discover_tools");
if (discoverTool) {
  discoverTool.description = `Discover and activate additional tool categories for this session. Available categories: ${[...ALL_TOOLSET_IDS].join(", ")}. Already-active categories are listed in the response.`;
}

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
