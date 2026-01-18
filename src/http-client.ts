// HTTP headers and configuration
// Note: Authorization header is handled by enhancedFetch which gets the token from
// either GITLAB_TOKEN env var (static mode) or OAuth context (OAuth mode)
export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "GitLab MCP Server",
  "Content-Type": "application/json",
  Accept: "application/json",
};
