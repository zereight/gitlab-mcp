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

Use this only with local OAuth (`GITLAB_USE_OAUTH=true`). The local OAuth flow
starts a browser on the same machine as the MCP server and listens for the
callback on a local HTTP server.

Change this when the default port conflicts with another process, or when your
GitLab OAuth Application is registered with a different local callback URL such
as `http://127.0.0.1:9999/callback`.

This variable is not used to choose the remote MCP OAuth callback URL. It does
not change the `redirect_uri` sent by remote MCP clients and is not a fix for
`Unregistered redirect_uri` errors when `GITLAB_MCP_OAUTH=true`.

Default:

- `http://127.0.0.1:8888/callback`

### `GITLAB_OAUTH_TOKEN_PATH`

Optional custom path for the stored OAuth token file.

### `GITLAB_OAUTH_TOKEN_SCRIPT`

Optional command that prints an OAuth access token to stdout. When set with
`GITLAB_USE_OAUTH=true`, the server uses this command instead of the local
browser OAuth flow and token file refresh.

Example:

```bash
GITLAB_USE_OAUTH=true \
GITLAB_OAUTH_TOKEN_SCRIPT="coder external-auth access-token gitlab"
```

The command may also print JSON with an `access_token` or `token` field.

### `GITLAB_OAUTH_TOKEN_SCRIPT_TIMEOUT_SECONDS`

Timeout for `GITLAB_OAUTH_TOKEN_SCRIPT`. Default: `30`.

## Remote / Multi-User Authentication

### `REMOTE_AUTHORIZATION`

Set to `true` to require GitLab auth headers per HTTP session.

See also: [Custom Agents and Multiple PAT Setup](../auth/custom-agent-multiple-pat.md).

Notes:

- Requires `STREAMABLE_HTTP=true`
- Not compatible with `SSE=true`
- Supports header-based auth such as:
  - `Authorization: Bearer <token>`
  - `Private-Token: <token>`
  - `Job-Token: <token>`

### `GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY`

Optional. Set to `true` to let unauthenticated clients call `tools/list` in
`REMOTE_AUTHORIZATION=true` deployments. This is intended for MCP gateways or
admin UIs that need to inspect tool metadata before a user provides a GitLab
token.

Default:

- `false`

Security notes:

- Only `initialize`, `notifications/initialized`, and `tools/list` may proceed without auth.
- `tools/call` and all GitLab API access still require request auth headers.
- Tool names and schemas can reveal enabled server capabilities; enable this only when that metadata is safe to expose.

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

Use this with remote MCP OAuth (`GITLAB_MCP_OAUTH=true`) when clients such as
OpenCode, MCPJam, Claude.ai, or another MCP client send their own callback URL.
It is recommended when you cannot register every client callback URI in GitLab
Admin.

This has a different purpose from `GITLAB_OAUTH_REDIRECT_URI`: callback proxy
mode turns a client-owned callback into the MCP server callback registered in
GitLab. Register `{MCP_SERVER_URL}/callback` in GitLab Admin.

### `MCP_SERVER_URL`

Public HTTPS MCP server base URL required for MCP OAuth mode.

### `GITLAB_OAUTH_APP_ID`

Pre-registered GitLab OAuth application ID used by MCP OAuth mode.

### `GITLAB_OAUTH_SCOPES`

Comma-separated scopes for MCP OAuth mode.

Examples:

- `api`
- `api,read_user`

### `GITLAB_OAUTH_ALLOWED_GROUPS`

Comma-separated list of GitLab group full paths. When set, only users who
belong to at least one of these groups (or any of their subgroups) are allowed
to use the server. Users who authenticate successfully via OAuth but are not
members of any matching group receive a `401 Access Denied` response.

Requires `GITLAB_MCP_OAUTH=true`.

> **Deprecation notice:** The old name `GITLAB_ALLOWED_GROUPS` is still accepted but will be
> removed in a future major version. Migrate to `GITLAB_OAUTH_ALLOWED_GROUPS`.

Examples:

- `my-org` — allows all members of `my-org` and any subgroup such as
  `my-org/engineering` or `my-org/engineering/backend`
- `my-org/engineering,my-org/security` — allows members of either
  group or their subgroups

Notes:

- Group paths are globally unique on a GitLab instance — path squatting is not
  possible.
- Matching is case-insensitive and checks the group's `full_path` (e.g.
  `my-org/team-a`), not its display name.
- The check is performed once at token issuance (when the MCP client exchanges
  the authorization code for tokens), not on every subsequent request. Existing
  sessions are not retroactively revoked when this value changes; users are
  re-checked when they complete a new OAuth flow or refresh through token issuance.
- The groups lookup uses the user's OAuth token. If GitLab rejects that lookup
  (for example because the token lacks a usable scope), login fails closed with
  access denied.
- No additional service account credentials are needed.
- Leave unset to allow any authenticated GitLab user (default behaviour).

