/**
 * SSE MCP Client for testing
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { MCPClientInterface, MCPConnectionError, MCPToolCallError } from "./client.js";

export class SSETestClient implements MCPClientInterface {
  private client: Client;
  private transport: SSEClientTransport | null = null;

  constructor() {
    this.client = new Client({ name: "test-client", version: "1.0.0" });
  }

  /**
   * Connect to MCP server via SSE
   */
  async connect(url: string): Promise<void> {
    if (this.transport) {
      throw new MCPConnectionError('Client is already connected');
    }

    try {
      this.transport = new SSEClientTransport(new URL(url));
      await this.client.connect(this.transport);
    } catch (error) {
      this.transport = null;
      throw new MCPConnectionError(
        `Failed to connect to SSE server: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        // Log but don't throw on disconnect errors
        console.warn('Warning during disconnect:', error);
      } finally {
        this.transport = null;
      }
    }
  }

  /**
   * List available tools from server
   */
  async listTools(): Promise<ListToolsResult> {
    if (!this.transport) {
      throw new MCPConnectionError('Client is not connected');
    }

    try {
      const response = await this.client.listTools();
      return response;
    } catch (error) {
      throw new MCPToolCallError(
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`,
        'listTools',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Call a tool on the server
   */
  async callTool(name: string, arguments_: Record<string, any> = {}): Promise<CallToolResult> {
    if (!this.transport) {
      throw new MCPConnectionError('Client is not connected');
    }

    try {
      const response = await this.client.callTool({ name, arguments: arguments_ });
      // Ensure the response conforms to CallToolResult interface
      return response as CallToolResult;
    } catch (error) {
      throw new MCPToolCallError(
        `Failed to call tool '${name}': ${error instanceof Error ? error.message : String(error)}`,
        name,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Test connection by listing tools
   */
  async testConnection(): Promise<boolean> {
    try {
      const tools = await this.listTools();
      return Array.isArray(tools.tools) && tools.tools.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get client connection status
   */
  get isConnected(): boolean {
    return this.transport !== null;
  }
} 