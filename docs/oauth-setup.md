# OAuth2 Authentication Setup Guide

This guide explains how to set up OAuth2 authentication for the GitLab MCP server.

## Why Use OAuth2?

OAuth2 provides several advantages over personal access tokens:

- **Better Security**: Tokens are obtained through a secure browser-based flow
- **Automatic Token Refresh**: Tokens are automatically refreshed when they expire
- **Scoped Access**: You can limit what the application can access
- **Easy Revocation**: You can revoke access from your GitLab settings at any time

## Prerequisites

- A GitLab account (GitLab.com or self-hosted GitLab instance)
- Node.js installed on your machine
- The GitLab MCP server installed

> ⚠️ **Important**: OAuth is designed for **local/desktop environments** (e.g., Claude Desktop, VS Code). For **Docker deployments**, use [Personal Access Token](../README.md#using-personal-access-token-traditional) instead, as OAuth requires browser-based authentication and a local callback server which does not work properly in containerized environments.

## Step 1: Create a GitLab OAuth Application

1. **Log in to your GitLab instance** (e.g., https://gitlab.com)

2. **Navigate to Applications**:

   - Click on your profile picture in the top right
   - Select **Settings** (or **Preferences**)
   - In the left sidebar, click **Applications**

   ![alt text](<./img/step 2.png>)

3. **Create a new application**:

   - Click **Add new application** (or **New application**)
   - Fill in the details:
     - **Name**: `GitLab MCP Server` (or any name you prefer)
     - **Redirect URI**: `http://127.0.0.1:8888/callback`
       - Note: If you want to use a different port, update this URI accordingly
     - **Confidential**:
       - **Unchecked (recommended for desktop/CLI apps)**: Uses PKCE for security, no client secret needed
       - **Checked (for server environments)**: Requires client secret, provides additional security for server-side apps
     - **Scopes**: Select the following scope:
       - `api` - Grants complete read/write access to the API (includes all necessary permissions)

   ![alt text](<./img/step 3.png>)

4. **Save the application**:

   - Click **Save application**
   - **Important**: Copy the **Application ID** - you'll need this as your `GITLAB_OAUTH_CLIENT_ID`
   - **For Confidential apps**: Also copy the **Secret** - you'll need this as `GITLAB_OAUTH_CLIENT_SECRET`

   ![alt text](<./img/step 4.png>)
   ![alt text](<./img/step 5.png>)

## Step 2: Configure the MCP Server

### For Claude Desktop App

Edit your Claude configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Linux**: `~/.config/Claude/claude_desktop_config.json`

Add or update the GitLab MCP server configuration:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_USE_OAUTH": "true",
        "GITLAB_OAUTH_CLIENT_ID": "your_application_id_here",
        "GITLAB_OAUTH_CLIENT_SECRET": "your_client_secret_here",
        "GITLAB_OAUTH_REDIRECT_URI": "http://127.0.0.1:8888/callback",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      }
    }
  }
}
```

> **Note**: `GITLAB_OAUTH_CLIENT_SECRET` is only required if you checked "Confidential" when creating your GitLab OAuth application. For non-confidential (public) apps, you can omit this variable.

### For Self-Hosted GitLab

If you're using a self-hosted GitLab instance, update the `GITLAB_API_URL`:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_USE_OAUTH": "true",
        "GITLAB_OAUTH_CLIENT_ID": "your_application_id_here",
        "GITLAB_OAUTH_CLIENT_SECRET": "your_client_secret_here",
        "GITLAB_OAUTH_REDIRECT_URI": "http://127.0.0.1:8888/callback",
        "GITLAB_API_URL": "https://your-gitlab-instance.com/api/v4"
      }
    }
  }
}
```

## Step 3: First-Time Authentication

1. **Start the MCP server** (or restart Claude if using Claude Desktop)

2. **When the server starts**, it will:

   - Detect that no OAuth token exists
   - Start a local HTTP server on port 8888
   - Automatically open your default browser to the GitLab authorization page

3. **In your browser**:

   - You'll see the GitLab authorization page
   - Review the requested permissions
   - Click **Authorize** to grant access

4. **After authorization**:

   - You'll be redirected to a success page
   - You can close the browser window
   - The token is securely saved to `~/.gitlab-mcp-token.json`

