# GitLab MCP Comparisons

This section helps you choose between `@zereight/mcp-gitlab`, other community GitLab MCP servers,
and GitLab's official MCP server.

## Quick summary

| | @zereight/mcp-gitlab | GitLab MCP A |
|---|----------------------|--------------|
| **Best for** | AI agent workflows (MR review, pipelines, issues) | Enterprise platform teams (multi-instance, CQRS tooling) |
| **Tool model** | 288 tools: 285 in toolsets + `execute_graphql` + `discover_tools` + `help` | CQRS-style grouped tools with action parameters |
| **Token budget** | Default ~40 tools (~12k schema tokens). `GITLAB_TOOLSETS=all` is ~73k — prefer `discover_tools` or Skill + CLI | Fewer listed tools by default |
| **Node.js** | >=20 | Typically >=24 |
| **License** | MIT | Varies (often Apache-2.0) |
| **Multi-instance** | Planned ([design doc](../configuration/multi-instance-design.md)) | Supported in some variants |
| **Agent Skill** | Built in (`skills/gitlab-mcp/`) | Not typical |

### tools/list size (measured 2026-11-03) {: #toolslist-size-measured-2026-11-03 }

A client sends the whole `tools/list` result to the model at session start. Token estimate is UTF-8 bytes / 4. Re-measure with `npm run test:mock` (`test/tools-list-budget.test.ts`).

| Profile | Tools | JSON bytes | Est. tokens |
| ------- | ----: | ---------: | ----------: |
| Default (`core` + `discover_tools` + `help`) | 40 | 46,703 | 11,676 |
| `GITLAB_TOOL_PROFILE=slim` | 39 | 45,695 | 11,424 |
| `GITLAB_TOOLSETS=all` | 286 | 293,666 | 73,417 |

## Documents

- [GitLab MCP A (community CQRS-style)](community-gitlab-mcp-a.md) — architectural comparison
  against grouped read/write tool models
- [Official GitLab MCP server](official-gitlab-mcp.md) — GitLab version, tokens, transports, rate
  limits, and tool controls compared with the server built into GitLab

## Choosing @zereight/mcp-gitlab

Pick this server when you want:

- MR 2-step review (`list_merge_request_changed_files` → batched diff)
- Broad GitLab API coverage with fine-grained tool names
- `discover_tools` or a named `GITLAB_TOOLSETS` list for token control without CQRS (`all` loads ~all schemas)
- Remote auth, stateless OAuth (HPA), and dynamic API URL routing
- MIT license and Node 20+ support
- Setup guides for Claude, Cursor, Copilot, VS Code, and more

## Choosing GitLab MCP A

Pick a CQRS-style community server when you want:

- A smaller fixed tool list with `browse_*` / `manage_*` naming
- Version- or tier-aware schema filtering out of the box
- Multi-instance YAML configuration today (before our POC ships)
- Connection resilience patterns (disconnected mode, auto-reconnect)
