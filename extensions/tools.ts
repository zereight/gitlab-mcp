import { zodToJsonSchema } from "zod-to-json-schema";
import {
  // Issue Boards schemas
  ListBoardsSchema,
  GetBoardSchema,
  CreateBoardSchema,
  UpdateBoardSchema,
  DeleteBoardSchema,
  ListBoardListsSchema,
  CreateBoardListSchema,
  UpdateBoardListSchema,
  DeleteBoardListSchema,
  GetBoardListIssuesSchema,
  
  // Time Tracking schemas
  AddTimeSpentSchema,
  GetTimeTrackingSchema,
  UpdateTimeEstimateSchema,
  ResetTimeEstimateSchema,
  GetTimeEstimateSchema,
  AddTimeEstimateSchema,
  AddToTimeEstimateSchema,
  CompareTimeEstimateSchema,
  BulkEstimateIssuesSchema,
  ListTimeEntriesSchema,
  DeleteTimeEntrySchema,
  
  // Releases schemas
  ListReleasesSchema,
  GetReleaseSchema,
  CreateReleaseSchema,
  UpdateReleaseSchema,
  DeleteReleaseSchema,
  CreateReleaseAssetSchema,
  UpdateReleaseAssetSchema,
  DeleteReleaseAssetSchema,
  
  // Bulk Operations schemas
  BulkUpdateIssuesSchema,
  BulkCloseIssuesSchema,
  BulkAssignIssuesSchema,
  BulkLabelIssuesSchema,
  BulkUpdateMergeRequestsSchema,
  BulkExportSchema,
  
  // Analytics schemas
  ProjectAnalyticsSchema,
  IssueAnalyticsSchema,
  TeamPerformanceSchema,
  MilestoneAnalyticsSchema,
  CustomReportSchema,
  
  // Webhooks schemas
  ListWebhooksSchema,
  GetWebhookSchema,
  CreateWebhookSchema,
  UpdateWebhookSchema,
  DeleteWebhookSchema,
  TestWebhookSchema,
} from "./schemas.js";

// ============================================================================
// ISSUE BOARDS TOOLS
// ============================================================================

export const boardTools = [
  {
    name: "list_boards",
    description: "List issue boards in a GitLab project",
    inputSchema: zodToJsonSchema(ListBoardsSchema),
  },
  {
    name: "get_board",
    description: "Get details of a specific issue board",
    inputSchema: zodToJsonSchema(GetBoardSchema),
  },
  {
    name: "create_board",
    description: "Create a new issue board in a GitLab project",
    inputSchema: zodToJsonSchema(CreateBoardSchema),
  },
  {
    name: "update_board",
    description: "Update an existing issue board",
    inputSchema: zodToJsonSchema(UpdateBoardSchema),
  },
  {
    name: "delete_board",
    description: "Delete an issue board from a GitLab project",
    inputSchema: zodToJsonSchema(DeleteBoardSchema),
  },
  {
    name: "list_board_lists",
    description: "List all lists in an issue board",
    inputSchema: zodToJsonSchema(ListBoardListsSchema),
  },
  {
    name: "create_board_list",
    description: "Create a new list in an issue board",
    inputSchema: zodToJsonSchema(CreateBoardListSchema),
  },
  {
    name: "update_board_list",
    description: "Update a list in an issue board",
    inputSchema: zodToJsonSchema(UpdateBoardListSchema),
  },
  {
    name: "delete_board_list",
    description: "Delete a list from an issue board",
    inputSchema: zodToJsonSchema(DeleteBoardListSchema),
  },
  {
    name: "get_board_list_issues",
    description: "Get issues in a specific board list",
    inputSchema: zodToJsonSchema(GetBoardListIssuesSchema),
  },
];

// ============================================================================
// TIME TRACKING TOOLS
// ============================================================================

export const timeTrackingTools = [
  {
    name: "add_time_spent",
    description: "Add time spent on an issue",
    inputSchema: zodToJsonSchema(AddTimeSpentSchema),
  },
  {
    name: "get_time_tracking",
    description: "Get time tracking summary for an issue",
    inputSchema: zodToJsonSchema(GetTimeTrackingSchema),
  },
  {
    name: "add_time_estimate",
    description: "Add initial time estimate for an issue",
    inputSchema: zodToJsonSchema(AddTimeEstimateSchema),
  },
  {
    name: "update_time_estimate",
    description: "Update existing time estimate for an issue",
    inputSchema: zodToJsonSchema(UpdateTimeEstimateSchema),
  },
  {
    name: "reset_time_estimate",
    description: "Reset time estimate for an issue to zero",
    inputSchema: zodToJsonSchema(ResetTimeEstimateSchema),
  },
  {
    name: "get_time_estimate",
    description: "Get only the time estimate for an issue",
    inputSchema: zodToJsonSchema(GetTimeEstimateSchema),
  },
  {
    name: "add_to_time_estimate",
    description: "Add additional time to existing estimate for an issue",
    inputSchema: zodToJsonSchema(AddToTimeEstimateSchema),
  },
  {
    name: "compare_time_estimate",
    description: "Compare time estimate vs actual time spent with analysis",
    inputSchema: zodToJsonSchema(CompareTimeEstimateSchema),
  },
  {
    name: "bulk_estimate_issues",
    description: "Set or add time estimates to multiple issues",
    inputSchema: zodToJsonSchema(BulkEstimateIssuesSchema),
  },
  {
    name: "list_time_entries",
    description: "List time tracking entries for an issue",
    inputSchema: zodToJsonSchema(ListTimeEntriesSchema),
  },
  {
    name: "delete_time_entry",
    description: "Delete a time tracking entry",
    inputSchema: zodToJsonSchema(DeleteTimeEntrySchema),
  },
];

