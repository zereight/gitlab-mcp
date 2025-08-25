// Time estimate operation handlers

import { ExtensionHandlerContext } from '../types.js';
import { 
  formatSuccessResponse, 
  encodeProjectId, 
  createRequestBody,
  parseDurationToSeconds,
  formatSecondsToHumanDuration,
  calculateAccuracyPercentage,
  calculateVariancePercentage,
  getTimeTrackingStatus,
  batchProcess,
  createBulkOperationSummary
} from '../utils.js';

export async function handleAddTimeEstimate(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid, duration } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Adding time estimate for issue ${issue_iid} in project ${effectiveProjectId}`);
  
  const body = createRequestBody({ duration });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_estimate`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "POST",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const estimate = await response.json();
  
  return formatSuccessResponse(estimate);
}

export async function handleAddToTimeEstimate(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid, duration } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Adding time estimate to issue ${issue_iid} in project ${effectiveProjectId}`);
  
  // First get current estimate
  const currentResponse = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_stats`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(currentResponse);
  const currentStats = await currentResponse.json();
  
  // Parse durations and add them
  const currentEstimate = currentStats.time_estimate || 0;
  const additionalSeconds = parseDurationToSeconds(duration);
  const newTotalSeconds = currentEstimate + additionalSeconds;
  const newDuration = formatSecondsToHumanDuration(newTotalSeconds);
  
  // Update with new total
  const body = createRequestBody({ duration: newDuration });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_estimate`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "POST",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const result = await response.json();
  
  return formatSuccessResponse({
    ...result,
    previous_estimate: currentStats.human_time_estimate,
    added_estimate: duration,
    new_total_estimate: result.human_time_estimate
  });
}

export async function handleUpdateTimeEstimate(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid, duration } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Updating time estimate for issue ${issue_iid} in project ${effectiveProjectId}`);
  
  const body = createRequestBody({ duration });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_estimate`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "POST",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const estimate = await response.json();
  
  return formatSuccessResponse(estimate);
}

export async function handleResetTimeEstimate(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Resetting time estimate for issue ${issue_iid} in project ${effectiveProjectId}`);
  
  const body = createRequestBody({ duration: "0" });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/reset_time_estimate`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "POST",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const result = await response.json();
  
  return formatSuccessResponse(result);
}

export async function handleGetTimeEstimate(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Getting time estimate for issue ${issue_iid} in project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_stats`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(response);
  const timeStats = await response.json();
  
  // Return only estimate-related data
  const estimateData = {
    time_estimate: timeStats.time_estimate,
    human_time_estimate: timeStats.human_time_estimate,
  };
  
  return formatSuccessResponse(estimateData);
}

export async function handleCompareTimeEstimate(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iid, include_breakdown = false } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Comparing time estimate vs actual for issue ${issue_iid} in project ${effectiveProjectId}`);
  
  // Get time stats
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_stats`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(response);
  const timeStats = await response.json();
  
  const estimated = timeStats.time_estimate || 0;
  const actual = timeStats.total_time_spent || 0;
  const difference = actual - estimated;
  const accuracyPercentage = calculateAccuracyPercentage(estimated, actual);
  
  let breakdown = {};
  if (include_breakdown) {
    // Get time entries for detailed breakdown
    const entriesResponse = await context.fetch(
      `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/resource_time_events`,
      context.DEFAULT_FETCH_CONFIG
    );
    
    if (entriesResponse.ok) {
      const entries = await entriesResponse.json();
      breakdown = {
        total_entries: entries.length,
        entries: entries.map((entry: any) => ({
          duration: entry.duration,
          spent_at: entry.spent_at,
          user: entry.user?.name || 'Unknown',
          note: entry.note
        }))
      };
    }
  }
  
  const comparison = {
    issue_iid: issue_iid,
    estimated_seconds: estimated,
    actual_seconds: actual,
    difference_seconds: difference,
    estimated_human: timeStats.human_time_estimate,
    actual_human: timeStats.human_total_time_spent,
    difference_human: formatSecondsToHumanDuration(Math.abs(difference)),
    status: getTimeTrackingStatus(estimated, actual),
    accuracy_percentage: accuracyPercentage,
    variance_percentage: calculateVariancePercentage(estimated, actual),
    ...(include_breakdown && { breakdown })
  };
  
  return formatSuccessResponse(comparison);
}

export async function handleBulkEstimateIssues(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, issue_iids, duration, action } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Bulk ${action} time estimates for ${issue_iids.length} issues in project ${effectiveProjectId}`);
  
  const processor = async (issue_iid: string) => {
    let finalDuration = duration;
    
    if (action === 'add') {
      // Get current estimate first
      const currentResponse = await context.fetch(
        `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_stats`,
        context.DEFAULT_FETCH_CONFIG
      );
      
      if (currentResponse.ok) {
        const currentStats = await currentResponse.json();
        const currentEstimate = currentStats.time_estimate || 0;
        const additionalSeconds = parseDurationToSeconds(duration);
        const newTotalSeconds = currentEstimate + additionalSeconds;
        finalDuration = formatSecondsToHumanDuration(newTotalSeconds);
      }
    }
    
    const body = createRequestBody({ duration: finalDuration });
    
    const response = await context.fetch(
      `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/issues/${issue_iid}/time_estimate`,
      {
        ...context.DEFAULT_FETCH_CONFIG,
        method: "POST",
        body,
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return {
      issue_iid,
      status: 'success',
      new_estimate: result.human_time_estimate,
      action: action
    };
  };
  
  const results = await batchProcess(issue_iids, processor);
  const summary = createBulkOperationSummary(results, action, { duration });
  
  return formatSuccessResponse(summary);
}