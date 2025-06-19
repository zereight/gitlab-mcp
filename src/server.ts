// MCP server setup and request handlers for the 9 exposed GitLab tools
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { GITLAB_API_URL } from './config/gitlab.js';
import { allTools, readOnlyTools, wikiToolNames, handleToolCall } from './tools/index.js';

// Environment variables for tool filtering
const GITLAB_READ_ONLY_MODE = process.env.GITLAB_READ_ONLY_MODE === "true";
const USE_GITLAB_WIKI = process.env.USE_GITLAB_WIKI === "true";

/**
 * Read version from package.json
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../../package.json");
let SERVER_VERSION = "unknown";
try {
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    SERVER_VERSION = packageJson.version || SERVER_VERSION;
  }
} catch (error) {
  console.error("Warning: Could not read version from package.json:", error);
}

// Create MCP server instance
const server = new Server(
  {
    name: "better-gitlab-mcp-server",
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Setup request handlers
export function setupServer() {
  // Handle list tools requests
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Apply read-only filter first
    const tools0 = GITLAB_READ_ONLY_MODE
      ? allTools.filter((tool) => readOnlyTools.includes(tool.name))
      : allTools;
      
    // Toggle wiki tools by USE_GITLAB_WIKI flag (currently no wiki tools in the 9 exposed)
    let tools = USE_GITLAB_WIKI
      ? tools0
      : tools0.filter((tool) => !wikiToolNames.includes(tool.name));

    // Remove $schema for Gemini compatibility
    tools = tools.map((tool) => {
      if (
        tool.inputSchema &&
        typeof tool.inputSchema === "object" &&
        tool.inputSchema !== null
      ) {
        if ("$schema" in tool.inputSchema) {
          const modifiedSchema = { ...tool.inputSchema };
          delete modifiedSchema.$schema;
          return { ...tool, inputSchema: modifiedSchema };
        }
      }
      return tool;
    });

    return {
      tools,
    };
  });

  // Handle tool call requests
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await handleToolCall(request);
    return {
      content: result.content,
      isError: result.isError || false
    };
  });

  return server;
}

/**
 * Initialize and run the server
 */
export async function runServer() {
  try {
    console.error("========================");
    console.error(`GitLab MCP Server v${SERVER_VERSION}`);
    console.error(`API URL: ${GITLAB_API_URL}`);
    console.error("========================");

    const configuredServer = setupServer();
    const transport = new StdioServerTransport();
    await configuredServer.connect(transport);
    console.error("GitLab MCP Server running on stdio");
  } catch (error) {
    console.error("Error initializing server:", error);
    process.exit(1);
  }
} 