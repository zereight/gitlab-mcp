import { SSE, STREAMABLE_HTTP } from "../config.js";

/**
 * Available transport modes for MCP server.
 */
export enum TransportMode {
  STDIO = "stdio",
  SSE = "sse",
  STREAMABLE_HTTP = "streamable-http",
}

/**
 * Determine the transport mode based on environment variables and availability.
 *
 * Transport mode priority (highest to lowest):
 * 1. STREAMABLE_HTTP
 * 2. SSE
 * 3. STDIO
 */
export function determineTransportMode(): TransportMode {
  if (STREAMABLE_HTTP) return TransportMode.STREAMABLE_HTTP;
  if (SSE) return TransportMode.SSE;
  return TransportMode.STDIO;
}
