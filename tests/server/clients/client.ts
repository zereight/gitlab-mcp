/**
 * MCP Client Interface and error classes for testing
 */

import { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";

export interface MCPClientInterface {
  /**
   * Connect to MCP server
   */
  connect(connectionString: string, options?: Record<string, any>): Promise<void>;

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
  callTool(name: string, arguments_?: Record<string, any>): Promise<CallToolResult>;

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
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MCPClientError';
  }
}

/**
 * Connection error for MCP clients
 */
export class MCPConnectionError extends MCPClientError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'MCPConnectionError';
  }
}

/**
 * Tool call error for MCP clients
 */
export class MCPToolCallError extends MCPClientError {
  constructor(message: string, public readonly toolName?: string, cause?: Error) {
    super(message, cause);
    this.name = 'MCPToolCallError';
  }
} 
