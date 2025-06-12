# GitLab MCP with Authentication Cookie Support

This fork of the GitLab MCP server adds support for authentication cookies, which is particularly useful for GitLab instances that require cookie-based authentication, such as Amazon's internal GitLab instance which uses Midway cookies.

## New Feature: Authentication Cookie Support

### Problem

When using the GitLab MCP server with certain GitLab instances, authentication can fail even with a valid token due to additional security requirements. Some GitLab instances require authentication cookies for access, which the original implementation doesn't support.

### Solution

This fork adds support for authentication cookies by:

1. Adding a new environment variable `GITLAB_AUTH_COOKIE_PATH` that points to the authentication cookie file
2. Reading and parsing the cookie file if the path is provided
3. Adding the cookie to all GitLab API requests
4. Maintaining backward compatibility with the existing token-based authentication

## Usage

### Installation

```bash
npm install @mattweg/gitlab-mcp
```

### Configuration

Set the `GITLAB_AUTH_COOKIE_PATH` environment variable to the path of your authentication cookie file:

```bash
export GITLAB_AUTH_COOKIE_PATH=~/.midway/cookie
```

### Usage with Amazon Q

```json
{
  "mcpServers": {
    "GitLab communication server": {
      "command": "npx",
      "args": ["-y", "@mattweg/gitlab-mcp"],
      "env": {
        "GITLAB_API_URL": "https://gitlab.aws.dev/api/v4",
        "GITLAB_AUTH_COOKIE_PATH": "~/.midway/cookie"
      }
    }
  }
}
```

### Usage with Docker

```bash
docker run -i --rm \
  -e GITLAB_API_URL=https://gitlab.aws.dev/api/v4 \
  -e GITLAB_AUTH_COOKIE_PATH=/path/to/cookie \
  -v /path/to/cookie:/path/to/cookie \
  mattweg/gitlab-mcp
```

## Testing

A test script is included to verify the authentication cookie functionality:

```bash
AUTH_COOKIE_PATH=~/.midway/cookie node test-auth-cookie.js
```

## Environment Variables

- `GITLAB_PERSONAL_ACCESS_TOKEN`: Your GitLab personal access token.
- `GITLAB_API_URL`: Your GitLab API URL. (Default: `https://gitlab.com/api/v4`)
- `GITLAB_READ_ONLY_MODE`: When set to 'true', restricts the server to only expose read-only operations.
- `USE_GITLAB_WIKI`: When set to 'true', enables the wiki-related tools.
- `USE_MILESTONE`: When set to 'true', enables the milestone-related tools.
- `USE_PIPELINE`: When set to 'true', enables the pipeline-related tools.
- `GITLAB_AUTH_COOKIE_PATH`: Path to an authentication cookie file for GitLab instances that require cookie-based authentication.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
