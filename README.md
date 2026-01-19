# GitLab MCP Server

**Maintained by:** [Dmitry Prudnikov](https://github.com/polaz) | **Original Author:** [zereight](https://github.com/zereight)

## @structured-world/gitlab-mcp

A fork of the original [zereight/gitlab-mcp](https://github.com/zereight/gitlab-mcp)

![npm version](https://img.shields.io/npm/v/@structured-world/gitlab-mcp) ![npm downloads](https://img.shields.io/npm/dm/@structured-world/gitlab-mcp) ![Release](https://github.com/structured-world/gitlab-mcp/workflows/Release/badge.svg) ![Codecov](https://codecov.io/gh/structured-world/gitlab-mcp/branch/main/graph/badge.svg) [![Coverage Report](https://img.shields.io/badge/Coverage-Live%20Report-brightgreen?logo=github)](https://structured-world.github.io/gitlab-mcp/coverage/)

GitLab MCP(Model Context Protocol) Server. **Includes bug fixes and improvements over the original GitLab MCP server.**

This fork is actively maintained and enhanced with strict TypeScript standards, Yarn 4 support, and improved development workflows.

## Requirements

- **Node.js**: >=24.0.0 (required for native fetch with Undici dispatcher pattern)
- **GitLab**: Compatible with GitLab.com and self-hosted instances

## Usage

### Using with Codex, Claude App, Cline, Roo Code, Cursor, Kilo Code

When using with the Claude App, you need to set up your API key and URLs directly.

#### Codex

Add to your `~/.codex/config.toml`:

```toml
[mcp_servers.gitlab]
command = "yarn"
args = ["dlx", "-q", "@structured-world/gitlab-mcp@latest", "stdio"]
env = { "GITLAB_TOKEN" = "mytoken", "GITLAB_API_URL" = "https://gitlab.com" }
```

#### npx

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@structured-world/gitlab-mcp"],
      "env": {
        "GITLAB_TOKEN": "your_gitlab_token",
        "GITLAB_API_URL": "your_gitlab_api_url",
        "GITLAB_PROJECT_ID": "your_project_id", // Optional: default project
        "GITLAB_ALLOWED_PROJECT_IDS": "", // Optional: comma-separated list of allowed project IDs
        "GITLAB_READ_ONLY_MODE": "false",
        "GITLAB_API_TIMEOUT_MS": "20000", // API timeout in milliseconds (default: 20000)
        "USE_GITLAB_WIKI": "false", // use wiki api?
        "USE_MILESTONE": "false", // use milestone api?
        "USE_PIPELINE": "false", // use pipeline api?
        "USE_VARIABLES": "true", // use variables api?
        "SKIP_TLS_VERIFY": "false" // skip SSL cert verification (dev only)
      }
    }
  }
}
```

#### vscode .vscode/mcp.json

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "gitlab-token",
      "description": "Gitlab Token to read API",
      "password": true
    }
  ],
  "servers": {
    "GitLab-MCP": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@structured-world/gitlab-mcp"],
      "env": {
        "GITLAB_TOKEN": "${input:gitlab-token}",
        "GITLAB_API_URL": "your-fancy-gitlab-url",
        "GITLAB_READ_ONLY_MODE": "true",
        ...
      }
    }
  }
}
```

#### Docker

**Transport Mode Selection:**
- **PORT environment variable present** → Server starts in HTTP mode with both SSE and StreamableHTTP endpoints (`/sse` and `/mcp`)
- **No PORT environment variable** → Server starts in stdio mode for direct MCP communication
- **Explicit `stdio` argument** → Forces stdio mode regardless of PORT

- stdio mcp.json

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITLAB_TOKEN",
        "-e",
        "GITLAB_API_URL",
        "-e",
        "GITLAB_READ_ONLY_MODE",
        "-e",
        "USE_GITLAB_WIKI",
        "-e",
        "USE_MILESTONE",
        "-e",
        "USE_PIPELINE",
        "-e",
        "USE_VARIABLES",
        "ghcr.io/structured-world/gitlab-mcp:latest"
      ],
      "env": {
        "GITLAB_TOKEN": "your_gitlab_token",
        "GITLAB_API_URL": "https://gitlab.com", // Optional, for self-hosted GitLab
        "GITLAB_READ_ONLY_MODE": "false",
        "USE_GITLAB_WIKI": "true",
        "USE_MILESTONE": "true",
        "USE_PIPELINE": "true",
        "USE_VARIABLES": "true"
      }
    }
  }
}
```

- HTTP Server (SSE + StreamableHTTP)

```shell
docker run -i --rm \
  -e PORT=3002 \
  -e GITLAB_TOKEN=your_gitlab_token \
  -e GITLAB_API_URL="https://gitlab.com" \
  -e GITLAB_READ_ONLY_MODE=true \
  -e USE_GITLAB_WIKI=true \
  -e USE_MILESTONE=true \
  -e USE_PIPELINE=true \
  -p 3333:3002 \
  ghcr.io/structured-world/gitlab-mcp:latest
