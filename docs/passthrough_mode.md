# GitLab MCP Passthrough Authentication Mode

This guide explains how to configure the GitLab MCP server to use passthrough authentication mode, where users provide their own GitLab Personal Access Token (PAT) with each request.

## Overview

Passthrough mode allows multiple users to use the same MCP server instance with their own GitLab credentials. Each user provides their GitLab Personal Access Token via the `Gitlab-Token` header, and the server uses that token for all GitLab API requests.

This mode is ideal for:
- Multi-user environments
- Scenarios where you don't want to store tokens on the server
- Testing with different access levels

## Configuration

To enable passthrough mode, set the following environment variable:

```bash
GITLAB_PAT_PASSTHROUGH=true
```

**Important:** When using passthrough mode, do not set:
- `GITLAB_PERSONAL_ACCESS_TOKEN`
- `GITLAB_OAUTH2_CLIENT_ID` (or any OAuth2 configuration)

## How It Works

1. The MCP server starts without any pre-configured authentication
2. Each client request must include a `Gitlab-Token` header with a valid GitLab PAT
3. The server uses the provided token for that specific request
4. No tokens are stored or cached by the server

## Client Configuration

### Using with MCP Client

When connecting to a passthrough-enabled server, clients must provide the GitLab token with each request:

```typescript
// Example client configuration
const client = new MCPClient({
  url: 'http://localhost:3000',
  headers: {
    'Gitlab-Token': 'your-gitlab-personal-access-token'
  }
});
```

### Using with cURL

```bash
curl -H "Gitlab-Token: your-gitlab-personal-access-token" \
     http://localhost:3000/your-endpoint
```

### Using with HTTP Libraries

```javascript
// Node.js with fetch
const response = await fetch('http://localhost:3000/your-endpoint', {
  headers: {
    'Gitlab-Token': 'your-gitlab-personal-access-token'
  }
});
```

## Creating a GitLab Personal Access Token

1. Go to GitLab (e.g., https://gitlab.com)
2. Navigate to **User Settings** → **Access Tokens**
3. Create a new token with:
   - **Token name**: Descriptive name (e.g., "MCP Client")
   - **Expiration date**: Set as needed
   - **Scopes**: Select based on your needs:
     - `api` - Full API access (recommended)
     - `read_api` - Read-only API access
     - `read_repository` - Read repository content
     - `write_repository` - Write repository content

4. Copy the generated token and use it in the `Gitlab-Token` header

## Security Considerations

1. **Token Transmission**: Tokens are sent with every request
   - Always use HTTPS in production to encrypt tokens in transit
   - Never log or store tokens on the client side in plain text

2. **No Server Storage**: The server does not store any tokens
   - Each request is authenticated independently
   - No session management or token caching

3. **Token Scope**: Users control their own access levels
   - Each user's token determines what they can access
   - Server has no control over permissions

## Error Handling

### Missing Token
If a request is made without the `Gitlab-Token` header:
```
Status: 401 Unauthorized
Body: "Please set a Gitlab-Token header in your request"
```

### Invalid Token Format
If the token is not a string or is sent multiple times:
```
Status: 401 Unauthorized
Body: "Gitlab-Token must only be set once"
```

### Invalid GitLab Token
If GitLab rejects the token:
```
Status: 401 Unauthorized
Body: GitLab API error message
```

## Starting the Server

Start the server with passthrough mode enabled:

```bash
GITLAB_PAT_PASSTHROUGH=true npm dev
```

The server will log:
```
Configuring GitLab PAT passthrough authentication. Users must set the Gitlab-Token header in their requests
```

## Comparison with Other Modes

| Feature | Passthrough | Static PAT | OAuth2 Proxy |
|---------|------------|------------|--------------|
| Multi-user support | ✅ Yes | ❌ No | ✅ Yes |
| Token storage | ❌ None | ✅ Server | ✅ Database |
| Setup complexity | Low | Low | High |
| Transport support | All | All | SSE/HTTP only |
| User token control | ✅ Full | ❌ None | ⚠️ Limited |

## Example: Full Request Flow

1. User creates a GitLab PAT with necessary scopes
2. User configures their MCP client with the token:
   ```javascript
   const client = new MCPClient({
     url: 'http://localhost:3000',
     headers: {
       'Gitlab-Token': 'glpat-xxxxxxxxxxxxxxxxxxxx'
     }
   });
   ```
3. Client makes a request to list projects
4. MCP server receives request with token header
5. Server forwards the token to GitLab API
6. GitLab validates token and returns data
7. Server returns data to client

## Troubleshooting

### Token Not Working
- Verify the token has not expired
- Check that the token has the required scopes
- Ensure the token is from the correct GitLab instance
- Try the token directly with GitLab API to verify it works

### Multiple Users Issues
- Each user must use their own token
- Tokens should not be shared between users
- Consider OAuth2 mode for better multi-user management

## Best Practices

1. **Token Rotation**: Regularly rotate PATs for security
2. **Minimal Scopes**: Use tokens with only necessary scopes
3. **HTTPS Only**: Always use HTTPS in production
4. **Client Security**: Store tokens securely on client side
5. **Monitoring**: Log request counts but never log tokens

## Note

Passthrough mode is ideal for development and multi-user scenarios where each user manages their own credentials. For production deployments with many users, consider using OAuth2 proxy mode for better token management and security.
