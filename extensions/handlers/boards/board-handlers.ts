// Board CRUD operation handlers

import { ExtensionHandlerContext } from '../types.js';
import { formatSuccessResponse, formatArrayParam, encodeProjectId, createRequestBody } from '../utils.js';

export async function handleListBoards(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, page = 1, per_page = 20 } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Listing boards for project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards?page=${page}&per_page=${per_page}`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(response);
  const boards = await response.json();
  
  return formatSuccessResponse(boards);
}

export async function handleGetBoard(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, board_id } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Getting board ${board_id} for project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards/${board_id}`,
    context.DEFAULT_FETCH_CONFIG
  );
  
  await context.handleGitLabError(response);
  const board = await response.json();
  
  return formatSuccessResponse(board);
}

export async function handleCreateBoard(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, name, assignee_id, milestone_id, labels, weight } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Creating board "${name}" for project ${effectiveProjectId}`);
  
  const body = createRequestBody({
    name,
    assignee_id,
    milestone_id,
    labels: formatArrayParam(labels),
    weight
  });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "POST",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const board = await response.json();
  
  return formatSuccessResponse(board);
}

export async function handleUpdateBoard(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, board_id, name, assignee_id, milestone_id, labels, weight } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Updating board ${board_id} for project ${effectiveProjectId}`);
  
  const body = createRequestBody({
    name,
    assignee_id,
    milestone_id,
    labels: formatArrayParam(labels),
    weight
  });
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards/${board_id}`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "PUT",
      body,
    }
  );
  
  await context.handleGitLabError(response);
  const board = await response.json();
  
  return formatSuccessResponse(board);
}

export async function handleDeleteBoard(args: any, context: ExtensionHandlerContext): Promise<any> {
  const { project_id, board_id } = args;
  const effectiveProjectId = context.getEffectiveProjectId(project_id);
  
  context.logger.info(`Deleting board ${board_id} for project ${effectiveProjectId}`);
  
  const response = await context.fetch(
    `${context.GITLAB_API_URL}/projects/${encodeProjectId(effectiveProjectId)}/boards/${board_id}`,
    {
      ...context.DEFAULT_FETCH_CONFIG,
      method: "DELETE",
    }
  );
  
  await context.handleGitLabError(response);
  
  return formatSuccessResponse(`Board ${board_id} deleted successfully`);
}