// Transport mode constants and type
const TransportModeObj = {
  STDIO: "stdio",
  SSE: "sse",
  STREAMABLE_HTTP: "streamable-http",
  DUAL: "dual",
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

// Feature gate metadata for USE_* environment variables
export interface FeatureGate {
  envVar: string; // e.g., "USE_LABELS"
  defaultValue: boolean; // Default when env var is not set
}

// Enhanced tool definition interface that includes handler function
export interface EnhancedToolDefinition extends ToolDefinition {
  handler: (args: unknown) => Promise<unknown>;
  gate?: FeatureGate; // Optional - tools without gate are always enabled
}

// Tool registry type for storing enhanced tool definitions
export type ToolRegistry = Map<string, EnhancedToolDefinition>;
