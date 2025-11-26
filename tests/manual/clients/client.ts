/**
 * MCP Client Interface and error classes for testing
 */

import { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";

export interface MCPClientInterface {
  /**
   * Connect to MCP server
   */
  // eslint-disable-next-line no-unused-vars
  connect(connectionString: string, options?: Record<string, unknown>): Promise<void>;

  /**
   * Disconnect from server
   */
  disconnect(): Promise<void>;

  /**
   * List available tools from server
   */
  listTools(): Promise<ListToolsResult>;

  /**
   * Call a tool on the server
   */
  // eslint-disable-next-line no-unused-vars
  callTool(name: string, arguments_?: Record<string, unknown>): Promise<CallToolResult>;

  /**
   * Test connection by listing tools
   */
  testConnection(): Promise<boolean>;

  /**
   * Get client connection status
   */
  get isConnected(): boolean;
}

/**
 * Base error class for MCP client errors
 */
export class MCPClientError extends Error {
  constructor(
    message: string,
    // eslint-disable-next-line no-unused-vars
    public readonly _cause?: Error
  ) {
    super(message);
    this.name = "MCPClientError";
  }
}

/**
 * Connection error for MCP clients
 */
export class MCPConnectionError extends MCPClientError {
  constructor(message: string, _cause?: Error) {
    super(message, _cause);
    this.name = "MCPConnectionError";
  }
}

/**
 * Tool call error for MCP clients
 */
export class MCPToolCallError extends MCPClientError {
  constructor(
    message: string,
    // eslint-disable-next-line no-unused-vars
    public readonly _toolName?: string,
    _cause?: Error
  ) {
    super(message, _cause);
    this.name = "MCPToolCallError";
  }
}
