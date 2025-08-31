// Extension handlers for GitLab MCP Extensions
// This file imports and re-exports all handlers from the organized structure

// Import all handlers from the new organized structure
import * as handlers from './handlers/index.js';

// Re-export the context interface for backward compatibility
export interface ExtensionHandlerContext {
  GITLAB_API_URL: string;
  DEFAULT_FETCH_CONFIG: any;
  getEffectiveProjectId: (projectId: string) => string;
  handleGitLabError: (response: any) => Promise<void>;
  logger: any;
  fetch: any;
}

// Re-export all handlers for backward compatibility
export const {
  // Board handlers
  handleListBoards,
  handleGetBoard,
  handleCreateBoard,
  handleUpdateBoard,
  handleDeleteBoard,
  handleListBoardLists,
  handleCreateBoardList,
  handleUpdateBoardList,
  handleDeleteBoardList,
  handleGetBoardListIssues,
  
  // Time tracking handlers
  handleAddTimeSpent,
  handleGetTimeTracking,
  handleListTimeEntries,
  handleDeleteTimeEntry,
  handleAddTimeEstimate,
  handleAddToTimeEstimate,
  handleUpdateTimeEstimate,
  handleResetTimeEstimate,
  handleGetTimeEstimate,
  handleCompareTimeEstimate,
  handleBulkEstimateIssues,
  
  // Release handlers (placeholders for now)
  handleListReleases,
  handleGetRelease,
  handleCreateRelease,
  handleUpdateRelease,
  handleDeleteRelease,
  handleCreateReleaseAsset,
  handleUpdateReleaseAsset,
  handleDeleteReleaseAsset,
  
  // Bulk operation handlers (placeholders for now)
  handleBulkUpdateIssues,
  handleBulkCloseIssues,
  handleBulkAssignIssues,
  handleBulkLabelIssues,
  handleBulkUpdateMergeRequests,
  handleBulkExportData,
  
  // Analytics handlers (placeholders for now)
  handleGetProjectAnalytics,
  handleGetIssueAnalytics,
  handleGetTeamPerformance,
  handleGetMilestoneAnalytics,
  handleGenerateCustomReport,
  
  // Webhook handlers (placeholders for now)
  handleListWebhooks,
  handleGetWebhook,
  handleCreateWebhook,
  handleUpdateWebhook,
  handleDeleteWebhook,
  handleTestWebhook
} = handlers;

// Export the handler mapping for tools.ts
export const extensionHandlers = {
  // Issue Boards
  list_boards: handleListBoards,
  get_board: handleGetBoard,
  create_board: handleCreateBoard,
  update_board: handleUpdateBoard,
  delete_board: handleDeleteBoard,
  list_board_lists: handleListBoardLists,
  create_board_list: handleCreateBoardList,
  update_board_list: handleUpdateBoardList,
  delete_board_list: handleDeleteBoardList,
  get_board_list_issues: handleGetBoardListIssues,
  
  // Time Tracking
  add_time_spent: handleAddTimeSpent,
  get_time_tracking: handleGetTimeTracking,
  add_time_estimate: handleAddTimeEstimate,
  add_to_time_estimate: handleAddToTimeEstimate,
  update_time_estimate: handleUpdateTimeEstimate,
  reset_time_estimate: handleResetTimeEstimate,
  get_time_estimate: handleGetTimeEstimate,
  compare_time_estimate: handleCompareTimeEstimate,
  bulk_estimate_issues: handleBulkEstimateIssues,
  list_time_entries: handleListTimeEntries,
  delete_time_entry: handleDeleteTimeEntry,
  
  // Releases
  list_releases: handleListReleases,
  get_release: handleGetRelease,
  create_release: handleCreateRelease,
  update_release: handleUpdateRelease,
  delete_release: handleDeleteRelease,
  create_release_asset: handleCreateReleaseAsset,
  update_release_asset: handleUpdateReleaseAsset,
  delete_release_asset: handleDeleteReleaseAsset,
  
  // Bulk Operations
  bulk_update_issues: handleBulkUpdateIssues,
  bulk_close_issues: handleBulkCloseIssues,
  bulk_assign_issues: handleBulkAssignIssues,
  bulk_label_issues: handleBulkLabelIssues,
  bulk_update_merge_requests: handleBulkUpdateMergeRequests,
  bulk_export_data: handleBulkExportData,
  
  // Analytics
  get_project_analytics: handleGetProjectAnalytics,
  get_issue_analytics: handleGetIssueAnalytics,
  get_team_performance: handleGetTeamPerformance,
  get_milestone_analytics: handleGetMilestoneAnalytics,
  generate_custom_report: handleGenerateCustomReport,
  
  // Webhooks
  list_webhooks: handleListWebhooks,
  get_webhook: handleGetWebhook,
  create_webhook: handleCreateWebhook,
  update_webhook: handleUpdateWebhook,
  delete_webhook: handleDeleteWebhook,
  test_webhook: handleTestWebhook,
};