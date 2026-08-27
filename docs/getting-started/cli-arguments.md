# CLI Arguments

Some MCP clients (like GitHub Copilot CLI) don't pass environment variables
reliably. For those clients, configure the server with **CLI arguments**
instead.

CLI arguments take precedence over environment variables.

Install the server once:

```bash
brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp
brew install zereight/gitlab-mcp/zereight-mcp-gitlab
```

Or with npm:

```bash
npm install -g @zereight/mcp-gitlab
```

No global install? Pin `npx` to the previous stable release and keep the server flags after it, for example `npx -y @zereight/mcp-gitlab@2.1.52 --token=...`. Use `@zereight/mcp-gitlab@latest` if you always want the newest release.

## Example config

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "zereight-mcp-gitlab",
      "args": ["--token=YOUR_GITLAB_TOKEN", "--api-url=https://gitlab.com/api/v4"],
      "tools": ["*"]
    }
  }
}
```

## Available arguments

| Argument               | Equivalent env var             | Description                                         |
| ---------------------- | ------------------------------ | --------------------------------------------------- |
| `--token`              | `GITLAB_PERSONAL_ACCESS_TOKEN` | GitLab Personal Access Token.                       |
| `--api-url`            | `GITLAB_API_URL`               | GitLab API URL (e.g., `https://gitlab.com/api/v4`). |
| `--read-only=true`     | `GITLAB_READ_ONLY_MODE`        | Enable read-only mode (deprecated — prefer `--permission-mode=readonly`). |
| `--permission-mode`    | `GITLAB_PERMISSION_MODE`       | `readonly`, `modify` (no delete tools), or `full`.  |
| `--use-wiki=true`      | `USE_GITLAB_WIKI`              | Enable wiki API tools.                              |
| `--use-milestone=true` | `USE_MILESTONE`                | Enable milestone API tools.                         |
| `--use-pipeline=true`  | `USE_PIPELINE`                 | Enable pipeline API tools.                          |
| `--disable-version-check=true` | `GITLAB_DISABLE_VERSION_CHECK` | Disable the startup new-version notice.     |

> **Deprecation notice:** `--read-only=true` and `GITLAB_READ_ONLY_MODE` are kept for
> backward compatibility but will be removed in a future major version.
> Use `--permission-mode=readonly` or `GITLAB_PERMISSION_MODE=readonly` instead.

## Subcommands

Subcommands are not MCP server flags. They run and exit without starting the MCP server.

### `auth`

Run GitLab's OAuth Device Authorization Grant (GitLab 17.9+; 17.2–17.8 need
`oauth2_device_grant_flow`) and store a token at `~/.gitlab-mcp-token.json`
(or `GITLAB_OAUTH_TOKEN_PATH`). This complements the existing localhost
callback flow; it does not replace it.

```bash
zereight-mcp-gitlab auth --client-id YOUR_APP_ID
zereight-mcp-gitlab auth --client-id YOUR_APP_ID --api-url https://gitlab.example.com/api/v4
zereight-mcp-gitlab auth --help
```

| Argument        | Equivalent env var         | Description                                      |
| --------------- | -------------------------- | ------------------------------------------------ |
| `--client-id`   | `GITLAB_OAUTH_CLIENT_ID`   | GitLab OAuth application ID.                     |
| `--api-url`     | `GITLAB_API_URL`           | GitLab API URL; `/api/v4` is stripped to origin. |
| `--token-path`  | `GITLAB_OAUTH_TOKEN_PATH`  | Token file path.                                 |

After `auth` succeeds, start the MCP server with `GITLAB_USE_OAUTH=true` and the
same client ID. If you use `--token-path`, set `GITLAB_OAUTH_TOKEN_PATH` to the
same path when you start the server. See [OAuth2 Authentication Setup Guide](../auth/oauth-setup.md#standalone-device-flow-auth-command).

For the full list of configuration options, see
[Environment Variables](../configuration/environment-variables.md).
