// Always export shared schemas
export * from "../shared";

// Always export read-only schemas (for backward compatibility)
export * from "./schema-readonly";

// Export write schemas (for backward compatibility)
export * from "./schema";

// Export the new unified registry
export * from "./registry";

// Import from the new registry
import { getFilteredWebhooksTools, getWebhooksReadOnlyToolNames } from "./registry";
import type { ToolDefinition } from "../../types";

// Conditional exports based on GITLAB_READ_ONLY_MODE environment variable
const isReadOnly = process.env.GITLAB_READ_ONLY_MODE === "true";

// Get tools from the new registry (with backward compatibility)
const webhooksToolsFromRegistry = getFilteredWebhooksTools(isReadOnly);

// Convert enhanced tool definitions to regular tool definitions for backward compatibility
export const webhooksTools: ToolDefinition[] = webhooksToolsFromRegistry.map(
  (tool): ToolDefinition => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })
);

// Export read-only tool names for backward compatibility
export const webhooksReadOnlyTools = getWebhooksReadOnlyToolNames();
