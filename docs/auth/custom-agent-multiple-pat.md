# Custom Agents and Multiple PAT Setup

This guide explains how to run `gitlab-mcp` for custom agents, single-user PAT
setups, multi-user deployments, and restricted tool surfaces.

## Local Single-PAT Setup

Use this when one local MCP client should access GitLab with one Personal Access
Token.

```bash
GITLAB_PERSONAL_ACCESS_TOKEN=glpat-... \
GITLAB_API_URL=https://gitlab.com/api/v4 \
npx -y @zereight/mcp-gitlab
```

In this mode:

- The server process uses `GITLAB_PERSONAL_ACCESS_TOKEN`.
- The token is shared by every request handled by that local process.
- This is the simplest setup for stdio clients and local development.

## Multi-User or Multiple-PAT Setup

Use remote authorization when different users or agent sessions need different
GitLab tokens.

```bash
STREAMABLE_HTTP=true \
REMOTE_AUTHORIZATION=true \
GITLAB_API_URL=https://gitlab.com/api/v4 \
npx -y @zereight/mcp-gitlab
```

Clients send their GitLab token on each HTTP session:

```http
Authorization: Bearer glpat-user-token
```

or:

```http
Private-Token: glpat-user-token
```

In this mode:

- Each session stores its own token.
- Tokens from one session are not reused for another session.
- `SESSION_TIMEOUT_SECONDS` controls inactivity expiration.
- After a session expires, the client must send auth headers again.

Do not put user PATs into a shared server config. The shared server should only
enable remote authorization and let each client provide its own token.

## Multiple GitLab Instances

Enable dynamic API URL support when one server must connect to different GitLab
instances.

```bash
STREAMABLE_HTTP=true \
REMOTE_AUTHORIZATION=true \
ENABLE_DYNAMIC_API_URL=true \
npx -y @zereight/mcp-gitlab
```

Clients include the target instance:

```http
X-GitLab-API-URL: https://gitlab.example.com/api/v4
```

`/api/v4` URLs are recommended. The server also accepts a GitLab base URL and
normalizes it by appending `/api/v4`.

## Tool Customization

Custom agents can expose only the tools they need.

```bash
GITLAB_TOOLSETS=issues,merge_requests,projects \
GITLAB_TOOLS=get_file_contents \
GITLAB_DENIED_TOOLS_REGEX="^(delete_|merge_)" \
npx -y @zereight/mcp-gitlab
```

Available controls:

- `GITLAB_TOOLSETS`: expose named tool groups, such as `issues`,
  `merge_requests`, `projects`, or `pipelines`.
- `GITLAB_TOOLS`: add individual tool names on top of enabled toolsets.
- `GITLAB_DENIED_TOOLS_REGEX`: hide tools whose names match a regular
  expression.
- `GITLAB_TOOL_POLICY_APPROVE`: expose tools but require `_confirmed: true`
  before execution.
- `GITLAB_TOOL_POLICY_HIDDEN`: hide specific tools from `tools/list`.

## Example Configurations

### Local Single PAT

```bash
GITLAB_PERSONAL_ACCESS_TOKEN=glpat-local-user \
GITLAB_API_URL=https://gitlab.com/api/v4 \
npx -y @zereight/mcp-gitlab
```

### Hosted Multi-User HTTP Server

```bash
STREAMABLE_HTTP=true \
REMOTE_AUTHORIZATION=true \
SESSION_TIMEOUT_SECONDS=3600 \
GITLAB_API_URL=https://gitlab.com/api/v4 \
npx -y @zereight/mcp-gitlab
```

Each client sends `Authorization: Bearer <PAT>` or `Private-Token: <PAT>`.

### Restricted Agent

```bash
STREAMABLE_HTTP=true \
REMOTE_AUTHORIZATION=true \
GITLAB_TOOLSETS=issues,merge_requests,projects \
GITLAB_DENIED_TOOLS_REGEX="^(delete_|merge_)" \
GITLAB_TOOL_POLICY_APPROVE="create_issue,update_issue,create_merge_request" \
npx -y @zereight/mcp-gitlab
```

This exposes issue, merge request, and project tools while hiding destructive
delete and merge operations. Selected write tools remain visible but require
explicit confirmation.

## Security Notes

- Use HTTPS for remote deployments.
- Do not hard-code user PATs into shared agent configs.
- Prefer read-only PAT scopes for read-only agents.
- Isolate deployment secrets from per-user GitLab tokens.
- Keep `SESSION_TIMEOUT_SECONDS` short enough for your deployment risk profile.
