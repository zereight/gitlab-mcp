/**
 * Custom Header MCP Client for Testing Remote Authorization
 * Extends StreamableHTTPTestClient to support custom headers
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";

export interface CustomHeaderClientOptions {
  headers?: Record<string, string>;
  timeout?: number;
  clientName?: string;
  clientVersion?: string;
}

/**
 * MCP client with support for custom HTTP headers
 * Useful for testing remote authorization scenarios
 */
export class CustomHeaderClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport | null = null;
  private customHeaders: Record<string, string>;
  private timeout: number;

  constructor(options: CustomHeaderClientOptions | Record<string, string> = {}) {
    // Support both old signature (headers only) and new options object
    if ('headers' in options || 'timeout' in options || 'clientName' in options) {
      const opts = options as CustomHeaderClientOptions;
      this.customHeaders = opts.headers || {};
      this.timeout = opts.timeout || 30000;
      this.client = new Client({ 
        name: opts.clientName || "test-client-with-headers", 
        version: opts.clientVersion || "1.0.0" 
      });
    } else {
      // Backward compatible: treat options as headers record
      this.customHeaders = options as Record<string, string>;
      this.timeout = 30000;
      this.client = new Client({ name: "test-client-with-headers", version: "1.0.0" });
    }
  }

  /**
   * Connect to MCP server with custom headers
   */
  async connect(url: string): Promise<void> {
    if (this.transport) {
      throw new Error('Client is already connected');
    }

    try {
      this.transport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit: {
          headers: this.customHeaders
        }
      });
      await this.client.connect(this.transport);
    } catch (error) {
      this.transport = null;
      throw new Error(
        `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
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
        // Silently ignore disconnect errors in tests
        // In production, you'd want proper logging
      } finally {
        this.transport = null;
      }
    }
  }

  /**
   * Get session ID from transport (useful for testing)
   */
  getSessionId(): string | undefined {
    return this.transport?.sessionId;
  }

  /**
   * Update custom headers (creates new connection if already connected)
   */
  setHeaders(headers: Record<string, string>): void {
    if (this.transport) {
      throw new Error('Cannot update headers while connected. Disconnect first.');
    }
    this.customHeaders = headers;
  }

  /**
   * List available tools from server
   */
  async listTools(): Promise<ListToolsResult> {
    if (!this.transport) {
      throw new Error('Client is not connected');
    }

    try {
      const response = await this.client.listTools();
      return response;
    } catch (error) {
      throw new Error(
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Call a tool on the server
   */
  async callTool(name: string, arguments_: Record<string, any> = {}): Promise<CallToolResult> {
    if (!this.transport) {
      throw new Error('Client is not connected');
    }

    try {
      const response = await this.client.callTool({ name, arguments: arguments_ });
      return response as CallToolResult;
    } catch (error) {
      throw new Error(
        `Failed to call tool '${name}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get client connection status
   */
  get isConnected(): boolean {
    return this.transport !== null;
  }
}

