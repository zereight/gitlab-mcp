# Environment Variables Reference

This document is the reference source of truth for runtime environment variables used by `@zereight/mcp-gitlab`.

Use an API URL, not the GitLab web root:

- `https://gitlab.com/api/v4`
- `https://your-gitlab.example.com/api/v4`

## Authentication

### `GITLAB_PERSONAL_ACCESS_TOKEN`

Default static GitLab Personal Access Token used in standard mode.

### `GITLAB_JOB_TOKEN`

Optional GitLab CI job token.

### `GITLAB_AUTH_COOKIE_PATH`

Optional Netscape cookie file path for cookie-based authentication.

### `GITLAB_USE_OAUTH`

Set to `true` to enable local browser-based OAuth2 authentication.

### `GITLAB_OAUTH_CLIENT_ID`

Client ID for local OAuth2 authentication.

### `GITLAB_OAUTH_CLIENT_SECRET`

Client secret for confidential OAuth applications only.

### `GITLAB_OAUTH_REDIRECT_URI`

OAuth callback URI for the local browser flow.

Default:

- `http://127.0.0.1:8888/callback`

### `GITLAB_OAUTH_TOKEN_PATH`

Optional custom path for the stored OAuth token file.

## Remote / Multi-User Authentication

### `REMOTE_AUTHORIZATION`

Set to `true` to require GitLab auth headers per HTTP session.

Notes:

- Requires `STREAMABLE_HTTP=true`
- Not compatible with `SSE=true`
- Supports header-based auth such as:
  - `Authorization: Bearer <token>`
  - `Private-Token: <token>`
  - `Job-Token: <token>`

### `SESSION_TIMEOUT_SECONDS`

Per-session auth timeout in seconds when using remote authorization.

Default:

- `3600`

### `GITLAB_MCP_OAUTH`

Enables the server-side MCP OAuth proxy mode for remote MCP clients.

### `GITLAB_OAUTH_CALLBACK_PROXY`

Set to `true` to make the MCP server handle GitLab's OAuth callback at
`{MCP_SERVER_URL}/callback`, then redirect the client with a proxy authorization
code. This keeps the GitLab OAuth Application redirect URI fixed to one MCP
server callback URL instead of requiring each MCP client's callback URL to be
registered in GitLab.

### `MCP_SERVER_URL`

Public HTTPS MCP server base URL required for MCP OAuth mode.

### `GITLAB_OAUTH_APP_ID`

Pre-registered GitLab OAuth application ID used by MCP OAuth mode.

### `GITLAB_OAUTH_SCOPES`

Comma-separated scopes for MCP OAuth mode.

Examples:

- `api`
- `api,read_user`

### `ENABLE_DYNAMIC_API_URL`

Set to `true` to allow the GitLab API URL to be supplied per request.

Notes:

- Requires `REMOTE_AUTHORIZATION=true`
- Uses the `X-GitLab-API-URL` request header in HTTP mode

## Stateless mode (multi-pod HPA)

See [Stateless Mode](./stateless-mode.md) for the full design and trade-off
discussion. Stateless mode makes the OAuth proxy, DCR registry, and
`Mcp-Session-Id` path safe to distribute across multiple pods with no shared
cache, no sticky sessions, and no external dependency.

### `OAUTH_STATELESS_MODE`

Set to `true` to enable stateless encodings for `client_id`, OAuth `state`,
OAuth `code`, and `Mcp-Session-Id`. Default `false` — legacy (per-pod memory)
behaviour is unchanged.

### `OAUTH_STATELESS_SECRET`

Required when `OAUTH_STATELESS_MODE=true`. Base64url-encoded ≥32 bytes. Must
be identical across all pods.

Generate with:

```bash
openssl rand -base64 32
```

### `OAUTH_STATELESS_SECRET_PREVIOUS`

Optional. Accepted on reads only; during key rotation the previous secret
keeps verifying tokens minted before the swap. Remove after `max(TTL)` has
elapsed.

### `OAUTH_STATELESS_CLIENT_TTL_SECONDS`

Max age for a signed DCR `client_id`. Default `86400` (24 h).

### `OAUTH_STATELESS_PENDING_TTL_SECONDS`

Max age for a sealed OAuth `state` during the callback-proxy `/authorize`
→ `/callback` hop. Default `600` (10 min).

### `OAUTH_STATELESS_STORED_TTL_SECONDS`

Max age for a sealed proxy authorization `code` during the `/callback` →
`/token` hop. Default `600` (10 min).

### `OAUTH_STATELESS_SESSION_TTL_SECONDS`