5. **The MCP server is now authenticated** and ready to use!

## Token Storage

The OAuth token is stored in a JSON file with restricted permissions (readable only by you):

- **Default location**: `~/.gitlab-mcp-token.json`
- **Custom location**: Set `GITLAB_OAUTH_TOKEN_PATH` environment variable

The token file contains:

- Access token
- Refresh token (if provided)
- Expiry time
- Token type

## Token Refresh

The MCP server automatically handles token refresh:

- Checks token expiry before each API request
- Automatically refreshes the token if it's expired (or will expire within 5 minutes)
- If refresh fails, it will restart the OAuth flow

## Using a Different Port

If port 8888 is already in use, you can use a different port:

1. Update the **Redirect URI** in your GitLab OAuth application:

   ```
   http://127.0.0.1:9999/callback
   ```

2. Update the `GITLAB_OAUTH_REDIRECT_URI` environment variable:
   ```json
   {
     "env": {
       "GITLAB_OAUTH_REDIRECT_URI": "http://127.0.0.1:9999/callback"
     }
   }
   ```

## Troubleshooting

### Browser doesn't open automatically

If the browser doesn't open automatically:

1. Look for the authorization URL in the server logs
2. Manually copy and paste the URL into your browser

### Port already in use (Multiple Claude Sessions)

**New in v2.0.8+**: The MCP server now supports multiple Claude sessions running simultaneously!

When you start a new Claude session while an OAuth server is already running:

1. The new instance automatically detects that the port is in use
2. It connects to the existing OAuth server as a client
3. The existing server opens a new browser window for authentication
4. Each session gets its own token independently

**What this means for you**:

- You can run multiple Claude sessions without port conflicts
- Each session will trigger its own OAuth flow
- The first session that starts becomes the OAuth server
- Subsequent sessions connect to it as clients
- All sessions can authenticate independently

**If you still want to use a different port**:

1. Change the port as described in "Using a Different Port" above
2. Or stop the process using port 8888

### Invalid redirect URI

If you see a "redirect URI mismatch" error:

1. Verify that the redirect URI in your GitLab OAuth application exactly matches the one in your configuration
2. Make sure to include the `/callback` path

### Token file permissions

If you see permissions errors:

1. The token file is automatically created with restricted permissions (0600)
2. Make sure your user has write access to the directory where the token file is stored

### Clearing tokens

To force re-authentication, delete the token file:

```bash
rm ~/.gitlab-mcp-token.json
```

Then restart the MCP server to go through the OAuth flow again.

## Revoking Access

To revoke the MCP server's access to your GitLab account:

1. Go to your GitLab **Settings** → **Applications**
2. Find the **Authorized applications** section
3. Find "GitLab MCP Server" (or whatever name you used)
4. Click **Revoke**
5. Delete the local token file: `rm ~/.gitlab-mcp-token.json`

## Security Best Practices

1. **Keep your Client ID confidential**: While it's not a secret, don't share it unnecessarily
2. **Don't share your token file**: The `~/.gitlab-mcp-token.json` file contains your access token
3. **Use scoped access**: Only grant the scopes your application needs
4. **Regularly review authorized applications**: Periodically check your authorized applications in GitLab
5. **Revoke access when done**: If you stop using the MCP server, revoke its access

## External Token Script (Advanced)

For environments that manage OAuth credentials externally (like Coder workspaces), you can delegate token retrieval to an external script instead of using the standard OAuth flow.

### When to Use External Token Script

Use this approach when:
- Your environment has its own OAuth credential management system (e.g., Coder, enterprise SSO systems)
- You want the MCP server to always fetch fresh tokens on-demand
- You don't want to manage token storage and refresh logic
- The environment maintains OAuth credentials that you can retrieve via a command

### Configuration

