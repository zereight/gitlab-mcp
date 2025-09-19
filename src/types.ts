// Transport mode constants and type
const TransportModeObj = {
  STDIO: 'stdio',
  SSE: 'sse',
  STREAMABLE_HTTP: 'streamable-http',
  DUAL: 'dual',
} as const;

export { TransportModeObj as TransportMode };
export type TransportMode = (typeof TransportModeObj)[keyof typeof TransportModeObj];

// Common GitLab API response types
export interface GitLabAPIResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
}

// Tool definition interface
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Enhanced tool definition interface that includes handler function
export interface EnhancedToolDefinition extends ToolDefinition {
  // eslint-disable-next-line no-unused-vars
  handler: (args: unknown) => Promise<unknown>;
}

// Tool registry type for storing enhanced tool definitions
export type ToolRegistry = Map<string, EnhancedToolDefinition>;
