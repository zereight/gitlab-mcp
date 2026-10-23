# Environment Variables Reference

This document is the reference source of truth for runtime environment variables used by `@zereight/mcp-gitlab`.

Use an API URL, not the GitLab web root:

- `https://gitlab.com/api/v4`
- `https://your-gitlab.example.com/api/v4`

## Compact MCP results

### `GITLAB_MCP_COMPACT_RESULTS`

Optional. Set to `true` to replace oversized MCP tool replies with a JSON preview
and a `zereight-mcp-gitlab tool …` command that prints the full payload in a
terminal. Default `false` so existing clients keep the complete JSON. Human CLI
commands are never compacted.

### `GITLAB_MCP_COMPACT_RESULT_CHARS`

Optional. Character threshold for compacting (default `4000`). Used by global
compact mode and by `GITLAB_MCP_COMPACT_TOOLS`.

### `GITLAB_MCP_COMPACT_TOOLS`

Optional. Comma-separated tool names whose oversized replies are compacted even
when `GITLAB_MCP_COMPACT_RESULTS` is off. Replies at or under the character
threshold stay intact. Unset means no extra tools are compacted, so existing
clients keep full payloads.

Example for the large read tools:

```bash
GITLAB_MCP_COMPACT_TOOLS=get_merge_request_diffs,get_file_contents,get_pipeline_job_output
```

CLI: `--compact-tools`

## List and attachment summaries

List tools accept an opt-in `summary` argument (`true`/`false`, default `false`).
When `true`, the server keeps high-signal fields such as `id`, `iid`, `title`,
`state`, and `web_url` and drops long bodies. Existing clients that omit
`summary` still receive the full GitLab JSON. `list_webhook_events` already had
its own `summary` flag; that native behavior is unchanged.

`get_pipeline_job_output` still defaults to the last 1000 lines (`limit` /
`offset`). Pass those arguments instead of fetching a whole job trace.

`download_attachment` accepts opt-in `metadata_only=true` to return filename,
mime type, and byte length without inline image bytes or a saved file. Default
`false` keeps the existing download behavior.

## Response masking

### `GITLAB_MASKING_ENABLED`

Optional. Set to `true` to mask sensitive text in GitLab tool results and
returned error messages. The default is `false`; when disabled, the existing
response path is used and no masking configuration file is read.

### `GITLAB_MASKING_CONFIG`

Optional path to a JSON masking configuration. Relative paths are resolved from
`GITLAB_MASKING_WORKSPACE_DIR` (or the server process working directory). When
unset, the server looks for `.gitlab-mcp-mask.json` in that directory. Missing
default files are allowed and only the built-in rules are used. If this variable
is explicitly set, its file must exist; a missing or invalid file fails startup
so a bad mount cannot silently disable custom rules.

The file may also contain a version 2 managed-policy reference:

```json
{ "version": 2, "mode": "managed", "policyGroup": "team-default" }
```

Managed references require `GITLAB_MASKING_POLICY_FILE`. They contain no rules;
the server validates the requested group against its protected policy file.
The repository includes `.gitlab-mcp-managed-policy.example.json` as a server
policy-file template.

### `GITLAB_MASKING_POLICY_FILE`

Optional path to a server-owned JSON file defining managed policy groups and
GitLab instance/project bindings. This is intended for HTTP deployments and
must not be readable or writable by the Agent. When configured, a request for a
bound project uses the server-selected policy group. An unbound or project-less
request is rejected by default, so a failed policy lookup cannot return an
unmasked response.

Managed bindings currently use numeric GitLab project IDs. A project path such
as `group/project` is rejected. For tools that declare more than one project
field, every referenced project must be bound to the same policy group. The
server ignores undeclared `project_id` fields, preventing a global tool from
selecting an unrelated policy. Project-less tools can use built-in rules only
when `unboundProjectBehavior` is explicitly set to `builtin`; custom managed
rules are never selected for them.

Omitted project filters on global queries (such as `list_issues`,
`list_merge_requests`, and `list_todos`) do not select the configured default
project's policy. A default project is included only when the tool handler
actually uses it, including strict project-scoped queries. Tool discovery
remains available with built-in masking even when project-less queries are denied.

### `GITLAB_MASKING_WORKSPACE_DIR`

Optional directory used to resolve the masking configuration. This does not
change the process working directory. For local stdio use, set it to the
workspace directory when the MCP client does not set the server process cwd.

The config file supports `keyword` rules for literal replacements and `regex`
rules for pattern replacements. See `.gitlab-mcp-mask.example.json` in the
repository. When masking is enabled, built-in rules cover GitLab token prefixes
`glpat-`, `glrt-`, `glptt-`, `gldt-`, `glcbt-`, `glsoat-`, `gloas-`,
`glagent-`, `glft-`, and `glimt-`, plus IPv4 and IPv6; each can be disabled or given a custom replacement under
`builtins`. Rules are loaded at startup; invalid configured files fail startup.

Overlapping matches mask their entire combined interval, using the replacement
of the earliest match (the longest match wins when start positions are equal).
Replacement text is not matched again.

### Text-response boundary

Masking applies to MCP tool text blocks, JSON encoded in text blocks,
`structuredContent`, and returned error messages. It is applied in stdio, SSE,
and Streamable HTTP modes, including stateless HTTP requests.

Plain text outputs preserve their formatting. For JSON text responses, only
string values are rewritten; numeric values and JSON formatting are preserved.

This release does not inspect files returned through download URLs, local files,
image or other binary content, or base64-encoded payloads. Treat those outputs
as outside the masking boundary.

## Authentication

### `GITLAB_PERSONAL_ACCESS_TOKEN`