Set the `GITLAB_OAUTH_TOKEN_SCRIPT` environment variable to the command that retrieves your access token:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_USE_OAUTH": "true",
        "GITLAB_OAUTH_TOKEN_SCRIPT": "coder external-auth access-token gitlab",
        "GITLAB_API_URL": "https://gitlab.example.com/api/v4"
      }
    }
  }
}
```

### How It Works

1. When the MCP server needs an access token, it executes the command specified in `GITLAB_OAUTH_TOKEN_SCRIPT`
2. The command should output the access token to stdout (whitespace and newlines are automatically trimmed)
3. The token is used immediately for GitLab API requests
4. The script is executed fresh each time the MCP server starts, ensuring you always have a valid token
5. No token storage or refresh logic is needed - your external system handles this

### Requirements

- The script/command must be executable from the MCP server environment
- The script should output **only** the access token to stdout
- The script must complete within 30 seconds
- When using `GITLAB_OAUTH_TOKEN_SCRIPT`, `GITLAB_OAUTH_CLIENT_ID` is **not required**

### Example: Coder Workspaces

[Coder](https://coder.com) workspaces provide built-in OAuth credential management. To use it:

```bash
# The Coder CLI command retrieves the current OAuth token
coder external-auth access-token gitlab
```

Configuration for Claude Desktop or VS Code in a Coder workspace:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_USE_OAUTH": "true",
        "GITLAB_OAUTH_TOKEN_SCRIPT": "coder external-auth access-token gitlab",
        "GITLAB_API_URL": "https://your-gitlab-instance.com/api/v4"
      }
    }
  }
}
```

### Troubleshooting External Token Script

**Script not found:**
- Ensure the script/command is in your PATH or use an absolute path
- Verify execute permissions on the script file

**Token not working:**
- Check that the script outputs the token to stdout (not stderr)
- Verify the token has the required `api` scope
- Ensure the token hasn't expired (check your external credential system)

**Script timeout:**
- The script must complete within 30 seconds
- If it takes longer, optimize the script or check network connectivity

## Confidential vs Non-Confidential Applications

When creating your GitLab OAuth application, you can choose between two types:

| Feature         | Confidential                            | Non-Confidential (Public) |
| --------------- | --------------------------------------- | ------------------------- |
| Client Secret   | Required (`GITLAB_OAUTH_CLIENT_SECRET`) | Not needed                |
| Security Method | Client secret + PKCE                    | PKCE only                 |
| Use Case        | Server-side applications                | Desktop/CLI applications  |
| Secret Storage  | Must store secret securely              | No secret to protect      |
| Recommendation  | When you control the server             | **Recommended for MCP**   |

### When to Use Each Type

**Non-Confidential (Recommended for MCP):**

- Desktop applications like Claude Desktop
- CLI tools and local development
- Any environment where you cannot securely store a client secret
- Uses PKCE (Proof Key for Code Exchange) for security

> **Why Recommended?** Per [RFC 8252 (OAuth 2.0 for Native Apps)](https://datatracker.ietf.org/doc/html/rfc8252), native applications (desktop/CLI apps) cannot securely store client secrets, so public clients with PKCE are recommended.

**Confidential:**

- Server-side applications where you can securely store secrets
- Enterprise deployments with strict security requirements
- When your organization requires client secret authentication

## Comparison with Personal Access Tokens

| Feature          | OAuth2                      | Personal Access Token   |
| ---------------- | --------------------------- | ----------------------- |
| Setup complexity | Medium (requires OAuth app) | Low (just create token) |
| Security         | Better (browser-based flow) | Good (manual token)     |
| Token rotation   | Automatic                   | Manual                  |
| Revocation       | Easy (from GitLab UI)       | Manual (delete token)   |
| Expiration       | Configurable                | Configurable            |
| Scoping          | Application-level           | User-level              |

## Additional Configuration Options

### Custom Token Storage Path

```json
{
  "env": {
    "GITLAB_OAUTH_TOKEN_PATH": "/path/to/custom/token.json"
  }
}
```

### Read-Only Mode

You can combine OAuth with read-only mode:

```json
{
  "env": {
    "GITLAB_USE_OAUTH": "true",
    "GITLAB_OAUTH_CLIENT_ID": "your_client_id",
    "GITLAB_READ_ONLY_MODE": "true"
  }
}
```

### Project Restrictions

You can restrict access to specific projects:

```json
{
  "env": {
    "GITLAB_USE_OAUTH": "true",
    "GITLAB_OAUTH_CLIENT_ID": "your_client_id",
    "GITLAB_ALLOWED_PROJECT_IDS": "123,456,789"
  }
}
```
