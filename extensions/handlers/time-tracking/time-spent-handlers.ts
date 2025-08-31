// Time spent operation handlers

import { ExtensionHandlerContext } from '../types.js';
import { formatSuccessResponse, encodeProjectId, createRequestBody } from '../utils.js';

export async function handleAddTimeSpent(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid, duration, summary, spent_at } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Adding time spent to issue ${issue_iid} in project ${effectiveProjectId}`);
  
  const body = createRequestBody({
    duration,
    summary,
    spent_at
  });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/add_spent_time`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "POST",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const timeEntry = await response.json();
  
  return formatSuccessResponse(timeEntry);
}

export async function handleGetTimeTracking(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Getting time tracking for issue ${issue_iid} in project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_stats`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(response);
  const timeStats = await response.json();
  
  return formatSuccessResponse(timeStats);
}

export async function handleListTimeEntries(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid, page = 1, per_page = 20 } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Listing time entries for issue ${issue_iid} in project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/resource_time_events?page=${page}&per_page=${per_page}`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(response);
  const timeEntries = await response.json();
  
  return formatSuccessResponse(timeEntries);
}

export async function handleDeleteTimeEntry(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid, time_event_id } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Deleting time entry ${time_event_id} for issue ${issue_iid} in project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/resource_time_events/${time_event_id}`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "DELETE",
    }
  );
  
  await context.handleGitLabError(response);
  
  return formatSuccessResponse(`Time entry ${time_event_id} deleted successfully`);
}