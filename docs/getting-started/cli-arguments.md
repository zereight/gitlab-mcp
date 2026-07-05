# CLI Arguments

Some MCP clients (like GitHub Copilot CLI) don't pass environment variables
reliably. For those clients, configure the server with **CLI arguments**
instead.

CLI arguments take precedence over environment variables.

Install the server globally once:

```bash
npm install -g @zereight/mcp-gitlab
```

No global install? Pin `npx` to the previous stable release and keep the server flags after it, for example `npx -y @zereight/mcp-gitlab@2.1.28 --token=...`. Use `@zereight/mcp-gitlab@latest` if you always want the newest release.

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

For the full list of configuration options, see
[Environment Variables](../configuration/environment-variables.md).
