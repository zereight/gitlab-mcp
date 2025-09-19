import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ConnectionManager } from "./services/ConnectionManager";
import { logger } from "./logger";

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
    // Get tools from registry manager (already filtered)
    const { RegistryManager } = await import("./registry-manager");
    const registryManager = RegistryManager.getInstance();
    const tools = registryManager.getAllToolDefinitions();

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
      try {
        // Try to get client first
        connectionManager.getClient();
        const instanceInfo = connectionManager.getInstanceInfo();
        logger.info(`Connection verified: ${instanceInfo.version} ${instanceInfo.tier}`);
      } catch {
        logger.info("Connection not initialized, attempting to initialize...");
        try {
          await connectionManager.initialize();
          connectionManager.getClient();
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
        throw new Error(`Failed to execute tool '${toolName}': ${errorMessage}`);
      }
    } catch (error) {
      logger.error(
        `Error in tool handler: ${error instanceof Error ? error.message : String(error)}`
      );
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
