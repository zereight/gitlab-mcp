# Dynamic GitLab API URL Support

This feature allows you to pass different GitLab API URLs via custom request headers, enabling the MCP server to connect to multiple GitLab instances simultaneously using a connection pool architecture.

## Overview

When enabled, the server can handle requests to different GitLab instances (e.g., gitlab.com, self-hosted GitLab, etc.) within the same session by accepting a custom header that specifies the GitLab API URL for each request.

## Architecture

### Connection Pool

The server uses a connection pool (`GitLabClientPool`) to manage HTTP/HTTPS agents for multiple GitLab instances:

- **Automatic Client Creation**: When a new GitLab API URL is encountered, a new client configuration is created with appropriate proxy settings and SSL options
- **Connection Reuse**: Subsequent requests to the same API URL reuse the existing client configuration
- **Automatic Cleanup**: Idle connections are automatically cleaned up after a configurable timeout
- **LRU Eviction**: When the pool reaches maximum capacity, the least recently used client is evicted

### Session-Based API URL

In remote authorization mode, each session can have its own GitLab API URL:

- The API URL is extracted from the `X-GitLab-API-URL` header
- It's stored alongside the authentication token in the session context
- All API calls within that session use the specified API URL

## Configuration

### Environment Variables

Add these environment variables to enable and configure the feature:

```bash
# Enable dynamic API URL support (required)
ENABLE_DYNAMIC_API_URL=true

# Remote authorization must be enabled for this feature
REMOTE_AUTHORIZATION=true
STREAMABLE_HTTP=true

# Connection pool configuration (optional)
GITLAB_POOL_MAX_SIZE=100              # Maximum number of GitLab instances in pool (default: 100)
GITLAB_POOL_IDLE_TIMEOUT=300000       # Idle timeout in milliseconds (default: 300000 = 5 minutes)
GITLAB_POOL_CLEANUP_INTERVAL=60000    # Cleanup interval in milliseconds (default: 60000 = 1 minute)

# Proxy settings (optional, applied to all pooled clients)
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=https://proxy.example.com:8443
NODE_TLS_REJECT_UNAUTHORIZED=0        # Set to 0 to disable SSL verification
GITLAB_CA_CERT_PATH=/path/to/ca.crt   # Path to custom CA certificate
```

### Prerequisites

1. **Remote Authorization Mode**: This feature requires `REMOTE_AUTHORIZATION=true` and `STREAMABLE_HTTP=true`
2. **Authentication**: Each request must include either `Authorization` or `Private-Token` header
3. **Custom API URL**: Include the `X-GitLab-API-URL` header with the GitLab instance URL

## Usage

### HTTP Request Headers

When making requests to the MCP server, include these headers:

```http
POST /mcp HTTP/1.1
Host: localhost:3002
Content-Type: application/json
MCP-Session-ID: your-session-id
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
X-GitLab-API-URL: https://gitlab.example.com

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_project",
    "arguments": {
      "project_id": "my-group/my-project"
    }
  },
  "id": 1
}
```

### Header Details

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` or `Private-Token` | Yes | GitLab authentication token |
| `X-GitLab-API-URL` | Yes* | Full URL to GitLab API (e.g., `https://gitlab.example.com`) |
| `MCP-Session-ID` | Yes** | Session identifier for maintaining state |

\* Required when `ENABLE_DYNAMIC_API_URL=true`  
\** Required for subsequent requests in the same session

### URL Format

The `X-GitLab-API-URL` header accepts various URL formats:

```bash
# Full API URL (recommended)
X-GitLab-API-URL: https://gitlab.example.com/api/v4

# Base URL (will be normalized to include /api/v4)
X-GitLab-API-URL: https://gitlab.example.com

# Self-hosted GitLab with custom path
X-GitLab-API-URL: https://git.company.com/gitlab/api/v4
```

The server automatically normalizes URLs to ensure they end with `/api/v4`.

## Examples

### Example 1: Connecting to Multiple GitLab Instances

```javascript
// First request to gitlab.com
const response1 = await fetch('http://localhost:3002/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer glpat-token-for-gitlab-com',
    'X-GitLab-API-URL': 'https://gitlab.com'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {}
    },
    id: 1
  })
});

const session1 = response1.headers.get('mcp-session-id');

// Second request to self-hosted GitLab (different session)
const response2 = await fetch('http://localhost:3002/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Private-Token': 'glpat-token-for-self-hosted',
    'X-GitLab-API-URL': 'https://gitlab.company.com'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {}
    },
    id: 2
  })
});

const session2 = response2.headers.get('mcp-session-id');

// Subsequent requests use the session ID
const response3 = await fetch('http://localhost:3002/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'MCP-Session-ID': session1,
    'Authorization': 'Bearer glpat-token-for-gitlab-com'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'get_project',
      arguments: { project_id: 'my-project' }
    },
    id: 3
  })
});
```

### Example 2: Using with cURL

```bash
# First request - creates session
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx" \
  -H "X-GitLab-API-URL: https://gitlab.example.com" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list_projects",
      "arguments": {}
    },
    "id": 1
  }' \
  -i  # Include headers to see MCP-Session-ID

# Subsequent request - reuses session
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Session-ID: <session-id-from-previous-response>" \
  -H "Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_project",
      "arguments": {
        "project_id": "my-group/my-project"
      }
    },
    "id": 2
  }'
```

