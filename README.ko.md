# GitLab MCP Server

[![npm](https://img.shields.io/npm/v/@zereight/mcp-gitlab.svg)](https://www.npmjs.com/package/@zereight/mcp-gitlab)

[English](./README.md) | [한국어](./README.ko.md) | [简体中文](./README.zh-CN.md) | [Português (Brasil)](./README.pt-BR.md)

📖 **[문서 →](https://zereight.github.io/gitlab-mcp/)** · [llms.txt](./llms.txt) · [llms-full.txt](./llms-full.txt)

**기본 노출: 40개 도구** (`core` 38개 + `discover_tools` + `help`). 전체는 278개(toolset 275개 + `execute_graphql` + `discover_tools` + `help`). 작게 시작하고, 세션에서 `discover_tools`로 확장하세요.

`zereight-mcp-gitlab` 바이너리를 먼저 설치하세요. `npm install -g @zereight/mcp-gitlab`, 또는 Homebrew `brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp` 다음 `brew install zereight/gitlab-mcp/zereight-mcp-gitlab`. 공식 MCP Registry 항목: [`io.github.zereight/gitlab-mcp`](https://registry.modelcontextprotocol.io/?q=io.github.zereight%2Fgitlab-mcp). 한 줄 설치: `npx -y @zereight/mcp-gitlab@latest`.

### Without → With

| 이 MCP 없이 | 이 MCP로 |
| ----------- | -------- |
| MR URL과 diff를 채팅에 붙여넣기 | `list_merge_request_changed_files` → 배치 `get_merge_request_file_diff` |
| GitLab UI에서 job 로그 찾기 | 페이지네이션과 함께 `get_pipeline_job_output` |
| 매 턴마다 프로젝트 경로를 다시 설명 | `project_id=group%2Fproject`, `merge_request_iid=123` |

### 설치 3경로

| 경로 | 언제 | 어떻게 |
| ---- | ---- | ------ |
| 로컬 IDE | 내 머신의 Cursor, Claude Code, Codex | stdio + PAT 또는 로컬 OAuth |
| 공유 HTTP | 팀 / 호스팅 MCP | Streamable HTTP URL + 원격 인증 또는 MCP OAuth |
| Claude.ai | Claude 웹 커넥터 | 공개 HTTPS + `GITLAB_MCP_OAUTH` |

### 설치

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=zereight.gitlab-mcp&config=eyJ0eXBlIjoic3RkaW8iLCJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB6ZXJlaWdodC9tY3AtZ2l0bGFiQGxhdGVzdCJdLCJlbnYiOnsiR0lUTEFCX1BFUlNPTkFMX0FDQ0VTU19UT0tFTiI6IiR7ZW52OkdJVExBQl9QRVJTT05BTF9BQ0NFU1NfVE9LRU59IiwiR0lUTEFCX0FQSV9VUkwiOiJodHRwczovL2dpdGxhYi5jb20vYXBpL3Y0In19)

바이너리를 먼저 설치하세요 (`npm install -g @zereight/mcp-gitlab`, 또는 Homebrew `brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp` 다음 `brew install zereight/gitlab-mcp/zereight-mcp-gitlab`). 토큰은 화면에 표시하지 않고 읽으세요:

```bash
read -rs GITLAB_PERSONAL_ACCESS_TOKEN && export GITLAB_PERSONAL_ACCESS_TOKEN
```

```bash
# Claude Code
claude mcp add gitlab --transport stdio --scope local --env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=https://gitlab.com/api/v4 -- zereight-mcp-gitlab

# Codex
codex mcp add gitlab --env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=https://gitlab.com/api/v4 -- zereight-mcp-gitlab
```

다른 클라이언트: [VS Code](./docs/clients/vscode.md) · [GitHub Copilot](./docs/clients/copilot.md) · [JSON 클라이언트](./docs/clients/json-clients.md) · [Cursor 상세](./docs/clients/cursor.md)

### 에이전트용 붙여넣기 프롬프트

MCP 설정을 고칠 수 있는 에이전트에 그대로 붙여넣으세요:

```
이 워크스페이스에 GitLab MCP 서버(@zereight/mcp-gitlab)를 설치하세요.
바이너리: zereight-mcp-gitlab (npm i -g @zereight/mcp-gitlab, 또는 npx -y @zereight/mcp-gitlab@latest).
인증: GITLAB_PERSONAL_ACCESS_TOKEN 과 GITLAB_API_URL=https://gitlab.com/api/v4 (또는 GITLAB_USE_OAUTH=true).
로컬: claude mcp add gitlab --transport stdio --scope local --env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=https://gitlab.com/api/v4 -- zereight-mcp-gitlab
또는: codex mcp add gitlab --env GITLAB_PERSONAL_ACCESS_TOKEN="$GITLAB_PERSONAL_ACCESS_TOKEN" --env GITLAB_API_URL=https://gitlab.com/api/v4 -- zereight-mcp-gitlab
Cursor: README deeplink 또는 docs/clients/cursor.md.
원격 HTTP: 클라이언트를 https://mcp.example.com/mcp (Streamable HTTP)로 연결. Claude.ai는 그 호스트에 GITLAB_MCP_OAUTH가 필요합니다.
기본 목록: 40개 도구(core 38 + discover_tools + help). 확장은 discover_tools. api toolset은 우회 위험을 받아들일 때만.
MCP 없는 동등 경로: npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill 와 zereight-mcp-gitlab CLI.
```

### 원격 HTTP

호스팅/셀프호스트 서버의 1순위 옵션입니다. 클라이언트를 Streamable HTTP URL로 연결하세요:

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

- 호스팅 / Claude.ai: 서버에서 `GITLAB_MCP_OAUTH=true` ([MCP OAuth](#mcp-oauth-프록시-사용하기-gitlab_mcp_oauth) 참고)
- 사용자별 PAT 헤더: `REMOTE_AUTHORIZATION=true` ([원격 인증](#원격-인증-사용하기-remote_authorization) 참고)
- 로컬 Docker 예시는 [사용법](#사용법)에 있습니다

### Skill + CLI (MCP 불필요)

Skill + CLI는 폴백이 아니라 동등한 경로입니다. 같은 워크플로우, 터미널의 전체 페이로드, MCP 등록 없음.

```bash
npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill
zereight-mcp-gitlab user whoami
zereight-mcp-gitlab mr list
```

[MCP 없이 CLI](./docs/getting-started/cli-without-mcp.md)와 [`skills/gitlab-mcp/`](./skills/gitlab-mcp/)를 보세요.

### MCP vs Human CLI

| MCP를 쓸 때 | CLI를 쓸 때 |
| ----------- | ----------- |
| 채팅에서 구조화된 도구가 필요할 때 | 전체 페이로드(diff, 로그, 아티팩트)가 필요할 때 |
| `jmespath`나 compact 결과로 충분할 때 | `GITLAB_MCP_COMPACT_RESULTS`가 켜져 있고 나머지는 터미널에서 볼 때 |
| 이미 MCP 서버를 등록했을 때 | PAT가 있거나 `auth`를 했고 MCP가 필요 없을 때 |

Human CLI는 compact되지 않습니다. 파괴적 도구와 `GITLAB_TOOL_POLICY_APPROVE` 도구는 `--yes`가 필요합니다.

### Tips

`project_id`는 숫자 ID 또는 URL 인코딩된 경로입니다. 예: 그룹 `group`, 프로젝트 `project`, MR `!123` → `project_id=group%2Fproject`, `merge_request_iid=123`. 중첩 그룹은 세그먼트마다 `%2F`를 씁니다 (`group%2Fsubgroup%2Fproject`).

### FAQ

**인증은 어떻게 하나요?** 로컬 데스크톱은 `GITLAB_PERSONAL_ACCESS_TOKEN`(또는 `GITLAB_PERSONAL_ACCESS_TOKEN_FILE`)이 가장 단순합니다. 로컬 OAuth는 `GITLAB_USE_OAUTH=true`. 원격 Claude.ai는 `GITLAB_MCP_OAUTH`. 멀티유저 HTTP는 `REMOTE_AUTHORIZATION`과 요청별 토큰 헤더입니다.

**도구가 40개만 보이는 이유는?** 기본 `core` toolset 38개에 항상 켜진 `discover_tools`와 `help`가 더해집니다. 인자 없이 `discover_tools`를 호출하면 카테고리 목록이 나오고, 카테고리(`pipelines`, `wiki` 등)를 넘기면 이 세션에 활성화됩니다. `GITLAB_TOOLSETS=all`도 `api`는 켜지 않습니다.

**로컬 OAuth / MCP OAuth / 원격 인증 차이는?** 로컬 OAuth는 서버와 같은 머신에서 브라우저를 엽니다. MCP OAuth는 공개 HTTPS 서버와 Claude.ai 같은 클라이언트용입니다. 원격 인증은 호출자의 PAT 또는 job token을 전달하며 OAuth 흐름이 없습니다.

**큰 응답을 줄이려면?** 도구 호출에 `jmespath`를 넘기세요. 또는 `GITLAB_MCP_COMPACT_RESULTS=true`로 큰 MCP 응답을 미리보기 + CLI 명령으로 바꿉니다. 전체 페이로드가 필요하면 CLI를 쓰세요.

**`api` toolset이 위험한 이유는?** `gitlab_api_request`는 그룹/프로젝트 허용 목록, 다른 도구 필터, 도구별 안전 검사를 우회합니다. 프롬프트 인젝션이 이 도구를 구동할 수 있습니다. `GITLAB_TOOLSETS`에 `api`를 직접 넣을 때만 켜세요. `all`, `discover_tools`, `GITLAB_TOOLS`는 켜지 않습니다.

### Cursor rule / CLAUDE.md 스니펫

```
GitLab 머지 리퀘스트, 이슈, 파이프라인은 이 MCP(@zereight/mcp-gitlab)로 처리하세요.
기본 core 도구로 시작하고, 확장은 discover_tools를 호출하세요.
list_merge_request_changed_files 다음 배치 get_merge_request_file_diff를 우선하세요.
결과는 jmespath 또는 compact를 쓰고, 전체 diff와 job 로그는 CLI를 쓰세요.
```

[![Star History Chart](./assets/star-history.png)](https://www.star-history.com/?repos=zereight%2Fgitlab-mcp&type=date&legend=top-left)

## @zereight/mcp-gitlab

**에이전트 워크플로우에 최적화된 GitLab MCP** — stdio, SSE, Streamable HTTP를 통해 프로젝트, 머지 리퀘스트, 이슈, 파이프라인, 위키, 릴리스, 마일스톤 등을 관리할 수 있습니다.

PAT, OAuth, 읽기 전용 모드, 동적 API URL, 원격 인증을 지원하며 VS Code, Claude, Cursor, Copilot 및 기타 MCP 클라이언트에서 사용할 수 있습니다.

### 왜 이 GitLab MCP를 사용하나요?

- **기본 40개 도구(`core` 38 + `discover_tools` + `help`); 전체 278개** — 작게 시작하고, `discover_tools`로 세션에서 확장
- **MR 2단계 리뷰** — `list_merge_request_changed_files` → 배치 `get_merge_request_file_diff`
- **Agent Skill 내장** — `skills/gitlab-mcp/` 워크플로우 가이드
- **유연한 인증** — Personal Access Token, 로컬 OAuth2 브라우저 플로우, MCP OAuth 프록시, 요청별 원격 인증
- **여러 전송 방식** — 로컬 클라이언트용 stdio, 레거시 클라이언트용 SSE, 최신 원격 배포용 Streamable HTTP
- **클라이언트 친화적 설정** — Claude Code, Codex, Antigravity, OpenCode, Copilot, Cline, Roo Code, Cursor, Kilo Code, Amp Code 예시 제공
- **셀프 호스팅 대응** — 커스텀 GitLab 인스턴스, 프록시 설정, 동적 API URL 라우팅 지원
- **JMESPath 결과 필터링** — 도구 호출에 선택적 `jmespath` 인자(`tools/list` 참고)를 넘기면 GitLab API 요청은 그대로 두고 JSON 결과만 줄여서 반환; 응답 마스킹이 켜져 있으면 마스킹된 데이터에 JMESPath가 적용됨

### 비교 요약

|                 | @zereight/mcp-gitlab                                             | GitLab MCP A (커뮤니티 CQRS형)             | GitLab 공식 MCP 서버                                                                                                                            |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **적합한 경우** | AI 에이전트 워크플로우                                           | 엔터프라이즈 멀티 인스턴스 / 그룹형 도구   | GitLab에 내장, 별도 설치 없음                                                                                                                   |
| **도구 모델**   | 278개 도구: toolset 275개 + `execute_graphql` + `discover_tools` + `help` | ~50–60개 `browse_*` / `manage_*` 그룹 도구 | HTTP 헤더로 고르는 toolset                                                                                                                      |
| **MR 리뷰**     | 2단계 배치 diff                                                  | 서버마다 다름                              | `get_merge_request`에 diffs                                                                                                                     |
| **Node.js**     | >=18.17                                                          | 보통 >=24                                  | stdio는 `mcp-remote`, Node.js 20+                                                                                                               |
| **라이선스**    | MIT                                                              | 서버마다 다름                              | GitLab의 일부                                                                                                                                   |

### tools/list 크기 (2026-10-23 실측)

클라이언트는 세션 시작 때 `tools/list` 전체를 모델에 보냅니다. 토큰 추정은 UTF-8 바이트 / 4입니다.

| 프로필 | 도구 수 | JSON 바이트 | 추정 토큰 |
| ------ | ------: | ----------: | --------: |
| 기본값 (`core` + `discover_tools` + `help`) | 40 | 50,682 | 12,671 |
| `GITLAB_TOOL_PROFILE=slim` | 39 | 49,646 | 12,412 |
| `GITLAB_TOOLSETS=all` | 276 | 285,677 | 71,420 |

설명이나 스키마를 바꾼 뒤에는 `npm run test:mock` (`test/tools-list-budget.test.ts`)으로 다시 측정하세요.

GitLab은 [공식 MCP 서버](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)도 제공합니다.

- Free, Premium, Ultimate. GitLab 19.2에서 Premium에서 Free로 옮겨졌고, GitLab 19.5에서 GA입니다.
- GitLab.com에서는 최상위 그룹 Owner가 MCP 서버 접근을 허용합니다. GitLab Self-Managed와 GitLab Dedicated는 인스턴스 설정입니다. 기본값 규칙은 공식 페이지에 있습니다.
- 원격 클라이언트는 HTTP `https://<gitlab.example.com>/api/v4/mcp`와 OAuth 2.0 동적 클라이언트 등록을 사용합니다.
- stdio는 `mcp-remote`를 거치며 Node.js 20 이상이 필요합니다.
- Toolset은 `X-Gitlab-Enabled-Mcp-Server-Toolsets` 헤더를 사용합니다. 선택 헤더 `X-Gitlab-Mcp-Server-Tool-Name-Prefix`는 도구 이름 접두사의 앞 32자만 유지합니다.

[공식 GitLab MCP 서버 전체 비교 →](./docs/comparison/official-gitlab-mcp.md)

빠른 시작: 아래에서 Personal Access Token 또는 OAuth2 설정 중 하나를 선택하고 `@zereight/mcp-gitlab`을 설치한 뒤 MCP 클라이언트 설정에서 `zereight-mcp-gitlab`을 사용하세요.

### 클라이언트 설정 가이드

- [Claude Code 설정 가이드](./docs/clients/claude-code.md)
- [VS Code 설정 가이드](./docs/clients/vscode.md)
- [GitHub Copilot 설정 가이드](./docs/clients/copilot.md)
- [Codex 설정 가이드](./docs/clients/codex.md)
- [Cursor 설정 가이드](./docs/clients/cursor.md)
- [JSON 기반 MCP 클라이언트 설정 가이드](./docs/clients/json-clients.md) - Factory AI Droid, OpenClaw, OpenCode 스타일 클라이언트용
- [OAuth2 인증 설정 가이드](./docs/auth/oauth-setup.md)
- [환경 변수 레퍼런스](./docs/configuration/environment-variables.md)
- [Stateless Mode — 멀티 Pod HPA](./docs/configuration/stateless-mode.md)
- [커스텀 에이전트 및 다중 PAT 설정](./docs/auth/custom-agent-multiple-pat.md)

## 사용법

### 설정 개요

#### 인증 방식

이 서버는 네 가지 인증 방식을 지원합니다.

**로컬/데스크톱 사용**(가장 일반적):

1. **Personal Access Token** (`GITLAB_PERSONAL_ACCESS_TOKEN` 또는 `GITLAB_PERSONAL_ACCESS_TOKEN_FILE`) — 가장 단순한 설정
2. **OAuth2 — 로컬 브라우저** (`GITLAB_USE_OAUTH`) — 더 나은 보안을 위해 권장

**서버/원격 배포**:

3. **OAuth2 — MCP 프록시** (`GITLAB_MCP_OAUTH`) — Claude.ai 같은 원격 MCP 클라이언트용
4. **원격 인증** (`REMOTE_AUTHORIZATION`) — 각 호출자가 자신의 토큰을 제공하는 멀티 유저 배포용

#### 빠른 설정 경로

- **Claude Code**: [Claude Code 설정 가이드](./docs/clients/claude-code.md)
- **VS Code**: [VS Code 설정 가이드](./docs/clients/vscode.md)
- **GitHub Copilot**: [GitHub Copilot 설정 가이드](./docs/clients/copilot.md)
- **Codex**: [Codex 설정 가이드](./docs/clients/codex.md)
- **Cursor**: [Cursor 설정 가이드](./docs/clients/cursor.md)
- **Factory AI Droid / OpenClaw / OpenCode 스타일 클라이언트**: [JSON 기반 MCP 클라이언트 설정 가이드](./docs/clients/json-clients.md)
- **OAuth 브라우저 플로우 상세**: [OAuth2 인증 설정 가이드](./docs/auth/oauth-setup.md)
- **localhost callback 없이 OAuth** (SSO, 원격 셸, 백그라운드 클라이언트): `zereight-mcp-gitlab auth`를 먼저 실행하세요 (GitLab 17.9+ device flow; 17.2–17.8은 `oauth2_device_grant_flow` 필요). 그다음 서버는 `GITLAB_USE_OAUTH=true`로 시작합니다. [독립 device-flow 커맨드](./docs/auth/oauth-setup.md#standalone-device-flow-auth-command)를 참고하세요.

가장 단순한 로컬 설정은 Personal Access Token으로 시작하세요. 브라우저 기반 로컬 인증은 OAuth2를 사용하세요. 원격 또는 멀티 유저 배포는 아래 MCP OAuth 및 원격 인증 섹션을 참고하세요.

서버를 한 번 설치하세요.

```shell
brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp
brew install zereight/gitlab-mcp/zereight-mcp-gitlab
```

npm으로 설치할 수도 있습니다:

```shell
npm install -g @zereight/mcp-gitlab
```

또는 Nix를 사용해 이 플레이크를 자신의 플레이크에 추가할 수 있습니다:

```nix
# flake.nix
inputs.gitlab-mcp.url = "github:zereight/gitlab-mcp";

# wherever you configure your MCP client:
command = lib.getExe inputs.gitlab-mcp.packages.${system}.default;
```

스토어 경로는 lock 파일에 고정되며, `nix flake update gitlab-mcp`로 업데이트합니다.

예시는 기존 `mcp-gitlab`보다 충돌 가능성이 낮은 `zereight-mcp-gitlab` 별칭을 사용합니다. MCP 클라이언트가 찾지 못하면 `which zereight-mcp-gitlab`의 절대 경로를 사용하세요.

전역 설치를 쓰지 않으려면 `npx -y @zereight/mcp-gitlab@2.3.6`처럼 직전 안정 버전(문서가 권장하는 버전)으로 고정하세요. 항상 최신 버전을 원하면 `npx -y @zereight/mcp-gitlab@latest`를 사용하세요. `main`에 머지된 수정을 다음 안정 버전 전에 확인하려면 프리릴리스 빌드인 `npx -y @zereight/mcp-gitlab@next`를 사용하세요(운영 환경용이 아닙니다). 새 버전이 나오면 서버가 시작 시 stderr로 알려줍니다(`GITLAB_DISABLE_VERSION_CHECK=true`로 비활성화 가능).

#### Claude Desktop 원클릭 설치(MCP Bundle)

v2.3.1 이후의 GitHub 릴리스마다 `gitlab-mcp.mcpb` [MCP Bundle](https://github.com/modelcontextprotocol/mcpb)이 첨부됩니다. [최신 번들](https://github.com/zereight/gitlab-mcp/releases/latest/download/gitlab-mcp.mcpb)을 내려받아 Claude Desktop으로 열거나 **Settings → Extensions**에 끌어다 놓으세요. Claude Desktop이 Personal Access Token을 입력받아 민감 정보로 저장하고, `GITLAB_API_URL`, `GITLAB_PERMISSION_MODE`, `GITLAB_TOOLSETS`, `GITLAB_MASKING_ENABLED`를 설정할 수 있게 합니다. Node.js나 npm을 따로 설치할 필요가 없습니다.

소스에서 번들을 만들려면 `npm run pack:mcpb`를 실행하세요(`gitlab-mcp.mcpb` 생성).

#### CLI 인자 사용하기(환경 변수 문제가 있는 클라이언트용)

일부 MCP 클라이언트(예: GitHub Copilot CLI)는 환경 변수 처리에 문제가 있을 수 있습니다. 이 경우 CLI 인자를 사용하세요.

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

**사용 가능한 CLI 인자:**

- `--token` - GitLab Personal Access Token (`GITLAB_PERSONAL_ACCESS_TOKEN` 대체)
- `--api-url` - GitLab API URL (`GITLAB_API_URL` 대체)
- `--read-only=true` - Deprecated (removed in next major (v3.0.0)); `--permission-mode=readonly`를 사용 (`GITLAB_READ_ONLY_MODE` 대체)
- `--permission-mode` - 권한 수준: `readonly`, `modify`(삭제/중단 도구 비활성), `full` (`GITLAB_PERMISSION_MODE` 대체, 기본값 `full`)
- `--toolsets=all` - 지정한 툴셋 활성화. 명시적 `api` 툴셋은 빠짐 (`GITLAB_TOOLSETS` 대체, 미설정 시 lean `core` 기본값 사용). `gitlab_api_request`는 `--toolsets=api`
- `--tools=list_issues` - 개별 도구 추가 (`GITLAB_TOOLS` 대체)
- `--use-wiki=true` - Deprecated (removed in next major (v3.0.0)); `--toolsets=core,wiki`를 사용 (`USE_GITLAB_WIKI` 대체)
- `--use-milestone=true` - Deprecated (removed in next major (v3.0.0)); `--toolsets=core,milestones`를 사용 (`USE_MILESTONE` 대체)
- `--use-pipeline=true` - Deprecated (removed in next major (v3.0.0)); `--toolsets=core,pipelines`를 사용하고, 기존 `--tools` 목록에 `validate_ci_lint,validate_project_ci_lint`를 추가하세요. 목록이 없으면 `--tools=validate_ci_lint,validate_project_ci_lint`를 설정하세요 (`USE_PIPELINE` 대체)
- `--disable-version-check=true` - 시작 시 신규 버전 알림 비활성화 (`GITLAB_DISABLE_VERSION_CHECK` 대체)
- `--masking-enabled=true` - 텍스트 응답 마스킹 활성화 (`GITLAB_MASKING_ENABLED` 대체)
- `--masking-config` - 마스킹 설정 파일 경로 (`GITLAB_MASKING_CONFIG` 대체)
- `--masking-policy-file` - 보호된 관리형 정책 파일 경로 (`GITLAB_MASKING_POLICY_FILE` 대체)
- `--masking-workspace-dir` - 마스킹 파일 경로를 해석하는 기준 디렉터리 (`GITLAB_MASKING_WORKSPACE_DIR` 대체)
- `--download-dir` - `download_attachment`가 파일을 저장하는 디렉터리 (`GITLAB_DOWNLOAD_DIR` 대체, 기본값 `.gitlab-mcp-downloads`)
- `--compact-results=true` - 큰 MCP 도구 응답을 미리보기와 CLI 명령으로 바꿈 (`GITLAB_MCP_COMPACT_RESULTS` 대체, 기본 꺼짐)
- `--compact-result-chars` - compact 임계값 문자 수 (`GITLAB_MCP_COMPACT_RESULT_CHARS` 대체, 기본 `4000`)
- `--compact-tools` - 전역 compact를 켜지 않고, 응답이 클 때 compact할 도구 이름을 쉼표로 지정 (`GITLAB_MCP_COMPACT_TOOLS` 대체)
- `--tool-profile` - `full`(기본값) 또는 `slim`. `slim`은 draft note, 이모지 반응, 라벨, CI 카탈로그 도구와 `create_group`을 초기 목록에서 뺌. `GITLAB_TOOLSETS`에 공백이 아닌 값이 설정된 경우에만 무시됨 (`GITLAB_TOOL_PROFILE` 대체)

이미 `GITLAB_TOOLSETS` 또는 `--toolsets`를 설정했다면 목록을 바꾸지 말고 `wiki`, `milestones`, `pipelines`를 기존 목록에 추가하세요. 이미 `GITLAB_TOOLS` 또는 `--tools`를 설정했다면 `validate_ci_lint`와 `validate_project_ci_lint`를 그 목록에 추가하세요. 명시적 목록은 기본 `core` toolset을 대체하며, 합쳐지지 않습니다.

CLI 인자는 환경 변수보다 우선합니다.

`zereight-mcp-gitlab auth`는 MCP 서버 플래그가 아니라 서브커맨드입니다. GitLab device flow를 실행한 뒤 종료합니다. [CLI 인자](./docs/getting-started/cli-arguments.md#auth)를 참고하세요.

같은 바이너리는 `gh` 스타일 GitLab CLI이기도 합니다 (`tool <name>` 또는 `mr list` 같은 curated 명령). **MCP 등록은 필요 없습니다** — PAT를 설정하거나, `auth`를 실행한 뒤 `GITLAB_USE_OAUTH=true`를 설정하면 됩니다: [MCP 없이 CLI 사용하기](./docs/getting-started/cli-without-mcp.md). `setup --cursor` / `setup --claude`는 클라이언트 설정을 출력하고, `doctor`는 토큰·API URL·toolset·버전을 점검합니다. 전체 페이로드는 터미널에서 이 CLI로 읽습니다. MCP 응답은 대화에 남습니다. `GITLAB_MCP_COMPACT_RESULTS=true`(또는 `--compact-results`)를 켜면 큰 도구 응답이 미리보기와 CLI 명령으로 바뀝니다. Human CLI 자체는 compact 되지 않습니다. permission mode, toolsets, denied-tools regex, tool-policy는 MCP와 같습니다. destructive 도구와 `GITLAB_TOOL_POLICY_APPROVE` 도구는 `--yes`가 필요합니다. [Human CLI](./docs/getting-started/cli-arguments.md#human-cli)를 참고하세요.

> **세밀한 도구 필터링:** `GITLAB_PERMISSION_MODE=modify`로 생성/수정은 허용하고 모든 삭제 도구와
> 파괴적인 중단(teardown) 도구(`cancel_pipeline`, `cancel_pipeline_job`, `stop_environment`,
> `stop_stale_environments`, `unprotect_branch`, `unprotect_tag`)를 차단하거나(`execute_graphql`을 통한 파괴적
> mutation — 삭제·중단 동사 — 과 `push_files`의 `delete`/`move` 포함),
> `GITLAB_PERMISSION_MODE=readonly`로 읽기 전용으로 운영할 수
> 있습니다. 또한
> `GITLAB_TOOLSETS=<group,…>`로 도구 그룹을 활성화하고, `GITLAB_TOOLS=<tool,…>`로 개별 도구만
> 허용하며(예: 읽기 도구 + 특정 쓰기 도구 몇 개), `GITLAB_DENIED_TOOLS_REGEX`로 패턴 차단할 수
> 있습니다. 레거시 `USE_GITLAB_WIKI` / `USE_MILESTONE` / `USE_PIPELINE` 플래그는
> deprecated (removed in next major (v3.0.0))입니다.
> `GITLAB_TOOLSETS=core,wiki`, `core,milestones`, `core,pipelines`를 사용하세요
> (`USE_PIPELINE`은 기존 `GITLAB_TOOLS` 목록에 `validate_ci_lint,validate_project_ci_lint`를 추가해야 하며, 그 목록을 통째로 바꾸면 안 됩니다).
> 이미 `GITLAB_TOOLSETS`를 설정했다면 toolset을 기존 목록에 추가하고, 목록 전체를 바꾸지 마세요.
> `GITLAB_TOOLS`가 없으면 `GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint`로 설정하세요. 이미 있으면 `validate_ci_lint,validate_project_ci_lint`를 기존 목록에 추가하고, 목록 전체를 바꾸지 마세요.
> [Tools Reference](./docs/tools/index.md#feature-toggles)와
> [Environment Variables](./docs/configuration/environment-variables.md)를 참고하세요.

> [!CAUTION]
> `gitlab_api_request`(`api` 툴셋)는 `GITLAB_ALLOWED_GROUPS`와 그 밖의 그룹 제한, 프로젝트 허용 목록, 도구 단위 제한(`GITLAB_TOOLS`, 다른 도구에 걸린 `GITLAB_DENIED_TOOLS_REGEX`), 개별 도구 안전 검사를 우회합니다. 토큰 권한 범위 전체가 노출됩니다. 프롬프트 인젝션이 이 도구를 호출할 수 있습니다. 이런 제한에 의존하는 운영자는 켜면 안 됩니다.
> `GITLAB_TOOLSETS`에 `api`를 직접 적을 때만 켜집니다 (`GITLAB_TOOLSETS=all`, `discover_tools`, `GITLAB_TOOLS`, 레거시 `USE_*`, `GITLAB_TOOL_PROFILE`로는 안 됩니다). `GITLAB_ALLOWED_PROJECT_IDS`나 세션 프로젝트 범위가 있으면 허용된 프로젝트의 `/projects/:id` 경로만 받습니다. `/search`, `/users`, `/groups/:id`, `/runners` 같은 엔드포인트는 거부됩니다. 본문과 쿼리 파라미터가 가리키는 다른 프로젝트는 검사하지 않습니다. `GITLAB_PROJECT_ID`와 OAuth 그룹 허용 목록은 이 도구가 검사하지 않습니다.

- sse

변수 이름만 넘기세요. Docker 클라이언트는 export한 `GITLAB_PERSONAL_ACCESS_TOKEN` 값을 컨테이너로 복사합니다.

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

#### MCP OAuth 프록시 사용하기(`GITLAB_MCP_OAUTH`)

> **서버/원격 배포 전용입니다.** 이 모드는 공개 접근 가능한 HTTPS URL로 MCP 서버를 배포해야 합니다. 로컬/데스크톱 사용은 `GITLAB_USE_OAUTH`를 사용하세요.

MCP OAuth 사양을 지원하는 원격 MCP 클라이언트(예: Claude.ai)용입니다. 서버는 완전한 OAuth 2.0 인증 서버로 동작합니다. 인증되지 않은 요청은 `401 + WWW-Authenticate` 응답을 받고, 클라이언트 측 OAuth 브라우저 플로우가 자동으로 시작됩니다.

OpenCode, MCPJam, Claude.ai 같은 원격 MCP 클라이언트는 인증 중에 자체 callback URL을 보낼 수 있습니다. 모든 클라이언트 callback URL을 GitLab에 등록할 수 없다면 `GITLAB_OAUTH_CALLBACK_PROXY=true`를 켜세요. 콜백 프록시 모드에서는 GitLab에 `{MCP_SERVER_URL}/callback` 하나만 Redirect URI로 등록하면 됩니다.

`GITLAB_OAUTH_REDIRECT_URI`는 로컬 OAuth(`GITLAB_USE_OAUTH`) 전용입니다. 원격 MCP OAuth 클라이언트 callback URL을 덮어쓰지 않으며, 원격 `Unregistered redirect_uri` 오류 해결용으로 사용하면 안 됩니다.

이 변수가 존재하는 이유는 로컬 OAuth 플로우가 MCP 서버와 같은 머신에서 브라우저를 열고, `http://127.0.0.1:8888/callback` 같은 로컬 HTTP 서버로 callback을 받기 때문입니다.

원격 MCP OAuth는 다릅니다. `GITLAB_MCP_OAUTH=true` 모드에서는 MCP 클라이언트가 `/authorize` 요청 중에 자체 callback URL을 제공합니다. `GITLAB_OAUTH_REDIRECT_URI`는 그 클라이언트 제공 URL을 대체하지 않습니다.

| 모드           | 활성화 변수             | Callback 변수                      | GitLab Redirect URI                                 |
| -------------- | ----------------------- | ---------------------------------- | --------------------------------------------------- |
| 로컬 OAuth     | `GITLAB_USE_OAUTH=true` | `GITLAB_OAUTH_REDIRECT_URI`        | `http://127.0.0.1:8888/callback` 또는 로컬 callback |
| 원격 MCP OAuth | `GITLAB_MCP_OAUTH=true` | `GITLAB_OAUTH_CALLBACK_PROXY=true` | `{MCP_SERVER_URL}/callback`                         |

MCP 서버가 직접 로컬 브라우저 callback을 받을 때만 `GITLAB_OAUTH_REDIRECT_URI`를 사용하세요. 원격 MCP 클라이언트가 callback URL을 소유하는 경우에는 `GITLAB_OAUTH_CALLBACK_PROXY=true`를 사용하세요.

**동작 방식**: 공개 HTTPS URL을 가진 위치에 이 MCP 서버를 배포합니다. MCP 클라이언트는 `{MCP_SERVER_URL}/mcp`로 연결합니다. 서버는 OAuth 2.0 플로우를 처리하고 GitLab과 자격 증명을 교환합니다.

**사전 준비:**

1. 공개 접근 가능한 HTTPS 서버 URL (`MCP_SERVER_URL`) — 로컬 테스트에는 [ngrok](https://ngrok.com)을 사용할 수 있습니다.
2. `api` 또는 `read_api` scope가 있는 사전 등록 GitLab OAuth 애플리케이션
   — `Admin area` → `Applications`에서 Redirect URI를 `{MCP_SERVER_URL}/callback`으로 설정하세요.

| 환경 변수                     | 필수 | 설명                                                                                                                            |
| ----------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GITLAB_MCP_OAUTH`            | 예   | 활성화하려면 `true`                                                                                                             |
| `GITLAB_API_URL`              | 예   | GitLab API base URL. URL에 자격 증명(`user:pass@`)을 넣지 마세요. 넣어도 무시됩니다. 비밀번호의 쉼표는 반드시 `%2C`로 적어야 합니다. |
| `GITLAB_OAUTH_APP_ID`         | 예   | GitLab OAuth Application ID                                                                                                     |
| `MCP_SERVER_URL`              | 예   | 이 MCP 서버의 공개 HTTPS URL                                                                                                    |
| `STREAMABLE_HTTP`             | 예   | 반드시 `true`                                                                                                                   |
| `GITLAB_OAUTH_CALLBACK_PROXY` | 선택 | MCP 서버의 고정 `/callback` URL을 사용하려면 `true`                                                                             |
| `GITLAB_OAUTH_ALLOWED_REDIRECT_URIS` | 선택 | 콜백 프록시 모드가 리다이렉트할 클라이언트 callback URL 목록 (기본값: Claude, ChatGPT, Cursor, 루프백 callback. 추가하려면 `defaults,<url>`) |
| `GITLAB_OAUTH_SCOPES`         | 선택 | 쉼표로 구분된 scope 목록(기본값: `api,read_api,read_user`)                                                                      |
| `GITLAB_OAUTH_ALLOWED_GROUPS` | 선택 | 쉼표로 구분된 GitLab 그룹 전체 경로 — 해당 그룹 및 하위 그룹 멤버만 서버를 사용할 수 있음 (기존 `GITLAB_ALLOWED_GROUPS` 대체) |
| `OAUTH_DISABLE_REFRESH_TOKEN` | 선택 | `true`면 refresh token을 발급하지 않음: 세션 TTL과 무관하게 GitLab access token이 만료될 때마다(2시간) 브라우저에서 다시 인가 |

`STREAMABLE_HTTP=true`일 때 서버 측 GitLab 자격 증명(`GITLAB_PERSONAL_ACCESS_TOKEN`, `GITLAB_JOB_TOKEN`, `GITLAB_AUTH_COOKIE_PATH`, 또는 `GITLAB_USE_OAUTH`)은 `REMOTE_AUTHORIZATION=true`, `GITLAB_MCP_OAUTH=true`, 또는 `STREAMABLE_HTTP_AUTH_TOKEN`이 필요합니다.

> **`Unregistered redirect_uri` 문제 해결**
>
> 브라우저 URL의 `redirect_uri`를 확인하세요. 값이 `http://127.0.0.1:xxxxx/.../callback` 같은 클라이언트 callback을 가리키면 다음 설정을 켜세요.
>
> ```env
> GITLAB_OAUTH_CALLBACK_PROXY=true
> ```
>
> 원격 MCP OAuth 문제를 `GITLAB_OAUTH_REDIRECT_URI` 변경으로 해결하려고 하지 마세요. 이 변수는 로컬 OAuth(`GITLAB_USE_OAUTH`) 전용입니다.

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

MCP 클라이언트 설정:

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

#### 원격 인증 사용하기(`REMOTE_AUTHORIZATION`)

> **서버/원격 배포 전용입니다.** 각 HTTP 호출자가 요청 헤더에 자신의 GitLab 토큰을 직접 제공합니다. OAuth 플로우는 사용하지 않습니다.

각 호출자가 HTTP 요청 헤더에 자신의 GitLab 토큰을 제공하는 멀티 유저 또는 멀티 테넌트 배포용입니다. MCP 서버는 호출자를 대신해 토큰을 GitLab으로 전달합니다.

**헤더 우선순위**: `Private-Token` > `JOB-TOKEN` > `Authorization: Bearer`

| 환경 변수                                                        | 필수 | 설명                                                                                                                    |
| ---------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| `REMOTE_AUTHORIZATION`                                           | 예   | 활성화하려면 `true`                                                                                                     |
| `STREAMABLE_HTTP`                                                | 예   | 반드시 `true`                                                                                                           |
| `ENABLE_DYNAMIC_API_URL`                                         | 선택 | 요청별 `X-GitLab-API-URL` 헤더 허용                                                                                     |
| `GITLAB_ALLOWED_HOSTS`                                           | 선택 | 허용할 `X-GitLab-API-URL` 호스트의 쉼표 구분 목록; `GITLAB_API_URL` 호스트는 항상 허용. 다운로드 리다이렉트 대상(릴리즈 에셋, 잡 아티팩트, 업로드 첨부)으로도 신뢰되므로 사설망 호스트는 여기에 등록 |
| `GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY`                    | 선택 | 인증 없이 `initialize`, `notifications/initialized`, `tools/list`, `server/discover`만 허용(도구 호출은 여전히 인증 필요)                  |
| `MCP_SERVER_URL` / `MCP_ALLOWED_HOSTS` / `MCP_ALLOWED_ORIGINS` | 선택 | DNS rebinding 방지를 위한 허용 `/mcp` 호스트/오리진 값                                                                  |
| `MCP_TRUST_PROXY`                                                | 선택 | 리버스 프록시 뒤에서 `Forwarded` / `X-Forwarded-*` 헤더 신뢰(다운로드 URL, Express `req.ip`, `/mcp` IP rate limit, OAuth rate limit) |

`GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY=true`는 사용자가 GitLab 토큰을 제공하기 전에 도구 메타데이터를 조회해야 하는 MCP 게이트웨이나 관리 UI용입니다. 배포 환경에서 도구 목록 공개가 안전한 경우가 아니면 비활성화하세요.

`MCP_SERVER_URL`이 설정되지 않으면 원격 다운로드 URL은 로컬 서버 주소로 대체됩니다. `MCP_TRUST_PROXY=true`는 서버가 신뢰할 수 있는 리버스 프록시를 통해서만 접근 가능하고 MCP 서버에 대한 직접 클라이언트 접근이 차단된 경우에만 설정하세요. 이 설정은 Streamable HTTP 및 SSE용 Express `trust proxy`를 활성화하고, `Forwarded` / `X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-Prefix`에서 공개 다운로드 URL을 파생하며, 프록시가 `X-Forwarded-For`에 클라이언트 포트를 포함해 보낼 때(예: `1.2.3.4:5678`) OAuth 엔드포인트 rate limiting이 동작하도록 유지합니다. 이 플래그 도입 이후 기존 OAuth+프록시 배포는 명시적으로 설정해야 합니다.

**예시 요청 헤더:**

```http
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

또는 Bearer 토큰 사용:

```http
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ `REMOTE_AUTHORIZATION`은 SSE 전송과 호환되지 않습니다. `STREAMABLE_HTTP=true`가 필요합니다.

### 환경 변수

전체 환경 변수 목록은 전용 문서를 참고하세요.

- [환경 변수 레퍼런스](./docs/configuration/environment-variables.md)

대부분의 사용자는 아래 시작 조합 중 하나만 필요합니다.

- **로컬 PAT**: `GITLAB_PERSONAL_ACCESS_TOKEN`, `GITLAB_API_URL`
- **로컬 OAuth**: `GITLAB_USE_OAUTH=true`, `GITLAB_OAUTH_CLIENT_ID`, `GITLAB_OAUTH_REDIRECT_URI`, `GITLAB_API_URL`
- **원격 멀티 유저 HTTP**: `STREAMABLE_HTTP=true`, `REMOTE_AUTHORIZATION=true`(또는 `GITLAB_MCP_OAUTH=true`), `MCP_TRUST_PROXY=true`(리버스 프록시 뒤), `MAX_REQUESTS_PER_MINUTE=300`, `MCP_SERVER_URL` 또는 `MCP_ALLOWED_HOSTS`, `HOST`, `PORT`
- **여러 배포를 동시에 운영**: 배포마다 `MCP_SERVER_NAME`을 다르게 설정(예: `gitlab-selfhosted-readonly`)하면 클라이언트, 로그, 텔레메트리에서 서로 구분할 수 있습니다
- **멀티 Pod HPA (stateless)**: 위 설정 + `OAUTH_STATELESS_MODE=true`, `OAUTH_STATELESS_SECRET`(모든 Pod에서 동일). [Stateless Mode](./docs/configuration/stateless-mode.md) 참고.

자주 참조하는 변수:

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

레퍼런스 문서는 다음 내용도 다룹니다.

- 인증 및 OAuth 변수
- MCP OAuth 프록시 변수
- 프로젝트 및 도구 필터링 변수
- `discover_tools`를 통한 동적 도구 탐색(온디맨드 도구셋 활성화)
- 전송 및 세션 변수
- 프록시 및 TLS 변수

콜백 프록시 모드 상세는 [GitLab MCP OAuth Callback Proxy](./docs/auth/oauth-callback-proxy.md)를 참고하세요.

#### SSE 세션 제한

`GET /sse`에는 Streamable HTTP와 동일한 원격 전송 제어가 적용됩니다.

- **Capacity:** 동시 SSE 세션은 최대 `MAX_SESSIONS`개(기본 1000)이며, 초과 연결은 `503`을 받습니다.
- **생성 rate limit:** 새 연결은 클라이언트 IP당 `MAX_REQUESTS_PER_MINUTE`(기본 60)로 제한되며, 초과 연결은 `429`를 받습니다.
- **Idle timeout:** `SESSION_TIMEOUT_SECONDS`(기본 1시간) 동안 `POST /messages` 요청이 없는 세션은 종료됩니다. 따라서 유휴 클라이언트는 슬롯을 계속 점유하는 대신 다시 연결해야 합니다. Streamable HTTP와 달리 SSE 스트림을 열어 두는 것은 활동으로 간주되지 **않습니다**.
- 용량이 가득 찬 동안 `/health`는 `503`과 `status: "degraded"`를 반환합니다.

설정은 [`MAX_SESSIONS`](./docs/configuration/environment-variables.md#max_sessions), `MAX_REQUESTS_PER_MINUTE`, `SESSION_TIMEOUT_SECONDS`를 참고하세요.

### 원격 인증 설정(멀티 유저 지원)

`REMOTE_AUTHORIZATION=true`를 사용하면 MCP 서버는 여러 사용자를 지원할 수 있습니다. 각 사용자는 HTTP 헤더로 자신의 GitLab 토큰을 전달합니다. 다음 경우 유용합니다.

- 각 사용자에게 자신의 GitLab 접근 권한이 필요한 공유 MCP 서버 인스턴스
- 사용자별 토큰을 MCP 요청에 주입할 수 있는 IDE 통합

**설정 예시:**

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

**클라이언트 설정:**

IDE 또는 MCP 클라이언트는 각 요청에 아래 헤더 중 하나를 보내야 합니다.

```http
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
```

또는

```http
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

토큰은 세션별로 저장됩니다(`mcp-session-id` 헤더로 식별). 같은 세션의 후속 요청에서 재사용됩니다.

#### Cursor 원격 인증 클라이언트 설정 예시

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

**중요 사항:**

- 원격 인증은 **Streamable HTTP 전송에서만** 동작합니다.
- 각 세션은 격리됩니다. 한 세션의 토큰은 다른 세션 데이터에 접근할 수 없습니다. 세션이 종료되면 토큰은 자동으로 정리됩니다.
- **세션 타임아웃:** 인증 토큰은 `SESSION_TIMEOUT_SECONDS`(기본 1시간) 동안 비활성 상태가 지속되면 만료됩니다. 만료 후 클라이언트는 인증 헤더를 다시 보내야 합니다. 전송 세션은 유지됩니다.
- 각 요청은 해당 세션의 타임아웃 타이머를 초기화합니다.
- **Rate limiting:** `/mcp` 요청은 클라이언트 IP당 `MAX_REQUESTS_PER_MINUTE`로 제한되며, OAuth 또는 원격 인증 사용 시 MCP 세션당으로도 제한됩니다(기본 60). 자세한 내용은 [environment-variables.md](docs/configuration/environment-variables.md#max_requests_per_minute)를 참고하세요.
- **Capacity limit:** 서버는 최대 `MAX_SESSIONS` 동시 세션을 허용합니다(기본 1000).

### MCP OAuth 설정(Claude.ai Native OAuth)

`GITLAB_MCP_OAUTH=true`를 사용하면 서버가 GitLab 인스턴스의 OAuth 프록시로 동작합니다. Claude.ai 및 MCP 사양을 준수하는 클라이언트는 브라우저 인증 플로우를 자동으로 처리합니다. 수동 Personal Access Token 관리가 필요 없습니다.

**사전 준비:**

**사전 등록된 GitLab OAuth 애플리케이션**이 필요합니다. GitLab은 동적으로 등록된 미검증 애플리케이션을 `mcp` scope로 제한하며, 이 scope만으로는 API 호출에 충분하지 않습니다(`api` 또는 `read_api` 필요).

1. GitLab 인스턴스 → **Admin Area > Applications**(인스턴스 전체) 또는 **User Settings > Applications**(개인)로 이동합니다.
2. 새 애플리케이션을 생성합니다.
   - **Confidential**: 체크 해제
   - **Scopes**: `api`, `read_api`, `read_user` 또는 `GITLAB_OAUTH_SCOPES`로 요청할 scope
3. 저장 후 **Application ID**를 복사합니다. 이 값이 `GITLAB_OAUTH_APP_ID`입니다.

**동작 방식:**

1. 사용자가 Claude.ai에 MCP 서버 URL을 추가합니다.
2. Claude.ai가 `/.well-known/oauth-authorization-server`로 OAuth 엔드포인트를 발견합니다.
3. Claude.ai가 Dynamic Client Registration(`POST /register`)을 수행합니다. MCP 서버가 로컬에서 처리하며 각 클라이언트에 가상 client ID를 부여합니다.
4. Claude.ai가 사전 등록 OAuth 애플리케이션을 사용해 사용자의 브라우저를 GitLab 로그인 페이지로 리다이렉트합니다.
5. 사용자가 인증하면 GitLab이 `https://claude.ai/api/mcp/auth_callback`으로 리다이렉트합니다.
6. Claude.ai가 모든 MCP 요청에 `Authorization: Bearer <token>`을 보냅니다.
7. 서버가 GitLab으로 토큰을 검증하고 세션별로 저장합니다.

**서버 설정:**

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

로컬 개발(HTTP 허용):

```bash
MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true \
STREAMABLE_HTTP=true \
GITLAB_MCP_OAUTH=true \
GITLAB_OAUTH_APP_ID=your-gitlab-oauth-app-client-id \
MCP_SERVER_URL=http://localhost:3002 \
GITLAB_API_URL=https://gitlab.com/api/v4 \
node build/index.js
```

**Claude.ai 설정:**

```json
{
  "mcpServers": {
    "GitLab": {
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
```

`headers` 필드는 필요 없습니다. Claude.ai가 OAuth로 토큰을 가져옵니다.

**환경 변수:**

| 변수                                        | 필수   | 설명                                                                                                                                                                       |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITLAB_MCP_OAUTH`                          | 예     | 활성화하려면 `true`                                                                                                                                                        |
| `GITLAB_OAUTH_APP_ID`                       | 예     | 사전 등록 GitLab OAuth 애플리케이션의 client ID                                                                                                                            |
| `MCP_SERVER_URL`                            | 예     | MCP 서버의 공개 HTTPS URL                                                                                                                                                  |
| `GITLAB_API_URL`                            | 예     | GitLab 인스턴스 API URL(예: `https://gitlab.com/api/v4`). URL에 자격 증명(`user:pass@`)을 넣지 마세요. 넣어도 무시됩니다. 비밀번호의 쉼표는 반드시 `%2C`로 적어야 합니다.             |
| `STREAMABLE_HTTP`                           | 예     | 반드시 `true`(SSE 미지원)                                                                                                                                                  |
| `GITLAB_OAUTH_SCOPES`                       | 아니오 | 요청할 GitLab scope 목록(쉼표 구분). 기본값은 `api`이며, 유효 permission mode가 `readonly`일 때 `read_api`입니다. 사전 등록 애플리케이션에 해당 scope가 설정되어 있어야 합니다. |
| `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR`        | 아니오 | Dynamic Client Registration(`POST /register`)의 클라이언트 IP당 rolling 한도. 기본 `20`/시간, 범위 `1`–`1000`. IDE 창 여러 개 등으로 등록이 막히면 올리세요. GitLab API 한도와 무관합니다. |
| `OAUTH_DISABLE_REFRESH_TOKEN`               | 아니오 | `true`면 `/token` 응답에서 `refresh_token`을 빼고 refresh grant를 `invalid_grant`로 거부합니다. GitLab access token이 만료되면 브라우저에서 다시 인가해야 합니다. 기본 `false`. 콜백 프록시 모드에서는 이 서버의 흐름을 따르는 MCP 클라이언트가 GitLab refresh token을 받지 못합니다(passthrough에서는 클라이언트가 GitLab에서 직접 받을 수 있음). 표준 MCP 클라이언트를 위한 재인가 정책이며 보안 경계가 아닙니다. 켜기 전에 발급된 refresh token은 GitLab **User Settings → Applications → Authorized applications → Revoke**로 revoke할 때까지 유효합니다. |
| `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL` | 아니오 | 로컬 HTTP 개발에서만 `true`                                                                                                                                                |

**중요 사항:**

- MCP OAuth는 **Streamable HTTP 전송에서만** 동작합니다(`SSE=true`와 호환되지 않음).
- 각 사용자 세션은 자체 OAuth 토큰을 저장하며 완전히 격리됩니다.
- 세션 타임아웃, rate limiting, capacity limit은 `REMOTE_AUTHORIZATION` 모드와 동일하게 적용됩니다(`SESSION_TIMEOUT_SECONDS`, `MAX_REQUESTS_PER_MINUTE`, `MAX_SESSIONS`).
- **DCR rate limiting:** `POST /register`는 클라이언트 IP당 `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR`로 제한됩니다(기본 20/시간). `/mcp` 한도 및 GitLab API quota와 별개입니다. [environment-variables.md](docs/configuration/environment-variables.md#oauth_register_rate_limit_per_hour) 참고.
- **헤더 인증 fallback:** `Private-Token` 또는 `JOB-TOKEN` 요청 헤더가 있으면 OAuth 검증을 건너뛰고 raw token을 해당 세션에 직접 사용합니다. 같은 서버 인스턴스에서 OAuth 플로우와 함께 PAT 및 CI job token을 사용할 수 있습니다. `Authorization: Bearer`는 항상 OAuth token으로 처리됩니다. PAT 기반 헤더 인증에는 `Private-Token`을 사용하세요.

## Agent Skill Files

Skill + CLI는 MCP와 동등한 경로입니다([Skill + CLI](#skill--cli-mcp-불필요) 참고). AI 에이전트가 skill/instruction 로딩을 지원하는 경우(Claude Code, GitHub Copilot, Cursor 등), [`skills/gitlab-mcp/`](./skills/gitlab-mcp/)에 미리 작성된 skill 파일을 사용할 수 있습니다.

- **[SKILL.md](./skills/gitlab-mcp/SKILL.md)** — 도구셋 개요, 핵심 워크플로우, 파라미터 힌트를 담은 핵심 가이드
- **[reference/](./skills/gitlab-mcp/reference/)** — 코드 리뷰, 머지 리퀘스트, 이슈, 파이프라인, 취약점 트리아지용 상세 워크플로우 문서

`skills` CLI로 설치:

```bash
npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill
```

AI 클라이언트에 skill 디렉터리를 등록하면 전체 ListTools 응답에만 의존하지 않고 더 좋은 도구 사용 지침을 얻을 수 있습니다.

## 도구 🛠️

전체 도구 목록은 영어 README의 [Tools 섹션](./README.md#tools-%EF%B8%8F)을 참고하세요. 현재 서버는 머지 리퀘스트, 이슈, 파이프라인, 배포, 환경, 아티팩트, 마일스톤, 위키, 저장소, 릴리스, 사용자, 이벤트, work item, 웹훅, 코드 검색, CI/CD 변수, dependency proxy, 취약점 트리아지, GraphQL 실행 도구를 제공합니다.

### Wiki 페이지 제목과 slug

GitLab은 wiki 페이지 제목에서 **slug**(URL, `/-/wikis/<slug>`)를 도출합니다. 따라서 `update_wiki_page` / `update_group_wiki_page`에 `title`을 전달하면 **페이지 이름이 바뀌고 URL이 변경**되어(중첩 페이지의 경우 페이지가 다른 경로로 이동할 수도 있음) 기존 링크가 깨집니다.

URL을 유지한 채 **표시 제목**만 변경하려면 `title`을 전달하지 **말고**, 표시 제목을 페이지 내용의 YAML front matter에 저장한 뒤 내용을 업데이트하세요:

```markdown
---
title: 사용자 지정 표시 제목
---

페이지 본문…
```

GitLab은 slug/URL을 그대로 유지하고 UI에 front matter의 제목을 표시합니다. 다시 읽을 때는 `get_wiki_page`에 `render_html: true`를 전달하면 `front_matter` 필드가 채워집니다 — 일반 `title` 필드는 항상 slug에서 도출된 값을 반영합니다.

## 테스트 🧪

프로젝트에는 원격 인증을 포함한 포괄적인 테스트가 포함되어 있습니다.

```bash
# 전체 테스트 실행(API 검증 + 원격 인증)
npm test

# 원격 인증 테스트만 실행
npm run test:remote-auth

# readonly MCP 테스트를 포함한 전체 테스트 실행
npm run test:all

# API 검증만 실행
npm run test:integration
```

모든 원격 인증 테스트는 mock GitLab 서버를 사용하므로 실제 GitLab 자격 증명이 필요하지 않습니다.
