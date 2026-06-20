# GitLab MCP Server

[English](./README.md) | [한국어](./README.ko.md) | [简体中文](./README.zh-CN.md)

📖 **[Documentation →](https://zereight.github.io/gitlab-mcp/)** Setup guides, environment variables, and the full tool reference live on the hosted docs site.

> **New Feature**: Dynamic GitLab API URL support with connection pooling! See [Dynamic API URL Documentation](docs/configuration/dynamic-api-url.md) for details.

[![Star History Chart](https://api.star-history.com/svg?repos=zereight/gitlab-mcp&type=Date)](https://www.star-history.com/#zereight/gitlab-mcp&Date)

## @zereight/mcp-gitlab

A comprehensive GitLab MCP server for AI clients. Manage projects, merge requests, issues, pipelines, wiki, releases, tags, milestones, and more through stdio, SSE, and Streamable HTTP.

Supports PAT, OAuth, read-only mode, dynamic API URLs, and remote authorization for VS Code, Claude, Cursor, Copilot, and other MCP clients.

### Why use this GitLab MCP?

- Broad GitLab coverage — projects, repository browsing, merge requests, issues, pipelines, wiki, releases, tags, labels, milestones, and more
- Flexible auth — Personal Access Token, local OAuth2 browser flow, MCP OAuth proxy, and per-request remote authorization
- Multiple transports — stdio for local clients, SSE for legacy clients, and Streamable HTTP for modern remote deployments
- Client-friendly setup — examples for Claude Code, Codex, Antigravity, OpenCode, Copilot, Cline, Roo Code, Cursor, Kilo Code, and Amp Code
- Self-hosted ready — works with custom GitLab instances, proxy settings, and dynamic API URL routing

Quick start: choose either Personal Access Token or OAuth2 setup below and use `@zereight/mcp-gitlab` in your MCP client configuration.

### Client Setup Guides

- [Claude Code Setup Guide](./docs/clients/claude-code.md)
- [VS Code Setup Guide](./docs/clients/vscode.md)
- [GitHub Copilot Setup Guide](./docs/clients/copilot.md)
- [Codex Setup Guide](./docs/clients/codex.md)
- [Cursor Setup Guide](./docs/clients/cursor.md)
- [JSON-Based MCP Clients Setup Guide](./docs/clients/json-clients.md) - for Factory AI Droid, OpenClaw, and OpenCode style clients
- [OAuth2 Authentication Setup Guide](./docs/auth/oauth-setup.md)
- [Environment Variables Reference](./docs/configuration/environment-variables.md)
- [Stateless Mode — Multi-Pod HPA](./docs/configuration/stateless-mode.md)
- [Custom Agents and Multiple PAT Setup](./docs/auth/custom-agent-multiple-pat.md)

## Usage

### Setup Overview

#### Authentication Methods

The server supports four authentication methods:

**For local/desktop use** (most common):

1. **Personal Access Token** (`GITLAB_PERSONAL_ACCESS_TOKEN`) — simplest setup
2. **OAuth2 — Local Browser** (`GITLAB_USE_OAUTH`) — recommended for better security

**For server/remote deployments**:

3. **OAuth2 — MCP Proxy** (`GITLAB_MCP_OAUTH`) — for remote MCP clients such as Claude.ai
4. **Remote Authorization** (`REMOTE_AUTHORIZATION`) — multi-user deployments where each caller provides their own token

#### Quick setup paths

- **Claude Code**: see [Claude Code Setup Guide](./docs/clients/claude-code.md)
- **VS Code**: see [VS Code Setup Guide](./docs/clients/vscode.md)
- **GitHub Copilot**: see [GitHub Copilot Setup Guide](./docs/clients/copilot.md)
- **Codex**: see [Codex Setup Guide](./docs/clients/codex.md)
- **Cursor**: see [Cursor Setup Guide](./docs/clients/cursor.md)
- **Factory AI Droid / OpenClaw / OpenCode style clients**: see [JSON-Based MCP Clients Setup Guide](./docs/clients/json-clients.md)
- **OAuth browser flow details**: see [OAuth2 Authentication Setup Guide](./docs/auth/oauth-setup.md)

For the simplest local setup, start with a Personal Access Token. For browser-based local auth, use OAuth2. For remote or multi-user deployments, continue to the MCP OAuth and Remote Authorization sections later in this README.

#### Using CLI Arguments (for clients with env var issues)

Some MCP clients (like GitHub Copilot CLI) have issues with environment variables. Use CLI arguments instead:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": [
        "-y",
        "@zereight/mcp-gitlab",
        "--token=YOUR_GITLAB_TOKEN",
        "--api-url=https://gitlab.com/api/v4"
      ],
      "tools": ["*"]
    }
  }
}
```

**Available CLI arguments:**

- `--token` - GitLab Personal Access Token (replaces `GITLAB_PERSONAL_ACCESS_TOKEN`)
- `--api-url` - GitLab API URL (replaces `GITLAB_API_URL`)
- `--read-only=true` - Enable read-only mode (replaces `GITLAB_READ_ONLY_MODE`)
- `--use-wiki=true` - Enable wiki API (replaces `USE_GITLAB_WIKI`)
- `--use-milestone=true` - Enable milestone API (replaces `USE_MILESTONE`)
- `--use-pipeline=true` - Enable pipeline API (replaces `USE_PIPELINE`)

CLI arguments take precedence over environment variables.

- sse

```shell
docker run -i --rm \
  -e HOST=0.0.0.0 \
  -e GITLAB_PERSONAL_ACCESS_TOKEN=your_gitlab_token \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_READ_ONLY_MODE=true \
  -e USE_GITLAB_WIKI=true \
  -e USE_MILESTONE=true \
  -e USE_PIPELINE=true \
  -e SSE=true \
  -p 3333:3002 \
  zereight050/gitlab-mcp
