// Ensure required environment variables exist for tests without hitting real services.
if (!process.env.GITLAB_PERSONAL_ACCESS_TOKEN) {
  process.env.GITLAB_PERSONAL_ACCESS_TOKEN = "test-token";
}

if (!process.env.GITLAB_API_URL) {
  process.env.GITLAB_API_URL = "https://gitlab.com/api/v4";
}

// Force unrestricted mode for Jest tests to avoid env leakage from user's .env
// Integration/unit tests mock fetch and shouldn't enforce project allow-list.
process.env.GITLAB_ALLOWED_PROJECT_IDS = "";

process.env.MCP_SKIP_SERVER_START = "true";

export {};