## Connection Pool Monitoring

### Pool Statistics

You can monitor the connection pool via the metrics endpoint:

```bash
curl http://localhost:3002/metrics
```

Response:
```json
{
  "activeSessions": 5,
  "totalSessions": 127,
  "expiredSessions": 12,
  "authFailures": 3,
  "requestsProcessed": 1543,
  "rejectedByRateLimit": 2,
  "rejectedByCapacity": 0,
  "authenticatedSessions": 5,
  "uptime": 3600.5,
  "memoryUsage": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "config": {
    "maxSessions": 1000,
    "maxRequestsPerMinute": 60,
    "sessionTimeoutSeconds": 3600,
    "remoteAuthEnabled": true
  }
}
```

## Security Considerations

### URL Validation

- The server validates that the provided URL is a valid HTTP/HTTPS URL
- Invalid URLs are rejected and logged
- The original `GITLAB_API_URL` from environment variables is used as fallback

### Authentication

- Each session maintains its own authentication token
- Tokens are validated for format and length
- Authentication tokens expire after `SESSION_TIMEOUT_SECONDS` of inactivity

### Rate Limiting

- Each session is subject to rate limiting (`MAX_REQUESTS_PER_MINUTE`)
- The connection pool has a maximum size (`GITLAB_POOL_MAX_SIZE`)
- Requests are rejected when limits are exceeded

### SSL/TLS

- Each pooled client respects the global SSL settings
- Custom CA certificates can be configured via `GITLAB_CA_CERT_PATH`
- SSL verification can be disabled with `NODE_TLS_REJECT_UNAUTHORIZED=0` (not recommended for production)

## Troubleshooting

### Common Issues

1. **"Missing Authorization or Private-Token header"**
   - Ensure you're sending either `Authorization: Bearer <token>` or `Private-Token: <token>` header
   - Verify the token format is correct (minimum 20 characters)

2. **"Invalid custom API URL provided"**
   - Check that the URL is properly formatted (e.g., `https://gitlab.example.com`)
   - Ensure the URL is accessible from the server

3. **"Server capacity reached"**
   - The connection pool is full (`GITLAB_POOL_MAX_SIZE` reached)
   - Wait for idle connections to be cleaned up or increase `GITLAB_POOL_MAX_SIZE`

4. **"Rate limit exceeded"**
   - You've exceeded `MAX_REQUESTS_PER_MINUTE` for your session
   - Wait for the rate limit window to reset (1 minute)

### Debug Logging

Enable debug logging to troubleshoot issues:

```bash
LOG_LEVEL=debug npm start
```

This will show:
- Custom API URL detection
- Connection pool operations
- Session creation and cleanup
- Authentication token handling

## Performance Considerations

### Connection Pool Sizing

- **Small deployments** (1-10 GitLab instances): `GITLAB_POOL_MAX_SIZE=10-20`
- **Medium deployments** (10-50 instances): `GITLAB_POOL_MAX_SIZE=50-100`
- **Large deployments** (50+ instances): `GITLAB_POOL_MAX_SIZE=100-200`

### Idle Timeout

- **Frequent access**: `GITLAB_POOL_IDLE_TIMEOUT=600000` (10 minutes)
- **Moderate access**: `GITLAB_POOL_IDLE_TIMEOUT=300000` (5 minutes, default)
- **Infrequent access**: `GITLAB_POOL_IDLE_TIMEOUT=60000` (1 minute)

### Memory Usage

Each pooled client consumes approximately:
- HTTP Agent: ~1-2 KB
- HTTPS Agent: ~2-4 KB
- Metadata: ~1 KB

Total per client: ~5-10 KB

For 100 clients: ~500 KB - 1 MB

## Migration Guide

### From Single Instance to Multi-Instance

1. **Enable the feature**:
   ```bash
   ENABLE_DYNAMIC_API_URL=true
   REMOTE_AUTHORIZATION=true
   STREAMABLE_HTTP=true
   ```

2. **Update client code** to include `X-GitLab-API-URL` header

3. **Test with a single instance** first to ensure compatibility

4. **Gradually add more instances** while monitoring the metrics endpoint

### Backward Compatibility

When `ENABLE_DYNAMIC_API_URL=false` (default):
- The server behaves exactly as before
- Only the `GITLAB_API_URL` environment variable is used
- No connection pooling overhead
- Custom API URL headers are ignored

## API Reference

### Custom Headers

#### X-GitLab-API-URL

Specifies the GitLab API URL for the current request.

**Format**: `X-GitLab-API-URL: <url>`

**Example**: `X-GitLab-API-URL: https://gitlab.example.com`

**Validation**:
- Must be a valid HTTP/HTTPS URL
- Automatically normalized to include `/api/v4` suffix
- Logged as warning if invalid

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_DYNAMIC_API_URL` | boolean | `false` | Enable dynamic API URL support |
| `GITLAB_POOL_MAX_SIZE` | number | `100` | Maximum number of GitLab instances in pool |
| `GITLAB_POOL_IDLE_TIMEOUT` | number | `300000` | Idle timeout in milliseconds |
| `GITLAB_POOL_CLEANUP_INTERVAL` | number | `60000` | Cleanup interval in milliseconds |

## License

This feature is part of the GitLab MCP Server and follows the same license terms.