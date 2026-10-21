/**
 * Stdio MCP Client for testing
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerCapabilities } from "@modelcontextprotocol/sdk/types.js";
import { MCPClientInterface, MCPConnectionError, MCPToolCallError } from "./client.js";

export class StdioTestClient implements MCPClientInterface {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client({ name: "test-client", version: "1.0.0" });
  }

  /**
   * Connect to MCP server via stdio
   */
  async connect(serverPath: string, env?: Record<string, string>): Promise<void> {
    if (this.transport) {
      throw new MCPConnectionError('Client is already connected');
    }

    try {
      const command = process.execPath;
      const args = [serverPath];

      // Prepare environment variables for the server process
      const serverEnv: Record<string, string> = {};
      
      // Copy process.env, filtering out undefined values
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          serverEnv[key] = value;
        }
      }
      
      // Add custom environment variables
      if (env) {
        Object.assign(serverEnv, env);
      }

      this.transport = new StdioClientTransport({
        command,
        args,
        env: serverEnv
      });

      await this.client.connect(this.transport);
    } catch (error) {
      this.transport = null;
      throw new MCPConnectionError(
        `Failed to connect to stdio server: ${error instanceof Error ? error.message : String(error)}`,
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

  async listResources() {
    if (!this.transport) {
      throw new MCPConnectionError('Client is not connected');
    }

    try {
      return await this.client.listResources();
    } catch (error) {
      throw new MCPToolCallError(
        `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`,
        'listResources',
        error instanceof Error ? error : undefined
      );
    }
  }

  async listResourceTemplates() {
    if (!this.transport) {
      throw new MCPConnectionError('Client is not connected');
    }

    try {
      return await this.client.listResourceTemplates();
    } catch (error) {
      throw new MCPToolCallError(
        `Failed to list resource templates: ${error instanceof Error ? error.message : String(error)}`,
        'listResourceTemplates',
        error instanceof Error ? error : undefined
      );
    }
  }

  async readResource(uri: string) {
    if (!this.transport) {
      throw new MCPConnectionError('Client is not connected');
    }

    try {
      return await this.client.readResource({ uri });
    } catch (error) {
      throw new MCPToolCallError(
        `Failed to read resource '${uri}': ${error instanceof Error ? error.message : String(error)}`,
        uri,
        error instanceof Error ? error : undefined
      );
    }
  }

  async listPrompts() {
    if (!this.transport) {
      throw new MCPConnectionError('Client is not connected');
    }

    try {
      return await this.client.listPrompts();
    } catch (error) {
      throw new MCPToolCallError(
        `Failed to list prompts: ${error instanceof Error ? error.message : String(error)}`,
        'listPrompts',
        error instanceof Error ? error : undefined
      );
    }
  }

  async getPrompt(name: string, arguments_?: Record<string, string>) {
    if (!this.transport) {
      throw new MCPConnectionError('Client is not connected');
    }

    try {
      return await this.client.getPrompt({ name, arguments: arguments_ });
    } catch (error) {
      throw new MCPToolCallError(
        `Failed to get prompt '${name}': ${error instanceof Error ? error.message : String(error)}`,
        name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async serverCapabilities(): Promise<ServerCapabilities | undefined> {
    if (!this.transport) {
      throw new MCPConnectionError('Client is not connected');
    }

    try {
      return this.client.getServerCapabilities();
    } catch (error) {
      throw new MCPToolCallError(
        `Failed to read server capabilities: ${error instanceof Error ? error.message : String(error)}`,
        'serverCapabilities',
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
    } catch {
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