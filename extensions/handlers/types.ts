// Shared types and interfaces for GitLab MCP Extension handlers

export interface ExtensionHandlerContext {
  GITLAB_API_URL: string;
  DEFAULT_FETCH_CONFIG: any;
  getEffectiveProjectId: (projectId: string) => string;
  handleGitLabError: (response: any) => Promise<void>;
  logger: any;
  fetch: any;
}

export interface HandlerResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// Common response types
export interface SuccessResponse extends HandlerResponse {}
export interface ErrorResponse extends HandlerResponse {}

// Common parameter types
export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface ProjectParams {
  project_id: string;
}

// Board-related types
export interface BoardParams extends ProjectParams {
  board_id?: string;
  name?: string;
  assignee_id?: number;
  milestone_id?: number;
  labels?: string[];
  weight?: number;
}

export interface BoardListParams extends ProjectParams {
  board_id: string;
  list_id?: string;
  label_id?: number;
  assignee_id?: number;
  milestone_id?: number;
  position?: number;
  collapsed?: boolean;
}

// Time tracking types
export interface TimeTrackingParams extends ProjectParams {
  issue_iid: string;
  duration?: string;
  summary?: string;
  spent_at?: string;
  time_event_id?: string;
}

export interface BulkEstimateParams extends ProjectParams {
  issue_iids: string[];
  duration: string;
  action: 'set' | 'add';
}

// Release types
export interface ReleaseParams extends ProjectParams {
  tag_name?: string;
  name?: string;
  description?: string;
  ref?: string;
  milestones?: string[];
  released_at?: string;
}

// Webhook types
export interface WebhookParams extends ProjectParams {
  webhook_id?: string;
  url?: string;
  push_events?: boolean;
  issues_events?: boolean;
  merge_requests_events?: boolean;
  tag_push_events?: boolean;
  note_events?: boolean;
  job_events?: boolean;
  pipeline_events?: boolean;
  wiki_page_events?: boolean;
  deployment_events?: boolean;
  releases_events?: boolean;
  subgroup_events?: boolean;
  enable_ssl_verification?: boolean;
  token?: string;
  push_events_branch_filter?: string;
}

// Analytics types
export interface AnalyticsParams extends ProjectParams {
  from_date?: string;
  to_date?: string;
  milestone_id?: number;
  assignee_id?: number;
  author_id?: number;
  label_name?: string[];
}

// Bulk operations types
export interface BulkOperationParams extends ProjectParams {
  issue_iids?: string[];
  merge_request_iids?: string[];
  assignee_id?: number;
  milestone_id?: number;
  labels?: string[];
  state_event?: 'close' | 'reopen';
}