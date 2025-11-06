# GitLab MCP Server

[![Star History Chart](https://api.star-history.com/svg?repos=zereight/gitlab-mcp&type=Date)](https://www.star-history.com/#zereight/gitlab-mcp&Date)

## @zereight/mcp-gitlab

[![smithery badge](https://smithery.ai/badge/@zereight/gitlab-mcp)](https://smithery.ai/server/@zereight/gitlab-mcp)

GitLab MCP(Model Context Protocol) Server. **Includes bug fixes and improvements over the original GitLab MCP server.**

<a href="https://glama.ai/mcp/servers/7jwbk4r6d7"><img width="380" height="200" src="https://glama.ai/mcp/servers/7jwbk4r6d7/badge" alt="gitlab mcp MCP server" /></a>

## Usage

### Using with Claude App, Cline, Roo Code, Cursor, Kilo Code

When using with the Claude App, you need to set up your API key and URLs directly.

#### Authentication Methods

The server supports two authentication methods:

1. **Personal Access Token** (traditional method)
2. **OAuth2** (recommended for better security)

#### Using OAuth2 Authentication

OAuth2 provides a more secure authentication flow using browser-based authentication. When enabled, the server will:
1. Open your browser to GitLab's authorization page
2. Wait for you to approve the access
3. Store the token securely for future use
4. Automatically refresh the token when it expires

For detailed OAuth2 setup instructions, see [OAuth Setup Guide](./docs/oauth-setup.md).

Quick setup - first create a GitLab OAuth application:

1. Go to your GitLab instance: `Settings` → `Applications`
2. Create a new application with:
   - **Name**: `GitLab MCP Server` (or any name you prefer)
   - **Redirect URI**: `http://127.0.0.1:8888/callback`
   - **Scopes**: Select `api` (provides complete read/write access to the API)
3. Copy the **Application ID** (this is your Client ID)

Then configure the MCP server with OAuth:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_USE_OAUTH": "true",
        "GITLAB_OAUTH_CLIENT_ID": "your_oauth_client_id",
        "GITLAB_OAUTH_REDIRECT_URI": "http://127.0.0.1:8888/callback",
        "GITLAB_API_URL": "your_gitlab_api_url",
        "GITLAB_PROJECT_ID": "your_project_id", // Optional: default project
        "GITLAB_ALLOWED_PROJECT_IDS": "", // Optional: comma-separated list of allowed project IDs
        "GITLAB_READ_ONLY_MODE": "false",
        "USE_GITLAB_WIKI": "false", // use wiki api?
        "USE_MILESTONE": "false", // use milestone api?
        "USE_PIPELINE": "false" // use pipeline api?
      }
    }
  }
}
```

#### Using Personal Access Token (traditional)

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_gitlab_token",
        "GITLAB_API_URL": "your_gitlab_api_url",
        "GITLAB_PROJECT_ID": "your_project_id", // Optional: default project
        "GITLAB_ALLOWED_PROJECT_IDS": "", // Optional: comma-separated list of allowed project IDs
        "GITLAB_READ_ONLY_MODE": "false",
        "USE_GITLAB_WIKI": "false", // use wiki api?
        "USE_MILESTONE": "false", // use milestone api?
        "USE_PIPELINE": "false" // use pipeline api?
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
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "${input:gitlab-token}",
        "GITLAB_API_URL": "your-fancy-gitlab-url",
        "GITLAB_READ_ONLY_MODE": "true",
        ...
      }
    }
  }
}
```

#### Strands Agents SDK (MCP Tools)

```python
env_vars = {
        "GITLAB_PERSONAL_ACCESS_TOKEN": gitlab_access_token,
        "GITLAB_API_URL": gitlab_api_url,
        "USE_GITLAB_WIKI": use_gitlab_wiki
        # ......the rest of the optional parameters 
}

stdio_gitlab_mcp_client = MCPClient(
        lambda: stdio_client(
            StdioServerParameters(
                command="npx",
                args=["-y", "@zereight/mcp-gitlab"],
                env=env_vars,
            )
        )
    )
```


