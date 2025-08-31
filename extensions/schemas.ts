import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { 
  GitLabUserSchema, 
  GitLabLabelSchema, 
  GitLabMilestoneSchema,
  PaginationOptionsSchema 
} from "../schemas.js";

// Base schemas for extension operations
const ProjectParamsSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path to project"),
});

// ============================================================================
// ISSUE BOARDS MANAGEMENT SCHEMAS
// ============================================================================

export const GitLabBoardSchema = z.object({
  id: z.number(),
  name: z.string(),
  project: z.object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
  }),
  milestone: z.object({
    id: z.number(),
    title: z.string(),
  }).nullable(),
  assignee: GitLabUserSchema.nullable(),
  labels: z.array(GitLabLabelSchema),
  weight: z.number().nullable(),
  lists: z.array(z.object({
    id: z.number(),
    label: GitLabLabelSchema.nullable(),
    position: z.number(),
    list_type: z.enum(['backlog', 'closed', 'label', 'milestone', 'assignee']),
  })),
});

export const CreateBoardSchema = ProjectParamsSchema.extend({
  name: z.string().describe("The name of the board"),
  assignee_id: z.number().optional().describe("The assignee the board should be scoped to"),
  milestone_id: z.number().optional().describe("The milestone the board should be scoped to"),
  labels: z.array(z.string()).optional().describe("Array of label names the board should be scoped to"),
  weight: z.number().optional().describe("The weight range the board should be scoped to"),
});

export const ListBoardsSchema = ProjectParamsSchema.merge(PaginationOptionsSchema);

export const GetBoardSchema = ProjectParamsSchema.extend({
  board_id: z.coerce.string().describe("The ID of the board"),
});

export const UpdateBoardSchema = GetBoardSchema.extend({
  name: z.string().optional().describe("The new name of the board"),
  assignee_id: z.number().optional().describe("The assignee the board should be scoped to"),
  milestone_id: z.number().optional().describe("The milestone the board should be scoped to"),
  labels: z.array(z.string()).optional().describe("Array of label names the board should be scoped to"),
  weight: z.number().optional().describe("The weight range the board should be scoped to"),
});

export const DeleteBoardSchema = GetBoardSchema;

// Board Lists Schemas
export const CreateBoardListSchema = GetBoardSchema.extend({
  label_id: z.number().optional().describe("The ID of the label"),
  assignee_id: z.number().optional().describe("The ID of the assignee"),
  milestone_id: z.number().optional().describe("The ID of the milestone"),
});

export const ListBoardListsSchema = GetBoardSchema;

export const UpdateBoardListSchema = GetBoardSchema.extend({
  list_id: z.coerce.string().describe("The ID of the list"),
  position: z.number().optional().describe("The position of the list"),
  collapsed: z.boolean().optional().describe("Whether the list is collapsed"),
});

export const DeleteBoardListSchema = GetBoardSchema.extend({
  list_id: z.coerce.string().describe("The ID of the list"),
});

export const GetBoardListIssuesSchema = GetBoardSchema.extend({
  list_id: z.coerce.string().describe("The ID of the list"),
}).merge(PaginationOptionsSchema);

// ============================================================================
// TIME TRACKING MANAGEMENT SCHEMAS
// ============================================================================

export const GitLabTimeStatsSchema = z.object({
  time_estimate: z.number(),
  total_time_spent: z.number(),
  human_time_estimate: z.string().nullable(),
  human_total_time_spent: z.string().nullable(),
});

export const GitLabTimeEntrySchema = z.object({
  id: z.number(),
  user: GitLabUserSchema,
  created_at: z.string(),
  updated_at: z.string(),
  spent_at: z.string(),
  duration: z.number(),
  summary: z.string(),
});

export const AddTimeSpentSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
  duration: z.string().describe("Time spent (e.g., '1h 30m', '2h', '45m')"),
  summary: z.string().optional().describe("Summary of work done"),
  spent_at: z.string().optional().describe("Date when time was spent (YYYY-MM-DD)"),
});

export const GetTimeTrackingSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
});

export const AddTimeEstimateSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
  duration: z.string().describe("Time estimate (e.g., '2h', '1d 4h', '30m')"),
});

export const UpdateTimeEstimateSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
  duration: z.string().describe("Time estimate (e.g., '2h', '1d 4h', '30m')"),
});

export const ResetTimeEstimateSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
});

export const GetTimeEstimateSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
});

export const AddToTimeEstimateSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
  duration: z.string().describe("Time estimate to add (e.g., '2h', '1d 4h', '30m')"),
});

export const CompareTimeEstimateSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
  include_breakdown: z.boolean().optional().describe("Include detailed breakdown of time entries"),
});

export const BulkEstimateIssuesSchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iids: z.array(z.number()).describe("Array of issue internal IDs"),
  duration: z.string().describe("Time estimate to apply to all issues"),
  action: z.enum(["set", "add"]).describe("Whether to set or add to existing estimates"),
});

export const ListTimeEntriesSchema = GetTimeTrackingSchema.merge(PaginationOptionsSchema);

export const DeleteTimeEntrySchema = z.object({
  project_id: z.coerce.string().describe("The ID or path of the project"),
  issue_iid: z.coerce.string().describe("The internal ID of the issue"),
  time_entry_id: z.coerce.string().describe("The ID of the time entry"),
});

// ============================================================================
// RELEASES MANAGEMENT SCHEMAS
// ============================================================================

export const GitLabReleaseSchema = z.object({
  tag_name: z.string(),
  name: z.string(),
  description: z.string(),
  description_html: z.string(),
  created_at: z.string(),
  released_at: z.string(),
  author: GitLabUserSchema,
  commit: z.object({
    id: z.string(),
    short_id: z.string(),
    title: z.string(),
    author_name: z.string(),
    author_email: z.string(),
    authored_date: z.string(),
    committer_name: z.string(),
    committer_email: z.string(),
    committed_date: z.string(),
    message: z.string(),
  }),
  milestones: z.array(GitLabMilestoneSchema),
  commit_path: z.string(),
  tag_path: z.string(),
  assets: z.object({
    count: z.number(),
    sources: z.array(z.object({
      format: z.string(),
      url: z.string(),
    })),
    links: z.array(z.object({
      id: z.number(),
      name: z.string(),
      url: z.string(),
      external: z.boolean(),
      link_type: z.string(),
    })),
  }),
  evidences: z.array(z.object({
    sha: z.string(),
    filepath: z.string(),
    collected_at: z.string(),
  })),
});

export const ListReleasesSchema = ProjectParamsSchema.extend({
  order_by: z.enum(['created_at', 'released_at']).optional().describe("Order releases by created_at or released_at"),
  sort: z.enum(['asc', 'desc']).optional().describe("Sort order"),
  include_html_description: z.boolean().optional().describe("Include HTML description"),
}).merge(PaginationOptionsSchema);

export const GetReleaseSchema = ProjectParamsSchema.extend({
  tag_name: z.string().describe("The Git tag the release is associated with"),
  include_html_description: z.boolean().optional().describe("Include HTML description"),
});

export const CreateReleaseSchema = ProjectParamsSchema.extend({
  name: z.string().describe("The release name"),
  tag_name: z.string().describe("The tag where the release is created from"),
  description: z.string().describe("The description of the release"),
  ref: z.string().optional().describe("If tag_name doesn't exist, the release is created from ref"),
  milestones: z.array(z.string()).optional().describe("Array of milestone titles to associate with the release"),
  assets: z.object({
    links: z.array(z.object({
      name: z.string(),
      url: z.string(),
      filepath: z.string().optional(),
      link_type: z.enum(['runbook', 'package', 'image', 'other']).optional(),
    })).optional(),
  }).optional().describe("Assets associated with the release"),
  released_at: z.string().optional().describe("Date and time for the release (ISO 8601 format)"),
});

export const UpdateReleaseSchema = GetReleaseSchema.extend({
  name: z.string().optional().describe("The release name"),
  description: z.string().optional().describe("The description of the release"),
  milestones: z.array(z.string()).optional().describe("Array of milestone titles to associate with the release"),
  released_at: z.string().optional().describe("Date and time for the release (ISO 8601 format)"),
});

export const DeleteReleaseSchema = GetReleaseSchema;

// Release Assets Schemas
export const CreateReleaseAssetSchema = GetReleaseSchema.extend({
  name: z.string().describe("The name of the asset"),
  url: z.string().describe("The URL of the asset"),
  filepath: z.string().optional().describe("The filepath of the asset"),
  link_type: z.enum(['runbook', 'package', 'image', 'other']).optional().describe("The type of the asset"),
});

export const UpdateReleaseAssetSchema = GetReleaseSchema.extend({
  link_id: z.coerce.string().describe("The ID of the asset link"),
  name: z.string().optional().describe("The name of the asset"),
  url: z.string().optional().describe("The URL of the asset"),
  filepath: z.string().optional().describe("The filepath of the asset"),
  link_type: z.enum(['runbook', 'package', 'image', 'other']).optional().describe("The type of the asset"),
});

export const DeleteReleaseAssetSchema = GetReleaseSchema.extend({
  link_id: z.coerce.string().describe("The ID of the asset link"),
});

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

