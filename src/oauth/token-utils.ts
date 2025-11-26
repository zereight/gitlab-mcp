/**
 * Token Utilities for OAuth
 *
 * Provides JWT creation/verification and PKCE utilities for OAuth 2.1 compliance.
 * Uses Node.js crypto module for all cryptographic operations.
 */

import * as crypto from "crypto";
import { MCPTokenPayload } from "./types";

// ============================================================
// JWT Functions
// ============================================================

/**
 * Create a JWT token
 *
 * Creates a signed JWT using HMAC-SHA256.
 *
 * @param payload - Token payload (will have iat and exp added)
 * @param secret - Secret key for signing
 * @param expiresIn - Token lifetime in seconds
 * @returns Signed JWT string
 */
export function createJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: number
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify and decode a JWT token
 *
 * Verifies the signature and checks expiration.
 *
 * @param token - JWT token to verify
 * @param secret - Secret key used for signing
 * @returns Decoded payload if valid, null if invalid or expired
 */
export function verifyJWT(token: string, secret: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signature] = parts;

    // Verify signature
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (signature !== expectedSig) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as Record<string, unknown>;

    // Check expiration
    const exp = payload.exp as number | undefined;
    if (exp && exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify JWT and return typed MCP token payload
 *
 * @param token - JWT token to verify
 * @param secret - Secret key used for signing
 * @returns MCPTokenPayload if valid, null if invalid
 */
export function verifyMCPToken(token: string, secret: string): MCPTokenPayload | null {
  const payload = verifyJWT(token, secret);
  if (!payload) {
    return null;
  }

  // Validate required fields
  if (
    typeof payload.iss !== "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.aud !== "string" ||
    typeof payload.sid !== "string" ||
    typeof payload.scope !== "string" ||
    typeof payload.gitlab_user !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  return payload as unknown as MCPTokenPayload;
}

// ============================================================
// PKCE Functions (for OAuth 2.1 compliance)
// ============================================================

/**
 * Generate a cryptographically random code verifier for PKCE
 *
 * @returns Base64URL-encoded random string (43-128 characters)
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate a code challenge from a code verifier using S256 method
 *
 * @param verifier - The code verifier
 * @returns Base64URL-encoded SHA256 hash of the verifier
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Verify a code challenge against a code verifier
 *
 * @param verifier - The code verifier from the token request
 * @param challenge - The code challenge from the authorization request
 * @param method - The challenge method (only S256 is supported)
 * @returns true if the verifier matches the challenge
 */
export function verifyCodeChallenge(verifier: string, challenge: string, method: string): boolean {
  if (method !== "S256") {
    // Only S256 is supported per OAuth 2.1
    return false;
  }
  return generateCodeChallenge(verifier) === challenge;
}

// ============================================================
// Random String Generation
// ============================================================

/**
 * Generate a cryptographically secure random string
 *
 * @param length - Desired length of the string (default: 32)
 * @returns Base64URL-encoded random string
 */
export function generateRandomString(length: number = 32): string {
  // Generate enough bytes to produce the desired length after base64url encoding
  const byteLength = Math.ceil((length * 3) / 4);
  return crypto.randomBytes(byteLength).toString("base64url").slice(0, length);
}

/**
 * Generate a UUID v4
 *
 * @returns UUID string in standard format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate an authorization code
 *
 * @returns 32-character random authorization code
 */
export function generateAuthorizationCode(): string {
  return generateRandomString(32);
}

/**
 * Generate a session ID
 *
 * @returns UUID for session identification
 */
export function generateSessionId(): string {
  return generateUUID();
}

/**
 * Generate an MCP refresh token
 *
 * @returns 64-character random refresh token
 */
export function generateRefreshToken(): string {
  return generateRandomString(64);
}

// ============================================================
// Base64URL Encoding/Decoding
// ============================================================

/**
 * Encode a string to Base64URL format
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64url");
}

/**
 * Decode a Base64URL string
 */
function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8");
}

// ============================================================
// Token Timing Utilities
// ============================================================

/**
 * Check if a token is about to expire
 *
 * @param expiryMs - Token expiry timestamp in milliseconds
 * @param bufferMs - Buffer time before expiry (default: 5 minutes)
 * @returns true if the token will expire within the buffer time
 */
export function isTokenExpiringSoon(expiryMs: number, bufferMs: number = 5 * 60 * 1000): boolean {
  return Date.now() + bufferMs >= expiryMs;
}

/**
 * Calculate token expiry timestamp
 *
 * @param expiresIn - Token lifetime in seconds
 * @returns Expiry timestamp in milliseconds
 */
export function calculateTokenExpiry(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}
