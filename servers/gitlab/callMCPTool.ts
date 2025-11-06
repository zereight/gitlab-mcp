/**
 * Core MCP Tool Orchestration
 *
 * This module provides the foundational callMCPTool function that enables
 * code execution with MCP, allowing agents to programmatically interact
 * with GitLab tools without loading all tool definitions into context.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

let mcpClient: Client | null = null;
let transport: Transport | null = null;

/**
 * Initialize MCP client connection
 * This should be called once before using callMCPTool
 */
export async function initializeMCPClient(): Promise<void> {
  if (mcpClient) {
    return; // Already initialized
  }

  // Create stdio transport for local MCP server
  transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@tso2381637/gitlab-mcp-code-execution"],
    env: {
      GITLAB_PERSONAL_ACCESS_TOKEN: process.env.GITLAB_PERSONAL_ACCESS_TOKEN || "",
      GITLAB_API_URL: process.env.GITLAB_API_URL || "https://gitlab.com/api/v4",
      GITLAB_PROJECT_ID: process.env.GITLAB_PROJECT_ID,
      GITLAB_ALLOWED_PROJECT_IDS: process.env.GITLAB_ALLOWED_PROJECT_IDS,
      GITLAB_READ_ONLY_MODE: process.env.GITLAB_READ_ONLY_MODE || "false",
      USE_GITLAB_WIKI: process.env.USE_GITLAB_WIKI || "false",
      USE_MILESTONE: process.env.USE_MILESTONE || "false",
      USE_PIPELINE: process.env.USE_PIPELINE || "false",
    },
  });

  mcpClient = new Client(
    {
      name: "gitlab-code-execution-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await mcpClient.connect(transport);
}

/**
 * Call an MCP tool with the given input
 *
 * This function enables progressive tool loading and data filtering,
 * keeping intermediate results in the execution environment.
 *
 * @param toolName - The name of the MCP tool to call (e.g., 'create_issue')
 * @param input - The input parameters for the tool
 * @returns The tool's response
 *
 * @example
 * ```typescript
 * const issue = await callMCPTool<GitLabIssue>('create_issue', {
 *   projectId: '123',
 *   title: 'Bug report',
 *   description: 'Found a bug'
 * });
 * ```
 */
export async function callMCPTool<TResponse = any>(
  toolName: string,
  input: Record<string, any>
): Promise<TResponse> {
  if (!mcpClient) {
    await initializeMCPClient();
  }

  if (!mcpClient) {
    throw new Error("Failed to initialize MCP client");
  }

  try {
    const response = await mcpClient.callTool({
      name: toolName,
      arguments: input,
    });

    // Parse the response content
    if (response.content && response.content.length > 0) {
      const firstContent = response.content[0];
      if (firstContent.type === "text") {
        try {
          return JSON.parse(firstContent.text) as TResponse;
        } catch {
          // If not JSON, return as is
          return firstContent.text as TResponse;
        }
      }
    }

    return response as TResponse;
  } catch (error) {
    throw new Error(`MCP tool call failed for '${toolName}': ${error}`);
  }
}

/**
 * Close the MCP client connection
 * Should be called when done with MCP operations
 */
export async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    transport = null;
  }
}

/**
 * Search for available tools using a query
 * Enables progressive tool discovery
 */
export async function searchTools(query: string): Promise<string[]> {
  if (!mcpClient) {
    await initializeMCPClient();
  }

  if (!mcpClient) {
    throw new Error("Failed to initialize MCP client");
  }

  const tools = await mcpClient.listTools();

  return tools.tools
    .filter(tool =>
      tool.name.includes(query) ||
      tool.description?.toLowerCase().includes(query.toLowerCase())
    )
    .map(tool => tool.name);
}