```

**For modern MCP clients (recommended):**
```json
{
  "mcpServers": {
    "gitlab": {
      "type": "streamable-http",
      "url": "http://localhost:3333/mcp"
    }
  }
}
```

**For legacy SSE clients (backwards compatibility):**
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

## Transport Modes

The GitLab MCP Server automatically selects the appropriate transport mode based on your configuration:

### Automatic Mode Selection

| Configuration | Transport Mode | Endpoints Available | Use Case |
|--------------|----------------|-------------------|----------|
| **PORT** env var present | HTTP (Dual) | `/sse` and `/mcp` | Web clients, HTTP-based MCP clients |
| **No PORT** env var | stdio | N/A | Direct MCP communication, CLI usage |
| **`stdio` argument** | stdio | N/A | Force stdio mode (overrides PORT) |

### Mode Details

**HTTP Mode (Dual Transport):**
- Runs Express server on specified PORT
- Provides both SSE (`/sse`) and StreamableHTTP (`/mcp`) endpoints simultaneously
- Perfect for web-based MCP clients and backwards compatibility
- Supports session management and reconnection

**stdio Mode:**
- Direct stdin/stdout communication
- No HTTP server required
- Optimal for command-line tools and direct MCP protocol usage
- Lower resource usage

## TLS/HTTPS Configuration

GitLab MCP Server supports secure HTTPS connections via:

| Approach | Best For | HTTP/2 | Auto-Renewal |
|----------|----------|--------|--------------|
| **Direct TLS** | Development, simple deployments | No | Manual |
| **Reverse Proxy** | Production (recommended) | Yes | Yes |

**Quick Start - Direct TLS:**
```bash
docker run -d \
  -e PORT=3000 \
  -e SSL_CERT_PATH=/certs/server.crt \
  -e SSL_KEY_PATH=/certs/server.key \
  -e GITLAB_TOKEN=your_token \
  -v $(pwd)/certs:/certs:ro \
  -p 3000:3000 \
  ghcr.io/structured-world/gitlab-mcp:latest
```

**Quick Start - Reverse Proxy (Caddy):**
```
gitlab-mcp.example.com {
    reverse_proxy gitlab-mcp:3002 {
        flush_interval -1
    }
}
```

For complete setup guides including **nginx**, **Envoy**, **Caddy**, and **Traefik** configurations with HTTP/2 support, see **[SSL.md](SSL.md)**.

## OAuth Authentication (Claude Custom Connector)

GitLab MCP Server supports OAuth 2.1 authentication for use as a **Claude Custom Connector**. This enables secure per-user authentication without sharing GitLab tokens.

### When to Use OAuth Mode

| Scenario | Recommended Mode |
|----------|------------------|
| Personal/local use | Static Token (`GITLAB_TOKEN`) |
| Team access via Claude Web/Desktop | **OAuth Mode** |
| Private LAN GitLab with public MCP server | **OAuth Mode** |
| CI/CD or automated pipelines | Static Token |

### Prerequisites

1. **GitLab 17.1+** (Device Authorization Grant support)
2. **HTTPS endpoint** for gitlab-mcp (required for OAuth)
3. **GitLab OAuth Application** configured

### Setup Guide

#### Step 1: Create GitLab OAuth Application

1. In GitLab, navigate to **User Settings > Applications** (or **Admin > Applications** for instance-wide)
2. Create a new application:
   - **Name**: `GitLab MCP Server`
   - **Redirect URI**: `https://your-mcp-server.com/oauth/callback` (required for Authorization Code Flow)
   - **Confidential**: `No` (PKCE provides security without client secret)
   - **Scopes**: Select `api` and `read_user`
3. Save and copy the **Application ID**

> **Note**: The redirect URI is used by Claude.ai Custom Connectors (Authorization Code Flow). CLI clients use Device Flow which doesn't require redirect URI.

#### Step 2: Configure gitlab-mcp Server

```bash
# Required for OAuth mode
OAUTH_ENABLED=true
OAUTH_SESSION_SECRET=your-minimum-32-character-secret-key
GITLAB_OAUTH_CLIENT_ID=your-gitlab-application-id
GITLAB_API_URL=https://your-gitlab-instance.com

# Server configuration
PORT=3000
HOST=0.0.0.0

# Optional OAuth settings
GITLAB_OAUTH_CLIENT_SECRET=your-secret    # Required only if GitLab app is confidential
GITLAB_OAUTH_SCOPES=api,read_user          # Default scopes
OAUTH_TOKEN_TTL=3600                       # Token lifetime (seconds)
OAUTH_REFRESH_TOKEN_TTL=604800             # Refresh token lifetime (seconds)
OAUTH_DEVICE_POLL_INTERVAL=5               # Device flow poll interval (seconds)
OAUTH_DEVICE_TIMEOUT=300                   # Auth timeout (seconds)
```