#### Docker

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
        "GITLAB_PERSONAL_ACCESS_TOKEN",
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
        "iwakitakuma/gitlab-mcp"
      ],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_gitlab_token",
        "GITLAB_API_URL": "https://gitlab.com/api/v4", // Optional, for self-hosted GitLab
        "GITLAB_READ_ONLY_MODE": "false",
        "USE_GITLAB_WIKI": "true",
        "USE_MILESTONE": "true",
        "USE_PIPELINE": "true"
      }
    }
  }
}
```

- sse

```shell
docker run -i --rm \
  -e GITLAB_PERSONAL_ACCESS_TOKEN=your_gitlab_token \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_READ_ONLY_MODE=true \
  -e USE_GITLAB_WIKI=true \
  -e USE_MILESTONE=true \
  -e USE_PIPELINE=true \
  -e SSE=true \
  -p 3333:3002 \
  iwakitakuma/gitlab-mcp
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
  -e GITLAB_PERSONAL_ACCESS_TOKEN=your_gitlab_token \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_READ_ONLY_MODE=true \
  -e USE_GITLAB_WIKI=true \
  -e USE_MILESTONE=true \
  -e USE_PIPELINE=true \
  -e STREAMABLE_HTTP=true \
  -p 3333:3002 \
  iwakitakuma/gitlab-mcp
```

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

### Environment Variables

#### Authentication Configuration

- `GITLAB_PERSONAL_ACCESS_TOKEN`: Your GitLab personal access token. **Required in standard mode**; not used when `REMOTE_AUTHORIZATION=true` or when using OAuth.
- `GITLAB_USE_OAUTH`: Set to `true` to enable OAuth2 authentication instead of personal access token.
- `GITLAB_OAUTH_CLIENT_ID`: The Client ID from your GitLab OAuth application. Required when using OAuth.
- `GITLAB_OAUTH_REDIRECT_URI`: The OAuth callback URL. Default: `http://127.0.0.1:8888/callback`
- `GITLAB_OAUTH_TOKEN_PATH`: Custom path to store the OAuth token. Default: `~/.gitlab-mcp-token.json`
- `REMOTE_AUTHORIZATION`: When set to 'true', enables remote per-session authorization via HTTP headers. In this mode:
  - The server accepts GitLab PAT tokens from HTTP headers (`Authorization: Bearer <token>` or `Private-Token: <token>`) on a per-session basis
  - `GITLAB_PERSONAL_ACCESS_TOKEN` environment variable is **not required** and ignored
  - Only works with **Streamable HTTP transport** (`STREAMABLE_HTTP=true`) because session management was already handled by the transport layer
  - **SSE transport is disabled** - attempting to use SSE with remote authorization will cause the server to exit with an error
  - Each client session can use a different token, enabling multi-user support with secure session isolation
  - Tokens are stored per session and automatically cleaned up when sessions close or timeout
- `SESSION_TIMEOUT_SECONDS`: Session auth token timeout in seconds. Default: `3600` (1 hour). Valid range: 1-86400 seconds (recommended: 60+). After this period of inactivity, the auth token is removed but the transport session remains active. The client must provide auth headers again on the next request. Only applies when `REMOTE_AUTHORIZATION=true`.

#### General Configuration

- `GITLAB_API_URL`: Your GitLab API URL. (Default: `https://gitlab.com/api/v4`)
- `GITLAB_PROJECT_ID`: Default project ID. If set, Overwrite this value when making an API request.
- `GITLAB_ALLOWED_PROJECT_IDS`: Optional comma-separated list of allowed project IDs. When set with a single value, acts as a default project (like the old "lock" mode). When set with multiple values, restricts access to only those projects. Examples:
  - Single value `123`: MCP server can only access project 123 and uses it as default
  - Multiple values `123,456,789`: MCP server can access projects 123, 456, and 789 but requires explicit project ID in requests
- `GITLAB_READ_ONLY_MODE`: When set to 'true', restricts the server to only expose read-only operations. Useful for enhanced security or when write access is not needed. Also useful for using with Cursor and it's 40 tool limit.
- `GITLAB_DENIED_TOOLS_REGEX`: When set as a regular expression, it excludes the matching tools.
- `USE_GITLAB_WIKI`: When set to 'true', enables the wiki-related tools (list_wiki_pages, get_wiki_page, create_wiki_page, update_wiki_page, delete_wiki_page). By default, wiki features are disabled.
- `USE_MILESTONE`: When set to 'true', enables the milestone-related tools (list_milestones, get_milestone, create_milestone, edit_milestone, delete_milestone, get_milestone_issue, get_milestone_merge_requests, promote_milestone, get_milestone_burndown_events). By default, milestone features are disabled.
- `USE_PIPELINE`: When set to 'true', enables the pipeline-related tools (list_pipelines, get_pipeline, list_pipeline_jobs, list_pipeline_trigger_jobs, get_pipeline_job, get_pipeline_job_output, create_pipeline, retry_pipeline, cancel_pipeline, play_pipeline_job, retry_pipeline_job, cancel_pipeline_job). By default, pipeline features are disabled.
- `GITLAB_AUTH_COOKIE_PATH`: Path to an authentication cookie file for GitLab instances that require cookie-based authentication. When provided, the cookie will be included in all GitLab API requests.
- `SSE`: When set to 'true', enables the Server-Sent Events transport.
- `STREAMABLE_HTTP`: When set to 'true', enables the Streamable HTTP transport. If both **SSE** and **STREAMABLE_HTTP** are set to 'true', the server will prioritize Streamable HTTP over SSE transport.
- `GITLAB_COMMIT_FILES_PER_PAGE`: The number of files per page that GitLab returns for commit diffs. This value should match the server-side GitLab setting. Adjust this if your GitLab instance uses a custom per-page value for commit diffs.