```

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "sse",
      "url": "http://localhost:3333/sse"
    }
  }
}
```

- streamable-http

```shell
docker run -i --rm \
  -e HOST=0.0.0.0 \
  -e REMOTE_AUTHORIZATION=true \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_READ_ONLY_MODE=true \
  -e USE_GITLAB_WIKI=true \
  -e USE_MILESTONE=true \
  -e USE_PIPELINE=true \
  -e STREAMABLE_HTTP=true \
  -p 3333:3002 \
  zereight050/gitlab-mcp
```

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "streamable-http",
      "url": "http://localhost:3333/mcp",
      "headers": {
        "Authorization": "Bearer glpat-..."
      }
    }
  }
}
```

#### Using MCP OAuth Proxy (`GITLAB_MCP_OAUTH`)

> **For server/remote deployments only.** This mode requires the MCP server to be deployed with a publicly accessible HTTPS URL. For local/desktop use, see `GITLAB_USE_OAUTH` above.

For remote MCP clients that support the MCP OAuth specification (e.g. Claude.ai).
The server acts as a full OAuth 2.0 authorization server — unauthenticated requests
receive a `401 + WWW-Authenticate` response, which triggers the OAuth browser flow
automatically on the client side.

Remote MCP clients such as OpenCode, MCPJam, and Claude.ai can send their own
callback URL during authorization. If you cannot register every client callback
URL in GitLab, enable `GITLAB_OAUTH_CALLBACK_PROXY=true`. With callback proxy
mode, GitLab only needs one registered redirect URI: `{MCP_SERVER_URL}/callback`.

`GITLAB_OAUTH_REDIRECT_URI` is for local OAuth (`GITLAB_USE_OAUTH`) only. It does
not override remote MCP OAuth client callback URLs and should not be used to fix
remote `Unregistered redirect_uri` errors.

This variable exists because the local OAuth flow starts a browser on the same
machine as the MCP server and listens for the callback on a local HTTP server,
for example `http://127.0.0.1:8888/callback`.

Remote MCP OAuth is different. In `GITLAB_MCP_OAUTH=true` mode, the MCP client
provides its own callback URL during `/authorize`. `GITLAB_OAUTH_REDIRECT_URI`
does not replace that client-provided URL.

| Mode | Enable with | Callback variable | GitLab redirect URI |
| --- | --- | --- | --- |
| Local OAuth | `GITLAB_USE_OAUTH=true` | `GITLAB_OAUTH_REDIRECT_URI` | `http://127.0.0.1:8888/callback` or your local callback |
| Remote MCP OAuth | `GITLAB_MCP_OAUTH=true` | `GITLAB_OAUTH_CALLBACK_PROXY=true` | `{MCP_SERVER_URL}/callback` |

Use `GITLAB_OAUTH_REDIRECT_URI` only when the MCP server itself owns the local
browser callback. Use `GITLAB_OAUTH_CALLBACK_PROXY=true` when a remote MCP client
owns the callback URL.

**How it works**: You deploy this MCP server somewhere with a public HTTPS URL. MCP
clients connect to `{MCP_SERVER_URL}/mcp`. The server handles the OAuth 2.0 flow,
exchanging credentials with GitLab on behalf of the client.

**Prerequisites**:

