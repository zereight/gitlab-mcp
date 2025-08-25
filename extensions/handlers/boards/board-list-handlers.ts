// Board list operation handlers

import { ExtensionHandlerContext } from '../types.js';
import { formatSuccessResponse, encodeProjectId, createRequestBody } from '../utils.js';

export async function handleListBoardLists(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, board_id } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Listing board lists for board ${board_id} in project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards/${board_id}/lists`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(response);
  const lists = await response.json();
  
  return formatSuccessResponse(lists);
}

export async function handleCreateBoardList(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, board_id, label_id, assignee_id, milestone_id } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Creating board list for board ${board_id} in project ${effectiveProjectId}`);
  
  const body = createRequestBody({
    label_id,
    assignee_id,
    milestone_id
  });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards/${board_id}/lists`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "POST",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const list = await response.json();
  
  return formatSuccessResponse(list);
}

export async function handleUpdateBoardList(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, board_id, list_id, position, collapsed } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Updating board list ${list_id} for board ${board_id} in project ${effectiveProjectId}`);
  
  const body = createRequestBody({
    position,
    collapsed
  });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards/${board_id}/lists/${list_id}`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "PUT",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const list = await response.json();
  
  return formatSuccessResponse(list);
}

export async function handleDeleteBoardList(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, board_id, list_id } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Deleting board list ${list_id} for board ${board_id} in project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards/${board_id}/lists/${list_id}`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "DELETE",
    }
  );
  
  await context.handleGitLabError(response);
  
  return formatSuccessResponse(`Board list ${list_id} deleted successfully`);
}

export async function handleGetBoardListIssues(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, board_id, list_id, page = 1, per_page = 20 } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Getting issues for board list ${list_id} in board ${board_id} for project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards/${board_id}/lists/${list_id}/issues?page=${page}&per_page=${per_page}`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(response);
  const issues = await response.json();
  
  return formatSuccessResponse(issues);
}