#### Step 3: Deploy with HTTPS

OAuth requires HTTPS. Example with Docker:

```bash
docker run -d \
  --name gitlab-mcp \
  -e OAUTH_ENABLED=true \
  -e OAUTH_SESSION_SECRET="$(openssl rand -base64 32)" \
  -e GITLAB_OAUTH_CLIENT_ID=your-app-id \
  -e GITLAB_API_URL=https://gitlab.example.com \
  -e PORT=3000 \
  -p 3000:3000 \
  ghcr.io/structured-world/gitlab-mcp:latest
```

Use a reverse proxy (nginx, Caddy, Traefik) to add HTTPS.

### Claude Web Setup

1. Go to [claude.ai](https://claude.ai) and sign in
2. Navigate to **Settings > Connectors**
3. Click **Add custom connector**
4. Enter your gitlab-mcp server URL: `https://your-mcp-server.com`
5. Click **Add**
6. When prompted, complete authentication:
   - You'll see a device code (e.g., `ABCD-1234`)
   - Open your GitLab instance and enter the code
   - Approve the authorization request
7. The connector is now active

### Claude Desktop Setup

#### macOS / Linux

Edit `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "streamable-http",
      "url": "https://your-mcp-server.com/mcp"
    }
  }
}
```

#### Windows

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "streamable-http",
      "url": "https://your-mcp-server.com/mcp"
    }
  }
}
```

After adding the server:
1. Restart Claude Desktop
2. Claude will prompt you to authenticate
3. Complete the device flow authorization in GitLab
4. Start using GitLab tools with your personal identity

### Private LAN GitLab Architecture

For GitLab instances on private networks (not internet-accessible):

```
+-------------------+         +-------------------+         +-------------------+
|   Claude Cloud    |  HTTPS  |    gitlab-mcp     |  HTTP   |   GitLab Server   |
|   or Desktop      |-------->|   (Public IP)     |-------->|   (Private LAN)   |
+-------------------+         +-------------------+         +-------------------+
                                       |
                                       | Device code displayed
                                       v
                              +-------------------+
                              |   User (on VPN)   |
                              |   visits GitLab   |
                              |   enters code     |
                              +-------------------+
```

**How it works:**
1. gitlab-mcp server has network access to GitLab (same network or VPN)
2. User connects to gitlab-mcp via Claude (public internet)
3. gitlab-mcp initiates device authorization with GitLab
4. User receives a code and visits GitLab directly (requires VPN/internal access)
5. User authenticates in GitLab and enters the code
6. gitlab-mcp receives the token and issues an MCP session token
7. All subsequent requests use the user's GitLab identity

**Requirements:**
- gitlab-mcp must reach GitLab API (deploy on same network or use VPN)
- Users must be able to access GitLab web UI (typically via VPN)
- gitlab-mcp must be accessible from internet (for Claude to connect)

### OAuth vs Static Token Comparison

| Feature | Static Token | OAuth Mode |
|---------|--------------|------------|
| Setup complexity | Simple | Moderate |
| Per-user identity | No (shared token) | Yes |
| Token management | Manual | Automatic |
| Audit trail | Single identity | Per-user actions |
| Security | Token in config | No tokens in config |
| Best for | Personal use, CI/CD | Teams, shared access |

### OAuth Flows

The server supports two OAuth flows automatically:

| Flow | Trigger | Used By | How It Works |
|------|---------|---------|--------------|
| **Authorization Code Flow** | `redirect_uri` present | Claude.ai Custom Connectors | Redirects to GitLab OAuth, then back to client |
| **Device Flow** | No `redirect_uri` | CLI clients, Claude Desktop | Shows device code page for manual entry |

The flow is selected automatically based on the presence of `redirect_uri` in the authorization request.

### OAuth Endpoints

When OAuth is enabled, the following endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | OAuth metadata discovery |
| `/.well-known/oauth-protected-resource` | GET | Protected resource metadata (RFC 9470) |
| `/authorize` | GET | Start authorization (auto-selects flow) |
| `/oauth/callback` | GET | GitLab callback (Auth Code Flow only) |
| `/oauth/poll` | GET | Poll for completion (Device Flow only) |
| `/token` | POST | Exchange code for tokens |
| `/health` | GET | Health check endpoint |

### Troubleshooting

**"OAuth not configured" error**
- Ensure `OAUTH_ENABLED=true` is set
- Verify `OAUTH_SESSION_SECRET` is at least 32 characters
- Check `GITLAB_OAUTH_CLIENT_ID` is correct

**Device code not accepted**
- Verify GitLab version is 17.1 or later
- Check OAuth application scopes include `api`
- Ensure the application is not set as "Confidential"

**"Failed to refresh token" error**
- GitLab refresh token may have expired
- Re-authenticate through Claude connector settings

**Cannot reach GitLab for authentication**
- For private LAN GitLab, connect to VPN first
- Verify you can access GitLab web UI in your browser

### Environment Variables

- `GITLAB_TOKEN`: Your GitLab personal access token.
- `GITLAB_API_URL`: Your GitLab API URL. (Default: `https://gitlab.com`)
- `GITLAB_PROJECT_ID`: Default project ID. If set, Overwrite this value when making an API request.
- `GITLAB_ALLOWED_PROJECT_IDS`: Optional comma-separated list of allowed project IDs. When set with a single value, acts as a default project (like the old "lock" mode). When set with multiple values, restricts access to only those projects. Examples:
  - Single value `123`: MCP server can only access project 123 and uses it as default
  - Multiple values `123,456,789`: MCP server can access projects 123, 456, and 789 but requires explicit project ID in requests
