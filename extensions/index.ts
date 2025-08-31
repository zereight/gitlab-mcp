// GitLab MCP Extensions - Main Export File
// This file exports all extension functionality for integration with the main GitLab MCP server

export * from "./schemas.js";
export * from "./tools.js";
export * from "./handlers.js";

// Re-export commonly used items for convenience
export {
  allExtensionTools,
  extensionToolNames,
  readOnlyExtensionTools,
  boardTools,
  timeTrackingTools,
  releasesTools,
  bulkOperationsTools,
  analyticsTools,
  webhooksTools,
} from "./tools.js";

export {
  extensionHandlers,
  type ExtensionHandlerContext,
} from "./handlers.js";