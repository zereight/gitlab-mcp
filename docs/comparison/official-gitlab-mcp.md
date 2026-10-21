# Official GitLab MCP Server

GitLab ships its own [MCP server](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)
inside GitLab, on the Free, Premium, and Ultimate tiers (Free since GitLab 19.2). This page compares
it with `@zereight/mcp-gitlab` on what decides whether it works in your setup: GitLab version, token
type, transport, rate limits, and tool controls.

Facts about the official server come from its documentation as read on 2026-10-21. Check the
[official page](https://docs.gitlab.com/user/model_context_protocol/mcp_server/) for changes.

## At a glance

|                    | @zereight/mcp-gitlab                                                                               | Official GitLab MCP server                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Where it runs**  | Your machine, container, or server (npm, Homebrew, Docker)                                         | Inside GitLab at `https://<gitlab-host>/api/v4/mcp`                                                             |
| **GitLab version** | Any instance with REST API v4; no documented minimum                                               | GitLab 18.3 or later (experiment); generally available in 19.5                                                  |
| **Turned on by**   | Nothing on the GitLab side; you supply a token                                                     | "Allow access to the MCP server" for the top-level group (GitLab.com) or the instance (Self-Managed, Dedicated) |
| **Tokens**         | Personal, project, and group access tokens, CI job tokens, OAuth, cookie file                      | OAuth token with the `mcp` scope, or a fine-grained personal access token                                       |
| **Transports**     | stdio, Streamable HTTP, legacy SSE                                                                 | HTTP (GitLab 18.6 and later); stdio through `mcp-remote`                                                        |
| **Node.js**        | >=18.17                                                                                            | 20 or later for stdio; none for HTTP                                                                            |
| **Rate limits**    | GitLab API limits for the token's user, plus `MAX_REQUESTS_PER_MINUTE` over Streamable HTTP or SSE | Separate MCP endpoint limit (GitLab.com, flags off by default: 60/min Free, 600/min Premium and Ultimate)       |
| **Tool selection** | `GITLAB_TOOLSETS`, `GITLAB_TOOLS`, `discover_tools`                                                | `X-Gitlab-Enabled-Mcp-Server-Toolsets` and `X-Gitlab-Enabled-Mcp-Server-Tools` headers                          |
| **Write controls** | `GITLAB_PERMISSION_MODE`, deny regex, approve and hidden policies, project allowlist               | GitLab permissions checked on every call                                                                        |
| **License**        | MIT                                                                                                | Part of GitLab                                                                                                  |

## GitLab version

The official server first shipped as an experiment in GitLab 18.3, became beta in 18.6, and became
generally available in 19.5. It moved from Premium to Free in 19.2, and toolset selection arrived in
19.5. An instance on an older release does not have the endpoint.

`@zereight/mcp-gitlab` calls the GitLab REST API v4 and, for some tools, GraphQL. It does not
document a minimum GitLab version. Newer features still need a GitLab release that has them: for
example, the `reviewer_state`, `note`, and `internal` options of `bulk_publish_draft_notes` need
GitLab 19.2. For instances that do not accept a personal access token as `Authorization: Bearer`, set
[`GITLAB_IS_OLD=true`](../configuration/environment-variables.md#gitlab_is_old) to send it as
`Private-Token`.

## Tokens

The official server accepts two kinds of token:

- An OAuth access token with the `mcp` scope
- A fine-grained personal access token with the MCP tool resource and the Execute permission

It rejects legacy personal access tokens, project access tokens, and group access tokens with
`403 Forbidden` and `insufficient_scope`, even when they have the `api` scope. The page does not
mention CI job tokens.

`@zereight/mcp-gitlab` sends the token you configure to the GitLab API, so GitLab decides what it
can do:

| Token                                    | Setting                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal, project, or group access token | [`GITLAB_PERSONAL_ACCESS_TOKEN`](../configuration/environment-variables.md#gitlab_personal_access_token) or `GITLAB_PERSONAL_ACCESS_TOKEN_FILE` |
| CI job token                             | [`GITLAB_JOB_TOKEN`](../configuration/environment-variables.md#gitlab_job_token)                                                                |
| Local browser OAuth                      | [`GITLAB_USE_OAUTH=true`](../auth/oauth-setup.md)                                                                                               |
| Cookie file                              | [`GITLAB_AUTH_COOKIE_PATH`](../configuration/environment-variables.md#gitlab_auth_cookie_path)                                                  |
| Per-session headers over HTTP            | [`REMOTE_AUTHORIZATION=true`](../auth/custom-agent-multiple-pat.md)                                                                             |
| OAuth for remote MCP clients             | [`GITLAB_MCP_OAUTH=true`](../configuration/environment-variables.md#gitlab_mcp_oauth)                                                           |

A CI job token can only reach the APIs GitLab allows for job tokens.

## Transports

The official server takes HTTP requests at `https://<gitlab-host>/api/v4/mcp`. GitLab documents
direct HTTP connections from 18.6. Clients that only speak stdio connect through the `mcp-remote`
proxy, which needs Node.js 20 or later.

`@zereight/mcp-gitlab` runs over stdio by default with Node.js 18.17 or later. Set
[`STREAMABLE_HTTP=true`](../configuration/environment-variables.md#streamable_http) or
[`SSE=true`](../configuration/environment-variables.md#sse) (legacy) to serve it over HTTP.

## Rate limits

On GitLab.com, the official server limits `POST /api/v4/mcp` per user by the namespace plan: 60
requests per minute on Free, 600 on Premium and Ultimate. GitLab introduced these limits in 19.5
behind feature flags that are disabled by default. The limit applies per user, not per client or
token, and requests also count toward the general GitLab.com limits. On Self-Managed and Dedicated,
an administrator sets one MCP limit for the instance.

`@zereight/mcp-gitlab` makes ordinary REST and GraphQL calls. They count toward the GitLab API limits
for the token's user, such as the
[GitLab.com rate limits](https://docs.gitlab.com/user/gitlab_com/#rate-limits-on-gitlabcom). A
single tool call can make more than one API request.

Over Streamable HTTP or SSE, the server also has its own request limit,
[`MAX_REQUESTS_PER_MINUTE`](../configuration/environment-variables.md#max_requests_per_minute)
(default 60), separate from the GitLab limits. The same value limits `/mcp` requests per client IP
(and per session with remote authorization or MCP OAuth), new `/sse` connections, and
`/downloads/*` requests. A client over any of them gets `429` from the server itself. It does not
apply over stdio.

## Tool selection and write controls

The official server returns a default set of toolsets: `core`, `merge_requests`, `work_items`,
`repository`, and `ci`, plus `meta` always and `duo_agent_platform` where GitLab Duo Agent Platform
is available. `wikis`, `code_security`, and `orbit` (added in 19.6) are opt-in. Clients choose
toolsets or single tools with HTTP headers. Listing a tool does not grant access: each call checks
the user's project and namespace permissions.

`@zereight/mcp-gitlab` calls GitLab as the token's user, so GitLab permissions apply too. In
addition, the server can narrow what an agent sees or runs:

| Control                                           | Setting                                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolsets and single tools                         | [`GITLAB_TOOLSETS`](../configuration/environment-variables.md#gitlab_toolsets), [`GITLAB_TOOLS`](../configuration/environment-variables.md#gitlab_tools) |
| Read only, or no delete and teardown              | [`GITLAB_PERMISSION_MODE`](../configuration/environment-variables.md#gitlab_permission_mode) (`readonly`, `modify`, `full`)                              |
| Block tools by name                               | [`GITLAB_DENIED_TOOLS_REGEX`](../configuration/environment-variables.md#gitlab_denied_tools_regex)                                                       |
| Hide from `tools/list` (callable only if allowed) | [`GITLAB_TOOL_POLICY_HIDDEN`](../configuration/environment-variables.md#gitlab_tool_policy_hidden)                                                       |
| Require `_confirmed: true` before a call runs     | [`GITLAB_TOOL_POLICY_APPROVE`](../configuration/environment-variables.md#gitlab_tool_policy_approve)                                                     |
| Limit which projects tools act on                 | [`GITLAB_ALLOWED_PROJECT_IDS`](../configuration/environment-variables.md#gitlab_allowed_project_ids)                                                     |
| Also hide other projects from listings and search | [`ENABLE_STRICT_PROJECT_SCOPE`](../configuration/environment-variables.md#enable_strict_project_scope) (`true`, with an allowlist)                       |

The opt-in `api` toolset (`gitlab_api_request`) still honors permission mode for its methods
(`readonly` allows only `GET`, `modify` rejects `DELETE`), and the project allowlist or a session
project scope on `/projects/:id` paths. It bypasses the other project and tool limits above, so
leave it off when you rely on them; see the [API tools reference](../tools/api.md).

See the [tools reference](../tools/index.md) for every toolset.

## Which one to pick

Pick the official server when:

- Your GitLab is 19.5 or later and the MCP access setting is on
- You want nothing to install or run
- Your client supports HTTP and OAuth, or you can issue fine-grained personal access tokens

Pick `@zereight/mcp-gitlab` when:

- Your GitLab release does not include the official server (before 18.3), or has only its
  experiment or beta (18.3 to 19.4), which needs Premium or Ultimate before 19.2 and has no toolset
  selection (added in 19.5)
- You use a classic personal access token, a project or group access token, or a CI job token
- You need read-only or no-delete modes, approval prompts, or a project allowlist
- You need tools outside the official toolsets; see the [tools reference](../tools/index.md)

You can also run both and give each client the one it needs.
