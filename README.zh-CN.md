# GitLab MCP Server

[English](./README.md) | [한국어](./README.ko.md) | [简体中文](./README.zh-CN.md)

📖 **[文档 →](https://zereight.github.io/gitlab-mcp/)** 设置指南、环境变量和完整工具参考请查看托管文档站点。

[![Star History Chart](./assets/star-history.png)](https://www.star-history.com/?repos=zereight%2Fgitlab-mcp&type=date&legend=top-left)

## @zereight/mcp-gitlab

这是面向 AI 客户端的完整 GitLab MCP 服务器。可通过 stdio、SSE 和 Streamable HTTP 管理项目、合并请求、议题、流水线、Wiki、发布、里程碑等。

支持 PAT、OAuth、只读模式、动态 API URL 和远程授权，可用于 VS Code、Claude、Cursor、Copilot 以及其他 MCP 客户端。

### 为什么使用这个 GitLab MCP？

- 覆盖范围广：项目、仓库浏览、合并请求、议题、流水线、Wiki、发布、标签、里程碑等
- 认证灵活：Personal Access Token、本地 OAuth2 浏览器流程、MCP OAuth 代理、按请求远程授权
- 多种传输方式：本地客户端使用 stdio，旧客户端使用 SSE，现代远程部署使用 Streamable HTTP
- 客户端设置友好：提供 Claude Code、Codex、Antigravity、OpenCode、Copilot、Cline、Roo Code、Cursor、Kilo Code 和 Amp Code 示例
- 适合自托管：支持自定义 GitLab 实例、代理设置和动态 API URL 路由

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

1. **Personal Access Token** (`GITLAB_PERSONAL_ACCESS_TOKEN`) — 最简单的设置
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

示例使用 `zereight-mcp-gitlab`，这是比旧的 `mcp-gitlab` 更不容易冲突的别名。如果 MCP 客户端找不到它，请使用 `which zereight-mcp-gitlab` 输出的绝对路径。

如果不想全局安装，请将 `npx` 固定到上一个稳定版本（即文档推荐的版本），例如 `npx -y @zereight/mcp-gitlab@2.1.40`。如果始终想使用最新版本，请改用 `npx -y @zereight/mcp-gitlab@latest`。有新版本发布时，服务器会在启动时通过 stderr 提示（可用 `GITLAB_DISABLE_VERSION_CHECK=true` 关闭）。

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
- `--read-only=true` - 启用只读模式（替代 `GITLAB_READ_ONLY_MODE`，已弃用 — 推荐 `--permission-mode=readonly`）
- `--permission-mode` - 权限级别：`readonly`、`modify`（禁用删除工具）或 `full`（替代 `GITLAB_PERMISSION_MODE`，默认 `full`）
- `--use-wiki=true` - 启用 Wiki API（替代 `USE_GITLAB_WIKI`，旧版 — 推荐 `GITLAB_TOOLSETS=wiki`）
- `--use-milestone=true` - 启用里程碑 API（替代 `USE_MILESTONE`，旧版 — 推荐 `GITLAB_TOOLSETS=milestones`）
- `--use-pipeline=true` - 启用流水线 API（替代 `USE_PIPELINE`，旧版 — 推荐 `GITLAB_TOOLSETS=pipelines`）
- `--disable-version-check=true` - 关闭启动时的新版本提示（替代 `GITLAB_DISABLE_VERSION_CHECK`）

CLI 参数优先于环境变量。

> **细粒度工具过滤：**使用 `GITLAB_PERMISSION_MODE=modify` 允许创建/更新并阻止所有删除工具，
> 或使用 `GITLAB_PERMISSION_MODE=readonly` 只读运行。还可以用
> `GITLAB_TOOLSETS=<group,…>` 启用工具分组，用 `GITLAB_TOOLS=<tool,…>` 白名单启用单个工具
> （例如：只读分组 + 少数几个写工具），用 `GITLAB_DENIED_TOOLS_REGEX` 按正则屏蔽工具。
> 旧版 `USE_GITLAB_WIKI` / `USE_MILESTONE` / `USE_PIPELINE` 标志仅为向后兼容保留。
> 参见 [Tools Reference](./docs/tools/index.md#feature-toggles) 和
> [Environment Variables](./docs/configuration/environment-variables.md)。

#### SSE

```shell
docker run -i --rm \
  -e HOST=0.0.0.0 \
  -e GITLAB_PERSONAL_ACCESS_TOKEN=your_gitlab_token \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_PERMISSION_MODE=readonly \
  -e GITLAB_TOOLSETS=wiki,milestones,pipelines \
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

#### Streamable HTTP

```shell
docker run -i --rm \
  -e HOST=0.0.0.0 \
  -e REMOTE_AUTHORIZATION=true \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e GITLAB_PERMISSION_MODE=readonly \
  -e GITLAB_TOOLSETS=wiki,milestones,pipelines \
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
| `GITLAB_API_URL`              | 是   | GitLab API base URL                                                                                         |
| `GITLAB_OAUTH_APP_ID`         | 是   | GitLab OAuth Application ID                                                                                 |
| `MCP_SERVER_URL`              | 是   | 此 MCP 服务器的公开 HTTPS URL                                                                               |
| `STREAMABLE_HTTP`             | 是   | 必须为 `true`                                                                                               |
| `GITLAB_OAUTH_CALLBACK_PROXY` | 可选 | 设置为 `true` 时使用 MCP 服务器固定的 `/callback` URL                                                       |
| `GITLAB_OAUTH_SCOPES`         | 可选 | 逗号分隔的 scope（默认：`api,read_api,read_user`）                                                          |
| `GITLAB_OAUTH_ALLOWED_GROUPS` | 可选 | 逗号分隔的 GitLab 群组完整路径 — 仅该群组及其子群组的成员可获取令牌（替代已废弃的 `GITLAB_ALLOWED_GROUPS`） |

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
| `GITLAB_ALLOWED_HOSTS`                                           | 可选 | 允许的 `X-GitLab-API-URL` 主机逗号分隔列表；`GITLAB_API_URL` 中的主机始终允许                                          |
| `GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY`                    | 可选 | 仅允许未认证的 `initialize`、`notifications/initialized`、`tools/list`（工具调用仍需认证）                                |
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
| `GITLAB_API_URL`                            | 是   | GitLab 实例 API URL（例如 `https://gitlab.com/api/v4`）                                                                                  |
| `STREAMABLE_HTTP`                           | 是   | 必须为 `true`（不支持 SSE）                                                                                                              |
| `GITLAB_OAUTH_SCOPES`                       | 否   | 要请求的 GitLab scopes，以逗号分隔。默认值为 `api`，当 `GITLAB_READ_ONLY_MODE=true` 时为 `read_api`。预注册应用必须配置至少这些 scopes。 |
| `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL` | 否   | 仅用于本地 HTTP 开发                                                                                                                     |

**重要说明：**

- MCP OAuth **仅适用于 Streamable HTTP 传输**（与 `SSE=true` 不兼容）。
- 每个用户会话保存自己的 OAuth token，会话完全隔离。
- 会话超时、rate limiting 和 capacity limit 与 `REMOTE_AUTHORIZATION` 模式相同（`SESSION_TIMEOUT_SECONDS`, `MAX_REQUESTS_PER_MINUTE`, `MAX_SESSIONS`）。
- **请求头认证 fallback：** 当请求头中存在 `Private-Token` 或 `JOB-TOKEN` 时，会跳过 OAuth 验证，并直接将原始 token 用于该会话。这样可以在同一服务器实例中同时使用 OAuth 流程、PAT 和 CI job token。`Authorization: Bearer` 始终被视为 OAuth token。PAT 请求头认证请使用 `Private-Token`。

## Agent Skill Files

对于支持 skill/instruction 加载的 AI 代理（Claude Code、GitHub Copilot、Cursor 等），[`skills/gitlab-mcp/`](./skills/gitlab-mcp/) 中提供了预构建 skill 文件。

- **[SKILL.md](./skills/gitlab-mcp/SKILL.md)** — 核心指南，包含工具集概览、关键工作流和参数提示
- **[reference/](./skills/gitlab-mcp/reference/)** — 代码审查、合并请求、议题和流水线的详细工作流文档

使用 `skills` CLI 安装：

```bash
npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill
```

在 AI 客户端中注册 skill 目录，可以在不完全依赖完整 ListTools 响应的情况下获得更好的工具使用指导。

## 工具 🛠️

完整工具列表请参考英文 README 的 [Tools 部分](./README.md#tools-%EF%B8%8F)。当前服务器提供合并请求、议题、流水线、部署、环境、制品、里程碑、Wiki、仓库、发布、用户、事件、work item、webhook、代码搜索和 GraphQL 执行相关工具。

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
