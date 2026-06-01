# CLI Arguments

Some MCP clients (like GitHub Copilot CLI) don't pass environment variables
reliably. For those clients, configure the server with **CLI arguments**
instead.

CLI arguments take precedence over environment variables.

## Example config

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

## Available arguments

| Argument               | Equivalent env var             | Description                                         |
| ---------------------- | ------------------------------ | --------------------------------------------------- |
| `--token`              | `GITLAB_PERSONAL_ACCESS_TOKEN` | GitLab Personal Access Token.                       |
| `--api-url`            | `GITLAB_API_URL`               | GitLab API URL (e.g., `https://gitlab.com/api/v4`). |
| `--read-only=true`     | `GITLAB_READ_ONLY_MODE`        | Enable read-only mode.                              |
| `--use-wiki=true`      | `USE_GITLAB_WIKI`              | Enable wiki API tools.                              |
| `--use-milestone=true` | `USE_MILESTONE`                | Enable milestone API tools.                         |
| `--use-pipeline=true`  | `USE_PIPELINE`                 | Enable pipeline API tools.                          |

For the full list of configuration options, see
[Environment Variables](../configuration/environment-variables.md).