- `GITLAB_READ_ONLY_MODE`: When set to 'true', restricts the server to only expose read-only operations. Useful for enhanced security or when write access is not needed. Also useful for using with Cursor and it's 40 tool limit.
- `GITLAB_DENIED_TOOLS_REGEX`: When set as a regular expression, it excludes the matching tools.
- `GITLAB_API_TIMEOUT_MS`: API request timeout in milliseconds. (Default: `20000` - 20 seconds). If GitLab API doesn't respond within this time, the request will be aborted and a timeout error will be returned to the MCP client.
- `USE_GITLAB_WIKI`: When set to 'true', enables the wiki-related tools (list_wiki_pages, get_wiki_page, create_wiki_page, update_wiki_page, delete_wiki_page). Supports both project-level and group-level wikis. By default, wiki features are disabled.
- `USE_MILESTONE`: When set to 'true', enables the milestone-related tools (list_milestones, get_milestone, create_milestone, edit_milestone, delete_milestone, get_milestone_issue, get_milestone_merge_requests, promote_milestone, get_milestone_burndown_events). By default, milestone features are disabled.
- `USE_PIPELINE`: When set to 'true', enables the pipeline-related tools (list_pipelines, get_pipeline, list_pipeline_jobs, list_pipeline_trigger_jobs, get_pipeline_job, get_pipeline_job_output, create_pipeline, retry_pipeline, cancel_pipeline, play_pipeline_job, retry_pipeline_job, cancel_pipeline_job). By default, pipeline features are disabled.
- `USE_LABELS`: When set to 'true', enables the label-related tools (list_labels, get_label, create_label, update_label, delete_label). By default, label features are enabled.
- `USE_MRS`: When set to 'true', enables the merge request-related tools (browse_merge_requests, browse_mr_discussions, manage_merge_request, manage_mr_discussion, manage_draft_notes). These 5 CQRS tools consolidate all MR operations. By default, merge request features are enabled.
- `USE_FILES`: When set to 'true', enables the file-related tools (browse_files, manage_files). These 2 CQRS tools consolidate all file operations. By default, file operation features are enabled.
- `USE_VARIABLES`: When set to 'true', enables the CI/CD variables-related tools (list_variables, get_variable, create_variable, update_variable, delete_variable). Supports both project-level and group-level variables. By default, variables features are enabled.
- `GITLAB_AUTH_COOKIE_PATH`: Path to an authentication cookie file for GitLab instances that require cookie-based authentication. When provided, the cookie will be included in all GitLab API requests.
- `SKIP_TLS_VERIFY`: When set to 'true', skips TLS certificate verification for all GitLab API requests (both REST and GraphQL). **WARNING**: This bypasses SSL certificate validation and should only be used for testing with self-signed certificates or trusted internal GitLab instances. Never use this in production environments.
- `SSL_CERT_PATH`: Path to PEM certificate file for direct HTTPS/TLS termination. Requires `SSL_KEY_PATH` to also be set.
- `SSL_KEY_PATH`: Path to PEM private key file for direct HTTPS/TLS termination. Requires `SSL_CERT_PATH` to also be set.
- `SSL_CA_PATH`: Optional path to CA certificate chain for client certificate validation.
- `SSL_PASSPHRASE`: Optional passphrase for encrypted private keys.
- `TRUST_PROXY`: Enable Express trust proxy for reverse proxy deployments. Values: `true`, `false`, `loopback`, `linklocal`, `uniquelocal`, hop count, or specific IP addresses.

### Dynamic Tool Description Customization

You can customize tool descriptions at runtime using environment variables following the pattern `GITLAB_TOOL_{TOOL_NAME}`. This feature is specifically designed to optimize agentic usage by:

