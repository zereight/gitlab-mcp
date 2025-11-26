/**
 * OAuth Endpoints Index
 *
 * Re-exports all OAuth endpoint handlers for easy import.
 */

export { metadataHandler, healthHandler, getBaseUrl } from "./metadata";
export { authorizeHandler, pollHandler } from "./authorize";
export { tokenHandler } from "./token";
