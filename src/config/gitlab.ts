// GitLab configuration and constants
import type { RequestInit } from 'node-fetch';

// Environment variables
export const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;

/**
 * Smart URL handling for GitLab API
 *
 * @param {string | undefined} url - Input GitLab API URL
 * @returns {string} Normalized GitLab API URL with /api/v4 path
 */
export function normalizeGitLabApiUrl(url?: string): string {
  if (!url) {
    return "https://gitlab.com/api/v4";
  }

  // Remove trailing slash if present
  let normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;

  // Check if URL already has /api/v4
  if (
    !normalizedUrl.endsWith("/api/v4") &&
    !normalizedUrl.endsWith("/api/v4/")
  ) {
    // Append /api/v4 if not already present
    normalizedUrl = `${normalizedUrl}/api/v4`;
  }

  return normalizedUrl;
}

// Use the normalizeGitLabApiUrl function to handle various URL formats
export const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "");

// Default fetch configuration with proxy support
export const DEFAULT_FETCH_CONFIG: RequestInit = {
  headers: {
    "Private-Token": GITLAB_PERSONAL_ACCESS_TOKEN || "",
    "Content-Type": "application/json",
  },
  agent: (() => {
    // Handle proxy configuration for both HTTP and HTTPS
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    
    if (httpProxy || httpsProxy) {
      try {
        // Dynamic import to avoid issues if proxy libraries aren't available
        const { HttpsProxyAgent } = require('https-proxy-agent');
        const { HttpProxyAgent } = require('http-proxy-agent');
        
        // Use HTTPS proxy if available, otherwise HTTP proxy
        const proxyUrl = httpsProxy || httpProxy;
        
        if (proxyUrl) {
          return proxyUrl.startsWith('https://') 
            ? new HttpsProxyAgent(proxyUrl)
            : new HttpProxyAgent(proxyUrl);
        }
      } catch (error) {
        console.warn('Proxy configuration failed:', error);
      }
    }
    
    return undefined;
  })(),
};

// Token validation warnings
if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
  console.error("Warning: GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  console.error("Some operations will not work without a valid token");
} 