### `ENABLE_DYNAMIC_API_URL`

Set to `true` to allow the GitLab API URL to be supplied per request.

Notes:

- Requires `REMOTE_AUTHORIZATION=true`
- Uses the `X-GitLab-API-URL` request header in HTTP mode
- The header URL must use an allowed host: any host in `GITLAB_API_URL`, plus any host in `GITLAB_ALLOWED_HOSTS`

### `GITLAB_ALLOWED_HOSTS`

Comma-separated additional hosts or GitLab base/API URLs allowed for
`X-GitLab-API-URL` when `ENABLE_DYNAMIC_API_URL=true`. This is only for hosts
beyond those already listed in `GITLAB_API_URL`; do not repeat `GITLAB_API_URL`
hosts here. Examples: `gitlab.example.com,https://gitlab.company.com:8443/api/v4`.

### `MCP_TRUST_PROXY`

Set to `true` when the MCP server runs behind a **trusted** reverse proxy.

Effects when enabled:

- **Public download URLs** (Streamable HTTP): derives the client-facing origin
  from `Forwarded` / `X-Forwarded-*` when `MCP_SERVER_URL` is unset.
- **Express `trust proxy`**: enables proxy-aware `req.ip` in both Streamable
  HTTP and SSE transports.
- **OAuth rate limiting** (`GITLAB_MCP_OAUTH=true`): normalizes
  `X-Forwarded-For` values that include a source port (for example
  `1.2.3.4:5678` or `[2001:db8::1]:5678`) before `express-rate-limit` keys
  requests on `/authorize`, `/token`, `/register`, and `/revoke`.

Use this only when the proxy is trusted **and** direct client access to the MCP
server port is blocked. When unset, forwarded headers are ignored for URL
derivation and Express does not trust `X-Forwarded-For`.

**Migration note:** OAuth deployments that previously relied on implicit proxy
trust must set `MCP_TRUST_PROXY=true` explicitly.

Recognized forwarded headers for URL derivation:

- `Forwarded`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`
- `X-Forwarded-Prefix`

## Stateless mode (multi-pod HPA)

See [Stateless Mode](stateless-mode.md) for the full design and trade-off
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

For agent-specific tool surfaces, see
[Custom Agents and Multiple PAT Setup](../auth/custom-agent-multiple-pat.md).

Special value:

- `all`

### `GITLAB_TOOLS`

Comma-separated list of individual tool names to add on top of enabled toolsets.

For restricted custom agents, combine this with `GITLAB_TOOLSETS`,
`GITLAB_DENIED_TOOLS_REGEX`, and the tool policy variables documented in
[Custom Agents and Multiple PAT Setup](../auth/custom-agent-multiple-pat.md).

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

Legacy additive flag for wiki-related tools. Prefer `GITLAB_TOOLSETS=wiki`.

### `USE_MILESTONE`

Legacy additive flag for milestone-related tools. Prefer `GITLAB_TOOLSETS=milestones`.

### `USE_PIPELINE`

Legacy additive flag for pipeline-related tools. Prefer `GITLAB_TOOLSETS=pipelines`.

> **Deprecation notice:** The `USE_*` flags are kept for backward compatibility only and cover
> just three toolsets. Use `GITLAB_TOOLSETS` (groups) and `GITLAB_TOOLS` (individual tools)
> instead.

## Transport and Server Runtime

### `STREAMABLE_HTTP`

Set to `true` to run the Streamable HTTP transport.

### `SSE`

Set to `true` to run the legacy SSE transport.

Notes:

- Not compatible with `REMOTE_AUTHORIZATION=true`
- If `HOST` is not loopback, startup requires `SSE_AUTH_TOKEN` unless you explicitly set `SSE_DANGEROUSLY_ALLOW_UNAUTHENTICATED_REMOTE=true`

### `SSE_AUTH_TOKEN`

Bearer token required for `/sse` and `/messages` when configured.
Use this for any network-reachable SSE deployment.

### `SSE_DANGEROUSLY_ALLOW_UNAUTHENTICATED_REMOTE`

Set to `true` only if you intentionally expose SSE without MCP-layer auth.
This allows any network client to use the server's configured GitLab token.

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

- [OAuth2 Authentication Setup Guide](../auth/oauth-setup.md)
- [GitLab MCP OAuth Callback Proxy](../auth/oauth-callback-proxy.md)
- [Stateless Mode (multi-pod HPA)](stateless-mode.md)
- [Claude Code Setup Guide](../clients/claude-code.md)
- [VS Code Setup Guide](../clients/vscode.md)
- [GitHub Copilot Setup Guide](../clients/copilot.md)
- [Codex Setup Guide](../clients/codex.md)
- [Cursor Setup Guide](../clients/cursor.md)
- [JSON-Based MCP Clients Setup Guide](../clients/json-clients.md)
