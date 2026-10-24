# GitLab MCP Server

[![npm](https://img.shields.io/npm/v/@zereight/mcp-gitlab.svg)](https://www.npmjs.com/package/@zereight/mcp-gitlab)

[English](./README.md) | [한국어](./README.ko.md) | [简体中文](./README.zh-CN.md) | [Português (Brasil)](./README.pt-BR.md)

📖 **[文档 →](https://zereight.github.io/gitlab-mcp/)** · [llms.txt](./llms.txt) · [llms-full.txt](./llms-full.txt)

**默认暴露 40 个工具**（38 个 `core` + `discover_tools` + `help`）。总共 278 个（toolset 中 275 个 + `execute_graphql` + `discover_tools` + `help`）。先用精简集，再在本会话中用 `discover_tools` 扩展。

先安装 `zereight-mcp-gitlab` 二进制。`npm install -g @zereight/mcp-gitlab`，或 Homebrew `brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp` 然后 `brew install zereight/gitlab-mcp/zereight-mcp-gitlab`。官方 MCP Registry 条目：[`io.github.zereight/gitlab-mcp`](https://registry.modelcontextprotocol.io/?q=io.github.zereight%2Fgitlab-mcp)。一键安装：`npx -y @zereight/mcp-gitlab@latest`。

### Without → With

| 没有此 MCP | 有此 MCP |
| ---------- | -------- |
| 把 MR URL 和 diff 粘贴进聊天 | `list_merge_request_changed_files` → 批量 `get_merge_request_file_diff` |
| 在 GitLab UI 里翻 job 日志 | 带分页的 `get_pipeline_job_output` |
| 每一轮都重新说明项目路径 | `project_id=group%2Fproject` 和 `merge_request_iid=123` |

### 三条安装路径

| 路径 | 适用 | 方式 |
| ---- | ---- | ---- |
| 本地 IDE | 本机上的 Cursor、Claude Code、Codex | stdio + PAT 或本地 OAuth |
| 共享 HTTP | 团队 / 托管 MCP | Streamable HTTP URL + 远程授权或 MCP OAuth |
| Claude.ai | Claude 网页连接器 | 公网 HTTPS + `GITLAB_MCP_OAUTH` |

### 安装

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=zereight.gitlab-mcp&config=eyJ0eXBlIjoic3RkaW8iLCJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB6ZXJlaWdodC9tY3AtZ2l0bGFiQGxhdGVzdCJdLCJlbnYiOnsiR0lUTEFCX1BFUlNPTkFMX0FDQ0VTU19UT0tFTiI6IiR7ZW52OkdJVExBQl9QRVJTT05BTF9BQ0NFU1NfVE9LRU59IiwiR0lUTEFCX0FQSV9VUkwiOiJodHRwczovL2dpdGxhYi5jb20vYXBpL3Y0In19)

先安装二进制（`npm install -g @zereight/mcp-gitlab`，或 Homebrew `brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp` 然后 `brew install zereight/gitlab-mcp/zereight-mcp-gitlab`）。不回显地读取令牌：

```bash
read -rs GITLAB_PERSONAL_ACCESS_TOKEN && export GITLAB_PERSONAL_ACCESS_TOKEN
```

```bash
# Claude Code
claude mcp add gitlab --transport stdio --scope local --env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=https://gitlab.com/api/v4 -- zereight-mcp-gitlab

# Codex
codex mcp add gitlab --env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=https://gitlab.com/api/v4 -- zereight-mcp-gitlab
```

其他客户端：[VS Code](./docs/clients/vscode.md) · [GitHub Copilot](./docs/clients/copilot.md) · [JSON 客户端](./docs/clients/json-clients.md) · [Cursor 详情](./docs/clients/cursor.md)

### 代理粘贴提示

把下面内容粘贴给能改 MCP 配置的代理：

```
为此工作区安装 GitLab MCP 服务器（@zereight/mcp-gitlab）。
二进制：zereight-mcp-gitlab（npm i -g @zereight/mcp-gitlab，或 npx -y @zereight/mcp-gitlab@latest）。
认证：GITLAB_PERSONAL_ACCESS_TOKEN 和 GITLAB_API_URL=https://gitlab.com/api/v4（或 GITLAB_USE_OAUTH=true）。
本地：claude mcp add gitlab --transport stdio --scope local --env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=https://gitlab.com/api/v4 -- zereight-mcp-gitlab
或：codex mcp add gitlab --env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=https://gitlab.com/api/v4 -- zereight-mcp-gitlab
Cursor：使用 README deeplink 或 docs/clients/cursor.md。
远程 HTTP：将客户端指向 https://mcp.example.com/mcp（Streamable HTTP）。Claude.ai 需要该主机启用 GITLAB_MCP_OAUTH。
默认列表：40 个工具（38 个 core + discover_tools + help）。用 discover_tools 扩展。除非接受绕过风险，否则不要启用 api toolset。
同等非 MCP 路径：npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill 加上 zereight-mcp-gitlab CLI。
```

### 远程 HTTP

托管或自建服务器的一等选项。把客户端指向 Streamable HTTP URL：

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "http",
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

- 托管 / Claude.ai：服务器上设置 `GITLAB_MCP_OAUTH=true`（见 [MCP OAuth](#使用-mcp-oauth-代理gitlab_mcp_oauth)）
- 每用户 PAT 头：`REMOTE_AUTHORIZATION=true`（见 [远程授权](#使用远程授权remote_authorization)）
- 本地 Docker 示例见 [使用方法](#使用方法)

### Skill + CLI（不需要 MCP）

Skill + CLI 是同等路径，不是备选。同样的工作流，终端里拿完整载荷，无需注册 MCP。

```bash
npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill
zereight-mcp-gitlab user whoami
zereight-mcp-gitlab mr list
```

见 [不使用 MCP 的 CLI](./docs/getting-started/cli-without-mcp.md) 和 [`skills/gitlab-mcp/`](./skills/gitlab-mcp/)。

### MCP vs Human CLI

| 使用 MCP 当 | 使用 CLI 当 |
| ----------- | ----------- |
| 代理需要聊天里的结构化工具 | 需要完整载荷（diff、日志、产物） |
| `jmespath` 或 compact 结果已够用 | 已开 `GITLAB_MCP_COMPACT_RESULTS`，其余要在终端看 |
| 已经注册了 MCP 服务器 | 已有 PAT 或跑过 `auth`，不想要 MCP |

Human CLI 从不 compact。破坏性工具和 `GITLAB_TOOL_POLICY_APPROVE` 工具需要 `--yes`。

### Tips

`project_id` 是数字 ID 或 URL 编码路径。例如：组 `group`、项目 `project`、合并请求 `!123` → `project_id=group%2Fproject`，`merge_request_iid=123`。嵌套组的每一段之间用 `%2F`（`group%2Fsubgroup%2Fproject`）。

### FAQ

**如何认证？** 本地桌面最简单的是 `GITLAB_PERSONAL_ACCESS_TOKEN`（或 `GITLAB_PERSONAL_ACCESS_TOKEN_FILE`）。本地 OAuth 用 `GITLAB_USE_OAUTH=true`。远程 Claude.ai 用 `GITLAB_MCP_OAUTH`。多用户 HTTP 用 `REMOTE_AUTHORIZATION` 和每请求令牌头。

**为什么只看到大约 40 个工具？** 默认 `core` toolset 有 38 个工具，外加始终开启的 `discover_tools` 和 `help`。不带参数调用 `discover_tools` 可列出类别，再传入类别（`pipelines`、`wiki` 等）即可在本会话激活。`GITLAB_TOOLSETS=all` 仍然**不会**启用 `api`。

**本地 OAuth、MCP OAuth 和远程授权有何区别？** 本地 OAuth 在服务器同一台机器上打开浏览器。MCP OAuth 用于公网 HTTPS 服务器和 Claude.ai 这类客户端。远程授权转发调用者的 PAT 或 job token，没有 OAuth 流程。

**如何缩小巨大响应？** 在任意工具调用上传递 `jmespath`。或设置 `GITLAB_MCP_COMPACT_RESULTS=true`，把过大的 MCP 回复变成预览加 CLI 命令。需要完整载荷时用 CLI。

**为什么 `api` toolset 危险？** `gitlab_api_request` 会绕过组/项目允许列表、其他工具过滤和单工具安全检查。提示注入可以驱动它。只有在 `GITLAB_TOOLSETS` 中列出 `api` 时才启用。`all`、`discover_tools` 和 `GITLAB_TOOLS` 都不会启用它。

### Cursor rule / CLAUDE.md 片段

```
GitLab 合并请求、议题和流水线走此 MCP（@zereight/mcp-gitlab）。
从默认 core 工具开始，用 discover_tools 扩展。
优先 list_merge_request_changed_files，再批量 get_merge_request_file_diff。
结果用 jmespath 或 compact；完整 diff 和 job 日志用 CLI。
```

[![Star History Chart](./assets/star-history.png)](https://www.star-history.com/?repos=zereight%2Fgitlab-mcp&type=date&legend=top-left)

## @zereight/mcp-gitlab

**面向 AI 代理工作流优化的 GitLab MCP** — 可通过 stdio、SSE 和 Streamable HTTP 管理项目、合并请求、议题、流水线、Wiki、发布、里程碑等。

支持 PAT、OAuth、只读模式、动态 API URL 和远程授权，可用于 VS Code、Claude、Cursor、Copilot 以及其他 MCP 客户端。

### 为什么使用这个 GitLab MCP？

- **默认 40 个工具（38 个 `core` + `discover_tools` + `help`）；共 278 个** — 先精简，再用 `discover_tools` 在本会话扩展
- **MR 两步审查** — `list_merge_request_changed_files` → 批量 `get_merge_request_file_diff`
- **内置 Agent Skill** — `skills/gitlab-mcp/` 工作流指南
- **认证灵活** — Personal Access Token、本地 OAuth2 浏览器流程、MCP OAuth 代理、按请求远程授权
- **多种传输方式** — 本地客户端使用 stdio，旧客户端使用 SSE，现代远程部署使用 Streamable HTTP
- **客户端设置友好** — 提供 Claude Code、Codex、Antigravity、OpenCode、Copilot、Cline、Roo Code、Cursor、Kilo Code 和 Amp Code 示例
- **适合自托管** — 支持自定义 GitLab 实例、代理设置和动态 API URL 路由
- **JMESPath 结果过滤** — 在工具调用中传入可选的 `jmespath` 参数（见 `tools/list`），可在不改变 GitLab API 请求的情况下精简 JSON 结果；启用响应掩码时，JMESPath 作用于掩码后的数据

### 对比摘要

|              | @zereight/mcp-gitlab                                                 | GitLab MCP A（社区 CQRS 型）               | GitLab 官方 MCP 服务器                                                                                                                  |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **更适合**   | AI 代理工作流                                                        | 企业多实例 / 分组工具                      | 内置于 GitLab，无需单独安装                                                                                                             |
| **工具模型** | 278 个工具：toolset 中 275 个 + `execute_graphql` + `discover_tools` + `help` | ~50–60 个 `browse_*` / `manage_*` 分组工具 | 用 HTTP 头选择 toolset                                                                                                                  |
| **MR 审查**  | 两步批量 diff                                                        | 因服务器而异                               | `get_merge_request` 带 diffs                                                                                                            |
| **Node.js**  | >=18.17                                                              | 通常 >=24                                  | stdio 经 `mcp-remote`，需要 Node.js 20+                                                                                                 |
| **许可证**   | MIT                                                                  | 因服务器而异                               | GitLab 的一部分                                                                                                                         |

### tools/list 体积（2026-10-24 实测）

客户端会在会话开始时把整份 `tools/list` 发给模型。Token 估算为 UTF-8 字节 / 4。

| 配置 | 工具数 | JSON 字节 | 估算 token |
| ---- | -----: | --------: | ---------: |
| 默认（`core` + `discover_tools` + `help`） | 40 | 50,682 | 12,671 |
| `GITLAB_TOOL_PROFILE=slim` | 39 | 49,646 | 12,412 |
| `GITLAB_TOOLSETS=all` | 276 | 285,677 | 71,420 |

更改描述或 schema 后，用 `npm run test:mock`（`test/tools-list-budget.test.ts`）重新测量。

GitLab 还提供[官方 MCP 服务器](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)。

- Free、Premium、Ultimate。GitLab 19.2 从 Premium 移到 Free。GitLab 19.5 正式可用。
- 在 GitLab.com 上，顶级群组 Owner 允许访问 MCP 服务器。GitLab Self-Managed 和 GitLab Dedicated 使用实例设置。默认规则见官方页面。
- 远程客户端使用 HTTP `https://<gitlab.example.com>/api/v4/mcp` 和 OAuth 2.0 动态客户端注册。
- stdio 通过 `mcp-remote`，需要 Node.js 20 或更高版本。
- Toolset 使用请求头 `X-Gitlab-Enabled-Mcp-Server-Toolsets`。可选请求头 `X-Gitlab-Mcp-Server-Tool-Name-Prefix` 只保留工具名前缀的前 32 个字符。

[与官方 GitLab MCP 服务器的完整对比 →](./docs/comparison/official-gitlab-mcp.md)

快速开始：在下面选择 Personal Access Token 或 OAuth2 设置，安装 `@zereight/mcp-gitlab`，并在 MCP 客户端配置中使用 `zereight-mcp-gitlab`。

### 客户端设置指南

- [Claude Code 设置指南](./docs/clients/claude-code.md)
- [VS Code 设置指南](./docs/clients/vscode.md)
- [GitHub Copilot 设置指南](./docs/clients/copilot.md)
- [Codex 设置指南](./docs/clients/codex.md)
- [Cursor 设置指南](./docs/clients/cursor.md)
- [基于 JSON 的 MCP 客户端设置指南](./docs/clients/json-clients.md) - 适用于 Factory AI Droid、OpenClaw 和 OpenCode 风格客户端
- [OAuth2 认证设置指南](./docs/auth/oauth-setup.md)
- [环境变量参考](./docs/configuration/environment-variables.md)
- [Stateless Mode — 多 Pod HPA](./docs/configuration/stateless-mode.md)
- [自定义 Agent 与多 PAT 设置](./docs/auth/custom-agent-multiple-pat.md)

## 使用方法

### 设置概览

#### 认证方式

服务器支持四种认证方式。

**本地/桌面使用**（最常见）：

1. **Personal Access Token** (`GITLAB_PERSONAL_ACCESS_TOKEN` 或 `GITLAB_PERSONAL_ACCESS_TOKEN_FILE`) — 最简单的设置
2. **OAuth2 — 本地浏览器** (`GITLAB_USE_OAUTH`) — 推荐用于更好的安全性

**服务器/远程部署**：

3. **OAuth2 — MCP 代理** (`GITLAB_MCP_OAUTH`) — 适用于 Claude.ai 等远程 MCP 客户端
4. **远程授权** (`REMOTE_AUTHORIZATION`) — 适用于每个调用方提供自己 token 的多用户部署

#### 快速设置路径

- **Claude Code**：[Claude Code 设置指南](./docs/clients/claude-code.md)
- **VS Code**：[VS Code 设置指南](./docs/clients/vscode.md)
- **GitHub Copilot**：[GitHub Copilot 设置指南](./docs/clients/copilot.md)
- **Codex**：[Codex 设置指南](./docs/clients/codex.md)
- **Cursor**：[Cursor 设置指南](./docs/clients/cursor.md)
- **Factory AI Droid / OpenClaw / OpenCode 风格客户端**：[基于 JSON 的 MCP 客户端设置指南](./docs/clients/json-clients.md)
- **OAuth 浏览器流程详情**：[OAuth2 认证设置指南](./docs/auth/oauth-setup.md)
- **无需 localhost callback 的 OAuth**（SSO、远程 shell、后台客户端）：先运行 `zereight-mcp-gitlab auth`（GitLab 17.9+ device flow；17.2–17.8 需 `oauth2_device_grant_flow`），再以 `GITLAB_USE_OAUTH=true` 启动服务器。参见[独立 device-flow 命令](./docs/auth/oauth-setup.md#standalone-device-flow-auth-command)。

最简单的本地设置可以从 Personal Access Token 开始。基于浏览器的本地认证使用 OAuth2。远程或多用户部署请继续查看下面的 MCP OAuth 和远程授权部分。

安装服务器：

```shell
brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp
brew install zereight/gitlab-mcp/zereight-mcp-gitlab
```

也可以使用 npm 安装：

```shell
npm install -g @zereight/mcp-gitlab
```

也可以使用 Nix，把此 flake 添加到你自己的 flake 中：

```nix
# flake.nix
inputs.gitlab-mcp.url = "github:zereight/gitlab-mcp";

# wherever you configure your MCP client:
command = lib.getExe inputs.gitlab-mcp.packages.${system}.default;
```

存储路径由你的 lock 文件固定，使用 `nix flake update gitlab-mcp` 更新。

示例使用 `zereight-mcp-gitlab`，这是比旧的 `mcp-gitlab` 更不容易冲突的别名。如果 MCP 客户端找不到它，请使用 `which zereight-mcp-gitlab` 输出的绝对路径。

如果不想全局安装，请将 `npx` 固定到上一个稳定版本（即文档推荐的版本），例如 `npx -y @zereight/mcp-gitlab@2.3.6`。如果始终想使用最新版本，请改用 `npx -y @zereight/mcp-gitlab@latest`。如需在下一个稳定版本发布前试用已合并到 `main` 的修复，请使用 `npx -y @zereight/mcp-gitlab@next`（预发布版本，不适用于生产环境）。有新版本发布时，服务器会在启动时通过 stderr 提示（可用 `GITLAB_DISABLE_VERSION_CHECK=true` 关闭）。

#### Claude Desktop 一键安装（MCP Bundle）

v2.3.1 之后的每个 GitHub Release 都附带 `gitlab-mcp.mcpb` [MCP Bundle](https://github.com/modelcontextprotocol/mcpb)。下载[最新的 bundle](https://github.com/zereight/gitlab-mcp/releases/latest/download/gitlab-mcp.mcpb)，用 Claude Desktop 打开（或拖到 **Settings → Extensions** 中）。Claude Desktop 会要求输入 Personal Access Token（作为敏感值保存），并可设置 `GITLAB_API_URL`、`GITLAB_PERMISSION_MODE`、`GITLAB_TOOLSETS` 和 `GITLAB_MASKING_ENABLED`。无需另外安装 Node.js 或 npm。

如需从源码构建 bundle，运行 `npm run pack:mcpb`（生成 `gitlab-mcp.mcpb`）。

#### 使用 CLI 参数（适用于环境变量有问题的客户端）

部分 MCP 客户端（例如 GitHub Copilot CLI）可能难以处理环境变量。可以改用 CLI 参数。

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

**可用 CLI 参数：**

- `--token` - GitLab Personal Access Token（替代 `GITLAB_PERSONAL_ACCESS_TOKEN`）
- `--api-url` - GitLab API URL（替代 `GITLAB_API_URL`）
- `--read-only=true` - Deprecated (removed in next major (v3.0.0))；请改用 `--permission-mode=readonly`（替代 `GITLAB_READ_ONLY_MODE`）
- `--permission-mode` - 权限级别：`readonly`、`modify`（禁用删除/拆除工具）或 `full`（替代 `GITLAB_PERMISSION_MODE`，默认 `full`）
- `--toolsets=all` - 启用指定工具集，但不包括必须显式列出的 `api`（替代 `GITLAB_TOOLSETS`；未设置时使用精简 `core` 默认值）。`gitlab_api_request` 需要 `--toolsets=api`
- `--tools=list_issues` - 添加单个工具（替代 `GITLAB_TOOLS`）
- `--use-wiki=true` - Deprecated (removed in next major (v3.0.0))；请改用 `--toolsets=core,wiki`（替代 `USE_GITLAB_WIKI`）
- `--use-milestone=true` - Deprecated (removed in next major (v3.0.0))；请改用 `--toolsets=core,milestones`（替代 `USE_MILESTONE`）
- `--use-pipeline=true` - Deprecated (removed in next major (v3.0.0))；请改用 `--toolsets=core,pipelines`，并把 `validate_ci_lint,validate_project_ci_lint` 追加到现有 `--tools` 列表（如果还没有该列表，则设置 `--tools=validate_ci_lint,validate_project_ci_lint`）（替代 `USE_PIPELINE`）
- `--disable-version-check=true` - 关闭启动时的新版本提示（替代 `GITLAB_DISABLE_VERSION_CHECK`）
- `--masking-enabled=true` - 启用文本响应掩码（替代 `GITLAB_MASKING_ENABLED`）
- `--masking-config` - 掩码配置文件路径（替代 `GITLAB_MASKING_CONFIG`）
- `--masking-policy-file` - 受保护的托管策略文件路径（替代 `GITLAB_MASKING_POLICY_FILE`）
- `--masking-workspace-dir` - 用于解析掩码文件的目录（替代 `GITLAB_MASKING_WORKSPACE_DIR`）
- `--download-dir` - `download_attachment` 保存文件的目录（替代 `GITLAB_DOWNLOAD_DIR`，默认 `.gitlab-mcp-downloads`）
- `--compact-results=true` - 将过大的 MCP 工具回复截断为预览并附带 CLI 命令（替代 `GITLAB_MCP_COMPACT_RESULTS`，默认关闭）
- `--compact-result-chars` - compact 字符阈值（替代 `GITLAB_MCP_COMPACT_RESULT_CHARS`，默认 `4000`）
- `--compact-tools` - 以逗号分隔的工具名，仅在回复过大时对这些工具进行 compact，而不开启全局 compact（替代 `GITLAB_MCP_COMPACT_TOOLS`）
- `--tool-profile` - `full`（默认）或 `slim`。`slim` 会从初始列表中移除 draft note、表情回应、标签、CI 目录工具以及 `create_group`。仅当 `GITLAB_TOOLSETS` 设置为非空白值时忽略（替代 `GITLAB_TOOL_PROFILE`）

如果已经设置了 `GITLAB_TOOLSETS` 或 `--toolsets`，请把 `wiki`、`milestones` 或 `pipelines` 追加到该列表，不要整段替换。如果已经设置了 `GITLAB_TOOLS` 或 `--tools`，请把 `validate_ci_lint` 和 `validate_project_ci_lint` 追加到该列表，不要整段替换。显式列表会替换默认的 `core` toolset，不会合并。

CLI 参数优先于环境变量。

`zereight-mcp-gitlab auth` 是子命令，不是 MCP 服务器参数。它运行 GitLab device flow 后退出。参见 [CLI 参数](./docs/getting-started/cli-arguments.md#auth)。

同一二进制也是 `gh` 风格的 GitLab CLI（`tool <name>`，或 `mr list` 这类 curated 命令）。**无需注册 MCP**——设置 PAT，或运行 `auth` 后设置 `GITLAB_USE_OAUTH=true`：参见 [无需 MCP 使用 CLI](./docs/getting-started/cli-without-mcp.md)。`setup --cursor` / `setup --claude` 会打印客户端配置；`doctor` 检查 token、API URL、toolset 和版本。完整结果在终端用 CLI 查看。MCP 回复仍进入对话。设置 `GITLAB_MCP_COMPACT_RESULTS=true`（或 `--compact-results`）后，过大的工具回复会变成预览加上 CLI 命令。Human CLI 本身不会被 compact。permission mode、toolsets、denied-tools regex 和 tool-policy 与 MCP 相同。破坏性工具以及 `GITLAB_TOOL_POLICY_APPROVE` 工具需要 `--yes`。参见 [Human CLI](./docs/getting-started/cli-arguments.md#human-cli)。

> **细粒度工具过滤：**使用 `GITLAB_PERMISSION_MODE=modify` 允许创建/更新，同时阻止所有删除工具以及
> 破坏性的拆除（teardown）工具（`cancel_pipeline`、`cancel_pipeline_job`、`stop_environment`、
> `stop_stale_environments`、`unprotect_branch`、`unprotect_tag`）（包括通过 `execute_graphql` 的破坏性 mutation
> —— 删除与拆除动词 —— 以及 `push_files` 的 `delete`/`move`），或使用
> `GITLAB_PERMISSION_MODE=readonly` 只读运行。还可以用
> `GITLAB_TOOLSETS=<group,…>` 启用工具分组，用 `GITLAB_TOOLS=<tool,…>` 白名单启用单个工具
> （例如：只读分组 + 少数几个写工具），用 `GITLAB_DENIED_TOOLS_REGEX` 按正则屏蔽工具。
> 旧版 `USE_GITLAB_WIKI` / `USE_MILESTONE` / `USE_PIPELINE` 已弃用
> （Deprecated, removed in next major (v3.0.0)）。
> 请改用 `GITLAB_TOOLSETS=core,wiki`、`core,milestones` 或 `core,pipelines`
> （`USE_PIPELINE` 还需要把 `validate_ci_lint,validate_project_ci_lint` 追加到现有 `GITLAB_TOOLS`，不要整段替换）。
> 如果已经设置了 `GITLAB_TOOLSETS`，请把 toolset 追加到现有列表，不要整段替换。
> 如果未设置 `GITLAB_TOOLS`，请设置 `GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint`。如果已经设置，请把 `validate_ci_lint,validate_project_ci_lint` 追加到现有列表，不要整段替换。
> 参见 [Tools Reference](./docs/tools/index.md#feature-toggles) 和
> [Environment Variables](./docs/configuration/environment-variables.md)。

> [!CAUTION]
> `gitlab_api_request`（`api` 工具集）会绕过 `GITLAB_ALLOWED_GROUPS` 及其他群组限制、项目允许列表、工具级限制（`GITLAB_TOOLS`、作用在其他工具上的 `GITLAB_DENIED_TOOLS_REGEX`）以及各个工具自己的安全检查。令牌的完整权限范围都会暴露。提示注入可以驱动这个工具。依赖这些限制的运维人员不得启用它。
> 只有在 `GITLAB_TOOLSETS` 中显式写入 `api` 时才会启用（`GITLAB_TOOLSETS=all`、`discover_tools`、`GITLAB_TOOLS`、旧版 `USE_*`、`GITLAB_TOOL_PROFILE` 都不会）。设置 `GITLAB_ALLOWED_PROJECT_IDS` 或会话项目范围后，只接受允许项目的 `/projects/:id` 路径。`/search`、`/users`、`/groups/:id`、`/runners` 等端点会被拒绝。请求体和查询参数中指向其他项目的值不会被检查。`GITLAB_PROJECT_ID` 和 OAuth 群组允许列表不会被此工具强制执行。

- sse

只传变量名。Docker 客户端把已 export 的 `GITLAB_PERSONAL_ACCESS_TOKEN` 复制进容器。

```shell
docker run -i --rm \
  -e HOST=0.0.0.0 \
  -e GITLAB_PERSONAL_ACCESS_TOKEN \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_PERMISSION_MODE=readonly \
  -e GITLAB_TOOLSETS=core,wiki,milestones,pipelines \
  -e SSE=true \
  -e SSE_AUTH_TOKEN=your_mcp_sse_token \
  -p 3333:3002 \
  zereight050/gitlab-mcp
```

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "sse",
      "url": "http://localhost:3333/sse",
      "headers": {
        "Authorization": "Bearer your_mcp_sse_token"
      }
    }
  }
}
```

- streamable-http

```shell
docker run -i --rm \
  -e HOST=0.0.0.0 \
  -e REMOTE_AUTHORIZATION=true \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_PERMISSION_MODE=readonly \
  -e GITLAB_TOOLSETS=core,wiki,milestones,pipelines \
  -e STREAMABLE_HTTP=true \
  -p 3333:3002 \
  zereight050/gitlab-mcp
```

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "streamable-http",
      "url": "http://localhost:3333/mcp",
      "headers": {
        "Authorization": "Bearer glpat-..."
      }
    }
  }
}
```

#### 使用 MCP OAuth 代理（`GITLAB_MCP_OAUTH`）

> **仅适用于服务器/远程部署。** 此模式要求 MCP 服务器部署在可公开访问的 HTTPS URL 上。本地/桌面使用请使用 `GITLAB_USE_OAUTH`。

适用于支持 MCP OAuth 规范的远程 MCP 客户端（例如 Claude.ai）。服务器会作为完整 OAuth 2.0 授权服务器运行。未认证请求会收到 `401 + WWW-Authenticate` 响应，从而触发客户端侧 OAuth 浏览器流程。

OpenCode、MCPJam、Claude.ai 等远程 MCP 客户端可能会在授权时发送自己的 callback URL。如果你无法在 GitLab 中注册每个客户端 callback URL，请启用 `GITLAB_OAUTH_CALLBACK_PROXY=true`。启用回调代理模式后，GitLab 只需要注册一个 Redirect URI：`{MCP_SERVER_URL}/callback`。

`GITLAB_OAUTH_REDIRECT_URI` 仅用于本地 OAuth（`GITLAB_USE_OAUTH`）。它不会覆盖远程 MCP OAuth 客户端 callback URL，也不应用来修复远程 `Unregistered redirect_uri` 错误。

这个变量存在是因为本地 OAuth 流程会在与 MCP 服务器相同的机器上打开浏览器，并通过本地 HTTP 服务器接收 callback，例如 `http://127.0.0.1:8888/callback`。

远程 MCP OAuth 不同。在 `GITLAB_MCP_OAUTH=true` 模式下，MCP 客户端会在 `/authorize` 请求中提供自己的 callback URL。`GITLAB_OAUTH_REDIRECT_URI` 不会替换这个客户端提供的 URL。

| 模式           | 启用方式                | Callback 变量                      | GitLab Redirect URI                                  |
| -------------- | ----------------------- | ---------------------------------- | ---------------------------------------------------- |
| 本地 OAuth     | `GITLAB_USE_OAUTH=true` | `GITLAB_OAUTH_REDIRECT_URI`        | `http://127.0.0.1:8888/callback` 或你的本地 callback |
| 远程 MCP OAuth | `GITLAB_MCP_OAUTH=true` | `GITLAB_OAUTH_CALLBACK_PROXY=true` | `{MCP_SERVER_URL}/callback`                          |

只有当 MCP 服务器自己接收本地浏览器 callback 时，才使用 `GITLAB_OAUTH_REDIRECT_URI`。当远程 MCP 客户端拥有 callback URL 时，请使用 `GITLAB_OAUTH_CALLBACK_PROXY=true`。

**工作方式**：将此 MCP 服务器部署到拥有公开 HTTPS URL 的位置。MCP 客户端连接到 `{MCP_SERVER_URL}/mcp`。服务器处理 OAuth 2.0 流程，并代表客户端与 GitLab 交换凭据。

**前置条件：**

1. 可公开访问的 HTTPS 服务器 URL（`MCP_SERVER_URL`）— 本地测试可使用 [ngrok](https://ngrok.com)
2. 预先注册的 GitLab OAuth 应用，包含 `api` 或 `read_api` scopes
   — 前往 `Admin area` → `Applications`，将 Redirect URI 设置为 `{MCP_SERVER_URL}/callback`

| 环境变量                      | 必需 | 说明                                                                                                        |
| ----------------------------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| `GITLAB_MCP_OAUTH`            | 是   | 设置为 `true` 以启用                                                                                        |
| `GITLAB_API_URL`              | 是   | GitLab API base URL。不要在 URL 中嵌入凭据（`user:pass@`），嵌入的凭据会被忽略。密码中的逗号必须写成 `%2C`。 |
| `GITLAB_OAUTH_APP_ID`         | 是   | GitLab OAuth Application ID                                                                                 |
| `MCP_SERVER_URL`              | 是   | 此 MCP 服务器的公开 HTTPS URL                                                                               |
| `STREAMABLE_HTTP`             | 是   | 必须为 `true`                                                                                               |
| `GITLAB_OAUTH_CALLBACK_PROXY` | 可选 | 设置为 `true` 时使用 MCP 服务器固定的 `/callback` URL                                                       |
| `GITLAB_OAUTH_ALLOWED_REDIRECT_URIS` | 可选 | 回调代理模式允许重定向的客户端 callback URL 列表（默认：Claude、ChatGPT、Cursor 和环回地址 callback；用 `defaults,<url>` 追加） |
| `GITLAB_OAUTH_SCOPES`         | 可选 | 逗号分隔的 scope（默认：`api,read_api,read_user`）                                                          |
| `GITLAB_OAUTH_ALLOWED_GROUPS` | 可选 | 逗号分隔的 GitLab 群组完整路径 — 仅该群组及其子群组的成员可使用服务器（替代已废弃的 `GITLAB_ALLOWED_GROUPS`） |
| `OAUTH_DISABLE_REFRESH_TOKEN` | 可选 | 设置为 `true` 时不发放 refresh token：每当 GitLab access token 过期（2 小时）用户都需在浏览器中重新授权，与会话 TTL 无关 |

当 `STREAMABLE_HTTP=true` 时，服务端 GitLab 凭据（`GITLAB_PERSONAL_ACCESS_TOKEN`、`GITLAB_JOB_TOKEN`、`GITLAB_AUTH_COOKIE_PATH` 或 `GITLAB_USE_OAUTH`）需要 `REMOTE_AUTHORIZATION=true`、`GITLAB_MCP_OAUTH=true` 或 `STREAMABLE_HTTP_AUTH_TOKEN`。

> **排查 `Unregistered redirect_uri`**
>
> 检查浏览器 URL 中的 `redirect_uri`。如果它指向客户端 callback，例如 `http://127.0.0.1:xxxxx/.../callback`，请启用：
>
> ```env
> GITLAB_OAUTH_CALLBACK_PROXY=true
> ```
>
> 不要通过修改 `GITLAB_OAUTH_REDIRECT_URI` 来修复远程 MCP OAuth。该变量仅用于本地 OAuth（`GITLAB_USE_OAUTH`）。

```shell
docker run -i --rm \
  -e HOST=0.0.0.0 \
  -e GITLAB_MCP_OAUTH=true \
  -e GITLAB_OAUTH_CALLBACK_PROXY=true \
  -e STREAMABLE_HTTP=true \
  -e MCP_SERVER_URL=https://your-server.example.com \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_OAUTH_APP_ID=your_app_id \
  -p 3000:3002 \
  zereight050/gitlab-mcp
```

MCP 客户端配置：

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "http",
      "url": "https://your-server.example.com/mcp"
    }
  }
}
```

#### 使用远程授权（`REMOTE_AUTHORIZATION`）

> **仅适用于服务器/远程部署。** 每个 HTTP 调用方都在请求头中直接提供自己的 GitLab token，不使用 OAuth 流程。

适用于多用户或多租户部署，每个调用方在 HTTP 请求头中提供自己的 GitLab token。MCP 服务器会代表调用方将 token 转发给 GitLab。

**请求头优先级**：`Private-Token` > `JOB-TOKEN` > `Authorization: Bearer`

| 环境变量                                                         | 必需 | 说明                                                                                                                    |
| ---------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| `REMOTE_AUTHORIZATION`                                           | 是   | 设置为 `true` 以启用                                                                                                    |
| `STREAMABLE_HTTP`                                                | 是   | 必须为 `true`                                                                                                           |
| `ENABLE_DYNAMIC_API_URL`                                         | 可选 | 允许按请求通过 `X-GitLab-API-URL` 请求头指定 GitLab URL                                                                 |
| `GITLAB_ALLOWED_HOSTS`                                           | 可选 | 允许的 `X-GitLab-API-URL` 主机逗号分隔列表；`GITLAB_API_URL` 中的主机始终允许。也作为下载重定向目标（release 资产、job 工件、上传附件）受信任；私有网络主机请在此列出 |
| `GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY`                    | 可选 | 仅允许未认证的 `initialize`、`notifications/initialized`、`tools/list`、`server/discover`（工具调用仍需认证）                                |
| `MCP_SERVER_URL` / `MCP_ALLOWED_HOSTS` / `MCP_ALLOWED_ORIGINS` | 可选 | 用于 DNS rebinding 防护的允许 `/mcp` 主机/来源值                                                                        |
| `MCP_TRUST_PROXY`                                                | 可选 | 在反向代理后信任 `Forwarded` / `X-Forwarded-*` 请求头（下载 URL、Express `req.ip`、`/mcp` IP 速率限制、OAuth 速率限制） |

`GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY=true` 适用于在用户提供 GitLab token 之前需要检查工具元数据的 MCP 网关或管理 UI。除非你的部署可以安全地暴露工具列表，否则请保持禁用。

当未设置 `MCP_SERVER_URL` 时，远程下载 URL 会回退到本地服务器地址。仅当服务器通过受信任的反向代理可达且已阻止客户端直接访问 MCP 服务器时，才设置 `MCP_TRUST_PROXY=true`。这会为 Streamable HTTP 和 SSE 启用 Express `trust proxy`，从 `Forwarded` / `X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-Prefix` 派生公共下载 URL，并在代理通过 `X-Forwarded-For` 发送带客户端端口的地址（例如 `1.2.3.4:5678`）时保持 OAuth 端点速率限制可用。引入此标志后，现有 OAuth+代理部署必须显式设置。

**示例请求头：**

```http
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

或使用 Bearer token：

```http
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ `REMOTE_AUTHORIZATION` 与 SSE 传输不兼容。必须使用 `STREAMABLE_HTTP=true`。

### 环境变量

完整环境变量列表请查看专门的参考文档：

- [环境变量参考](./docs/configuration/environment-variables.md)

大多数用户只需要以下起始组合之一：

- **本地 PAT**：`GITLAB_PERSONAL_ACCESS_TOKEN`, `GITLAB_API_URL`
- **本地 OAuth**：`GITLAB_USE_OAUTH=true`, `GITLAB_OAUTH_CLIENT_ID`, `GITLAB_OAUTH_REDIRECT_URI`, `GITLAB_API_URL`
- **远程多用户 HTTP**：`STREAMABLE_HTTP=true`, `REMOTE_AUTHORIZATION=true`（或 `GITLAB_MCP_OAUTH=true`）, `MCP_TRUST_PROXY=true`（反向代理后）, `MAX_REQUESTS_PER_MINUTE=300`, `MCP_SERVER_URL` 或 `MCP_ALLOWED_HOSTS`, `HOST`, `PORT`
- **并行运行多个部署**：为每个实例设置不同的 `MCP_SERVER_NAME`（例如 `gitlab-selfhosted-readonly`），以便在客户端、日志和遥测数据中区分它们
- **多 Pod HPA（stateless）**：上述配置 + `OAUTH_STATELESS_MODE=true`, `OAUTH_STATELESS_SECRET`（所有 Pod 相同）。参见 [Stateless Mode](./docs/configuration/stateless-mode.md)。

常用变量：

- `GITLAB_API_URL`
- `GITLAB_PERSONAL_ACCESS_TOKEN`
- `GITLAB_USE_OAUTH`
- `REMOTE_AUTHORIZATION`
- `MCP_TRUST_PROXY`
- `MAX_REQUESTS_PER_MINUTE`
- `MAX_SESSIONS`
- `MCP_ALLOWED_HOSTS`
- `MCP_ALLOWED_ORIGINS`
- `GITLAB_MCP_OAUTH`
- `GITLAB_OAUTH_CALLBACK_PROXY`
- `GITLAB_OAUTH_ALLOWED_REDIRECT_URIS`
- `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR`
- `OAUTH_DISABLE_REFRESH_TOKEN`
- `OAUTH_STATELESS_MODE`
- `OAUTH_STATELESS_SECRET`

参考文档还包含：

- auth 和 OAuth 变量
- MCP OAuth 代理变量
- 项目与工具过滤变量
- 通过 `discover_tools` 进行动态工具发现（按需启用工具集）
- 传输和会话变量
- 代理和 TLS 变量

回调代理模式详情请参阅 [GitLab MCP OAuth Callback Proxy](./docs/auth/oauth-callback-proxy.md)。

#### SSE 会话限制

`GET /sse` 与 Streamable HTTP 受到相同的远程传输控制：

- **容量：** 并发 SSE 会话最多为 `MAX_SESSIONS` 个（默认 1000），超出的连接返回 `503`。
- **创建速率限制：** 新连接按客户端 IP 受 `MAX_REQUESTS_PER_MINUTE` 限制（默认 60），超出的连接返回 `429`。
- **空闲超时：** 在 `SESSION_TIMEOUT_SECONDS`（默认 1 小时）内没有 `POST /messages` 请求的会话会被关闭，因此空闲客户端必须重新连接，而不能一直占用容量槽位。与 Streamable HTTP 不同，保持 SSE 流打开**不**算作活动。
- 实例达到容量时，`/health` 返回 `503` 和 `status: "degraded"`。

可通过 [`MAX_SESSIONS`](./docs/configuration/environment-variables.md#max_sessions)、`MAX_REQUESTS_PER_MINUTE` 和 `SESSION_TIMEOUT_SECONDS` 调整这些限制。

### 远程授权设置（多用户支持）

使用 `REMOTE_AUTHORIZATION=true` 时，MCP 服务器可以支持多个用户，每个用户通过 HTTP 请求头传入自己的 GitLab token。适用于：

- 每个用户都需要自己 GitLab 访问权限的共享 MCP 服务器实例
- 可以将用户专属 token 注入 MCP 请求的 IDE 集成

**设置示例：**

```bash
docker run -d \
  -e HOST=0.0.0.0 \
  -e STREAMABLE_HTTP=true \
  -e REMOTE_AUTHORIZATION=true \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_PERMISSION_MODE=readonly \
  -e SESSION_TIMEOUT_SECONDS=3600 \
  -p 3333:3002 \
  zereight050/gitlab-mcp
```

**客户端配置：**

IDE 或 MCP 客户端必须在每个请求中发送以下请求头之一：

```http
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
```

或

```http
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

token 按会话存储（由 `mcp-session-id` 请求头标识），并在同一会话的后续请求中复用。

#### Cursor 远程授权客户端配置示例

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

**重要说明：**

- 远程授权**仅适用于 Streamable HTTP 传输**
- 每个会话相互隔离。一个会话的 token 不能访问另一个会话的数据。会话关闭后 token 会自动清理。
- **会话超时：** 认证 token 在 `SESSION_TIMEOUT_SECONDS`（默认 1 小时）无活动后过期。超时后，客户端必须再次发送认证请求头。传输会话仍保持活动。
- 每个请求都会重置该会话的超时计时器。
- **Rate limiting：** `/mcp` 请求按客户端 IP 限制为每分钟 `MAX_REQUESTS_PER_MINUTE` 次；使用 OAuth 或远程授权时还按 MCP 会话限制（默认 60）。详见 [environment-variables.md](docs/configuration/environment-variables.md#max_requests_per_minute)。
- **Capacity limit：** 服务器最多接受 `MAX_SESSIONS` 个并发会话（默认 1000）。

### MCP OAuth 设置（Claude.ai Native OAuth）

使用 `GITLAB_MCP_OAUTH=true` 时，服务器会作为 GitLab 实例的 OAuth 代理。Claude.ai 以及任何符合 MCP 规范的客户端会自动处理完整浏览器认证流程，无需手动管理 Personal Access Token。

**前置条件：**

需要**预先注册的 GitLab OAuth 应用**。GitLab 会将动态注册的未验证应用限制为 `mcp` scope，该 scope 不足以调用 API（需要 `api` 或 `read_api`）。

1. 前往 GitLab 实例 → **Admin Area > Applications**（实例级）或 **User Settings > Applications**（个人）
2. 创建新应用：
   - **Confidential**：取消勾选
   - **Scopes**：`api`, `read_api`, `read_user`，或你计划通过 `GITLAB_OAUTH_SCOPES` 请求的 scopes
3. 保存并复制 **Application ID**。它就是 `GITLAB_OAUTH_APP_ID`。

**工作方式：**

1. 用户在 Claude.ai 中添加 MCP 服务器 URL。
2. Claude.ai 通过 `/.well-known/oauth-authorization-server` 发现 OAuth 端点。
3. Claude.ai 通过 Dynamic Client Registration（`POST /register`）注册自身。MCP 服务器在本地处理，并为每个客户端分配虚拟 client ID。
4. Claude.ai 使用预先注册的 OAuth 应用，将用户浏览器重定向到 GitLab 登录页。
5. 用户完成认证后，GitLab 重定向回 `https://claude.ai/api/mcp/auth_callback`。
6. Claude.ai 在每个 MCP 请求中发送 `Authorization: Bearer <token>`。
7. 服务器通过 GitLab 验证 token，并按会话存储。

**服务器设置：**

```bash
docker run -d \
  -e STREAMABLE_HTTP=true \
  -e GITLAB_MCP_OAUTH=true \
  -e GITLAB_OAUTH_APP_ID="your-gitlab-oauth-app-client-id" \
  -e GITLAB_API_URL="https://gitlab.example.com/api/v4" \
  -e MCP_SERVER_URL="https://your-mcp-server.example.com" \
  -p 3002:3002 \
  zereight050/gitlab-mcp
```

本地开发（允许 HTTP）：

```bash
MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true \
STREAMABLE_HTTP=true \
GITLAB_MCP_OAUTH=true \
GITLAB_OAUTH_APP_ID=your-gitlab-oauth-app-client-id \
MCP_SERVER_URL=http://localhost:3002 \
GITLAB_API_URL=https://gitlab.com/api/v4 \
node build/index.js
```

**Claude.ai 配置：**

```json
{
  "mcpServers": {
    "GitLab": {
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
```

无需 `headers` 字段。Claude.ai 会通过 OAuth 获取 token。

**环境变量：**

| 变量                                        | 必需 | 说明                                                                                                                                     |
| ------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GITLAB_MCP_OAUTH`                          | 是   | 设置为 `true` 以启用                                                                                                                     |
| `GITLAB_OAUTH_APP_ID`                       | 是   | 预先注册的 GitLab OAuth 应用 client ID                                                                                                   |
| `MCP_SERVER_URL`                            | 是   | MCP 服务器的公开 HTTPS URL                                                                                                               |
| `GITLAB_API_URL`                            | 是   | GitLab 实例 API URL（例如 `https://gitlab.com/api/v4`）。不要在 URL 中嵌入凭据（`user:pass@`），嵌入的凭据会被忽略。密码中的逗号必须写成 `%2C`。 |
| `STREAMABLE_HTTP`                           | 是   | 必须为 `true`（不支持 SSE）                                                                                                              |
| `GITLAB_OAUTH_SCOPES`                       | 否   | 要请求的 GitLab scopes，以逗号分隔。默认值为 `api`；有效 permission mode 为 `readonly` 时为 `read_api`。预注册应用必须配置至少这些 scopes。 |
| `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR`        | 否   | Dynamic Client Registration（`POST /register`）的每客户端 IP rolling 限制。默认 `20`/小时，范围 `1`–`1000`。多个 IDE 窗口等导致注册被限流时可调高。与 GitLab API 限额无关。 |
| `OAUTH_DISABLE_REFRESH_TOKEN`               | 否   | 设置 `true` 时 `/token` 响应不含 `refresh_token`，refresh grant 以 `invalid_grant` 拒绝；GitLab access token 过期后用户需在浏览器中重新授权。默认 `false`。回调代理模式下，遵循本服务器流程的 MCP 客户端拿不到 GitLab refresh token（passthrough 模式下客户端可直接从 GitLab 获取）。这是面向标准 MCP 客户端的重新授权策略，而非安全边界。启用前已发放的 refresh token 在 GitLab **User Settings → Applications → Authorized applications → Revoke** 撤销前仍然有效。 |
| `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL` | 否   | 仅用于本地 HTTP 开发                                                                                                                     |

**重要说明：**

- MCP OAuth **仅适用于 Streamable HTTP 传输**（与 `SSE=true` 不兼容）。
- 每个用户会话保存自己的 OAuth token，会话完全隔离。
- 会话超时、rate limiting 和 capacity limit 与 `REMOTE_AUTHORIZATION` 模式相同（`SESSION_TIMEOUT_SECONDS`, `MAX_REQUESTS_PER_MINUTE`, `MAX_SESSIONS`）。
- **DCR rate limiting：** `POST /register` 按客户端 IP 受 `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR` 限制（默认 20/小时）。与 `/mcp` 限制及 GitLab API 配额无关。详见 [environment-variables.md](docs/configuration/environment-variables.md#oauth_register_rate_limit_per_hour)。
- **请求头认证 fallback：** 当请求头中存在 `Private-Token` 或 `JOB-TOKEN` 时，会跳过 OAuth 验证，并直接将原始 token 用于该会话。这样可以在同一服务器实例中同时使用 OAuth 流程、PAT 和 CI job token。`Authorization: Bearer` 始终被视为 OAuth token。PAT 请求头认证请使用 `Private-Token`。

## Agent Skill Files

Skill + CLI 与 MCP 同等（见 [Skill + CLI](#skill--cli不需要-mcp)）。对于支持 skill/instruction 加载的 AI 代理（Claude Code、GitHub Copilot、Cursor 等），[`skills/gitlab-mcp/`](./skills/gitlab-mcp/) 中提供了预构建 skill 文件。

- **[SKILL.md](./skills/gitlab-mcp/SKILL.md)** — 核心指南，包含工具集概览、关键工作流和参数提示
- **[reference/](./skills/gitlab-mcp/reference/)** — 代码审查、合并请求、议题、流水线和漏洞分类的详细工作流文档

使用 `skills` CLI 安装：

```bash
npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill
```

在 AI 客户端中注册 skill 目录，可以在不完全依赖完整 ListTools 响应的情况下获得更好的工具使用指导。

## 工具 🛠️

完整工具列表请参考英文 README 的 [Tools 部分](./README.md#tools-%EF%B8%8F)。当前服务器提供合并请求、议题、流水线、部署、环境、制品、里程碑、Wiki、仓库、发布、用户、事件、work item、webhook、代码搜索、CI/CD 变量、dependency proxy、漏洞分类和 GraphQL 执行相关工具。

### Wiki 页面标题与 slug

GitLab 会根据 wiki 页面标题推导其 **slug**（即 URL，`/-/wikis/<slug>`）。因此向 `update_wiki_page` / `update_group_wiki_page` 传入 `title` 会**重命名页面并改变其 URL**——对于嵌套页面，还可能把页面移动到不同的路径——从而导致已有链接失效。

若只想修改**显示标题**而保持 URL 不变，请**不要**传入 `title`，而是把显示标题写入页面内容的 YAML front matter 并更新内容：

```markdown
---
title: 我的自定义显示标题
---

页面正文…
```

GitLab 会保持 slug/URL 不变，并在界面中显示 front matter 中的标题。读取时对 `get_wiki_page` 传入 `render_html: true`，即可填充 `front_matter` 字段——而普通的 `title` 字段始终反映由 slug 推导的值。

## 测试 🧪

项目包含完整测试覆盖，包括远程授权：

```bash
# 运行所有测试（API 验证 + 远程授权）
npm test

# 只运行远程授权测试
npm run test:remote-auth

# 运行所有测试，包括 readonly MCP 测试
npm run test:all

# 只运行 API 验证
npm run test:integration
```

所有远程授权测试都使用 mock GitLab 服务器，不需要真实 GitLab 凭据。
