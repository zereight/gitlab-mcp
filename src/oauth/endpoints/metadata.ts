/**
 * OAuth Metadata Endpoint
 *
 * Implements the OAuth 2.0 Authorization Server Metadata endpoint
 * (RFC 8414) at /.well-known/oauth-authorization-server
 *
 * This endpoint allows OAuth clients to discover server capabilities.
 */

import { Request, Response } from "express";
import { HOST, PORT } from "../../config";

/**
 * Get the base URL from the request
 *
 * Handles reverse proxy scenarios by checking X-Forwarded-* headers.
 *
 * @param req - Express request
 * @returns Base URL string (e.g., "https://example.com")
 */
export function getBaseUrl(req: Request): string {
  // Check for forwarded protocol (from reverse proxy)
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto ?? req.protocol ?? "http";

  // Check for forwarded host (from reverse proxy)
  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost ?? req.get("host") ?? `${HOST}:${PORT}`;

  return `${protocol}://${host}`;
}

/**
 * OAuth Authorization Server Metadata endpoint handler
 *
 * Returns metadata about the OAuth server's capabilities including:
 * - Issuer
 * - Authorization and token endpoints
 * - Supported response types, grant types, and PKCE methods
 *
 * @param req - Express request
 * @param res - Express response
 */
export function metadataHandler(req: Request, res: Response): void {
  const baseUrl = getBaseUrl(req);

  // OAuth 2.0 Authorization Server Metadata (RFC 8414)
  const metadata = {
    // REQUIRED: Issuer identifier (must be HTTPS in production)
    issuer: baseUrl,

    // REQUIRED: Authorization endpoint
    authorization_endpoint: `${baseUrl}/authorize`,

    // REQUIRED: Token endpoint
    token_endpoint: `${baseUrl}/token`,

    // OPTIONAL: Supported response types
    response_types_supported: ["code"],

    // OPTIONAL: Supported grant types
    grant_types_supported: ["authorization_code", "refresh_token"],

    // OPTIONAL: Supported PKCE code challenge methods (S256 required for OAuth 2.1)
    code_challenge_methods_supported: ["S256"],

    // OPTIONAL: Token endpoint authentication methods
    // "none" for public clients (device flow with non-confidential apps)
    token_endpoint_auth_methods_supported: ["none"],

    // OPTIONAL: Supported scopes
    scopes_supported: ["mcp:tools", "mcp:resources"],

    // REQUIRED for Claude.ai: Dynamic Client Registration endpoint (RFC 7591)
    registration_endpoint: `${baseUrl}/register`,

    // MCP-specific metadata
    mcp_version: "2025-03-26",
  };

  res.json(metadata);
}

/**
 * OAuth Protected Resource Metadata endpoint handler (RFC 9470)
 *
 * Returns metadata about this MCP server as a protected resource,
 * including a reference to the authorization server.
 *
 * @param req - Express request
 * @param res - Express response
 */
export function protectedResourceHandler(req: Request, res: Response): void {
  const baseUrl = getBaseUrl(req);

  // OAuth 2.0 Protected Resource Metadata (RFC 9470)
  const metadata = {
    // REQUIRED: Resource identifier
    resource: baseUrl,

    // REQUIRED: Authorization servers that can be used to access this resource
    authorization_servers: [baseUrl],

    // OPTIONAL: Scopes required for this resource
    scopes_supported: ["mcp:tools", "mcp:resources"],

    // OPTIONAL: Bearer token methods supported
    bearer_methods_supported: ["header"],
  };

  res.json(metadata);
}

/**
 * Health check endpoint handler
 *
 * Returns server health status for monitoring.
 *
 * @param req - Express request
 * @param res - Express response
 */
export function healthHandler(req: Request, res: Response): void {
  res.json({
    status: "ok",
    mode: "oauth",
    timestamp: new Date().toISOString(),
  });
}
