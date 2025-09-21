// Ensure required environment variables exist for tests without hitting real services.
if (!process.env.GITLAB_PERSONAL_ACCESS_TOKEN) {
  process.env.GITLAB_PERSONAL_ACCESS_TOKEN = 'test-token';
}

if (!process.env.GITLAB_API_URL) {
  process.env.GITLAB_API_URL = 'https://gitlab.com/api/v4';
}

process.env.MCP_SKIP_SERVER_START = 'true';

export {};
