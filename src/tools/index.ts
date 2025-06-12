// Re-export all tool functionality for the 6 exposed GitLab MCP tools

export { allTools, readOnlyTools, wikiToolNames } from './definitions.js';
export { handleToolCall } from './handlers.js'; 