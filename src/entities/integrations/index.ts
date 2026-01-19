// Always export shared schemas
export * from "../shared";

// Always export read-only schemas
export * from "./schema-readonly";

// Export write schemas
export * from "./schema";

// Export the unified registry
export * from "./registry";

// Import from the registry
import { getFilteredIntegrationsTools, getIntegrationsReadOnlyToolNames } from "./registry";
import type { ToolDefinition } from "../../types";

// Conditional exports based on GITLAB_READONLY environment variable
const isReadOnly = process.env.GITLAB_READONLY === "true";

// Get tools from the registry
const integrationsToolsFromRegistry = getFilteredIntegrationsTools(isReadOnly);

// Convert enhanced tool definitions to regular tool definitions for backward compatibility
export const integrationsTools: ToolDefinition[] = integrationsToolsFromRegistry.map(
  (tool): ToolDefinition => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })
);

// Export read-only tool names for backward compatibility
export const integrationsReadOnlyTools = getIntegrationsReadOnlyToolNames();