- **Improving AI agent tool selection** - Customize descriptions to match your specific workflows and use cases
- **Enhancing semantic clarity** - Provide context-specific descriptions that help AI agents understand when to use each tool
- **Reducing ambiguity** - Replace generic descriptions with precise, workflow-oriented explanations
- **Optimizing for your domain** - Use terminology and concepts familiar to your AI agents and team

#### Format
```bash
GITLAB_TOOL_{TOOL_NAME}="Your custom description"
```

Where `{TOOL_NAME}` is the uppercase version of the tool name with underscores preserved.

#### Examples
```bash
# Customize the list_projects tool description
export GITLAB_TOOL_LIST_PROJECTS="Show all available GitLab projects in our organization"

# Customize the create_merge_request tool description
export GITLAB_TOOL_CREATE_MERGE_REQUEST="Create a new MR following our team's review process"

# Customize the get_file_contents tool description
export GITLAB_TOOL_GET_FILE_CONTENTS="Read source code files from the repository"

# Multiple customizations
export GITLAB_TOOL_LIST_PROJECTS="List user projects"
export GITLAB_TOOL_GET_PROJECT="Get project details including settings"
export GITLAB_TOOL_CREATE_WORK_ITEM="Create tickets for our sprint planning"
```

#### Usage in Configuration Files
```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@structured-world/gitlab-mcp"],
      "env": {
        "GITLAB_TOKEN": "your_token",
        "GITLAB_API_URL": "https://gitlab.com",

        "GITLAB_TOOL_LIST_PROJECTS": "Show our team's GitLab projects",
        "GITLAB_TOOL_CREATE_MERGE_REQUEST": "Create MR with our review standards",
        "GITLAB_TOOL_GET_FILE_CONTENTS": "Read code from repo"
      }
    }
  }
}
```

#### Important Notes

- **Description Override Only**: Only the tool description is overridden - the tool name and functionality remain unchanged
- **Schema Preservation**: Schema field descriptions are NOT affected - they remain hardcoded for consistency
- **Case Sensitivity**: Tool names in environment variables must be UPPERCASE (e.g., `LIST_PROJECTS` not `list_projects`)
- **Invalid Names**: Invalid tool names in environment variables are ignored with a warning in debug logs
- **Content Guidelines**: Descriptions can be any valid string but should be kept concise for better UX
- **Scope**: Works with all 61 available tools across all entities (Core, Work Items, Merge Requests, Files, etc.)

## Tools 🛠️

**61 Tools Available** - Organized by entity and functionality below.

### Key Features:
- **CQRS Pattern** - Consolidated action-based tools: `browse_*` for reads, `manage_*` for writes
- **Modular Entity Architecture** - Separate entities for Labels, Merge Requests, Files, Pipelines, etc.
- **Environment-Gated Features** - Enable/disable tool groups with USE_* environment variables
- **Work Items Management** - Modern GraphQL API for Issues, Epics, Tasks, and more
- **Complete GitLab API Coverage** - Repository, Merge Requests, Pipelines, Wiki, and more
- **Tier-based Feature Detection** - Automatically enables features based on your GitLab tier
- **Read-only Mode Support** - Safe operation mode for production environments

### Migration from v5.0 (CQRS Consolidation):
Multiple individual tools have been consolidated into action-based CQRS tools. This reduces tool count from 85 to 61 while maintaining all functionality.

<details>
<summary>Consolidated Tools in v5.0</summary>

**Merge Requests (20 tools → 5 CQRS tools)**:
- `list_merge_requests`, `get_merge_request`, `get_merge_request_diffs`, `list_merge_request_diffs`, `get_branch_diffs` → Use `browse_merge_requests` with action: "list", "get", "diffs", "compare"
- `mr_discussions`, `list_draft_notes`, `get_draft_note` → Use `browse_mr_discussions` with action: "list", "drafts", "draft"
- `create_merge_request`, `update_merge_request`, `merge_merge_request` → Use `manage_merge_request` with action: "create", "update", "merge"
- `create_note`, `create_merge_request_thread`, `create_merge_request_note`, `update_merge_request_note` → Use `manage_mr_discussion` with action: "comment", "thread", "reply", "update"
- `create_draft_note`, `update_draft_note`, `publish_draft_note`, `bulk_publish_draft_notes`, `delete_draft_note` → Use `manage_draft_notes` with action: "create", "update", "publish", "publish_all", "delete"

**Files (5 tools → 2 CQRS tools)**:
- `get_file_contents`, `get_repository_tree` → Use `browse_files` with action: "content", "tree"
- `create_or_update_file`, `push_files`, `upload_markdown` → Use `manage_files` with action: "single", "batch", "upload"

