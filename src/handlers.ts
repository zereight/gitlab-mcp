import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ConnectionManager } from "./services/ConnectionManager";
import { logger } from "./logger";
import {
  handleGitLabError,
  GitLabStructuredError,
  isStructuredToolError,
} from "./utils/error-handler";

interface JsonSchemaProperty {
  type?: string;
  $ref?: string;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  enum?: unknown[];
  oneOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  [key: string]: unknown;
}

type JsonSchema = JsonSchemaProperty & {
  $schema?: string;
  properties?: Record<string, JsonSchemaProperty>;
};

/**
 * Extract HTTP status code and message from GitLab API error string
 * Matches patterns like:
 *   - "GitLab API error: 403 Forbidden - message"
 *   - "GitLab API error: 403 Forbidden"
 *   - "GitLab API error: 403"
 *   - "Failed to execute tool 'name': GitLab API error: 403 Forbidden"
 *
 * Exported for direct unit testing.
 */
export function parseGitLabApiError(
  errorMessage: string
): { status: number; message: string } | null {
  // Match GitLab API error anywhere in the string (handles wrapped errors)
  // Pattern: "GitLab API error: <status> [<statusText>] [- <details>]"
  // Status text uses [\w\s]+? to match word chars and spaces (non-greedy)
  // Separator is " - " (space-hyphen-space) to avoid matching hyphens in status text
  const match = errorMessage.match(/GitLab API error:\s*(\d+)(?:\s+([\w\s]+?))?(?:\s+-\s+(.*))?$/);
  if (!match) return null;

  const status = parseInt(match[1], 10);
  const statusText = match[2]?.trim() ?? "";
  const details = match[3]?.trim() ?? "";

  let message: string;
  if (statusText && details) {
    message = `${status} ${statusText} - ${details}`;
  } else if (statusText) {
    message = `${status} ${statusText}`;
  } else if (details) {
    message = `${status} - ${details}`;
  } else {
    message = `${status}`;
  }

  return { status, message };
}

/**
 * Type guard for objects with an action property
 */
function hasAction(value: unknown): value is { action: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "action" in value &&
    typeof (value as { action: unknown }).action === "string"
  );
}

/**
 * Extract action from error or its cause chain
 */
function extractActionFromError(error: unknown): string | undefined {
  if (hasAction(error)) {
    return error.action;
  }

  // Check error cause (for wrapped errors)
  const cause = (error as Error & { cause?: unknown }).cause;
  if (hasAction(cause)) {
    return cause.action;
  }

  return undefined;
}

/**
 * Convert an error to a structured GitLab error response
 * Extracts tool name and action from context, parses API errors
 */
function toStructuredError(
  error: unknown,
  toolName: string,
  toolArgs?: Record<string, unknown>
): GitLabStructuredError | null {
  // If already a structured error, return it
  if (isStructuredToolError(error)) {
    return error.structuredError;
  }

  // Check if the error cause is a structured error (for wrapped errors)
  const cause = (error as Error & { cause?: unknown }).cause;
  if (isStructuredToolError(cause)) {
    return cause.structuredError;
  }

  if (!(error instanceof Error)) return null;

  // Try to parse GitLab API error from message
  const parsed = parseGitLabApiError(error.message);
  if (!parsed) return null;

  // Extract action: prefer from error cause, then from tool args
  let action = extractActionFromError(error);
  if (!action && toolArgs && typeof toolArgs.action === "string") {
    action = toolArgs.action;
  }
  action ??= "unknown";

  return handleGitLabError(
    { status: parsed.status, message: parsed.message },
    toolName,
    action,
    toolArgs
  );
}