Default static GitLab Personal Access Token used in standard mode.

A non-empty value overrides `GITLAB_PERSONAL_ACCESS_TOKEN_FILE`.

### `GITLAB_PERSONAL_ACCESS_TOKEN_FILE`

Optional path to a file that holds the personal access token.

The server reads the file once during startup. It trims leading and trailing whitespace, including newlines. It does not read the file again on later requests.

If `GITLAB_PERSONAL_ACCESS_TOKEN` or `--token` is non-empty, that inline value wins. The server ignores this file and writes a warning to stderr. It does not open the file.

If the inline value is empty and this variable is set, startup stops when the file is missing, cannot be read, or is empty after trim. The error includes the path and a cause code such as `ENOENT`, `EACCES`, or `EMPTY`. The error does not include the file contents.

This variable only fills the personal access token. It does not change the precedence of `GITLAB_JOB_TOKEN`, OAuth, `GITLAB_AUTH_COOKIE_PATH`, or remote authorization.

### `GITLAB_IS_OLD`

Optional. Set to `true` (or `--is-old=true`) to send Personal Access Tokens as
`Private-Token` instead of `Authorization: Bearer`. Use this for older GitLab
instances that do not accept Bearer PAT authentication. OAuth tokens still use
`Authorization: Bearer`.

> **Note:** With `GITLAB_IS_OLD=true`, ordinary API requests send the PAT in
> `Private-Token` and follow redirects without the download path's credential
> filtering. A cross-origin redirect from the configured GitLab server can
> therefore expose the PAT. Prefer Bearer auth when your GitLab version
> supports it.

### `GITLAB_JOB_TOKEN`

Optional GitLab CI job token.

### `GITLAB_AUTH_COOKIE_PATH`

Optional Netscape cookie file path for cookie-based authentication.

### `GITLAB_USE_OAUTH`

Set to `true` to enable local browser-based OAuth2 authentication.

The token is acquired lazily on the first tool call (not at startup). If no
stored token exists, the browser opens then; transient refresh failures fail
that call instead of opening a browser.

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

- Only `initialize`, `notifications/initialized`, `tools/list`, and `server/discover` may proceed without auth.
- `tools/call` and all GitLab API access still require request auth headers.
- This is a compatibility pass-through for clients that send `server/discover`; it does not indicate MCP v2 support.
- Tool names and schemas can reveal enabled server capabilities; enable this only when that metadata is safe to expose.

### `SESSION_TIMEOUT_SECONDS`

Per-session auth timeout in seconds when using remote authorization. The SSE
transport also closes connections that receive no `POST /messages` request for this
long.

Default:

- `3600`

### `GITLAB_MCP_OAUTH`

Enables the server-side MCP OAuth proxy mode for remote MCP clients.

Dynamic Client Registration (`POST /register`) is rate-limited per client IP;
tune with `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR` (default `20`/hour).

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

In callback proxy mode the server only accepts client callback URLs listed in
`GITLAB_OAUTH_ALLOWED_REDIRECT_URIS`, and shows a consent page before it sends
the browser to GitLab. See below.

### `GITLAB_OAUTH_ALLOWED_REDIRECT_URIS`

Comma-separated list of client callback URLs that callback proxy mode
(`GITLAB_OAUTH_CALLBACK_PROXY=true`) will send authorization codes to. Dynamic
Client Registration with any other `redirect_uris` fails with
`invalid_redirect_uri`, and `/authorize` refuses them with a 400.

Default (when unset or empty):

- `https://claude.ai/api/mcp/auth_callback`
- `https://claude.com/api/mcp/auth_callback`
- `https://chatgpt.com/connector_platform_oauth_redirect`
- `https://chatgpt.com/connector/oauth/*`
- `cursor://anysphere.cursor-mcp/oauth/callback`
- `http://localhost/*`, `http://127.0.0.1/*`, `http://[::1]/*`

Entry forms:

- An exact URL, e.g. `https://mcp.example.com/oauth/callback`.
- A prefix ending in `/*`, e.g. `https://mcp.example.com/oauth/*`. Scheme and
  host must match exactly; the port must match too, except for loopback hosts
  (`localhost`, `127.0.0.1`, `[::1]`), where any port is accepted.
- `defaults` expands to the default list, so
  `defaults,https://mcp.example.com/cb` keeps the built-in entries and adds one.
- `*` accepts any callback URL. This restores the old behavior and logs a
  warning at startup; the consent page is still shown.

An invalid entry (for example a wildcard in the host) stops the server at
startup with an error naming this variable.

**Consent page.** Before redirecting to GitLab, the server shows a page with the
client name and where the browser will be sent afterwards, with Approve and Deny
buttons. Approval is remembered in a signed cookie for 30 days per client and
callback URL. With `OAUTH_STATELESS_MODE=true` the signing key is derived from
`OAUTH_STATELESS_SECRET`, so approvals are valid on every pod (rotating the secret
asks users again). Without stateless mode the key is random per process and users
are asked again after a restart.

### `MCP_SERVER_URL`

Public HTTPS MCP server base URL required for MCP OAuth mode.

### `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL`

Set to `true` to allow a non-HTTPS `MCP_SERVER_URL` when `GITLAB_MCP_OAUTH=true`
and the hostname is not `localhost` or `127.0.0.1`.

`http://localhost` and `http://127.0.0.1` are already accepted without this flag.
Use it only for local HTTP development on another host. There is no CLI flag;
the server reads this name from the environment directly.

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
to use the server. This applies to every credential the server accepts: OAuth
access tokens (including tokens issued by other GitLab OAuth applications),
`Private-Token` headers, and stateless session ids.

