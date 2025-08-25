// TypeScript type definitions for GitLab MCP Extensions

import { z } from "zod";
import {
  GitLabBoardSchema,
  GitLabTimeStatsSchema,
  GitLabTimeEntrySchema,
  GitLabReleaseSchema,
  GitLabWebhookSchema,
} from "./schemas.js";

// ============================================================================
// ISSUE BOARDS TYPES
// ============================================================================

export type GitLabBoard = z.infer<typeof GitLabBoardSchema>;

export interface GitLabBoardList {
  id: number;
  label: {
    id: number;
    name: string;
    color: string;
    description: string | null;
  } | null;
  position: number;
  list_type: 'backlog' | 'closed' | 'label' | 'milestone' | 'assignee';
  collapsed?: boolean;
}

export interface GitLabBoardCreateOptions {
  name: string;
  assignee_id?: number;
  milestone_id?: number;
  labels?: string[];
  weight?: number;
}

export interface GitLabBoardUpdateOptions {
  name?: string;
  assignee_id?: number;
  milestone_id?: number;
  labels?: string[];
  weight?: number;
}

// ============================================================================
// TIME TRACKING TYPES
// ============================================================================

export type GitLabTimeStats = z.infer<typeof GitLabTimeStatsSchema>;
export type GitLabTimeEntry = z.infer<typeof GitLabTimeEntrySchema>;

export interface TimeTrackingOptions {
  duration: string;
  summary?: string;
  spent_at?: string;
}

export interface TimeEstimateOptions {
  duration: string;
}

// ============================================================================
// RELEASES TYPES
// ============================================================================

export type GitLabRelease = z.infer<typeof GitLabReleaseSchema>;

export interface GitLabReleaseAsset {
  id: number;
  name: string;
  url: string;
  external: boolean;
  link_type: 'runbook' | 'package' | 'image' | 'other';
  filepath?: string;
}

export interface GitLabReleaseCreateOptions {
  name: string;
  tag_name: string;
  description: string;
  ref?: string;
  milestones?: string[];
  assets?: {
    links?: Array<{
      name: string;
      url: string;
      filepath?: string;
      link_type?: 'runbook' | 'package' | 'image' | 'other';
    }>;
  };
  released_at?: string;
}

export interface GitLabReleaseUpdateOptions {
  name?: string;
  description?: string;
  milestones?: string[];
  released_at?: string;
}

// ============================================================================
// BULK OPERATIONS TYPES
// ============================================================================

export interface BulkUpdateIssuesOptions {
  issue_iids: number[];
  assignee_ids?: number[];
  milestone_id?: number;
  labels?: string[];
  remove_labels?: string[];
  state_event?: 'close' | 'reopen';
  discussion_locked?: boolean;
}

export interface BulkCloseIssuesOptions {
  issue_iids: number[];
  comment?: string;
}

export interface BulkAssignIssuesOptions {
  issue_iids: number[];
  assignee_ids: number[];
  action: 'assign' | 'unassign';
}

export interface BulkLabelIssuesOptions {
  issue_iids: number[];
  labels: string[];
  action: 'add' | 'remove' | 'replace';
}

export interface BulkUpdateMergeRequestsOptions {
  merge_request_iids: number[];
  assignee_ids?: number[];
  reviewer_ids?: number[];
  milestone_id?: number;
  labels?: string[];
  remove_labels?: string[];
  state_event?: 'close' | 'reopen';
}

export interface BulkExportOptions {
  export_type: 'issues' | 'merge_requests' | 'milestones';
  format: 'json' | 'csv';
  filters?: {
    state?: 'opened' | 'closed' | 'all';
    labels?: string[];
    milestone?: string;
    assignee_id?: number;
    author_id?: number;
    created_after?: string;
    created_before?: string;
  };
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface ProjectAnalyticsOptions {
  from: string;
  to: string;
  milestone_id?: number;
  labels?: string[];
}

export interface IssueAnalyticsOptions extends ProjectAnalyticsOptions {
  group_by?: 'day' | 'week' | 'month';
  include_closed?: boolean;
}

export interface TeamPerformanceOptions extends ProjectAnalyticsOptions {
  user_ids?: number[];
  include_time_tracking?: boolean;
}

export interface MilestoneAnalyticsOptions {
  milestone_id: string;
  include_burndown?: boolean;
}

export interface CustomReportOptions {
  report_type: 'issues' | 'merge_requests' | 'time_tracking' | 'milestones';
  from: string;
  to: string;
  filters?: {
    state?: 'opened' | 'closed' | 'all';
    labels?: string[];
    milestone?: string;
    assignee_id?: number;
    author_id?: number;
  };
  format: 'json' | 'csv';
  group_by?: 'day' | 'week' | 'month' | 'user' | 'label' | 'milestone';
}

export interface AnalyticsResult {
  metrics: Record<string, any>;
  data: any[];
  summary: {
    total_count: number;
    date_range: {
      from: string;
      to: string;
    };
    filters_applied: Record<string, any>;
  };
}

// ============================================================================
// WEBHOOKS TYPES
// ============================================================================

export type GitLabWebhook = z.infer<typeof GitLabWebhookSchema>;

export interface GitLabWebhookCreateOptions {
  url: string;
  push_events?: boolean;
  issues_events?: boolean;
  confidential_issues_events?: boolean;
  merge_requests_events?: boolean;
  tag_push_events?: boolean;
  note_events?: boolean;
  confidential_note_events?: boolean;
  job_events?: boolean;
  pipeline_events?: boolean;
  wiki_page_events?: boolean;
  deployment_events?: boolean;
  releases_events?: boolean;
  subgroup_events?: boolean;
  push_events_branch_filter?: string;
  enable_ssl_verification?: boolean;
  token?: string;
  custom_webhook_template?: string;
}

export interface GitLabWebhookUpdateOptions {
  url?: string;
  push_events?: boolean;
  issues_events?: boolean;
  confidential_issues_events?: boolean;
  merge_requests_events?: boolean;
  tag_push_events?: boolean;
  note_events?: boolean;
  confidential_note_events?: boolean;
  job_events?: boolean;
  pipeline_events?: boolean;
  wiki_page_events?: boolean;
  deployment_events?: boolean;
  releases_events?: boolean;
  subgroup_events?: boolean;
  push_events_branch_filter?: string;
  enable_ssl_verification?: boolean;
  token?: string;
  custom_webhook_template?: string;
}

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface PaginationOptions {
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
}

export interface ExtensionError {
  type: string;
  message: string;
  context?: any;
  status_code?: number;
}

// ============================================================================
// WORKFLOW AUTOMATION TYPES (Future Implementation)
// ============================================================================

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: {
    event_type: string;
    conditions: Record<string, any>;
  };
  actions: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleCreateOptions {
  name: string;
  description?: string;
  enabled?: boolean;
  trigger: {
    event_type: string;
    conditions: Record<string, any>;
  };
  actions: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
}