export const BulkUpdateIssuesSchema = ProjectParamsSchema.extend({
  issue_iids: z.array(z.number()).describe("Array of issue internal IDs"),
  assignee_ids: z.array(z.number()).optional().describe("Array of user IDs to assign"),
  milestone_id: z.number().optional().describe("Milestone ID to assign"),
  labels: z.array(z.string()).optional().describe("Array of label names to add"),
  remove_labels: z.array(z.string()).optional().describe("Array of label names to remove"),
  state_event: z.enum(['close', 'reopen']).optional().describe("State change to apply"),
  discussion_locked: z.boolean().optional().describe("Lock or unlock discussions"),
});

export const BulkCloseIssuesSchema = ProjectParamsSchema.extend({
  issue_iids: z.array(z.number()).describe("Array of issue internal IDs"),
  comment: z.string().optional().describe("Comment to add when closing issues"),
});

export const BulkAssignIssuesSchema = ProjectParamsSchema.extend({
  issue_iids: z.array(z.number()).describe("Array of issue internal IDs"),
  assignee_ids: z.array(z.number()).describe("Array of user IDs to assign"),
  action: z.enum(['assign', 'unassign']).describe("Whether to assign or unassign users"),
});

export const BulkLabelIssuesSchema = ProjectParamsSchema.extend({
  issue_iids: z.array(z.number()).describe("Array of issue internal IDs"),
  labels: z.array(z.string()).describe("Array of label names"),
  action: z.enum(['add', 'remove', 'replace']).describe("Whether to add, remove, or replace labels"),
});

export const BulkUpdateMergeRequestsSchema = ProjectParamsSchema.extend({
  merge_request_iids: z.array(z.number()).describe("Array of merge request internal IDs"),
  assignee_ids: z.array(z.number()).optional().describe("Array of user IDs to assign"),
  reviewer_ids: z.array(z.number()).optional().describe("Array of user IDs to assign as reviewers"),
  milestone_id: z.number().optional().describe("Milestone ID to assign"),
  labels: z.array(z.string()).optional().describe("Array of label names to add"),
  remove_labels: z.array(z.string()).optional().describe("Array of label names to remove"),
  state_event: z.enum(['close', 'reopen']).optional().describe("State change to apply"),
});

export const BulkExportSchema = ProjectParamsSchema.extend({
  export_type: z.enum(['issues', 'merge_requests', 'milestones']).describe("Type of data to export"),
  format: z.enum(['json', 'csv']).describe("Export format"),
  filters: z.object({
    state: z.enum(['opened', 'closed', 'all']).optional(),
    labels: z.array(z.string()).optional(),
    milestone: z.string().optional(),
    assignee_id: z.number().optional(),
    author_id: z.number().optional(),
    created_after: z.string().optional(),
    created_before: z.string().optional(),
  }).optional().describe("Filters to apply to the export"),
});

// ============================================================================
// ANALYTICS AND REPORTING SCHEMAS
// ============================================================================

export const ProjectAnalyticsSchema = ProjectParamsSchema.extend({
  from: z.string().describe("Start date for analytics (YYYY-MM-DD)"),
  to: z.string().describe("End date for analytics (YYYY-MM-DD)"),
  milestone_id: z.number().optional().describe("Filter by milestone"),
  labels: z.array(z.string()).optional().describe("Filter by labels"),
});

export const IssueAnalyticsSchema = ProjectAnalyticsSchema.extend({
  group_by: z.enum(['day', 'week', 'month']).optional().describe("Group results by time period"),
  include_closed: z.boolean().optional().describe("Include closed issues in analytics"),
});

export const TeamPerformanceSchema = ProjectAnalyticsSchema.extend({
  user_ids: z.array(z.number()).optional().describe("Filter by specific users"),
  include_time_tracking: z.boolean().optional().describe("Include time tracking data"),
});

export const MilestoneAnalyticsSchema = ProjectParamsSchema.extend({
  milestone_id: z.coerce.string().describe("The ID of the milestone"),
  include_burndown: z.boolean().optional().describe("Include burndown chart data"),
});

export const CustomReportSchema = ProjectParamsSchema.extend({
  report_type: z.enum(['issues', 'merge_requests', 'time_tracking', 'milestones']).describe("Type of report"),
  from: z.string().describe("Start date for report (YYYY-MM-DD)"),
  to: z.string().describe("End date for report (YYYY-MM-DD)"),
  filters: z.object({
    state: z.enum(['opened', 'closed', 'all']).optional(),
    labels: z.array(z.string()).optional(),
    milestone: z.string().optional(),
    assignee_id: z.number().optional(),
    author_id: z.number().optional(),
  }).optional().describe("Filters to apply to the report"),
  format: z.enum(['json', 'csv']).describe("Report format"),
  group_by: z.enum(['day', 'week', 'month', 'user', 'label', 'milestone']).optional().describe("Group results by"),
});

