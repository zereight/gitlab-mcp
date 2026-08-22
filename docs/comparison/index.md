# GitLab MCP Comparisons

This section helps you choose between `@zereight/mcp-gitlab` and other community GitLab MCP
servers.

## Quick summary

| | @zereight/mcp-gitlab | GitLab MCP A |
|---|----------------------|--------------|
| **Best for** | AI agent workflows (MR review, pipelines, issues) | Enterprise platform teams (multi-instance, CQRS tooling) |
| **Tool model** | ~217 granular tools + `discover_tools` | CQRS-style grouped tools with action parameters |
| **Token budget** | Start minimal via `discover_tools` / toolsets | Fewer listed tools by default |
| **Node.js** | >=18 | Typically >=24 |
| **License** | MIT | Varies (often Apache-2.0) |
| **Multi-instance** | Planned ([design doc](../configuration/multi-instance-design.md)) | Supported in some variants |
| **Agent Skill** | Built in (`skills/gitlab-mcp/`) | Not typical |

## Documents

- [GitLab MCP A (community CQRS-style)](community-gitlab-mcp-a.md) — architectural comparison
  against grouped read/write tool models

## Choosing @zereight/mcp-gitlab

Pick this server when you want:

- MR 2-step review (`list_merge_request_changed_files` → batched diff)
- Broad GitLab API coverage with fine-grained tool names
- `discover_tools` or `GITLAB_TOOLSETS` for token control without CQRS
- Remote auth, stateless OAuth (HPA), and dynamic API URL routing
- MIT license and Node 18+ support
- Setup guides for Claude, Cursor, Copilot, VS Code, and more

## Choosing GitLab MCP A

Pick a CQRS-style community server when you want:

- A smaller fixed tool list with `browse_*` / `manage_*` naming
- Version- or tier-aware schema filtering out of the box
- Multi-instance YAML configuration today (before our POC ships)
- Connection resilience patterns (disconnected mode, auto-reconnect)