**Core/Projects (8 tools → CQRS tools)**:
- `list_projects`, `get_project`, `search_repositories` → Use `browse_projects` with action: "list", "get", "search"
- `create_repository`, `fork_repository` → Use `manage_repository` with action: "create", "fork"
- `list_namespaces`, `get_namespace`, `verify_namespace` → Use `browse_namespaces` with action: "list", "get", "verify"
- `list_commits`, `get_commit`, `get_commit_diff` → Use `browse_commits` with action: "list", "get", "diff"
- `list_events`, `get_project_events` → Use `browse_events` with action: "user", "project"

</details>

### Migration from v2.0:
All issue management has been migrated to the Work Items GraphQL API. The legacy REST API issue tools (`create_issue`, `update_issue`, etc.) have been removed. Use the Work Items tools (`create_work_item`, `update_work_item`, etc.) instead for better performance and more features.

<details>
<summary>Removed/Migrated Tools from v2.0</summary>

The following issue-related tools have been removed and replaced by Work Items GraphQL API:

- `create_issue` → Use `create_work_item` instead
- `update_issue` → Use `update_work_item` instead
- `delete_issue` → Use `delete_work_item` instead
- `list_issues` → Use `list_work_items` instead
- `my_issues` → Use `list_work_items` with assignee filter
- `get_issue` → Use `get_work_item` instead
- `create_issue_link` → Use `update_work_item` with LINKED_ITEMS widget
- `delete_issue_link` → Use `update_work_item` with LINKED_ITEMS widget
- `update_issue_note` → Use `update_work_item` with NOTES widget
- `create_issue_note` → Use `update_work_item` with NOTES widget
- `list_issue_links` → Use Work Items GraphQL API
- `list_issue_discussions` → Use Work Items GraphQL API
- `get_issue_link` → Use Work Items GraphQL API

</details>

## Complete Tool Reference

### Legend
- 📖 = Read-only tool (available in GITLAB_READ_ONLY_MODE)
- ✏️ = Read/Write tool (disabled in GITLAB_READ_ONLY_MODE)

### Core Tools (13 tools)
Core GitLab functionality always available. Uses CQRS pattern with consolidated action-based tools.

#### Repository & Project Management
- 📖 **`browse_projects`**: PROJECT DISCOVERY: Find, browse, or inspect GitLab projects. Actions: "search" finds projects by name/topic, "list" browses accessible projects, "get" retrieves full details.
- ✏️ **`manage_repository`**: REPOSITORY MANAGEMENT: Create or fork GitLab projects. Actions: "create" starts new project, "fork" creates your copy of existing project.
- 📖 **`list_project_members`**: List members of a GitLab project with access levels.

#### Namespaces & Groups
- 📖 **`browse_namespaces`**: NAMESPACE OPERATIONS: Explore groups and user namespaces. Actions: "list" discovers namespaces, "get" retrieves details, "verify" checks if path exists.
- ✏️ **`create_group`**: Create a new GitLab group/namespace. Can create subgroups with parent_id.

#### Commits & History
- 📖 **`browse_commits`**: COMMIT HISTORY: Explore repository commit history. Actions: "list" browses commits with filters, "get" retrieves commit metadata, "diff" shows code changes.
- ✏️ **`create_branch`**: Create a new branch in a GitLab project from existing ref.

#### Events & Activity
- 📖 **`browse_events`**: ACTIVITY FEED: Track GitLab activity. Actions: "user" shows your activity, "project" monitors project activity. Filter by date/action type.
- 📖 **`list_group_iterations`**: List group iterations/sprints for agile planning. Requires GitLab Premium.

#### Users & Utilities
- 📖 **`get_users`**: Search GitLab users with smart pattern detection. Auto-detects emails, usernames, or names.
- 📖 **`download_attachment`**: Download file attachments from issues/MRs by secret and filename.

#### Todos (Task Queue)
- 📖 **`list_todos`**: View your GitLab todos (notifications requiring action). Filter by state, action type, or target type.
- ✏️ **`manage_todos`**: Manage todo items. Actions: "mark_done" completes single todo, "mark_all_done" clears queue, "restore" undoes completed todo.

### Labels Management (5 tools)
Requires USE_LABELS=true environment variable (enabled by default). Supports both project and group labels.

- ✏️ **`create_label`**: Create a new label in a project or group
- ✏️ **`update_label`**: Update an existing label in a project or group
- ✏️ **`delete_label`**: Delete a label from a project or group
- 📖 **`get_label`**: Get a single label from a project or group
- 📖 **`list_labels`**: List labels for a project or group

### Merge Requests Management (5 CQRS tools)
Requires USE_MRS=true environment variable (enabled by default). Uses CQRS pattern with action-based tools.

#### Merge Request Browsing (Query)
- 📖 **`browse_merge_requests`**: BROWSE merge requests. Actions: "list" shows MRs with filtering, "get" retrieves single MR by IID or branch, "diffs" shows file changes, "compare" diffs two branches/commits.
- 📖 **`browse_mr_discussions`**: BROWSE MR discussions and draft notes. Actions: "list" shows all discussion threads, "drafts" lists unpublished draft notes, "draft" gets single draft note.