export async function setupHandlers(server: Server): Promise<void> {
  // Initialize connection and detect GitLab instance on startup
  const connectionManager = ConnectionManager.getInstance();
  try {
    await connectionManager.initialize();
    logger.info("Connection initialized during server setup");
  } catch (error) {
    logger.warn(
      `Initial connection failed during setup, will retry on first tool call: ${error instanceof Error ? error.message : String(error)}`
    );
    // Continue without initialization - tools will handle gracefully on first call
  }
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info("ListToolsRequest received");

    // Get tools from registry manager (already filtered)
    const { RegistryManager } = await import("./registry-manager");
    const registryManager = RegistryManager.getInstance();
    const tools = registryManager.getAllToolDefinitions();

    logger.info({ toolCount: tools.length }, "Returning tools list");

    // Helper function to resolve $ref references in JSON schema
    function resolveRefs(
      schema: JsonSchemaProperty | JsonSchemaProperty[],
      rootSchema?: JsonSchema
    ): JsonSchemaProperty | JsonSchemaProperty[] {
      if (!schema || typeof schema !== "object") return schema;

      // Set root schema for reference resolution
      rootSchema ??= schema as JsonSchema;

      // Handle arrays
      if (Array.isArray(schema)) {
        return schema.map(item => resolveRefs(item, rootSchema) as JsonSchemaProperty);
      }

      // Handle $ref resolution
      if (schema.$ref && typeof schema.$ref === "string") {
        const refPath = schema.$ref.replace("#/properties/", "");
        const referencedProperty = rootSchema.properties?.[refPath];

        if (referencedProperty) {
          // Resolve the referenced property recursively
          const resolvedRef = resolveRefs(referencedProperty, rootSchema) as JsonSchemaProperty;
          // Merge with current properties (excluding $ref)
          const schemaWithoutRef = { ...schema };
          delete schemaWithoutRef.$ref;
          return { ...resolvedRef, ...schemaWithoutRef };
        }
        // If reference can't be resolved, remove $ref and keep other properties
        const schemaWithoutRef = { ...schema };
        delete schemaWithoutRef.$ref;
        return schemaWithoutRef;
      }

      // Recursively process all object properties
      const result: JsonSchemaProperty = {};
      for (const [key, value] of Object.entries(schema)) {
        if (key === "properties" && typeof value === "object" && value !== null) {
          // Special handling for properties object
          const resolvedProperties: Record<string, JsonSchemaProperty> = {};
          for (const [propKey, propValue] of Object.entries(
            value as Record<string, JsonSchemaProperty>
          )) {
            resolvedProperties[propKey] = resolveRefs(propValue, rootSchema) as JsonSchemaProperty;
          }
          result[key] = resolvedProperties;
        } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          result[key] = resolveRefs(value as JsonSchemaProperty, rootSchema);
        } else {
          result[key] = value;
        }
      }

      return result;
    }

    // Remove $schema for Gemini compatibility and ensure proper JSON schema format
    const modifiedTools = tools.map(tool => {
      let inputSchema = tool.inputSchema;

      // Force all input schemas to be type: "object" for MCP compatibility
      if (inputSchema && typeof inputSchema === "object") {
        inputSchema = { ...inputSchema, type: "object" };
      }

      // Resolve $ref references for MCP agent compatibility
      if (inputSchema && typeof inputSchema === "object") {
        const resolved = resolveRefs(inputSchema);
        // Only assign if resolved is an object (not array)
        if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
          inputSchema = resolved;
        }
      }

      // Remove $schema for Gemini compatibility
      if (inputSchema && typeof inputSchema === "object" && "$schema" in inputSchema) {
        const cleanedSchema = { ...inputSchema } as Record<string, unknown>;
        delete cleanedSchema.$schema;
        inputSchema = cleanedSchema;
      }

      return { ...tool, inputSchema };
    });

    return {
      tools: modifiedTools,
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      if (!request.params.arguments) {
        throw new Error("Arguments are required");
      }

      logger.info(`Tool called: ${request.params.name}`);

      // Check if connection is initialized - try to initialize if needed
      const connectionManager = ConnectionManager.getInstance();
      const { isOAuthEnabled } = await import("./oauth/index");
      const oauthMode = isOAuthEnabled();

      try {
        // Try to get client first (basic initialization check)
        connectionManager.getClient();

        // In OAuth mode, ensure introspection is done (uses token from context)
        if (oauthMode) {
          await connectionManager.ensureIntrospected();
        }

        const instanceInfo = connectionManager.getInstanceInfo();
        logger.info(`Connection verified: ${instanceInfo.version} ${instanceInfo.tier}`);
      } catch {
        logger.info("Connection not initialized, attempting to initialize...");
        try {
          await connectionManager.initialize();
          connectionManager.getClient();

          // In OAuth mode, ensure introspection is done after init
          if (oauthMode) {
            await connectionManager.ensureIntrospected();
          }

          const instanceInfo = connectionManager.getInstanceInfo();
          logger.info(`Connection initialized: ${instanceInfo.version} ${instanceInfo.tier}`);
        } catch (initError) {
          logger.error(
            `Connection initialization failed: ${initError instanceof Error ? initError.message : String(initError)}`
          );
          throw new Error("Bad Request: Server not initialized");
        }
      }

      // Dynamic tool dispatch using the new registry manager
      const toolName = request.params.name;

      try {
        // Import the registry manager
        const { RegistryManager } = await import("./registry-manager");
        const registryManager = RegistryManager.getInstance();

        // Check if tool exists and passes all filtering (applied at registry level)
        if (!registryManager.hasToolHandler(toolName)) {
          throw new Error(`Tool '${toolName}' is not available or has been filtered out`);
        }

        logger.info(`Executing tool: ${toolName}`);

        // Check OAuth context
        const { isOAuthEnabled, getTokenContext } = await import("./oauth/index");
        if (isOAuthEnabled()) {
          const context = getTokenContext();
          logger.debug(
            { hasContext: !!context, hasToken: !!context?.gitlabToken, tool: toolName },
            "OAuth context check before tool execution"
          );
        }

        // Execute the tool using the registry manager
        const result = await registryManager.executeTool(toolName, request.params.arguments);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Preserve original error as cause to allow action extraction and structured error detection
        throw new Error(`Failed to execute tool '${toolName}': ${errorMessage}`, { cause: error });
      }
    } catch (error) {
      logger.error(
        `Error in tool handler: ${error instanceof Error ? error.message : String(error)}`
      );

      // Try to convert to structured error for better LLM feedback
      const toolName = request.params.name;
      const toolArgs = request.params.arguments;
      const structuredError = toStructuredError(error, toolName, toolArgs);

      if (structuredError) {
        logger.debug({ structuredError }, "Returning structured error response");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(structuredError, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Fallback to original error format
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });
}
