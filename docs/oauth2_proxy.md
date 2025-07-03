# GitLab MCP OAuth2 Proxy Configuration

This guide explains how to configure the GitLab MCP server to use OAuth2 proxy authentication, allowing users to authenticate with GitLab OAuth2 applications instead of using personal access tokens.

## Overview

The OAuth2 proxy mode enables dynamic client registration and token management, providing a more secure and flexible authentication method compared to static personal access tokens.

**Note:** OAuth2 proxy mode is only available when using SSE or STREAMABLE_HTTP transport modes. It is not supported with STDIO transport.

## Required Environment Variables

To enable OAuth2 proxy mode, you must set the following environment variables:

### Core OAuth2 Configuration

```bash
# GitLab OAuth2 Application Credentials
GITLAB_OAUTH2_CLIENT_ID=your_gitlab_app_id
GITLAB_OAUTH2_CLIENT_SECRET=your_gitlab_app_secret

# GitLab OAuth2 Endpoints
GITLAB_OAUTH2_AUTHORIZATION_URL=https://gitlab.com/oauth/authorize
GITLAB_OAUTH2_TOKEN_URL=https://gitlab.com/oauth/token
GITLAB_OAUTH2_ISSUER_URL=https://gitlab.com
GITLAB_OAUTH2_BASE_URL=http://localhost:3000  # Your MCP server URL

# OAuth2 Redirect Configuration
GITLAB_OAUTH2_REDIRECT_URL=http://localhost:3000/callback
```

### Optional Configuration

```bash
# Token Revocation Endpoint (optional)
GITLAB_OAUTH2_REVOCATION_URL=https://gitlab.com/oauth/revoke

# Database Path (defaults to in-memory if not set)
GITLAB_OAUTH2_DB_PATH=/path/to/oauth.db
```

## Setting Up a GitLab OAuth2 Application

1. Go to your GitLab instance (e.g., https://gitlab.com)
2. Navigate to **User Settings** → **Applications**
3. Create a new application with:
   - **Name**: Your MCP Server (or any descriptive name)
   - **Redirect URI**: Must match `GITLAB_OAUTH2_REDIRECT_URL` exactly (e.g., `http://localhost:3000/callback`)
   - **Scopes**: Select the following:
     - `api` - Access the authenticated user's API
     - `openid` - Authenticate using OpenID Connect
     - `profile` - Read user's profile data
     - `email` - Read user's email address

4. After creation, GitLab will provide:
   - **Application ID**: Use this for `GITLAB_OAUTH2_CLIENT_ID`
   - **Secret**: Use this for `GITLAB_OAUTH2_CLIENT_SECRET`

## Configuration Examples

### Development Setup (localhost)

```bash
# .env file
GITLAB_OAUTH2_CLIENT_ID=your_app_id_here
GITLAB_OAUTH2_CLIENT_SECRET=your_app_secret_here
GITLAB_OAUTH2_AUTHORIZATION_URL=https://gitlab.com/oauth/authorize
GITLAB_OAUTH2_TOKEN_URL=https://gitlab.com/oauth/token
GITLAB_OAUTH2_ISSUER_URL=https://gitlab.com
GITLAB_OAUTH2_BASE_URL=http://localhost:3000
GITLAB_OAUTH2_REDIRECT_URL=http://localhost:3000/callback
```

### Production Setup

```bash
# .env file
GITLAB_OAUTH2_CLIENT_ID=your_app_id_here
GITLAB_OAUTH2_CLIENT_SECRET=your_app_secret_here
GITLAB_OAUTH2_AUTHORIZATION_URL=https://gitlab.company.com/oauth/authorize
GITLAB_OAUTH2_TOKEN_URL=https://gitlab.company.com/oauth/token
GITLAB_OAUTH2_ISSUER_URL=https://gitlab.company.com
GITLAB_OAUTH2_BASE_URL=https://mcp.company.com
GITLAB_OAUTH2_REDIRECT_URL=https://mcp.company.com/callback
GITLAB_OAUTH2_DB_PATH=/var/lib/gitlab-mcp/oauth.db
```

## Database Storage

By default, the OAuth2 proxy uses an in-memory SQLite database. For production use, specify a persistent database path:

```bash
GITLAB_OAUTH2_DB_PATH=/path/to/persistent/oauth.db
```

The database stores:
- OAuth client registrations
- State mappings for OAuth flow
- Access token hashes (using Argon2 for security)

## Security Considerations

1. **Client Secrets**: Never commit `GITLAB_OAUTH2_CLIENT_SECRET` to version control
2. **HTTPS**: Always use HTTPS for production deployments
3. **Token Storage**: Access tokens are hashed using Argon2 before storage
4. **Token Expiry**: Tokens expire after 1 hour by default
5. **State Expiry**: OAuth state parameters expire after 15 minutes

## Troubleshooting

### Common Issues

1. **"Protected resource URL mismatch"**
   - Ensure `GITLAB_OAUTH2_BASE_URL` matches your server's actual URL
   - Check that the redirect URI in GitLab matches `GITLAB_OAUTH2_REDIRECT_URL`

2. **"Invalid redirect URI"**
   - The redirect URI must match exactly (including protocol and port)
   - No trailing slashes unless specified in GitLab

3. **"Invalid scope"**
   - Ensure your GitLab OAuth app has the required scopes enabled
   - The MCP server requests: `api`, `openid`, `profile`, `email`

### Debug Mode

Enable debug logging to troubleshoot OAuth2 issues:

```bash
export VERBOSE="true"
```

## Starting the Server

OAuth2 proxy mode requires SSE or STREAMABLE_HTTP transport.

The server will log:
```
Configuring GitLab OAuth2 proxy authentication
```

**Note:** STDIO transport mode does not support OAuth2 proxy authentication.

## Client Configuration

MCP clients connecting to an OAuth2-enabled server should use the OAuth2 flow instead of providing a GitLab token directly. The server will handle dynamic client registration and token management automatically.

## Note

OAuth2 proxy support is currently in beta. While functional, it may have limitations compared to personal access token authentication. Please report any issues to the project's issue tracker.
