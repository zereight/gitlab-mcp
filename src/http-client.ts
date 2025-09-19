import { GITLAB_TOKEN } from "./config";

// HTTP headers and configuration
export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "GitLab MCP Server",
  "Content-Type": "application/json",
  Accept: "application/json",
};

if (GITLAB_TOKEN) {
  DEFAULT_HEADERS.Authorization = `Bearer ${GITLAB_TOKEN}`;
}