#### Merge Request Management (Command)
- ✏️ **`manage_merge_request`**: MANAGE merge requests. Actions: "create" creates new MR, "update" modifies existing MR, "merge" merges approved MR into target branch.
- ✏️ **`manage_mr_discussion`**: MANAGE MR discussions. Actions: "comment" adds comment to issue/MR, "thread" starts new discussion, "reply" responds to existing thread, "update" modifies note.
- ✏️ **`manage_draft_notes`**: MANAGE draft notes. Actions: "create" creates draft note, "update" modifies draft, "publish" publishes single draft, "publish_all" publishes all drafts, "delete" removes draft.

### File Operations (2 CQRS tools)
Requires USE_FILES=true environment variable (enabled by default). Uses CQRS pattern with action-based tools.

- 📖 **`browse_files`**: BROWSE repository files. Actions: "tree" lists files/folders with pagination, "content" reads file contents. Use for exploring project structure or reading source code.
- ✏️ **`manage_files`**: MANAGE repository files. Actions: "single" creates/updates one file, "batch" commits multiple files atomically, "upload" adds markdown attachments.

### CI/CD Variables (5 tools)
Requires USE_VARIABLES=true environment variable (enabled by default). Supports both project-level and group-level variables.

- 📖 **`list_variables`**: List all CI/CD variables for a project or group with their configuration and security settings
- 📖 **`get_variable`**: Get a specific CI/CD variable by key from a project or group, optionally filtered by environment scope
- ✏️ **`create_variable`**: Create a new CI/CD variable for automated deployments and pipeline configuration in a project or group
- ✏️ **`update_variable`**: Update an existing CI/CD variable's value, security settings, or configuration in a project or group
- ✏️ **`delete_variable`**: Remove a CI/CD variable from a project or group

### Work Items (5 tools)
Modern GraphQL API for issues, epics, tasks, and more. Requires USE_WORKITEMS=true (enabled by default).

- ✏️ **`create_work_item`**: Create a new work item (epic, issue, task, etc.) in a GitLab group
- ✏️ **`update_work_item`**: Update an existing work item
- ✏️ **`delete_work_item`**: Delete a work item
- 📖 **`get_work_item`**: Get details of a specific work item by ID
- 📖 **`list_work_items`**: List work items from a GitLab group with optional filtering by type

### Wiki Management (5 tools)
Requires USE_GITLAB_WIKI=true environment variable. Supports both project-level and group-level wikis.

- ✏️ **`create_wiki_page`**: Create a new wiki page in a GitLab project or group
- ✏️ **`update_wiki_page`**: Update an existing wiki page in a GitLab project or group
- ✏️ **`delete_wiki_page`**: Delete a wiki page from a GitLab project or group
- 📖 **`get_wiki_page`**: Get details of a specific wiki page from a project or group
- 📖 **`list_wiki_pages`**: List wiki pages in a GitLab project or group

### Milestones (9 tools)
Requires USE_MILESTONE=true environment variable. Supports both project and group milestones.

- ✏️ **`create_milestone`**: Create a new milestone in a GitLab project or group
- ✏️ **`edit_milestone`**: Edit an existing milestone in a GitLab project or group
- ✏️ **`delete_milestone`**: Delete a milestone from a GitLab project or group
- ✏️ **`promote_milestone`**: Promote a project milestone to a group milestone
- 📖 **`get_milestone`**: Get details of a specific project or group milestone
- 📖 **`get_milestone_issue`**: Get issues associated with a specific project or group milestone
- 📖 **`get_milestone_merge_requests`**: Get merge requests associated with a specific project or group milestone
- 📖 **`get_milestone_burndown_events`**: Get burndown events for a specific project or group milestone
- 📖 **`list_milestones`**: List milestones in a GitLab project or group with filtering options

### Pipelines & CI/CD (12 tools)
Requires USE_PIPELINE=true environment variable.

- ✏️ **`create_pipeline`**: Create a new pipeline for a branch or tag
- ✏️ **`retry_pipeline`**: Retry a failed or canceled pipeline
- ✏️ **`cancel_pipeline`**: Cancel a running pipeline
- ✏️ **`play_pipeline_job`**: Run a manual pipeline job
- ✏️ **`retry_pipeline_job`**: Retry a failed or canceled pipeline job
- ✏️ **`cancel_pipeline_job`**: Cancel a running pipeline job
- 📖 **`get_pipeline`**: Get details of a specific pipeline in a GitLab project
- 📖 **`get_pipeline_job`**: Get details of a GitLab pipeline job number
- 📖 **`get_pipeline_job_output`**: Get the output/trace of a GitLab pipeline job with optional pagination to limit context window usage
- 📖 **`list_pipelines`**: List pipelines in a GitLab project with filtering options
- 📖 **`list_pipeline_jobs`**: List all jobs in a specific pipeline
- 📖 **`list_pipeline_trigger_jobs`**: List all trigger jobs (bridges) in a specific pipeline that trigger downstream pipelines