Requests from users who are not members of any matching group are denied:

- Authorization code exchange (`POST /token`): fails with an `Access denied` error.
- Token refresh: fails with `invalid_grant`; no new tokens are returned.
- `/mcp` with an OAuth Bearer token: `403` with
  `WWW-Authenticate: Bearer error="insufficient_scope"`.
- `/mcp` with a `Private-Token` header or a stateless session id: `403`.

Requires `GITLAB_MCP_OAUTH=true`.

> **Deprecation notice:** The old name `GITLAB_ALLOWED_GROUPS` is still accepted but is
> deprecated (removed in next major (v3.0.0)). Migrate to `GITLAB_OAUTH_ALLOWED_GROUPS`.

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
- Membership is checked at token issuance, on token refresh, and on every
  `/mcp` request. Results (member or not) are cached in memory per token for
  5 minutes in each server process, so removing a user from the allowed groups
  takes effect within 5 minutes, including for existing sessions.
- The groups lookup uses the caller's token. If GitLab rejects that lookup
  (for example because the token lacks a usable scope), access is denied. If
  GitLab is unavailable (`5xx` or `429`), the request fails (`500` for OAuth
  tokens, `503` for header auth) and the result is not cached.
- `JOB-TOKEN` header authentication is rejected with `403` while this is set,
  because a CI job token cannot list the user's groups. Use OAuth or a
  `Private-Token` header from CI jobs instead.
- No additional service account credentials are needed.
- Leave unset to allow any authenticated GitLab user (default behaviour).

### `OAUTH_DISABLE_REFRESH_TOKEN`

Set to `true` to make users authorize in the browser again each time their
GitLab access token expires, instead of letting the MCP client renew the token
silently with a refresh token. Default `false`: refresh works as before. CLI
flag: `--oauth-disable-refresh-token`.

