# Use the CLI without MCP

The same binary that runs the MCP server is also a GitLab CLI. You can read
merge requests, issues, and pipelines from a terminal or an agent skill **without
registering any MCP server**. You only need credentials.

Pick one of the two options below.

| | Option A: Personal Access Token | Option B: OAuth device flow |
| --- | --- | --- |
| Setup effort | 1 minute | Needs a GitLab OAuth application |
| Needs a browser on this machine | No | No (you open the URL anywhere) |
| Credential lifetime | Until the token expires | Auto-refreshed |
| Best for | Local use, CI, quick start | SSO instances, shared machines |

## Install

```bash
npm install -g @zereight/mcp-gitlab
zereight-mcp-gitlab --help
```

`mcp-gitlab` is the legacy alias of the same binary.

## Option A: Personal Access Token

1. In GitLab, open **Preferences → Access tokens** and create a token.
   Use the `read_api` scope for read-only work, `api` if you need to write.
2. Export it for the shell session. Read it without echo so it stays out of your
   shell history:

```bash
read -rs GITLAB_PERSONAL_ACCESS_TOKEN && export GITLAB_PERSONAL_ACCESS_TOKEN
export GITLAB_API_URL=https://gitlab.example.com/api/v4   # omit for gitlab.com
```

3. Verify:

```bash
zereight-mcp-gitlab user whoami
```

> Prefer the environment variable over `--token`. Command-line arguments are
> visible to other users through `ps`.

## Option B: OAuth device flow

1. Create an OAuth application in GitLab (**Preferences → Applications**) with
   the `api` scope (or `read_api` for read-only) and copy its Application ID.
   See [OAuth2 Setup](../auth/oauth-setup.md) for the details.
2. Log in once. This prints a URL and a code; open the URL on any device:

```bash
export GITLAB_OAUTH_CLIENT_ID=YOUR_APP_ID
export GITLAB_API_URL=https://gitlab.example.com/api/v4   # omit for gitlab.com
zereight-mcp-gitlab auth
```

3. Tell the CLI to use the stored token, then verify:

```bash
export GITLAB_USE_OAUTH=true
zereight-mcp-gitlab user whoami
```

The token is stored in `~/.gitlab-mcp-token.json`. If you passed `--token-path`
to `auth`, set `GITLAB_OAUTH_TOKEN_PATH` to the same path.

Run `auth` **before** the first command. If `GITLAB_USE_OAUTH=true` is set but no
token file exists, the CLI falls back to the localhost browser callback flow.

## Everyday commands

```bash
zereight-mcp-gitlab mr list --project-id group/project --state opened
zereight-mcp-gitlab mr view --project-id group/project --mr-iid 42
zereight-mcp-gitlab mr files --project-id group/project --mr-iid 42
zereight-mcp-gitlab mr diff --project-id group/project --mr-iid 42
zereight-mcp-gitlab mr discussions --project-id group/project --mr-iid 42
zereight-mcp-gitlab tool get_merge_request --project-id group/project --merge-request-iid 42 --output json
```

Add `--output json` to pipe into `jq`. See [Human CLI](./cli-arguments.md#human-cli)
for the full command list and safety rules (`--yes`, `--permission-mode`).

## Keep it read-only

```bash
export GITLAB_PERMISSION_MODE=readonly
```

Writes are refused with exit code `2` before any network call.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Missing GitLab credentials` (exit `2`) | No PAT and `GITLAB_USE_OAUTH` is not `true` | Set one of the two options above |
| `Refusing to send OAuth tokens over cleartext HTTP` | OAuth is on and `GITLAB_API_URL` is `http://` to a non-localhost host | Use an `https://` URL (plain `http://` is only allowed for `localhost`) |
| `401 Unauthorized` | Expired or under-scoped token | Create a new token or re-run `auth` |
| `404 Not Found` on a project you can open | Wrong `GITLAB_API_URL`, or token lacks access | Check the URL ends with `/api/v4` and the token's scope |
| Browser tries to open during a command | OAuth enabled but no stored token | Run `auth` first |
| Needs a different instance per command | `GITLAB_API_URL` is global | Set it inline: `GITLAB_API_URL=... zereight-mcp-gitlab ...` |
