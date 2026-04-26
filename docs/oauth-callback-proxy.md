# GitLab MCP OAuth Callback Proxy

## Problem

The current OAuth flow requires each MCP client's callback URL to be pre-registered in the GitLab OAuth Application settings. This means GitLab admin involvement for every new client deployment.

## Passthrough Mode (Default — GITLAB_OAUTH_CALLBACK_PROXY=false)

GitLab redirects **directly back to the MCP client**. The MCP server only proxies the client_id and token exchange — it never receives the callback.

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant GitLab as GitLab

    Client->>Server: POST /register<br/>{redirect_uris: [client.com/cb]}
    Server-->>Client: {client_id: virtual-uuid}

    Client->>Server: GET /authorize<br/>{redirect_uri=client.com/cb, code_challenge, state}
    Server->>GitLab: 302 → /oauth/authorize<br/>{client_id=REAL_APP_ID,<br/>redirect_uri=client.com/cb,<br/>code_challenge, state}

    Note over GitLab: User logs in & authorizes

    GitLab->>Client: 302 → client.com/cb?code=GITLAB_CODE&state=...
    Note right of Client: ⚠️ GitLab redirects directly<br/>to the MCP client.<br/>This URL must be registered<br/>in GitLab OAuth App settings.

    Client->>Server: POST /token<br/>{code=GITLAB_CODE, code_verifier}
    Server->>GitLab: POST /oauth/token<br/>{code=GITLAB_CODE, code_verifier,<br/>client_id=REAL_APP_ID}
    GitLab-->>Server: {access_token, refresh_token}
    Server-->>Client: {access_token, refresh_token}

    Client->>Server: POST /mcp<br/>Authorization: Bearer access_token
    Server->>GitLab: Validate token & make API calls
```

**Problem**: Every MCP client needs its callback URL registered in GitLab Admin → Applications. New client = new URL = GitLab admin involvement.

## Callback Proxy Mode (GITLAB_OAUTH_CALLBACK_PROXY=true)

The MCP server **intercepts the callback itself**, exchanges the code with GitLab, stores the tokens server-side, and redirects to the client with a proxy code. Only ONE fixed URL needs to be registered with GitLab.

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant GitLab as GitLab

    Client->>Server: POST /register<br/>{redirect_uris: [client.com/cb]}
    Server-->>Client: {client_id: virtual-uuid}

    Client->>Server: GET /authorize<br/>{redirect_uri=client.com/cb,<br/>code_challenge=CLIENT_CC, state=CLIENT_STATE}

    Note over Server: Stores client's redirect_uri,<br/>state, and code_challenge.<br/>Generates proxy PKCE pair.

    Server->>GitLab: 302 → /oauth/authorize<br/>{client_id=REAL_APP_ID,<br/>redirect_uri=mcp-server.com/callback,<br/>code_challenge=PROXY_CC,<br/>state=PROXY_STATE}

    Note over GitLab: User logs in & authorizes

    GitLab->>Server: 302 → mcp-server.com/callback?code=GITLAB_CODE&state=PROXY_STATE
    Note right of Server: ✅ GitLab redirects to the<br/>MCP server's fixed /callback.<br/>Only THIS URL is registered<br/>in GitLab OAuth App settings.

    Server->>GitLab: POST /oauth/token<br/>{code=GITLAB_CODE,<br/>code_verifier=PROXY_CV,<br/>redirect_uri=mcp-server.com/callback}
    GitLab-->>Server: {access_token, refresh_token}

    Note over Server: Stores tokens server-side.<br/>Generates proxy auth code.

    Server->>Client: 302 → client.com/cb?code=PROXY_CODE&state=CLIENT_STATE

    Client->>Server: POST /token<br/>{code=PROXY_CODE, code_verifier=CLIENT_CV}

    Note over Server: Verifies client PKCE.<br/>Looks up stored tokens<br/>by proxy code (one-time use).

    Server-->>Client: {access_token, refresh_token}

    Client->>Server: POST /mcp<br/>Authorization: Bearer access_token
    Server->>GitLab: Validate token & make API calls
```

**Result**: Only `https://mcp-server.example.com/callback` needs to be registered in GitLab. Works with any number of MCP clients without GitLab admin changes.

## Security

| Property | How It's Enforced |
|----------|------------------|
| Dual PKCE | Separate pairs for client↔server and server↔GitLab legs |
| Proxy codes are one-time use | Deleted from store after first `/token` exchange |
| Proxy codes expire | 10-minute TTL, checked before returning tokens |
| Client PKCE is verified | `code_verifier` is mandatory when `code_challenge` was stored |
| State is not replayable | Deleted from pending store after `/callback` consumes it |
| Error responses are sanitized | Generic messages to clients, details in server logs only |
| Bounded memory | In-memory LRU cache, max 1000 entries |

## Configuration

```bash
# Enable callback proxy mode
GITLAB_MCP_OAUTH=true
GITLAB_OAUTH_CALLBACK_PROXY=true
MCP_SERVER_URL=https://mcp-server.example.com
GITLAB_OAUTH_APP_ID=<app-id>
```

In GitLab Admin → Applications:
- Set the redirect URI to `https://mcp-server.example.com/callback`
- Ensure Confidential is **unchecked** (public client, PKCE replaces client_secret)
- Enable the required scopes (e.g. `api`, `read_api`, `read_user`)