#### Performance & Security Configuration

- `MAX_SESSIONS`: Maximum number of concurrent sessions allowed. Default: `1000`. Valid range: 1-10000. When limit is reached, new connections are rejected with HTTP 503.
- `MAX_REQUESTS_PER_MINUTE`: Rate limit per session in requests per minute. Default: `60`. Valid range: 1-1000. Exceeded requests return HTTP 429.
- `PORT`: Server port. Default: `3002`. Valid range: 1-65535.

#### Monitoring Endpoints

When using Streamable HTTP transport, the following endpoints are available:

- `/health`: Health check endpoint returning server status, active sessions count, and uptime.
- `/metrics`: Detailed metrics including:
  - Active and total session counts
  - Authentication metrics (failures, expirations)
  - Rate limiting statistics
  - Resource usage (memory, uptime)
  - Configuration summary

### Remote Authorization Setup (Multi-User Support)

When using `REMOTE_AUTHORIZATION=true`, the MCP server can support multiple users, each with their own GitLab token passed via HTTP headers. This is useful for:
- Shared MCP server instances where each user needs their own GitLab access
- IDE integrations that can inject user-specific tokens into MCP requests

**Setup Example:**

```bash
# Start server with remote authorization
docker run -d \
  -e STREAMABLE_HTTP=true \
  -e REMOTE_AUTHORIZATION=true \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_READ_ONLY_MODE=true \
  -e SESSION_TIMEOUT_SECONDS=3600 \
  -p 3333:3002 \
  iwakitakuma/gitlab-mcp
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

## Tools 🛠️

<details>
<summary>Click to expand</summary>

<!-- TOOLS-START -->

1. `merge_merge_request` - Merge a merge request in a GitLab project
2. `create_or_update_file` - Create or update a single file in a GitLab project
3. `search_repositories` - Search for GitLab projects
4. `create_repository` - Create a new GitLab project
5. `get_file_contents` - Get the contents of a file or directory from a GitLab project
6. `push_files` - Push multiple files to a GitLab project in a single commit
7. `create_issue` - Create a new issue in a GitLab project
8. `create_merge_request` - Create a new merge request in a GitLab project
9. `fork_repository` - Fork a GitLab project to your account or specified namespace
10. `create_branch` - Create a new branch in a GitLab project
11. `get_merge_request` - Get details of a merge request (Either mergeRequestIid or branchName must be provided)
12. `get_merge_request_diffs` - Get the changes/diffs of a merge request (Either mergeRequestIid or branchName must be provided)
13. `list_merge_request_diffs` - List merge request diffs with pagination support (Either mergeRequestIid or branchName must be provided)
14. `get_branch_diffs` - Get the changes/diffs between two branches or commits in a GitLab project
15. `update_merge_request` - Update a merge request (Either mergeRequestIid or branchName must be provided)
16. `create_note` - Create a new note (comment) to an issue or merge request
17. `create_merge_request_thread` - Create a new thread on a merge request
18. `mr_discussions` - List discussion items for a merge request
19. `update_merge_request_note` - Modify an existing merge request thread note
20. `create_merge_request_note` - Add a new note to an existing merge request thread
21. `get_draft_note` - Get a single draft note from a merge request
22. `list_draft_notes` - List draft notes for a merge request
23. `create_draft_note` - Create a draft note for a merge request
24. `update_draft_note` - Update an existing draft note
25. `delete_draft_note` - Delete a draft note
26. `publish_draft_note` - Publish a single draft note
27. `bulk_publish_draft_notes` - Publish all draft notes for a merge request
28. `update_issue_note` - Modify an existing issue thread note
29. `create_issue_note` - Add a new note to an existing issue thread
30. `list_issues` - List issues (default: created by current user only; use scope='all' for all accessible issues)
31. `my_issues` - List issues assigned to the authenticated user (defaults to open issues)
32. `get_issue` - Get details of a specific issue in a GitLab project
33. `update_issue` - Update an issue in a GitLab project
34. `delete_issue` - Delete an issue from a GitLab project
35. `list_issue_links` - List all issue links for a specific issue
36. `list_issue_discussions` - List discussions for an issue in a GitLab project
37. `get_issue_link` - Get a specific issue link
38. `create_issue_link` - Create an issue link between two issues
39. `delete_issue_link` - Delete an issue link
40. `list_namespaces` - List all namespaces available to the current user
41. `get_namespace` - Get details of a namespace by ID or path
42. `verify_namespace` - Verify if a namespace path exists
43. `get_project` - Get details of a specific project
44. `list_projects` - List projects accessible by the current user
45. `list_project_members` - List members of a GitLab project
46. `list_labels` - List labels for a project
47. `get_label` - Get a single label from a project
48. `create_label` - Create a new label in a project
49. `update_label` - Update an existing label in a project
50. `delete_label` - Delete a label from a project
51. `list_group_projects` - List projects in a GitLab group with filtering options
52. `list_wiki_pages` - List wiki pages in a GitLab project
53. `get_wiki_page` - Get details of a specific wiki page
54. `create_wiki_page` - Create a new wiki page in a GitLab project
55. `update_wiki_page` - Update an existing wiki page in a GitLab project
56. `delete_wiki_page` - Delete a wiki page from a GitLab project
57. `get_repository_tree` - Get the repository tree for a GitLab project (list files and directories)
58. `list_pipelines` - List pipelines in a GitLab project with filtering options
59. `get_pipeline` - Get details of a specific pipeline in a GitLab project
60. `list_pipeline_jobs` - List all jobs in a specific pipeline
61. `list_pipeline_trigger_jobs` - List all trigger jobs (bridges) in a specific pipeline that trigger downstream pipelines
62. `get_pipeline_job` - Get details of a GitLab pipeline job number
63. `get_pipeline_job_output` - Get the output/trace of a GitLab pipeline job with optional pagination to limit context window usage
64. `create_pipeline` - Create a new pipeline for a branch or tag
65. `retry_pipeline` - Retry a failed or canceled pipeline
66. `cancel_pipeline` - Cancel a running pipeline
67. `play_pipeline_job` - Run a manual pipeline job
68. `retry_pipeline_job` - Retry a failed or canceled pipeline job
69. `cancel_pipeline_job` - Cancel a running pipeline job
70. `list_merge_requests` - List merge requests in a GitLab project with filtering options
71. `list_milestones` - List milestones in a GitLab project with filtering options
72. `get_milestone` - Get details of a specific milestone
73. `create_milestone` - Create a new milestone in a GitLab project
74. `edit_milestone` - Edit an existing milestone in a GitLab project
75. `delete_milestone` - Delete a milestone from a GitLab project
76. `get_milestone_issue` - Get issues associated with a specific milestone
77. `get_milestone_merge_requests` - Get merge requests associated with a specific milestone
78. `promote_milestone` - Promote a milestone to the next stage
79. `get_milestone_burndown_events` - Get burndown events for a specific milestone
80. `get_users` - Get GitLab user details by usernames
81. `list_commits` - List repository commits with filtering options
82. `get_commit` - Get details of a specific commit
83. `get_commit_diff` - Get changes/diffs of a specific commit
84. `list_group_iterations` - List group iterations with filtering options
85. `upload_markdown` - Upload a file to a GitLab project for use in markdown content
86. `download_attachment` - Download an uploaded file from a GitLab project by secret and filename
87. `list_events` - List all events for the currently authenticated user
88. `get_project_events` - List all visible events for a specified project
89. `list_releases` - List all releases for a project
90. `get_release` - Get a release by tag name
91. `create_release` - Create a new release in a GitLab project
92. `update_release` - Update an existing release in a GitLab project
93. `delete_release` - Delete a release from a GitLab project (does not delete the associated tag)
94. `create_release_evidence` - Create release evidence for an existing release (GitLab Premium/Ultimate only)
95. `download_release_asset` - Download a release asset file by direct asset path
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