Inactivity timeout for a sealed `Mcp-Session-Id`, evaluated against the
`iat` of the most recently minted sid. The server mints a fresh sid on
every `/mcp` request, so continuously-used sessions never expire; a
session is only rejected when no traffic has arrived for longer than this
window. Defaults to `SESSION_TIMEOUT_SECONDS` when unset, matching the
legacy stateful `setAuthTimeout` semantics without additional
configuration.

Value validation: must parse as a finite positive integer. If the env var
(or `--oauth-stateless-session-ttl` CLI flag) is unset or invalid, the
value falls back to `SESSION_TIMEOUT_SECONDS` when that is itself a finite
positive integer, otherwise to the hardcoded default of `3600` seconds.
Misconfigurations never produce `NaN` — this guarantees the TTL check in
the stateless codec (`ttlSec > 0` in `checkIat`) always enforces an
inactivity window for sealed sids.

## Core GitLab Configuration

### `GITLAB_API_URL`

GitLab API base URL.

Default:

- `https://gitlab.com/api/v4`

### `GITLAB_PROJECT_ID`

Optional default project ID.

### `GITLAB_ALLOWED_PROJECT_IDS`

Optional comma-separated allowlist of project IDs.

Behavior:

- One project ID: acts like a default locked project
- Multiple project IDs: restricts access to those projects only

### `GITLAB_READ_ONLY_MODE`

Set to `true` to expose only read-only tools.

## Tool Exposure and Filtering

### `GITLAB_TOOLSETS`

Comma-separated list of toolset IDs to enable.

Special value:

- `all`

### `GITLAB_TOOLS`

Comma-separated list of individual tool names to add on top of enabled toolsets.

### `GITLAB_DENIED_TOOLS_REGEX`

Optional regex denylist for tool names.

### `GITLAB_TOOL_POLICY_APPROVE`

Comma-separated tool names that require explicit confirmation before execution. Tools listed here are visible in `tools/list` with `confirmationHint: true` but will return a confirmation prompt unless called with `_confirmed: true`.

CLI: `--tool-policy-approve`

Examples:

- `create_issue,delete_issue`
- `merge_merge_request`

### `GITLAB_TOOL_POLICY_HIDDEN`

Comma-separated tool names to hide from `tools/list`. Hidden tools are not visible to the agent but remain callable if invoked directly. Takes precedence over `GITLAB_TOOL_POLICY_APPROVE` when the same tool appears in both.

CLI: `--tool-policy-hidden`

Examples:

- `delete_issue,delete_wiki_page`

### `USE_GITLAB_WIKI`

Legacy additive flag for wiki-related tools.

### `USE_MILESTONE`

Legacy additive flag for milestone-related tools.

### `USE_PIPELINE`

Legacy additive flag for pipeline-related tools.

## Transport and Server Runtime

### `STREAMABLE_HTTP`

Set to `true` to run the Streamable HTTP transport.

### `SSE`

Set to `true` to run the legacy SSE transport.

Notes:

- Not compatible with `REMOTE_AUTHORIZATION=true`

### `HOST`

Bind host for HTTP transports.

Default:

- `127.0.0.1`

### `PORT`

HTTP server port.

Default:

- `3002`

## Network and TLS

### `HTTP_PROXY`

Optional outbound HTTP proxy.

### `HTTPS_PROXY`

Optional outbound HTTPS proxy.

### `NO_PROXY`

Optional proxy bypass rules.

### `NODE_TLS_REJECT_UNAUTHORIZED`

Controls TLS certificate verification.

### `GITLAB_CA_CERT_PATH`

Optional custom CA certificate path.

### `GITLAB_POOL_MAX_SIZE`

Maximum GitLab client pool size.

## Recommended Starting Sets

## Simple local PAT setup

- `GITLAB_PERSONAL_ACCESS_TOKEN`
- `GITLAB_API_URL`

## Local OAuth setup

- `GITLAB_USE_OAUTH=true`
- `GITLAB_OAUTH_CLIENT_ID`
- `GITLAB_OAUTH_REDIRECT_URI`
- `GITLAB_API_URL`

## Remote shared deployment

- `STREAMABLE_HTTP=true`
- `REMOTE_AUTHORIZATION=true`
- `HOST`
- `PORT`

## Related Guides

- [OAuth2 Authentication Setup Guide](./oauth-setup.md)
- [GitLab MCP OAuth Callback Proxy](./oauth-callback-proxy.md)
- [Stateless Mode (multi-pod HPA)](./stateless-mode.md)
- [Claude Code Setup Guide](./claude-code-setup.md)
- [VS Code Setup Guide](./vscode-setup.md)
- [GitHub Copilot Setup Guide](./copilot-setup.md)
- [Codex Setup Guide](./codex-setup.md)
- [Cursor Setup Guide](./cursor-setup.md)
- [JSON-Based MCP Clients Setup Guide](./json-mcp-clients-setup.md)