## CLI Tools 🔧

### list-tools - Browse Available Tools

The `list-tools` CLI utility helps you explore all available GitLab MCP tools, their descriptions, parameters, and tier requirements.

#### Installation

```bash
# Install dependencies
yarn install

# Build the project
yarn build
```

#### Usage

```bash
# List all tools with descriptions and tier badges
yarn list-tools

# Show all tools with full parameter details
yarn list-tools --detail

# List tools in simple format (names only)
yarn list-tools --simple

# Show tools for a specific entity
yarn list-tools --entity workitems
yarn list-tools --entity "merge requests"

# Get detailed info for a specific tool
yarn list-tools --tool create_work_item

# Export as JSON for programmatic use
yarn list-tools --json

# Show environment configuration
yarn list-tools --env

# Test with different configurations
GITLAB_READONLY=true yarn list-tools        # Show only read-only tools
USE_WORKITEMS=false yarn list-tools         # Hide work items tools
```

#### Features

- **Tier Badges** - Visual indicators for GitLab tier requirements:
  - 🟢 Free - Available in all GitLab tiers
  - 🟡 Premium - Requires GitLab Premium or higher
  - 🔴 Ultimate - Requires GitLab Ultimate

- **Parameter Documentation** - Shows all input parameters with:
  - Parameter name and type
  - Required/optional status
  - Detailed descriptions

- **Environment Filtering** - Respects environment variables:
  - `GITLAB_READONLY` - Show only read-only tools
  - `USE_*` flags - Enable/disable tool categories
  - `GITLAB_DENIED_TOOLS_REGEX` - Filter tools by regex pattern

- **Multiple Output Formats**:
  - Markdown (default) - Human-readable with formatting
  - JSON - Machine-readable for automation
  - Simple - Just tool names for scripting

#### Examples

```bash
# Find all tools related to merge requests
yarn list-tools --entity mrs

# Check what parameters are needed for creating a work item
yarn list-tools --tool create_work_item

# List all available tools with their input schemas (for MCP agents)
yarn list-tools --detail

# Export tool list for documentation
yarn list-tools --json > tools.json

# Verify read-only mode configuration
GITLAB_READONLY=true yarn list-tools --simple | wc -l
```

## Testing

This project includes comprehensive integration tests that verify functionality against a real GitLab instance.

### Running Tests

```bash
# Run all tests (requires .env.test configuration)
yarn test

# Run with verbose output
yarn test --verbose

# Run specific test suites
yarn test tests/integration/data-lifecycle.test.ts
yarn test tests/integration/schemas/workitems.test.ts
```

### Quick Tool Testing

For rapid testing of individual MCP tools:

```bash
# Test specific tools directly
./scripts/test_mcp.sh '{"name": "list_work_items", "arguments": {"namespacePath": "test"}}'
./scripts/test_mcp.sh '{"name": "get_work_item_types", "arguments": {"namespacePath": "test"}}'
./scripts/test_mcp.sh '{"name": "create_work_item", "arguments": {"namespacePath": "test", "workItemType": "EPIC", "title": "Test Epic"}}'
```

The `test_mcp.sh` script automatically:
- Loads environment from `.env.test`
- Sends proper MCP initialization sequence
- Executes your tool call with proper JSON-RPC formatting
- Perfect for debugging individual tools and handlers

### Test Architecture

- **200+ integration tests** running against real GitLab 18.3 Ultimate instance
- **Data lifecycle pattern** - Creates test infrastructure once, shared across dependent tests
- **Work Items CRUD testing** - Complete Create/Read/Update/Delete for both Issues and Epics
- **Schema validation** - All 50+ schemas validated against real API responses
- **Dependency chain** - Tests run in proper order using `--runInBand` for reliable results

For detailed testing documentation, see [TESTING.md](TESTING.md).

## 💖 Support the Project

This GitLab MCP Server is developed and maintained with care for the community. If it saves you time or helps your workflow, consider supporting its continued development!

<div align="center">

![USDT TRC-20 Donation QR Code](assets/usdt-qr.svg)

☕ **Buy me a coffee with USDT (TRC-20)**
`TFDsezHa1cBkoeZT5q2T49Wp66K8t2DmdA`

📱 *Scan QR code with your wallet (TronLink, Trust Wallet, Exodus, etc.)*

**Every contribution helps keep this project alive and growing! 🚀**

</div>

---

**Maintained with ❤️ by [Dmitry Prudnikov](https://github.com/polaz)**
**Original work by [zereight](https://github.com/zereight) - Thank you for the foundation!**
# Version 5.0.0
