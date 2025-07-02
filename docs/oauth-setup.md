# GitLab OAuth2 Setup Guide

This guide explains how to set up OAuth2 authentication for the GitLab MCP server.

## Prerequisites

1. A GitLab instance (GitLab.com or self-hosted)
2. Admin access to create OAuth applications in GitLab

## Setting up GitLab OAuth Application

1. Go to your GitLab instance
2. Navigate to **User Settings** > **Applications** (for user-owned apps) or **Admin Area** > **Applications** (for instance-wide apps)
3. Create a new application with:
   - **Name**: `GitLab MCP Server`
   - **Redirect URI**: You need to add the callback URL that your MCP client will use. This is typically `http://localhost:PORT/callback` where PORT is the port your MCP client uses.
   - **Scopes**: Select the appropriate scopes (api, read_api, etc.)

## The Redirect URI Challenge

MCP clients typically start their own OAuth callback server on a random port. This creates a challenge because GitLab requires exact redirect URI matching.

### Solutions:

1. **Add Multiple Redirect URIs**: Add a range of possible callback URLs to your GitLab OAuth app:
   ```
   http://localhost:50000/callback
   http://localhost:50001/callback
   http://localhost:50002/callback
   ... (add more as needed)
   ```

2. **Use Personal Access Token Instead**: For simpler setup, use a GitLab Personal Access Token:
   ```json
   {
     "mcpServers": {
       "gitlab": {
         "command": "node",
         "args": ["path/to/gitlab-mcp/build/index.js"],
         "env": {
           "GITLAB_PERSONAL_ACCESS_TOKEN": "your-token-here",
           "GITLAB_API_URL": "https://gitlab.com/api/v4"
         }
       }
     }
   }
   ```

## Environment Variables for OAuth2

If using OAuth2, set these environment variables:

```bash
# OAuth2 Configuration
GITLAB_OAUTH2_CLIENT_ID="your-client-id"
GITLAB_OAUTH2_CLIENT_SECRET="your-client-secret"
GITLAB_OAUTH2_REDIRECT_URL="http://localhost:3002/callback"

# GitLab URLs
GITLAB_OAUTH2_AUTHORIZATION_URL="https://gitlab.com/oauth/authorize"
GITLAB_OAUTH2_TOKEN_URL="https://gitlab.com/oauth/token"
GITLAB_OAUTH2_REVOCATION_URL="https://gitlab.com/oauth/revoke"
GITLAB_OAUTH2_INTROSPECTION_URL="https://gitlab.com/oauth/introspect"

# Server Configuration
GITLAB_OAUTH2_BASE_URL="http://localhost:3002"
GITLAB_OAUTH2_ISSUER_URL="https://gitlab.com"
```

## Troubleshooting

### "Invalid redirect URI" error

This means the callback URL the MCP client is using doesn't match any of the redirect URIs configured in your GitLab OAuth application. Check the error URL to see what port the client is using and add that to your GitLab OAuth app.

### "Client authentication failed" error

This typically means the client ID or secret is incorrect. Double-check your environment variables.

## Recommendation

For most use cases, using a GitLab Personal Access Token is simpler and more reliable than OAuth2, as it doesn't require managing redirect URIs and callback servers.