1. A publicly accessible HTTPS server URL (`MCP_SERVER_URL`) — use [ngrok](https://ngrok.com) for local testing
2. A pre-registered GitLab OAuth application with `api` (or `read_api`) scopes
   — Go to `Admin area` → `Applications`, set Redirect URI to `{MCP_SERVER_URL}/callback`

| Environment Variable  | Required | Description                                                |
| --------------------- | -------- | ---------------------------------------------------------- |
| `GITLAB_MCP_OAUTH`    | ✅       | Set to `true` to enable                                    |
| `GITLAB_API_URL`      | ✅       | GitLab API base URL                                        |
| `GITLAB_OAUTH_APP_ID` | ✅       | GitLab OAuth Application ID                                |
| `MCP_SERVER_URL`      | ✅       | Public HTTPS URL of this MCP server                        |
| `STREAMABLE_HTTP`     | ✅       | Must be `true`                                             |
| `GITLAB_OAUTH_CALLBACK_PROXY` | optional | Set to `true` to use the MCP server's fixed `/callback` URL |
| `GITLAB_OAUTH_SCOPES` | optional | Comma-separated scopes (default: `api,read_api,read_user`) |
| `GITLAB_OAUTH_ALLOWED_GROUPS` | optional | Comma-separated group full paths — only members (and subgroup members) may obtain a token (replaces deprecated `GITLAB_ALLOWED_GROUPS`) |

When `STREAMABLE_HTTP=true`, server-side `GITLAB_PERSONAL_ACCESS_TOKEN` or `GITLAB_JOB_TOKEN` require `REMOTE_AUTHORIZATION=true` or `GITLAB_MCP_OAUTH=true`.

> **Troubleshooting `Unregistered redirect_uri`**
>
> Check the `redirect_uri` in the browser URL. If it points to a client callback
> such as `http://127.0.0.1:xxxxx/.../callback`, enable:
>
> ```env
> GITLAB_OAUTH_CALLBACK_PROXY=true
> ```
>
> Do not fix remote MCP OAuth by changing `GITLAB_OAUTH_REDIRECT_URI`. That
> variable is for local OAuth (`GITLAB_USE_OAUTH`) only.

```shell
docker run -i --rm \
  -e HOST=0.0.0.0 \
  -e GITLAB_MCP_OAUTH=true \
  -e GITLAB_OAUTH_CALLBACK_PROXY=true \
  -e STREAMABLE_HTTP=true \
  -e MCP_SERVER_URL=https://your-server.example.com \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_OAUTH_APP_ID=your_app_id \
  -p 3000:3002 \
  zereight050/gitlab-mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "http",
      "url": "https://your-server.example.com/mcp"
    }
  }
}
```

#### Using Remote Authorization (`REMOTE_AUTHORIZATION`)

> **For server/remote deployments only.** Each HTTP caller provides their own GitLab token directly in request headers — no OAuth flow involved.

For multi-user or multi-tenant deployments where each caller provides their own
GitLab token in the HTTP request header. No OAuth flow — the MCP server forwards
the token to GitLab on behalf of the caller.

**Header priority**: `Private-Token` > `JOB-TOKEN` > `Authorization: Bearer`

| Environment Variable     | Required | Description                                                |
| ------------------------ | -------- | ---------------------------------------------------------- |
| `REMOTE_AUTHORIZATION`   | ✅       | Set to `true` to enable                                    |
| `STREAMABLE_HTTP`        | ✅       | Must be `true`                                             |
| `ENABLE_DYNAMIC_API_URL` | optional | Allow per-request GitLab URL via `X-GitLab-API-URL` header |
| `GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY` | optional | Allow unauthenticated `tools/list` discovery only (tool calls still require auth) |
| `MCP_TRUST_PROXY`        | optional | Trust `Forwarded` / `X-Forwarded-*` headers behind a reverse proxy (download URLs, Express `req.ip`, OAuth rate limits) |

`GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY=true` is intended for MCP gateways
or admin UIs that need to inspect tool metadata before a user provides a GitLab
token. Leave it disabled unless the tool list is safe to expose in your deployment.

When `MCP_SERVER_URL` is not set, remote download URLs fall back to the local
server address. Set `MCP_TRUST_PROXY=true` only if the server is reachable through a
trusted reverse proxy and direct client access to the MCP server is blocked.
This enables Express `trust proxy` for Streamable HTTP and SSE, derives public
download URLs from `Forwarded` / `X-Forwarded-Proto` / `X-Forwarded-Host` /
`X-Forwarded-Prefix`, and keeps OAuth endpoint rate limiting working when
proxies send `X-Forwarded-For` with a client port (for example `1.2.3.4:5678`).
Existing OAuth+proxy deployments must set this explicitly after the flag was
introduced.

**Example request headers**:

```http
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

or using a Bearer token:

```http
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ `REMOTE_AUTHORIZATION` is **not compatible** with SSE transport. `STREAMABLE_HTTP=true` is required.

### Environment Variables

Use the dedicated reference for the full environment variable list:

- [Environment Variables Reference](./docs/configuration/environment-variables.md)

Most users only need one of these starting sets:

- **Local PAT**: `GITLAB_PERSONAL_ACCESS_TOKEN`, `GITLAB_API_URL`
- **Local OAuth**: `GITLAB_USE_OAUTH=true`, `GITLAB_OAUTH_CLIENT_ID`, `GITLAB_OAUTH_REDIRECT_URI`, `GITLAB_API_URL`
- **Remote multi-user HTTP**: `STREAMABLE_HTTP=true`, `REMOTE_AUTHORIZATION=true`, `HOST`, `PORT`
- **Multi-pod HPA (stateless)**: above + `OAUTH_STATELESS_MODE=true`, `OAUTH_STATELESS_SECRET` (same across all pods). See [Stateless Mode](./docs/configuration/stateless-mode.md).

Commonly referenced variables:

- `GITLAB_API_URL`
- `GITLAB_PERSONAL_ACCESS_TOKEN`
- `GITLAB_USE_OAUTH`
- `REMOTE_AUTHORIZATION`
- `MCP_TRUST_PROXY`
- `GITLAB_MCP_OAUTH`
- `GITLAB_OAUTH_CALLBACK_PROXY`
- `OAUTH_STATELESS_MODE`
- `OAUTH_STATELESS_SECRET`

The reference document also covers:

- auth and OAuth variables
- MCP OAuth proxy variables
- project and tool filtering variables
- dynamic tool discovery via `discover_tools` (on-demand toolset activation)
- transport and session variables
- proxy and TLS variables

For callback proxy mode details, see [GitLab MCP OAuth Callback Proxy](./docs/auth/oauth-callback-proxy.md).

### Remote Authorization Setup (Multi-User Support)

When using `REMOTE_AUTHORIZATION=true`, the MCP server can support multiple users, each with their own GitLab token passed via HTTP headers. This is useful for:

- Shared MCP server instances where each user needs their own GitLab access
- IDE integrations that can inject user-specific tokens into MCP requests

**Setup Example:**

```bash
# Start server with remote authorization
docker run -d \
  -e HOST=0.0.0.0 \
  -e STREAMABLE_HTTP=true \
  -e REMOTE_AUTHORIZATION=true \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_READ_ONLY_MODE=true \
  -e SESSION_TIMEOUT_SECONDS=3600 \
  -p 3333:3002 \
  zereight050/gitlab-mcp
```

**Client Configuration:**

Your IDE or MCP client must send one of these headers with each request:

```
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
```

or

```
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

The token is stored per session (identified by `mcp-session-id` header) and reused for subsequent requests in the same session.

#### Remote Authorization Client Configuration Example with Cursor

```json
{
  "mcpServers": {
    "GitLab": {
      "url": "http(s)://<your_mcp_gitlab_server>/mcp",
      "headers": {
        "Authorization": "Bearer glpat-..."
      }
    }
  }
}
```

**Important Notes:**

- Remote authorization **only works with Streamable HTTP transport**
- Each session is isolated - tokens from one session cannot access another session's data
  Tokens are automatically cleaned up when sessions close
- **Session timeout:** Auth tokens expire after `SESSION_TIMEOUT_SECONDS` (default 1 hour) of inactivity. After timeout, the client must send auth headers again. The transport session remains active.
- Each request resets the timeout timer for that session
- **Rate limiting:** Each session is limited to `MAX_REQUESTS_PER_MINUTE` requests per minute (default 60)
- **Capacity limit:** Server accepts up to `MAX_SESSIONS` concurrent sessions (default 1000)

### MCP OAuth Setup (Claude.ai Native OAuth)

When using `GITLAB_MCP_OAUTH=true`, the server acts as an OAuth proxy to your GitLab
instance. Claude.ai (and any MCP-spec-compliant client) handles the entire browser
authentication flow automatically — no manual Personal Access Token management needed.

**Prerequisites:**

A **pre-registered GitLab OAuth application** is required. GitLab restricts dynamically
registered (unverified) applications to the `mcp` scope, which is insufficient for API
calls (need `api` or `read_api`).

1. Go to your GitLab instance → **Admin Area > Applications** (instance-wide) or **User Settings > Applications** (personal)
2. Create a new application with:
   - **Confidential**: unchecked
   - **Scopes**: `api`, `read_api`, `read_user` (or whichever scopes you intend to request via `GITLAB_OAUTH_SCOPES`)
3. Save and copy the **Application ID** — this is your `GITLAB_OAUTH_APP_ID`

**How it works:**

1. User adds your MCP server URL in Claude.ai
2. Claude.ai discovers OAuth endpoints via `/.well-known/oauth-authorization-server`
3. Claude.ai registers itself via Dynamic Client Registration (`POST /register`) — handled locally by the MCP server (each client gets a virtual client ID)
4. Claude.ai redirects the user's browser to GitLab's login page using the pre-registered OAuth application
5. User authenticates; GitLab redirects back to `https://claude.ai/api/mcp/auth_callback`
6. Claude.ai sends `Authorization: Bearer <token>` on every MCP request
7. Server validates the token with GitLab and stores it per session

**Server setup:**

```bash
docker run -d \
  -e STREAMABLE_HTTP=true \
  -e GITLAB_MCP_OAUTH=true \
  -e GITLAB_OAUTH_APP_ID="your-gitlab-oauth-app-client-id" \
  -e GITLAB_API_URL="https://gitlab.example.com/api/v4" \
  -e MCP_SERVER_URL="https://your-mcp-server.example.com" \
  -p 3002:3002 \
  zereight050/gitlab-mcp
```

For local development (HTTP allowed):

```bash
MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true \
STREAMABLE_HTTP=true \
GITLAB_MCP_OAUTH=true \
GITLAB_OAUTH_APP_ID=your-gitlab-oauth-app-client-id \
MCP_SERVER_URL=http://localhost:3002 \
GITLAB_API_URL=https://gitlab.com/api/v4 \
node build/index.js
```

**Claude.ai configuration:**

```json
{
  "mcpServers": {
    "GitLab": {
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
```

No `headers` field is needed — Claude.ai obtains the token via OAuth automatically.

**Environment variables:**

| Variable                                    | Required | Description                                                                                                                                                                                                         |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITLAB_MCP_OAUTH`                          | Yes      | Set to `true` to enable                                                                                                                                                                                             |
| `GITLAB_OAUTH_APP_ID`                       | Yes      | Client ID of the pre-registered GitLab OAuth application                                                                                                                                                            |
| `MCP_SERVER_URL`                            | Yes      | Public HTTPS URL of your MCP server                                                                                                                                                                                 |
| `GITLAB_API_URL`                            | Yes      | Your GitLab instance API URL (e.g. `https://gitlab.com/api/v4`)                                                                                                                                                     |
| `STREAMABLE_HTTP`                           | Yes      | Must be `true` (SSE is not supported)                                                                                                                                                                               |
| `GITLAB_OAUTH_SCOPES`                       | No       | Comma-separated GitLab scopes to request (e.g. `api,read_user`). Defaults to `api` (or `read_api` when `GITLAB_READ_ONLY_MODE=true`). The pre-registered application must be configured with at least these scopes. |
| `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL` | No       | Set `true` for local HTTP dev only                                                                                                                                                                                  |

**Important Notes:**

- MCP OAuth **only works with Streamable HTTP transport** (`SSE=true` is incompatible)
- Each user session stores its own OAuth token — sessions are fully isolated
- Session timeout, rate limiting, and capacity limits apply identically to the
  `REMOTE_AUTHORIZATION` mode (`SESSION_TIMEOUT_SECONDS`, `MAX_REQUESTS_PER_MINUTE`,
  `MAX_SESSIONS`)
- **Header auth fallback:** when `Private-Token` or `JOB-TOKEN` request headers are
  present, OAuth validation is skipped and the raw token is used directly for that
  session. This allows PATs and CI job tokens to be used alongside the OAuth flow on
  the same server instance. `Authorization: Bearer` is always treated as an OAuth
  token — use `Private-Token` for PAT-based header auth.

## Agent Skill Files

Pre-built skill files are available in [`skills/gitlab-mcp/`](./skills/gitlab-mcp/) for AI agents that support skill/instruction loading (Claude Code, GitHub Copilot, Cursor, etc.).

- **[SKILL.md](./skills/gitlab-mcp/SKILL.md)** — Core guide (~800 tokens) with toolset overview, key workflows, and parameter hints
- **[reference/](./skills/gitlab-mcp/reference/)** — Detailed workflow docs for code review, merge requests, issues, and pipelines

Install with the `skills` CLI:

```bash
npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill
```

Register the skill directory in your AI client to get optimal tool usage guidance without relying solely on the full ListTools response.

## Tools 🛠️

<details>
<summary>Click to expand</summary>

<!-- TOOLS-START -->

1. `merge_merge_request` - Merge a merge request in a GitLab project
2. `create_or_update_file` - Create or update a single file in a GitLab project
3. `search_repositories` - Search for GitLab projects
4. `create_repository` - Create a new GitLab project
5. `create_group` - Create a new GitLab group or subgroup (name, path, description, visibility, and optional parent_id)
6. `get_file_contents` - Get the contents of a file or directory from a GitLab project
7. `push_files` - Push multiple files to a GitLab project in a single commit
8. `create_issue` - Create a new issue in a GitLab project
9. `create_merge_request` - Create a new merge request in a GitLab project
10. `fork_repository` - Fork a GitLab project to your account or specified namespace
11. `create_branch` - Create a new branch in a GitLab project
12. `get_merge_request` - Get details of a merge request with compact deployment summary, behind-count, commit addition summary, and approval summary (Either mergeRequestIid or branchName must be provided)
13. `get_merge_request_diffs` - Get the changes/diffs of a merge request (Either mergeRequestIid or branchName must be provided)
14. `list_merge_request_diffs` - List merge request diffs with pagination support (Either mergeRequestIid or branchName must be provided)
15. `get_merge_request_conflicts` - Get the conflicts of a merge request in a GitLab project
16. `list_merge_request_changed_files` - STEP 1 of code review workflow. Returns ONLY the list of changed file paths in a merge request — WITHOUT diff content. Call this first to get file paths, then call get_merge_request_file_diff with multiple files in a single batched call (recommended 3-5 files per call). Supports excluded_file_patterns filtering using regex. (Either mergeRequestIid or branchName must be provided)
17. `get_merge_request_file_diff` - STEP 2 of code review workflow. Get diffs for one or more files from a merge request. Call list_merge_request_changed_files first, then pass them as an array to fetch diffs efficiently. Batching multiple files (recommended 3-5) is supported. (Either mergeRequestIid or branchName must be provided)
18. `list_merge_request_versions` - List all versions of a merge request
19. `get_merge_request_version` - Get a specific version of a merge request
20. `get_branch_diffs` - Get the changes/diffs between two branches or commits in a GitLab project
21. `update_merge_request` - Update a merge request (Either mergeRequestIid or branchName must be provided)
22. `create_note` - Create a new note (comment) to an issue or merge request
23. `create_merge_request_thread` - Create a new thread on a merge request
24. `mr_discussions` - List discussion items for a merge request
25. `resolve_merge_request_thread` - Resolve a thread on a merge request
26. `update_merge_request_note` - Modify an existing merge request thread note
27. `create_merge_request_note` - Add a new note to an existing merge request thread
28. `delete_merge_request_discussion_note` - Delete a discussion note on a merge request
29. `update_merge_request_discussion_note` - Update a discussion note on a merge request
30. `create_merge_request_discussion_note` - Add a new discussion note to an existing merge request thread
31. `delete_merge_request_note` - Delete an existing merge request note
32. `get_merge_request_note` - Get a specific note for a merge request
33. `get_merge_request_notes` - List notes for a merge request
34. `get_draft_note` - Get a single draft note from a merge request
35. `list_draft_notes` - List draft notes for a merge request
36. `create_draft_note` - Create a draft note for a merge request
37. `update_draft_note` - Update an existing draft note
38. `delete_draft_note` - Delete a draft note
39. `publish_draft_note` - Publish a single draft note
40. `bulk_publish_draft_notes` - Publish all draft notes for a merge request
41. `list_merge_requests` - List merge requests globally or in a specific GitLab project with filtering options (project_id is now optional)
42. `approve_merge_request` - Approve a merge request (requires appropriate permissions)
43. `unapprove_merge_request` - Unapprove a previously approved merge request
44. `get_merge_request_approval_state` - Get merge request approval details including approvers (uses `approval_state` when available, otherwise falls back to `approvals`)
45. `update_issue_note` - Modify an existing issue thread note
46. `create_issue_note` - Add a new note to an existing issue thread
47. `list_issues` - List issues (default: created by current user only; use scope='all' for all accessible issues)
48. `my_issues` - List issues assigned to the authenticated user (defaults to open issues)
49. `get_issue` - Get details of a specific issue in a GitLab project
50. `update_issue` - Update an issue in a GitLab project
51. `update_issue_description_patch` - Apply a patch (search/replace or unified diff) to an issue description. Reduces token usage by sending only the change instead of the full description. Supports `dry_run` to preview and `create_note` to summarize.
52. `delete_issue` - Delete an issue from a GitLab project
53. `list_todos` - List GitLab to-do items for the current user
54. `mark_todo_done` - Mark a GitLab to-do item as done
55. `mark_all_todos_done` - Mark all pending GitLab to-do items as done for the current user
56. `list_issue_links` - List all issue links for a specific issue
57. `list_issue_discussions` - List discussions for an issue in a GitLab project
58. `get_issue_link` - Get a specific issue link
59. `create_issue_link` - Create an issue link between two issues
60. `delete_issue_link` - Delete an issue link
61. `list_namespaces` - List all namespaces available to the current user
62. `get_namespace` - Get details of a namespace by ID or path
63. `verify_namespace` - Verify if a namespace path exists
64. `get_project` - Get details of a specific project
65. `list_projects` - List projects accessible by the current user
66. `list_project_members` - List members of a GitLab project
67. `list_group_projects` - List projects in a GitLab group with filtering options
68. `list_group_iterations` - List group iterations with filtering options
69. `list_labels` - List labels for a project
70. `get_label` - Get a single label from a project
71. `create_label` - Create a new label in a project
72. `update_label` - Update an existing label in a project
73. `delete_label` - Delete a label from a project
74. `list_pipelines` - List pipelines in a GitLab project with filtering options
75. `get_pipeline` - Get details of a specific pipeline in a GitLab project
76. `list_pipeline_jobs` - List all jobs in a specific pipeline
77. `list_pipeline_trigger_jobs` - List all trigger jobs (bridges) in a specific pipeline that trigger downstream pipelines
78. `get_pipeline_job` - Get details of a GitLab pipeline job number
79. `get_pipeline_job_output` - Get the output/trace of a GitLab pipeline job with optional pagination to limit context window usage
80. `validate_ci_lint` - Validate provided GitLab CI/CD YAML content for a project
81. `validate_project_ci_lint` - Validate an existing `.gitlab-ci.yml` configuration for a project
82. `create_pipeline` - Create a new pipeline for a branch or tag
83. `retry_pipeline` - Retry a failed or canceled pipeline
84. `cancel_pipeline` - Cancel a running pipeline
85. `play_pipeline_job` - Run a manual pipeline job
86. `retry_pipeline_job` - Retry a failed or canceled pipeline job
87. `cancel_pipeline_job` - Cancel a running pipeline job
88. `list_deployments` - List deployments in a GitLab project with filtering options
89. `get_deployment` - Get details of a specific deployment in a GitLab project
90. `list_environments` - List environments in a GitLab project
91. `get_environment` - Get details of a specific environment in a GitLab project
92. `list_job_artifacts` - List artifact files in a job's artifacts archive. Returns file names, paths, types, and sizes
93. `download_job_artifacts` - Download the entire artifact archive (zip) for a job to a local path. Returns the saved file path
94. `get_job_artifact_file` - Get the content of a single file from a job's artifacts by its path within the archive
95. `list_milestones` - List milestones in a GitLab project with filtering options
96. `get_milestone` - Get details of a specific milestone
97. `create_milestone` - Create a new milestone in a GitLab project
98. `edit_milestone` - Edit an existing milestone in a GitLab project
99. `delete_milestone` - Delete a milestone from a GitLab project
100. `get_milestone_issue` - Get issues associated with a specific milestone
101. `get_milestone_merge_requests` - Get merge requests associated with a specific milestone
102. `promote_milestone` - Promote a milestone to the next stage
103. `get_milestone_burndown_events` - Get burndown events for a specific milestone
104. `list_wiki_pages` - List wiki pages in a GitLab project
105. `get_wiki_page` - Get details of a specific wiki page
106. `create_wiki_page` - Create a new wiki page in a GitLab project
107. `update_wiki_page` - Update an existing wiki page in a GitLab project
108. `delete_wiki_page` - Delete a wiki page from a GitLab project
109. `list_group_wiki_pages` - List wiki pages in a GitLab group
110. `get_group_wiki_page` - Get details of a specific group wiki page
111. `create_group_wiki_page` - Create a new wiki page in a GitLab group
112. `update_group_wiki_page` - Update an existing wiki page in a GitLab group
113. `delete_group_wiki_page` - Delete a wiki page from a GitLab group
114. `get_repository_tree` - Get the repository tree for a GitLab project (list files and directories)
115. `list_commits` - List repository commits with filtering options
116. `get_commit` - Get details of a specific commit
117. `get_commit_diff` - Get changes/diffs of a specific commit
118. `list_commit_statuses` - List statuses for a specific commit
119. `create_commit_status` - Create or update the status of a specific commit
120. `list_releases` - List all releases for a project
121. `get_release` - Get a release by tag name
122. `create_release` - Create a new release in a GitLab project
123. `update_release` - Update an existing release in a GitLab project
124. `delete_release` - Delete a release from a GitLab project (does not delete the associated tag)
125. `create_release_evidence` - Create release evidence for an existing release (GitLab Premium/Ultimate only)
126. `download_release_asset` - Download a release asset file by direct asset path
127. `list_tags` - List repository tags with filtering and pagination support
128. `get_tag` - Get details of a specific repository tag
129. `create_tag` - Create a new tag in the repository
130. `delete_tag` - Delete a tag from the repository
131. `get_tag_signature` - Get the signature of a signed tag
132. `get_users` - Get GitLab user details by usernames
133. `list_events` - List all events for the currently authenticated user
134. `get_project_events` - List all visible events for a specified project
135. `upload_markdown` - Upload a file to a GitLab project for use in markdown content
136. `download_attachment` - Download an uploaded file from a GitLab project by secret and filename
137. `get_work_item` - Get a single work item with full details including status, hierarchy (parent/children), type, labels, assignees, and all widgets
138. `list_work_items` - List work items in a project with filters (type, state, search, assignees, labels). Returns items with status and hierarchy info
139. `create_work_item` - Create a new work item (issue, task, incident, test_case, epic, key_result, objective, requirement, ticket). Supports setting title, description, labels, assignees, weight, parent, health status, start/due dates, milestone, and confidentiality
140. `update_work_item` - Update a work item. Can modify title, description, labels, assignees, weight, state, status, parent hierarchy, children, health status, start/due dates, milestone, confidentiality, linked items, and custom fields
141. `convert_work_item_type` - Convert a work item to a different type (e.g. issue to task, task to incident)
142. `list_work_item_statuses` - List available statuses for a work item type in a project. Requires GitLab Premium/Ultimate with configurable statuses
143. `list_custom_field_definitions` - List available custom field definitions for a work item type in a project. Returns field names, types, and IDs needed for setting custom fields via update_work_item
144. `move_work_item` - Move a work item (issue, task, etc.) to a different project. Uses GitLab GraphQL issueMove mutation
145. `list_work_item_notes` - List notes and discussions on a work item. Returns threaded discussions with author, body, timestamps, and system/internal flags
146. `create_work_item_note` - Add a note/comment to a work item. Supports Markdown, internal notes, and threaded replies
147. `get_timeline_events` - List timeline events for an incident. Returns chronological events with notes, timestamps, and tags
148. `create_timeline_event` - Create a timeline event on an incident. Supports tags: 'Start time', 'End time', 'Impact detected', 'Response initiated', 'Impact mitigated', 'Cause identified'
149. `list_webhooks` - List all configured webhooks for a GitLab project or group. Provide either project_id or group_id
150. `list_webhook_events` - List recent webhook events (past 7 days) for a project or group webhook. Use summary mode for overview, then get_webhook_event for full details
151. `get_webhook_event` - Get full details of a specific webhook event by ID, including request/response payloads
152. `search_code` - Search for code across all projects on the GitLab instance (requires advanced search or exact code search to be enabled)
153. `search_project_code` - Search for code within a specific GitLab project (requires advanced search or exact code search to be enabled)
154. `search_group_code` - Search for code within a specific GitLab group (requires advanced search or exact code search to be enabled)
155. `execute_graphql` - Execute a GitLab GraphQL query
156. `list_merge_request_pipelines` - List pipelines for a merge request with pagination support
157. `list_project_variables` - List CI/CD variables for a project with optional environment scope filter
158. `get_project_variable` - Get a single CI/CD variable from a project by key, with optional environment scope filter
159. `create_project_variable` - Create a new CI/CD variable in a project
160. `update_project_variable` - Update an existing CI/CD variable in a project, with optional filter to disambiguate by environment scope
161. `delete_project_variable` - Delete a CI/CD variable from a project, with optional filter to disambiguate by environment scope
162. `list_group_variables` - List CI/CD variables for a group with optional environment scope filter
163. `get_group_variable` - Get a single CI/CD variable from a group by key, with optional environment scope filter
164. `create_group_variable` - Create a new CI/CD variable in a group
165. `update_group_variable` - Update an existing CI/CD variable in a group, with optional filter to disambiguate by environment scope
166. `delete_group_variable` - Delete a CI/CD variable from a group, with optional filter to disambiguate by environment scope
167. `get_dependency_proxy_settings` - Get dependency proxy settings for a group (enabled status, blob count, total size, image prefix, TTL policy)
168. `update_dependency_proxy_settings` - Update dependency proxy settings for a group (enable/disable, credentials for authenticated Docker Hub pulls)
169. `list_dependency_proxy_blobs` - List cached dependency proxy blobs for a group with cursor-based pagination
170. `purge_dependency_proxy_cache` - Schedule purge of all cached dependency proxy blobs for a group

<!-- TOOLS-END -->

</details>

## Testing 🧪

The project includes comprehensive test coverage including remote authorization:

```bash
# Run all tests (API validation + remote auth)
npm test

# Run only remote authorization tests
npm run test:remote-auth

# Run all tests including readonly MCP tests
npm run test:all

# Run only API validation
npm run test:integration
```

All remote authorization tests use a mock GitLab server and do not require actual GitLab credentials.