// ============================================================================
// RELEASES TOOLS
// ============================================================================

export const releasesTools = [
  {
    name: "list_releases",
    description: "List releases in a GitLab project",
    inputSchema: zodToJsonSchema(ListReleasesSchema),
  },
  {
    name: "get_release",
    description: "Get details of a specific release",
    inputSchema: zodToJsonSchema(GetReleaseSchema),
  },
  {
    name: "create_release",
    description: "Create a new release in a GitLab project",
    inputSchema: zodToJsonSchema(CreateReleaseSchema),
  },
  {
    name: "update_release",
    description: "Update an existing release",
    inputSchema: zodToJsonSchema(UpdateReleaseSchema),
  },
  {
    name: "delete_release",
    description: "Delete a release from a GitLab project",
    inputSchema: zodToJsonSchema(DeleteReleaseSchema),
  },
  {
    name: "create_release_asset",
    description: "Create a release asset link",
    inputSchema: zodToJsonSchema(CreateReleaseAssetSchema),
  },
  {
    name: "update_release_asset",
    description: "Update a release asset link",
    inputSchema: zodToJsonSchema(UpdateReleaseAssetSchema),
  },
  {
    name: "delete_release_asset",
    description: "Delete a release asset link",
    inputSchema: zodToJsonSchema(DeleteReleaseAssetSchema),
  },
];

// ============================================================================
// BULK OPERATIONS TOOLS
// ============================================================================

export const bulkOperationsTools = [
  {
    name: "bulk_update_issues",
    description: "Update multiple issues simultaneously",
    inputSchema: zodToJsonSchema(BulkUpdateIssuesSchema),
  },
  {
    name: "bulk_close_issues",
    description: "Close multiple issues with optional comment",
    inputSchema: zodToJsonSchema(BulkCloseIssuesSchema),
  },
  {
    name: "bulk_assign_issues",
    description: "Assign or unassign multiple issues to users",
    inputSchema: zodToJsonSchema(BulkAssignIssuesSchema),
  },
  {
    name: "bulk_label_issues",
    description: "Add, remove, or replace labels on multiple issues",
    inputSchema: zodToJsonSchema(BulkLabelIssuesSchema),
  },
  {
    name: "bulk_update_merge_requests",
    description: "Update multiple merge requests simultaneously",
    inputSchema: zodToJsonSchema(BulkUpdateMergeRequestsSchema),
  },
  {
    name: "bulk_export_data",
    description: "Export project data in bulk (issues, MRs, milestones)",
    inputSchema: zodToJsonSchema(BulkExportSchema),
  },
];

// ============================================================================
// ANALYTICS TOOLS
// ============================================================================

export const analyticsTools = [
  {
    name: "get_project_analytics",
    description: "Get comprehensive project analytics and metrics",
    inputSchema: zodToJsonSchema(ProjectAnalyticsSchema),
  },
  {
    name: "get_issue_analytics",
    description: "Get issue-specific analytics including velocity and cycle time",
    inputSchema: zodToJsonSchema(IssueAnalyticsSchema),
  },
  {
    name: "get_team_performance",
    description: "Get team and individual performance metrics",
    inputSchema: zodToJsonSchema(TeamPerformanceSchema),
  },
  {
    name: "get_milestone_analytics",
    description: "Get milestone progress and burndown analytics",
    inputSchema: zodToJsonSchema(MilestoneAnalyticsSchema),
  },
  {
    name: "generate_custom_report",
    description: "Generate custom reports with specified filters and grouping",
    inputSchema: zodToJsonSchema(CustomReportSchema),
  },
];

// ============================================================================
// WEBHOOKS TOOLS
// ============================================================================

export const webhooksTools = [
  {
    name: "list_webhooks",
    description: "List project webhooks",
    inputSchema: zodToJsonSchema(ListWebhooksSchema),
  },
  {
    name: "get_webhook",
    description: "Get details of a specific webhook",
    inputSchema: zodToJsonSchema(GetWebhookSchema),
  },
  {
    name: "create_webhook",
    description: "Create a new project webhook",
    inputSchema: zodToJsonSchema(CreateWebhookSchema),
  },
  {
    name: "update_webhook",
    description: "Update an existing webhook",
    inputSchema: zodToJsonSchema(UpdateWebhookSchema),
  },
  {
    name: "delete_webhook",
    description: "Delete a project webhook",
    inputSchema: zodToJsonSchema(DeleteWebhookSchema),
  },
  {
    name: "test_webhook",
    description: "Test a webhook by triggering a test event",
    inputSchema: zodToJsonSchema(TestWebhookSchema),
  },
];

// ============================================================================
// ALL EXTENSION TOOLS
// ============================================================================

export const allExtensionTools = [
  ...boardTools,
  ...timeTrackingTools,
  ...releasesTools,
  ...bulkOperationsTools,
  ...analyticsTools,
  ...webhooksTools,
];

// Extension tool names for filtering
export const extensionToolNames = allExtensionTools.map(tool => tool.name);

// Read-only extension tools
export const readOnlyExtensionTools = [
  "list_boards",
  "get_board",
  "list_board_lists",
  "get_board_list_issues",
  "get_time_tracking",
  "get_time_estimate",
  "compare_time_estimate",
  "list_time_entries",
  "list_releases",
  "get_release",
  "get_project_analytics",
  "get_issue_analytics",
  "get_team_performance",
  "get_milestone_analytics",
  "generate_custom_report",
  "bulk_export_data",
  "list_webhooks",
  "get_webhook",
];