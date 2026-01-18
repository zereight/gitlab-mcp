/**
 * OAuth Endpoints Index
 *
 * Re-exports all OAuth endpoint handlers for easy import.
 */

export { metadataHandler, healthHandler, protectedResourceHandler, getBaseUrl } from "./metadata";
export { authorizeHandler, pollHandler } from "./authorize";
export { callbackHandler } from "./callback";
export { tokenHandler } from "./token";
export { registerHandler, getRegisteredClient, isValidRedirectUri } from "./register";