// ============================================================================
// WEBHOOKS MANAGEMENT SCHEMAS
// ============================================================================

export const GitLabWebhookSchema = z.object({
  id: z.number(),
  url: z.string(),
  project_id: z.number(),
  push_events: z.boolean(),
  push_events_branch_filter: z.string(),
  issues_events: z.boolean(),
  confidential_issues_events: z.boolean(),
  merge_requests_events: z.boolean(),
  tag_push_events: z.boolean(),
  note_events: z.boolean(),
  confidential_note_events: z.boolean(),
  job_events: z.boolean(),
  pipeline_events: z.boolean(),
  wiki_page_events: z.boolean(),
  deployment_events: z.boolean(),
  releases_events: z.boolean(),
  subgroup_events: z.boolean(),
  enable_ssl_verification: z.boolean(),
  created_at: z.string(),
  custom_webhook_template: z.string().nullable(),
});

export const CreateWebhookSchema = ProjectParamsSchema.extend({
  url: z.string().describe("The URL to which the hook will be triggered"),
  push_events: z.boolean().optional().describe("Trigger hook on push events"),
  issues_events: z.boolean().optional().describe("Trigger hook on issue events"),
  confidential_issues_events: z.boolean().optional().describe("Trigger hook on confidential issue events"),
  merge_requests_events: z.boolean().optional().describe("Trigger hook on merge request events"),
  tag_push_events: z.boolean().optional().describe("Trigger hook on tag push events"),
  note_events: z.boolean().optional().describe("Trigger hook on note events"),
  confidential_note_events: z.boolean().optional().describe("Trigger hook on confidential note events"),
  job_events: z.boolean().optional().describe("Trigger hook on job events"),
  pipeline_events: z.boolean().optional().describe("Trigger hook on pipeline events"),
  wiki_page_events: z.boolean().optional().describe("Trigger hook on wiki page events"),
  deployment_events: z.boolean().optional().describe("Trigger hook on deployment events"),
  releases_events: z.boolean().optional().describe("Trigger hook on release events"),
  subgroup_events: z.boolean().optional().describe("Trigger hook on subgroup events"),
  push_events_branch_filter: z.string().optional().describe("Branch filter for push events"),
  enable_ssl_verification: z.boolean().optional().describe("Enable SSL verification"),
  token: z.string().optional().describe("Secret token for webhook authentication"),
  custom_webhook_template: z.string().optional().describe("Custom webhook template"),
});

export const ListWebhooksSchema = ProjectParamsSchema.merge(PaginationOptionsSchema);

export const GetWebhookSchema = ProjectParamsSchema.extend({
  hook_id: z.coerce.string().describe("The ID of the webhook"),
});

export const UpdateWebhookSchema = GetWebhookSchema.extend({
  url: z.string().optional().describe("The URL to which the hook will be triggered"),
  push_events: z.boolean().optional().describe("Trigger hook on push events"),
  issues_events: z.boolean().optional().describe("Trigger hook on issue events"),
  confidential_issues_events: z.boolean().optional().describe("Trigger hook on confidential issue events"),
  merge_requests_events: z.boolean().optional().describe("Trigger hook on merge request events"),
  tag_push_events: z.boolean().optional().describe("Trigger hook on tag push events"),
  note_events: z.boolean().optional().describe("Trigger hook on note events"),
  confidential_note_events: z.boolean().optional().describe("Trigger hook on confidential note events"),
  job_events: z.boolean().optional().describe("Trigger hook on job events"),
  pipeline_events: z.boolean().optional().describe("Trigger hook on pipeline events"),
  wiki_page_events: z.boolean().optional().describe("Trigger hook on wiki page events"),
  deployment_events: z.boolean().optional().describe("Trigger hook on deployment events"),
  releases_events: z.boolean().optional().describe("Trigger hook on release events"),
  subgroup_events: z.boolean().optional().describe("Trigger hook on subgroup events"),
  push_events_branch_filter: z.string().optional().describe("Branch filter for push events"),
  enable_ssl_verification: z.boolean().optional().describe("Enable SSL verification"),
  token: z.string().optional().describe("Secret token for webhook authentication"),
  custom_webhook_template: z.string().optional().describe("Custom webhook template"),
});

export const DeleteWebhookSchema = GetWebhookSchema;

export const TestWebhookSchema = GetWebhookSchema;