Requires `GITLAB_MCP_OAUTH=true`. It applies to every MCP OAuth proxy mode:
passthrough and callback proxy (`GITLAB_OAUTH_CALLBACK_PROXY=true`), with or
without `OAUTH_STATELESS_MODE`. It does not affect `GITLAB_USE_OAUTH` (local
OAuth) or `REMOTE_AUTHORIZATION`. The flag is a re-authorization policy for
standard MCP clients, not a security boundary; see
[What the flag cannot enforce](#what-the-flag-cannot-enforce).

When enabled:

- `POST /token` (authorization code grant) returns GitLab's `access_token`,
  `token_type`, and `expires_in` without `refresh_token`.
- `POST /token` with `grant_type=refresh_token` fails with `400 invalid_grant`
  and GitLab is not called. Refresh tokens issued before the flag was turned on
  are rejected the same way when they are sent to this server. Clients that
  discard their stored tokens on `invalid_grant` (the MCP TypeScript SDK does)
  then start a new authorization.
- `/.well-known/oauth-authorization-server` lists only `authorization_code` in
  `grant_types_supported`.
- Dynamic client registration (`POST /register`) responses drop
  `refresh_token` from `grant_types` (`authorization_code` when nothing else
  was requested).
- One line is logged at startup. Token values are never logged.

When users have to re-authorize: when the GitLab access token expires
(`expires_in`; GitLab OAuth access tokens are valid for 2 hours). The next
`/mcp` request with the expired token gets `401`, and the client opens the
browser authorization again. `OAUTH_STATELESS_SESSION_TTL_SECONDS` and
`SESSION_TIMEOUT_SECONDS` do not set this interval: after a session expires,
the client opens a new session with its access token, without a prompt, as
long as that token is still valid.

Notes:

- GitLab decides whether its own Authorize page is shown again. It can approve
  the request without a click, for example for applications an administrator
  marked as trusted. The user always needs a signed-in GitLab browser session.
- In callback proxy mode the MCP server's consent page is remembered for 30
  days (see `GITLAB_OAUTH_ALLOWED_REDIRECT_URIS`), so it is not shown on every
  re-authorization.
- In stateless mode, requests that carry only the `Mcp-Session-Id` (no
  `Authorization` header) skip the bearer check. For a client that does this,
  an expired token shows up as GitLab `401` errors in tool results until it
  sends its Bearer token again. MCP SDK clients send the
  Bearer token on every request.

#### What the flag cannot enforce

The flag controls only what this server returns and accepts at `/token`. It
does not revoke anything at GitLab, and a client can call GitLab's
`/oauth/token` directly with the public application ID. This server accepts
access tokens obtained that way.

- Refresh tokens that GitLab issued before the flag was turned on stay valid at
  GitLab. To cut them off, revoke the application in GitLab under
  **User Settings → Applications → Authorized applications → Revoke** (see
  [Revoking Access](../auth/oauth-setup.md#revoking-access)).
- In passthrough mode (`GITLAB_OAUTH_CALLBACK_PROXY` unset) the client holds
  the PKCE verifier, and GitLab sends the authorization code to the client's
  own redirect URI. The client can redeem that code at GitLab itself and get a
  refresh token on every authorization, with or without `OAUTH_STATELESS_MODE`.
  In callback proxy mode (`GITLAB_OAUTH_CALLBACK_PROXY=true`) the server uses
  its own PKCE verifier and receives the GitLab code at `/callback`, so an MCP
  client that follows this server's flow never gets a GitLab refresh token.
- In every mode the GitLab application is public, so a signed-in user can run
  their own PKCE flow against it with one of its redirect URIs (in callback
  proxy mode, this server's `/callback`) and redeem the code at GitLab. Treat
  the flag as a re-authorization policy for standard MCP clients, not a
  security boundary.

### `ENABLE_DYNAMIC_API_URL`

Set to `true` to allow the GitLab API URL to be supplied per request.

Notes:

- Requires `REMOTE_AUTHORIZATION=true`
- Uses the `X-GitLab-API-URL` request header in HTTP mode
- The header URL must use an allowed host: any host in `GITLAB_API_URL`, plus any host in `GITLAB_ALLOWED_HOSTS`

### `ENABLE_DYNAMIC_PROJECT_SCOPE`

Set to `true` to allow a caller to narrow its own project allowlist per session
via the `X-GitLab-Allowed-Project-Ids` request header (comma-separated project
IDs or full paths).

Notes:

- Requires `REMOTE_AUTHORIZATION=true`
- The header can only **narrow**, never widen. When `GITLAB_ALLOWED_PROJECT_IDS`
  is set, every requested id must appear in it; a request naming anything outside
  it is rejected with `401` rather than silently narrowed to the intersection.
  The comparison is textual, so header entries must match the configured entries
  verbatim — a numeric id does not match a path entry for the same project.
- When `GITLAB_ALLOWED_PROJECT_IDS` is unset, the header narrows from "every
  project the token can reach" to the listed ones.
- The resulting scope behaves exactly like `GITLAB_ALLOWED_PROJECT_IDS` for that
  session: a single id acts as the default project, tools that cannot be project
  scoped (`execute_graphql`, `create_repository`, `create_group`,
  `fork_repository`, the group variable and dependency proxy tools) are refused,
  `group:<id-or-path>` targets are refused, and `gitlab_api_request` accepts only
  `/projects/:id` paths for an allowed project.
- The scope is fixed for the session. A later request without the header keeps
  it; a later request with a different value (wider or narrower) is rejected with
  `401`. This also holds when the request carries a new token. Re-initialize the
  session to change the scope. A session started without the header can be
  narrowed by a later request that sends it.
- In stateless mode the scope is sealed into the `Mcp-Session-Id` alongside the
  token, so a caller cannot widen it by editing the sid.
- The scope is only as trustworthy as the caller. This is intended for
  deployments where one trusted process (an agent gateway, a chat bot with its
  own per-room ACLs) fans out to several logical tenants and wants each tool call
  bounded to that tenant's project — not as a defence against a hostile client.

Example:

```text
X-GitLab-Allowed-Project-Ids: 42
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

### `ENABLE_STRICT_PROJECT_SCOPE`

Set to `true` to close the discovery gaps a project allowlist
(`GITLAB_ALLOWED_PROJECT_IDS`, or the session scope under
`ENABLE_DYNAMIC_PROJECT_SCOPE`) leaves open. Without this flag, the allowlist
only restricts which projects tools may operate on — listings and searches
still return everything the token can see.

While an allowlist is in effect, strict scope:

- filters `list_projects`, `list_group_projects`, and `search_repositories`
  results down to the allowlist (`count` and `total_pages` deliberately keep
  reflecting the unfiltered GitLab totals so pagination still covers every
  page; callers can infer how many upstream matches exist, but never see them)
- routes `list_issues` and `list_merge_requests` without a `project_id` to the
  allowed project instead of the instance-wide endpoint (a multi-project
  allowlist requires an explicit `project_id`)
- refuses instance-wide and group-wide tools that cannot be limited to allowed
  projects: `search_code`, `search_group_code`, `list_events`, the todo tools,
  group webhooks, and the group merge request, member, wiki, milestone, and
  iteration tools

### `GITLAB_ALLOWED_HOSTS`

Comma-separated additional hosts or GitLab base/API URLs allowed for
`X-GitLab-API-URL` when `ENABLE_DYNAMIC_API_URL=true`. This is only for hosts
beyond those already listed in `GITLAB_API_URL`; do not repeat `GITLAB_API_URL`
hosts here. Examples: `gitlab.example.com,https://gitlab.company.com:8443/api/v4`.

Hosts listed here (and in `GITLAB_API_URL`) are also trusted as redirect targets for
downloads — release assets, job artifacts, job artifact files and uploaded attachments.
Downloads follow upstream redirects only when the destination
is one of these hosts, or when it resolves to a public address; redirects to loopback,
private, link-local (for example `169.254.169.254`) or otherwise non-public addresses
are refused, including when they are written as an equivalent IPv6 form such as
`[::ffff:169.254.169.254]`. Self-hosted instances whose downloads redirect to another
host on a private network must list that host here.

Entries are matched exactly, including a non-default port: list `minio.internal:9000`
to trust that host and port. Requests keep the GitLab credential headers
(`Authorization`, `Private-Token`, `JOB-TOKEN`) only towards the host the request
started on and towards these trusted hosts; any other redirect target, such as object
storage, is fetched without them. Once they have been withheld they stay off every later
hop, including a hop to a trusted host or back to the host the request started on: the
caller reads that response as the downloaded file, so an authenticated request there
would be one the redirect target chose.

A redirect that would downgrade an HTTPS request to cleartext HTTP is refused outright,
for every target including a trusted host. An instance that serves release assets from a
plain-HTTP storage host on another hostname therefore has to serve that storage over
HTTPS, or not redirect to it.

The redirect target is resolved once for the address check and again when the
connection is opened, so a name whose DNS answer changes between the two lookups is not
covered by this validation. Pinning the connection to the checked address is not done
here because `undici` derives the TLS `servername` from the request host: rewriting the
request to an IP literal would drop hostname verification and bypass the per-origin
proxy routing used for `HTTP_PROXY` / `NO_PROXY`. Downloads to arbitrary public hosts
are allowed, which is required for GitLab object storage.

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
- **`/mcp` rate limiting** (Streamable HTTP): keys `POST` and `DELETE /mcp`
  requests by the real client IP instead of the reverse-proxy IP. Required for
  shared deployments behind a single egress IP so each user gets their own
  `MAX_REQUESTS_PER_MINUTE` bucket.

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
`/token` hop. Default `120` (2 min). Kept short because sealed codes cannot
enforce cross-pod one-time use; each pod also tracks in-flight and consumed
code hashes in a TTL-bound in-memory cache (no early LRU eviction; fail
closed when full).

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

This TTL does not make users re-authorize in GitLab: after a sid expires the
client opens a new session with its current access token, and refresh tokens
keep that token renewed. To make MCP clients authorize in the browser again
when the GitLab access token expires, set
[`OAUTH_DISABLE_REFRESH_TOKEN`](#oauth_disable_refresh_token) (see
[What the flag cannot enforce](#what-the-flag-cannot-enforce)).

## Core GitLab Configuration

### `GITLAB_API_URL`

GitLab API base URL.

Do not put credentials in the URL (`https://user:pass@host`), whether it comes from `GITLAB_API_URL` or `--api-url`. They are ignored with a startup warning; use your deployment's token or OAuth configuration to authenticate instead.

Each URL must use `http` or `https`; startup fails for any other value, such as `localhost:8080`, without printing it.

The value can also be a comma-separated list of URLs. If a URL still has a password, a comma in the password must be written as `%2C`. A literal comma can be read as a list separator: `https://alice:123,https:word@host` becomes the two URLs `https://alice:123` and `https:word@host`, requests go to the wrong host, and the startup log lists `<invalid>, host`. The startup log prints only the host name of each URL, so URLs that differ only in port or path look the same there. An entry that does not parse, has no host, or has an `@` in its path, query, or fragment shows as `<invalid>`; this includes a valid URL such as `https://gitlab.example.com/gl@team`, which requests still use as it is. A password ends at an `@`, so every URL listed before the last URL that has an `@` shows as `<invalid>` too: `http://alice:12,http://sec:34,http://tail@gitlab.example` logs `<invalid>, <invalid>, gitlab.example`, because `sec` is part of the password. This also hides a URL of its own listed before a URL with credentials (`https://a.example,https://user:pass@b.example` logs `<invalid>, b.example`). Only the log changes; requests still use each URL as it is split. Taking the credentials out of the URL, and authenticating with a token or OAuth instead, shows the host names again, except for a URL that still has an `@` in its path, query, or fragment and every URL listed before it: `https://a.example,https://gitlab.example.com/gl@team` logs `<invalid>, <invalid>`. If OAuth is on and the first URL is cleartext `http://`, the error names only that URL's host name, which can show as `<invalid>` under the same rules: for `http://alice:12,http://sec:34,http://tail@gitlab.example` it names `http://<invalid>`.

Default:

- `https://gitlab.com/api/v4`

### `GITLAB_GRAPHQL_URL`

Optional GraphQL endpoint. When unset, the server derives it from `GITLAB_API_URL`:
the origin, plus any path prefix before `/api/v4`, plus `/api/graphql`.

There is no CLI flag; the server reads this name from the environment directly.

### `GITLAB_REPO_FILE_ENCODING`

Default content encoding for `create_or_update_file` and `push_files` when a call
omits `encoding`.

- `text` (default) — any value other than `base64` is treated as text
- `base64` — file content is already base64-encoded

CLI: `--repo-file-encoding`

### `GITLAB_COMMIT_FILES_PER_PAGE`

Stop threshold for `get_commit_diff` when `full_diff` is set. Pagination stops
when a page returns fewer diffs than this value. Default `20`, matching GitLab's
default commit-diff page size. The request does not send `per_page`.

There is no CLI flag; the server reads this name from the environment directly.

### `GITLAB_PROJECT_ID`

Optional default project ID.

### `GITLAB_ALLOWED_PROJECT_IDS`

Optional comma-separated allowlist of project IDs.

Behavior:

- One project ID: acts like a default locked project
- Multiple project IDs: restricts access to those projects only
- `gitlab_api_request` (opt-in `api` toolset) accepts only `/projects/:id` and
  `/projects/:id/...` paths for an allowed project and rejects every other path

This is process-level and fixed at startup. To let a caller narrow the scope
per session, see `ENABLE_DYNAMIC_PROJECT_SCOPE`.

### `GITLAB_READ_ONLY_MODE`

Set to `true` to expose only read-only tools.

> **Deprecation notice:** `GITLAB_READ_ONLY_MODE` and `--read-only=true` are deprecated
> (removed in next major (v3.0.0)).
> Use `GITLAB_PERMISSION_MODE=readonly` or `--permission-mode=readonly` instead.

When set to `true` it takes precedence over `GITLAB_PERMISSION_MODE`.

### `GITLAB_PERMISSION_MODE`

Permission level for the exposed tool surface. One of:

| Value      | Read | Create/Update | Delete/Teardown |
| ---------- | ---- | ------------- | --------------- |
| `readonly` | ✅   | ❌            | ❌              |
| `modify`   | ✅   | ✅            | ❌              |
| `full`     | ✅   | ✅            | ✅              |

Default: `full`

CLI: `--permission-mode`

Behavior:

- `readonly` matches the legacy `GITLAB_READ_ONLY_MODE=true` behavior (deprecated; removed in next major (v3.0.0))
- `modify` blocks delete and teardown tools: it hides all `delete_*` tools plus
  `erase_pipeline_job`, `purge_dependency_proxy_cache`, and the destructive teardown verbs
  `cancel_pipeline`, `cancel_pipeline_job`, `stop_environment`, `stop_stale_environments`,
  `unprotect_branch`, and `unprotect_tag` from `tools/list`, rejects them when called directly, and rejects
  `push_files` `delete`/`move` actions
- `modify` also rejects destructive mutations sent through `execute_graphql`: any top-level
  mutation field whose name contains a deletion verb (`delete`, `destroy`, `remove`, `prune`,
  `purge`, `erase`) or a teardown verb (`revoke`, `cancel`, `stop`, `terminate`, `unprotect`,
  `disable`, `deactivate`, `drop`, `unschedule`)
- `gitlab_api_request`, when the `api` toolset is explicitly enabled, stays listed in `readonly`
  and `modify`. The handler allows only `GET` in `readonly` and rejects `DELETE` in `modify`
- `download_attachment` and `download_job_artifacts` stay listed in `readonly`, but in stdio
  mode they never write to disk there: `download_attachment` returns images inline and rejects
  other files and any `local_path`, and `download_job_artifacts` is rejected
- Invalid values fail startup with an error
- `GITLAB_DENIED_TOOLS_REGEX` and the tool policy variables still apply on top

### `GITLAB_DISABLE_VERSION_CHECK`

Set to `true` to disable the startup update check.

By default the server queries the npm registry once at startup (3 second
timeout, fail-silent — it never blocks or breaks startup) and logs a notice to
stderr when a newer version than the one running is available. No data other
than the standard HTTP request to `registry.npmjs.org` is sent.

Set this in offline or air-gapped environments, or when you do not want the
server to make any outbound request beyond your GitLab instance.

### `GITLAB_DOWNLOAD_DIR`

Directory that `download_attachment` saves files under in stdio mode. Relative
values resolve against the server's working directory. `local_path` is a
subdirectory of this directory, not of the working directory.

Default:

- `.gitlab-mcp-downloads` (created on first use with a `.gitignore` that
  ignores everything in it)

`download_attachment` only creates new files here: it refuses to replace an
existing file, and rejects `local_path` segments and filenames that start with
a dot (`.git`, `.vscode`, `.envrc`). Point this outside your checkout (for
example `~/Downloads/gitlab-mcp`) if you do not want downloaded files inside
the project tree at all.

`download_job_artifacts` does not use this directory. It saves
`artifacts_job_<id>.zip` to `local_path` under the working directory, rejects
`local_path` segments that start with a dot, and replaces an earlier archive
of the same job.

In readonly mode (`GITLAB_PERMISSION_MODE=readonly` or
`GITLAB_READ_ONLY_MODE=true`) neither tool writes files: `download_attachment`
only returns images inline, and `download_job_artifacts` is rejected.

## Tool Exposure and Filtering

### `GITLAB_TOOL_PROFILE`

Optional initial tool list. Default `full` keeps today's default toolsets.

`slim` drops draft-note, emoji-reaction, label, CI catalog, and `create_group`
tools from the initial list. It does nothing when `GITLAB_TOOLSETS` is set.
`discover_tools` will not add the omitted tools back. Name a specific tool in
`GITLAB_TOOLS` to keep it. Invalid values fail startup.

CLI: `--tool-profile`

### `GITLAB_TOOLSETS`

Comma-separated list of toolset IDs to enable. If unset, the server exposes the lean `core` toolset plus the always-on `discover_tools` meta-tool.

For agent-specific tool surfaces, see
[Custom Agents and Multiple PAT Setup](../auth/custom-agent-multiple-pat.md).

Special values:

- `all` — enable every toolset except the explicit-only `api` toolset.
- `GITLAB_TOOLSETS=merge_requests,issues,repositories,branches,projects,labels,ci,groups,users` — restores the pre-lean default set.
- `api` — enable `gitlab_api_request`. This id is **not** included in `all`. `discover_tools`, `GITLAB_TOOLS=gitlab_api_request`, legacy `USE_*` flags, and `GITLAB_TOOL_PROFILE` do not enable it. CLI: `--toolsets=api` (same `--toolsets` flag as the other ids).

!!! danger "gitlab_api_request bypasses other restrictions"

    `gitlab_api_request` bypasses `GITLAB_ALLOWED_GROUPS` and other group restrictions, project allowlists, tool-level restrictions (`GITLAB_TOOLS`, `GITLAB_DENIED_TOOLS_REGEX` on other tools), and individual tool safety checks. The full token permission scope is exposed. Prompt injection in GitLab content can drive this tool. Operators who rely on these restrictions must NOT enable the `api` toolset.

    With `GITLAB_ALLOWED_PROJECT_IDS` or a session project scope (`ENABLE_DYNAMIC_PROJECT_SCOPE`), only `/projects/:id` and `/projects/:id/...` paths for an allowed project are accepted, on the first request and on every redirect hop that keeps the credentials. Every other path, such as `/search`, `/users`, `/groups/:id`, `/runners`, admin endpoints, and the `/projects` collection, is rejected. Body and query parameters that name another project (for example `target_project_id` or `from_project_id`) are not checked. `GITLAB_PROJECT_ID` and OAuth group allowlists (`GITLAB_OAUTH_ALLOWED_GROUPS` / `GITLAB_ALLOWED_GROUPS`, which decide who may use the server) are not enforced by this tool.

    When the toolset is enabled the server logs a startup warning. `GITLAB_PERMISSION_MODE=readonly` (and legacy `GITLAB_READ_ONLY_MODE=true`) still lists the tool but the handler allows only `GET`. `modify` rejects `DELETE`. `GITLAB_DENIED_TOOLS_REGEX` and `GITLAB_TOOL_POLICY_APPROVE` still apply to `gitlab_api_request` itself.

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

Comma-separated tool names to hide from `tools/list`. Hidden tools are not visible to the agent but remain callable if invoked directly, as long as they are otherwise enabled: their toolset is enabled (through `GITLAB_TOOLSETS` or `discover_tools`) or they are named in `GITLAB_TOOLS` or a legacy flag, and permission mode and `GITLAB_DENIED_TOOLS_REGEX` allow them. Hiding a tool does not enable it; a hidden tool that is not otherwise enabled is rejected like any other unavailable tool. Takes precedence over `GITLAB_TOOL_POLICY_APPROVE` when the same tool appears in both.

CLI: `--tool-policy-hidden`

Examples:

- `delete_issue,delete_wiki_page`

### `USE_GITLAB_WIKI`

> **Deprecated** (removed in next major (v3.0.0)). Legacy additive flag for wiki-related tools.
> Use `GITLAB_TOOLSETS=core,wiki` instead. If you already set `GITLAB_TOOLSETS`, append `wiki`
> to your existing list instead of replacing it.

### `USE_MILESTONE`

> **Deprecated** (removed in next major (v3.0.0)). Legacy additive flag for milestone-related tools.
> Use `GITLAB_TOOLSETS=core,milestones` instead. If you already set `GITLAB_TOOLSETS`, append
> `milestones` to your existing list instead of replacing it.

### `USE_PIPELINE`

> **Deprecated** (removed in next major (v3.0.0)). Legacy additive flag for pipeline-related tools.
> Use `GITLAB_TOOLSETS=core,pipelines` and `GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint`
> instead. Those two lint tools live in the `ci` toolset, not `pipelines`. If you already set
> `GITLAB_TOOLSETS`, append `pipelines` to your existing list instead of replacing it.
> If `GITLAB_TOOLS` is already set, append `validate_ci_lint,validate_project_ci_lint` instead of replacing that list.

> **Deprecation notice:** The `USE_*` flags are kept for backward compatibility only, cover
> just three toolsets, and will be removed in the next major (v3.0.0). Only `true` enables the
> extra tools. Any other value, including `false`, does not enable that toolset — remove the
> variable, and set the replacement above only if you want those tools in addition to `core`.
> Use `GITLAB_TOOLSETS` (include `core` so the default starter set stays enabled) and `GITLAB_TOOLS`
> (individual tools) instead. An explicit `GITLAB_TOOLSETS` list replaces the default toolsets;
> it does not merge.

## Logging

### `LOG_LEVEL`

Pino log level.

Values: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`

Default:

- `info`

### `LOG_FORMAT`

Controls log output format. When set to `json`, disables `pino-pretty` and
writes newline-delimited JSON to stderr. Useful for production deployments
where logs are ingested by a collector (Datadog, Loki, CloudWatch, etc.).

Values: `json` | _(any other value or unset uses `pino-pretty`)_

Default:

- _(unset — human-readable colored output via `pino-pretty`)_

Example:

```bash
LOG_FORMAT=json LOG_LEVEL=warn npm start
```

## Transport and Server Runtime

### `GITLAB_MCP_REQUEST_BODY_LIMIT`

Maximum encoded JSON request size accepted by Streamable HTTP and SSE transports.
The limit applies to the complete JSON-RPC request, including its envelope and all
arguments, rather than only to note text. Values use the syntax accepted by
Express, such as `512kb`, `10mb`, or a byte count.

Default:

- `10mb`

The default accommodates GitLab's 1,000,000-character note limit even when JSON
escaping or UTF-8 encoding makes the request several times larger than its
character count. Lower the value only when clients do not need large note, file,
or CI configuration payloads. Reverse proxies can impose a separate request-size
limit and must be configured independently. The larger parser is mounted only on
MCP message routes, after their transport-level request controls.

### `STREAMABLE_HTTP`

Set to `true` to run the Streamable HTTP transport.

When using server-side GitLab credentials (`GITLAB_PERSONAL_ACCESS_TOKEN`,
`GITLAB_JOB_TOKEN`, `GITLAB_AUTH_COOKIE_PATH`, or `GITLAB_USE_OAUTH`), also set
one MCP-layer auth mode: `REMOTE_AUTHORIZATION=true`, `GITLAB_MCP_OAUTH=true`,
or `STREAMABLE_HTTP_AUTH_TOKEN`.

Streamable HTTP allows `/mcp` requests when the `Host` header is a loopback
host on any port (`127.0.0.1`, `localhost`, `[::1]`), matches `MCP_SERVER_URL`,
matches the `HOST`:`PORT` the server binds to, or is listed in
`MCP_ALLOWED_HOSTS`. When an `Origin` header is present, it must be a loopback
origin, match `MCP_SERVER_URL`, match the bound `http://HOST:PORT` origin, or be
listed in `MCP_ALLOWED_ORIGINS`.

> **Upgrade note:** deployments reached through a non-loopback hostname or IP
> (for example an internal DNS name or LAN IP) must set `MCP_SERVER_URL` or
> `MCP_ALLOWED_HOSTS`, otherwise `/mcp` requests are rejected with `403`.

### `STREAMABLE_HTTP_AUTH_TOKEN`

Bearer token required on `/mcp` when Streamable HTTP uses server-side GitLab
credentials without `REMOTE_AUTHORIZATION` or `GITLAB_MCP_OAUTH`.

### `MCP_ALLOWED_HOSTS`

Comma-separated extra allowed `Host` header values for `/mcp`.
Use this when the public host clients send differs from `MCP_SERVER_URL`.
Values may be bare hosts (`mcp.example.com`) or host:port pairs.

### `MCP_ALLOWED_ORIGINS`

Comma-separated extra allowed browser origins for `/mcp`, for example
`https://mcp.example.com`.

### `SSE`

Set to `true` to run the legacy SSE transport.

Notes:

- Not compatible with `REMOTE_AUTHORIZATION=true`
- Startup requires `SSE_AUTH_TOKEN` unless you explicitly set `SSE_DANGEROUSLY_ALLOW_UNAUTHENTICATED_REMOTE=true`

### `SSE_AUTH_TOKEN`

Bearer token required for `/sse` and `/messages`.
Use this for any SSE deployment.

When SSE runs behind a reverse proxy on a different public hostname, also set
`MCP_SERVER_URL` to the external URL or enable `MCP_TRUST_PROXY=true` so
forwarded `Host` / `Origin` headers from the proxy are accepted.

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

### `MCP_SERVER_NAME`

Name this server advertises to MCP clients during the `initialize` handshake
(`serverInfo.name`). Set a distinct value to tell multiple GitLab MCP
deployments apart in client UIs and logs.

Default:

- `zereight-gitlab-mcp-server`

### `MAX_REQUESTS_PER_MINUTE`

Maximum requests allowed per rolling 60-second window. Applies to Streamable HTTP
and SSE remote deployments. Valid range: `1`–`1000`.

Default:

- `60`

This single value is reused in four places (whichever limit is hit first wins):

| Layer              | Key            | Routes                                                                        |
| ------------------ | -------------- | ----------------------------------------------------------------------------- |
| Express middleware | Client IP      | `POST` / `DELETE /mcp`                                                        |
| Session handler    | MCP session ID | Existing sessions when `REMOTE_AUTHORIZATION=true` or `GITLAB_MCP_OAUTH=true` |
| Download proxy     | Auth token     | `GET /downloads/*`                                                            |
| SSE connections    | Client IP      | New `GET /sse` connections (rejected with `429`)                              |

When `MCP_TRUST_PROXY` is unset behind a reverse proxy, all clients share one IP
bucket and the per-IP limit becomes the bottleneck for the whole deployment.

**Shared deployment starting point:** `MCP_TRUST_PROXY=true` with
`MAX_REQUESTS_PER_MINUTE=300` (raise if `/metrics` shows
`rejectedByRateLimit` growth). This limits MCP server abuse; GitLab API rate
limits are separate upstream constraints.

Monitor rejections via `/metrics` → `rejectedByRateLimit` or
`gitlab_mcp_requests_rejected_total{reason="rate_limit"}`.

### `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR`

Maximum client registration (`POST /register`) requests allowed per client IP
per rolling 1-hour window. Applies when `GITLAB_MCP_OAUTH=true`.

Valid range: `1`-`1000`.

Default:

- `20`

Raise this if legitimate MCP clients are being throttled during dynamic client
registration (for example multiple IDE windows each calling `POST /register`), or
lower it to harden against registration abuse.

Counts apply **per server process** (in-memory `express-rate-limit` store). In
multi-instance deployments each replica maintains its own counter; use
ingress-level limits when you need a strict global cap.

Separate from `MAX_REQUESTS_PER_MINUTE` (`/mcp` and other OAuth routes) and
from GitLab upstream API rate limits.

### `MAX_SESSIONS`

Maximum concurrent MCP sessions on a single server instance (Streamable HTTP /
remote authorization / MCP OAuth / SSE).

Default:

- `1000`

When the limit is reached, new session creation is rejected until an existing
session expires or is closed. For the SSE transport this applies to new
`GET /sse` connections, which are additionally rate-limited per client IP
(`MAX_REQUESTS_PER_MINUTE`) and closed after `SESSION_TIMEOUT_SECONDS` without a
`POST /messages` request.

At capacity `/health` reports `503` with `status: "degraded"` on both remote
transports, so orchestrator health checks stop routing new work to the instance.
Use `/health` as a readiness probe, not a liveness probe — a liveness restart at
capacity drops every open session.

## Download tokens

Remote downloads mint an encrypted token. These settings are read from the
environment directly (no CLI flags).

### `DOWNLOAD_TOKEN_SECRET`

Shared secret for download-token encryption. When set, the key is
`SHA-256(secret)` so every replica can open tokens issued by the others.
When unset, each process generates a random key; tokens then fail after a
restart or on another pod.

Set this for any multi-pod deployment that returns download URLs.

### `DOWNLOAD_TOKEN_TTL`

Download-token lifetime in seconds. Default `300`. `parseInt` takes the
numeric prefix (`12abc` becomes `12`). Values with no numeric prefix, or
values `<= 0`, fall back to `300`.

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

- `GITLAB_PERSONAL_ACCESS_TOKEN` or `GITLAB_PERSONAL_ACCESS_TOKEN_FILE`
- `GITLAB_API_URL`

## Local OAuth setup

- `GITLAB_USE_OAUTH=true`
- `GITLAB_OAUTH_CLIENT_ID`
- `GITLAB_OAUTH_REDIRECT_URI`
- `GITLAB_API_URL`

## Remote shared deployment

- `STREAMABLE_HTTP=true`
- `REMOTE_AUTHORIZATION=true` or `GITLAB_MCP_OAUTH=true`
- `MCP_TRUST_PROXY=true` (when behind a reverse proxy)
- `MAX_REQUESTS_PER_MINUTE=300` (tune from metrics)
- `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR` (when `GITLAB_MCP_OAUTH=true`; raise if DCR `/register` returns 429)
- `MCP_SERVER_URL` or `MCP_ALLOWED_HOSTS` (non-loopback public host)
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
