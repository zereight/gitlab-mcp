# GitLab MCP Server

[![npm](https://img.shields.io/npm/v/@zereight/mcp-gitlab.svg)](https://www.npmjs.com/package/@zereight/mcp-gitlab)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_GitLab_MCP-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](vscode:mcp/install?%7B%22name%22%3A%22zereight.gitlab-mcp%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40zereight%2Fmcp-gitlab%40latest%22%5D%2C%22env%22%3A%7B%22GITLAB_PERSONAL_ACCESS_TOKEN%22%3A%22%24%7Binput%3Agitlab-token%7D%22%2C%22GITLAB_API_URL%22%3A%22https%3A%2F%2Fgitlab.com%2Fapi%2Fv4%22%2C%22GITLAB_PERMISSION_MODE%22%3A%22full%22%7D%7D)

[English](./README.md) | [한국어](./README.ko.md) | [简体中文](./README.zh-CN.md) | [Português (Brasil)](./README.pt-BR.md)

📖 **[Documentação →](https://zereight.github.io/gitlab-mcp/)** Guias de configuração, variáveis de ambiente e a referência completa de ferramentas estão disponíveis no site de documentação.

[![Star History Chart](./assets/star-history.png)](https://www.star-history.com/?repos=zereight%2Fgitlab-mcp&type=date&legend=top-left)

## @zereight/mcp-gitlab

**GitLab MCP otimizado para fluxos de trabalho com agentes de IA** — gerencie projetos, merge requests, issues, pipelines, Wiki, releases, milestones e muito mais via stdio, SSE e Streamable HTTP.

Suporta PAT, OAuth, modo somente leitura, URLs de API dinâmicas e autorização remota para VS Code, Claude, Cursor, Copilot e outros clientes MCP.

### Por que usar este GitLab MCP?

- **268 ferramentas: 266 em toolsets + `execute_graphql` + `discover_tools`** — comece com um toolset pequeno e ative mais categorias em tempo de execução
- **Revisão de MR em 2 etapas** — `list_merge_request_changed_files` → `get_merge_request_file_diff` em lote
- **Agent Skill integrado** — orientação de workflows em `skills/gitlab-mcp/`
- **Autenticação flexível** — Personal Access Token, fluxo OAuth2 local no navegador, proxy MCP OAuth e autorização remota por requisição
- **Múltiplos transportes** — stdio para clientes locais, SSE para clientes legados e Streamable HTTP para implantações remotas modernas
- **Configuração amigável para clientes** — exemplos para Claude Code, Codex, Antigravity, OpenCode, Copilot, Cline, Roo Code, Cursor, Kilo Code e Amp Code
- **Pronto para self-hosting** — funciona com instâncias GitLab personalizadas, configurações de proxy e roteamento dinâmico de URL da API
- **Filtragem de resultados com JMESPath** — o argumento opcional `jmespath` nas chamadas de ferramentas (veja `tools/list`) reduz os resultados JSON sem alterar as requisições à API do GitLab; quando o mascaramento de respostas está ativo, o JMESPath é aplicado aos dados já mascarados

### Comparação

|                           | @zereight/mcp-gitlab                           | GitLab MCP A (comunidade, estilo CQRS)                    |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| **Mais indicado para**    | Workflows de agentes de IA                     | Múltiplas instâncias corporativas / ferramentas agrupadas |
| **Modelo de ferramentas** | 268 ferramentas: 266 em toolsets + `execute_graphql` + `discover_tools` | ~50–60 ferramentas agrupadas `browse_*` / `manage_*`      |
| **Revisão de MR**         | Diff em lote em 2 etapas                       | Varia                                                     |
| **Node.js**               | >=18.17                                        | Frequentemente >=24                                       |
| **Licença**               | MIT                                            | Varia                                                     |

[Comparação completa →](./docs/comparison/community-gitlab-mcp-a.md)

Início rápido: escolha abaixo uma configuração com Personal Access Token ou OAuth2, instale `@zereight/mcp-gitlab` e use `zereight-mcp-gitlab` na configuração do seu cliente MCP.

### Guias de configuração de clientes

- [Guia de configuração do Claude Code](./docs/clients/claude-code.md)
- [Guia de configuração do VS Code](./docs/clients/vscode.md)
- [Guia de configuração do GitHub Copilot](./docs/clients/copilot.md)
- [Guia de configuração do Codex](./docs/clients/codex.md)
- [Guia de configuração do Cursor](./docs/clients/cursor.md)
- [Guia para clientes MCP baseados em JSON](./docs/clients/json-clients.md) - para Factory AI Droid, OpenClaw e clientes no estilo OpenCode
- [Guia de configuração de autenticação OAuth2](./docs/auth/oauth-setup.md)
- [Referência de variáveis de ambiente](./docs/configuration/environment-variables.md)
- [Modo Stateless — HPA com múltiplos Pods](./docs/configuration/stateless-mode.md)
- [Agentes personalizados e configuração com múltiplos PATs](./docs/auth/custom-agent-multiple-pat.md)

## Uso

### Visão geral da configuração

#### Métodos de autenticação

O servidor suporta quatro métodos de autenticação.

**Para uso local/desktop** (mais comum):

1. **Personal Access Token** (`GITLAB_PERSONAL_ACCESS_TOKEN`) — configuração mais simples
2. **OAuth2 — navegador local** (`GITLAB_USE_OAUTH`) — recomendado para maior segurança

**Para implantações em servidor/remotas**:

3. **OAuth2 — proxy MCP** (`GITLAB_MCP_OAUTH`) — para clientes MCP remotos, como Claude.ai
4. **Autorização remota** (`REMOTE_AUTHORIZATION`) — para implantações multiusuário em que cada chamador fornece seu próprio token

#### Caminhos rápidos de configuração

- **Claude Code**: veja o [Guia de configuração do Claude Code](./docs/clients/claude-code.md)
- **VS Code**: veja o [Guia de configuração do VS Code](./docs/clients/vscode.md)
- **GitHub Copilot**: veja o [Guia de configuração do GitHub Copilot](./docs/clients/copilot.md)
- **Codex**: veja o [Guia de configuração do Codex](./docs/clients/codex.md)
- **Cursor**: veja o [Guia de configuração do Cursor](./docs/clients/cursor.md)
- **Factory AI Droid / OpenClaw / clientes no estilo OpenCode**: veja o [Guia para clientes MCP baseados em JSON](./docs/clients/json-clients.md)
- **Detalhes do fluxo OAuth no navegador**: veja o [Guia de configuração de autenticação OAuth2](./docs/auth/oauth-setup.md)
- **OAuth sem callback em localhost** (SSO, shell remoto, clientes em background): execute `zereight-mcp-gitlab auth` (GitLab 17.9+ usa device flow; versões 17.2–17.8 precisam de `oauth2_device_grant_flow`) e depois inicie o servidor com `GITLAB_USE_OAUTH=true`. Veja o [comando independente de device flow](./docs/auth/oauth-setup.md#standalone-device-flow-auth-command).

Para a configuração local mais simples, comece com um Personal Access Token. Para autenticação local baseada em navegador, use OAuth2. Para implantações remotas ou multiusuário, consulte as seções de MCP OAuth e Autorização Remota mais abaixo neste README.

Instale o servidor uma vez:

```shell
brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp
brew install zereight/gitlab-mcp/zereight-mcp-gitlab
```

Ou com npm:

```shell
npm install -g @zereight/mcp-gitlab
```

Ou com Nix, adicionando este flake ao seu:

```nix
# flake.nix
inputs.gitlab-mcp.url = "github:zereight/gitlab-mcp";

# wherever you configure your MCP client:
command = lib.getExe inputs.gitlab-mcp.packages.${system}.default;
```

O caminho no store é fixado pelo seu lock file; atualize-o com `nix flake update gitlab-mcp`.

Os exemplos usam `zereight-mcp-gitlab`, um alias com menor chance de conflito que o binário legado `mcp-gitlab`. Se o seu cliente MCP não o encontrar, use o caminho absoluto retornado por `which zereight-mcp-gitlab`.

Não quer instalar globalmente? Fixe o `npx` na versão estável anterior (a versão recomendada por esta documentação), por exemplo `npx -y @zereight/mcp-gitlab@2.2.0`. Se quiser sempre a versão mais recente, use `npx -y @zereight/mcp-gitlab@latest`. O servidor exibe um aviso no stderr durante a inicialização quando existe uma versão mais nova disponível (desative com `GITLAB_DISABLE_VERSION_CHECK=true`).

#### Usando argumentos de CLI (para clientes com problemas com variáveis de ambiente)

Alguns clientes MCP, como o GitHub Copilot CLI, têm problemas com variáveis de ambiente. Nesse caso, use argumentos de CLI:

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

**Argumentos de CLI disponíveis:**

- `--token` - GitLab Personal Access Token (substitui `GITLAB_PERSONAL_ACCESS_TOKEN`)
- `--api-url` - URL da API do GitLab (substitui `GITLAB_API_URL`)
- `--read-only=true` - ativa o modo somente leitura (substitui `GITLAB_READ_ONLY_MODE`, obsoleto — prefira `--permission-mode=readonly`)
- `--permission-mode` - nível de permissão: `readonly`, `modify` (sem ferramentas de exclusão ou teardown) ou `full` (substitui `GITLAB_PERMISSION_MODE`, padrão `full`)
- `--toolsets=all` - ativa toolsets nomeados (substitui `GITLAB_TOOLSETS`; sem valor usa o padrão enxuto `core`)
- `--tools=list_issues` - adiciona ferramentas individuais (substitui `GITLAB_TOOLS`)
- `--use-wiki=true` - ativa a API de Wiki (substitui `USE_GITLAB_WIKI`, legado — prefira `GITLAB_TOOLSETS=wiki`)
- `--use-milestone=true` - ativa a API de milestones (substitui `USE_MILESTONE`, legado — prefira `GITLAB_TOOLSETS=milestones`)
- `--use-pipeline=true` - ativa a API de pipelines (substitui `USE_PIPELINE`, legado — prefira `GITLAB_TOOLSETS=pipelines`)
- `--disable-version-check=true` - desativa o aviso de nova versão na inicialização (substitui `GITLAB_DISABLE_VERSION_CHECK`)
- `--masking-enabled=true` - ativa o mascaramento de respostas de texto (substitui `GITLAB_MASKING_ENABLED`)
- `--masking-config` - caminho para um arquivo de configuração de mascaramento (substitui `GITLAB_MASKING_CONFIG`)
- `--masking-policy-file` - caminho para um arquivo protegido de política gerenciada (substitui `GITLAB_MASKING_POLICY_FILE`)
- `--masking-workspace-dir` - diretório usado para resolver arquivos de mascaramento (substitui `GITLAB_MASKING_WORKSPACE_DIR`)
- `--compact-results=true` - trunca respostas muito grandes de ferramentas MCP e anexa um comando CLI para a carga completa (substitui `GITLAB_MCP_COMPACT_RESULTS`; desativado por padrão)
- `--compact-result-chars` - limite de caracteres para compactação (substitui `GITLAB_MCP_COMPACT_RESULT_CHARS`; padrão `4000`)
- `--compact-tools` - nomes de ferramentas separados por vírgula para compactar quando a resposta for grande, sem ativar o compact global (substitui `GITLAB_MCP_COMPACT_TOOLS`)
- `--tool-profile` - `full` (padrão) ou `slim`. `slim` remove draft notes, reações com emoji, labels, ferramentas do catálogo de CI e `create_group` da lista inicial. Ignorado apenas quando `GITLAB_TOOLSETS` tem um valor não em branco (substitui `GITLAB_TOOL_PROFILE`)

Os argumentos de CLI têm precedência sobre as variáveis de ambiente.

`zereight-mcp-gitlab auth` é um subcomando, não uma flag do servidor MCP. Ele executa o device flow do GitLab e encerra. Veja [Argumentos de CLI](./docs/getting-started/cli-arguments.md#auth).

O mesmo binário também é uma CLI do GitLab no estilo `gh` (`tool <name>` ou formas curadas como `mr list`). **Não é necessário registrar o MCP** — defina um PAT, ou execute `auth` e defina `GITLAB_USE_OAUTH=true`: veja [CLI sem MCP](./docs/getting-started/cli-without-mcp.md). Use-o para ver a carga completa no terminal. As respostas do MCP permanecem no chat, a menos que você defina `GITLAB_MCP_COMPACT_RESULTS=true` (ou `--compact-results`), o que substitui respostas grandes de ferramentas por uma prévia e um comando CLI. A CLI humana nunca é compactada. Os mesmos filtros de permission mode, toolsets, denied-tools regex e tool-policy se aplicam. Ferramentas destrutivas e ferramentas com `GITLAB_TOOL_POLICY_APPROVE` exigem `--yes`. Consulte [CLI Humana](./docs/getting-started/cli-arguments.md#human-cli).

> **Filtragem granular de ferramentas:** use `GITLAB_PERMISSION_MODE=modify` para permitir criação/atualização enquanto
> bloqueia todas as ferramentas de exclusão e as ferramentas destrutivas de teardown (`cancel_pipeline`,
> `cancel_pipeline_job`, `stop_environment`, `stop_stale_environments`, `unprotect_branch`) —
> incluindo mutations destrutivas (verbos de exclusão e teardown) por meio de `execute_graphql` e
> ações `delete`/`move` do `push_files` — ou use `GITLAB_PERMISSION_MODE=readonly` para acesso somente leitura.
> Também é possível habilitar grupos de ferramentas com `GITLAB_TOOLSETS=<group,…>`, permitir ferramentas individuais com
> `GITLAB_TOOLS=<tool,…>` (por exemplo, grupos somente leitura mais algumas ferramentas específicas de escrita) e
> bloquear por padrão usando `GITLAB_DENIED_TOOLS_REGEX`. As flags legadas `USE_GITLAB_WIKI` /
> `USE_MILESTONE` / `USE_PIPELINE` são mantidas apenas para compatibilidade retroativa.
> Consulte a [Referência de ferramentas](./docs/tools/index.md#feature-toggles) e
> [Variáveis de ambiente](./docs/configuration/environment-variables.md).

- sse

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

- streamable-http

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

#### Usando o proxy MCP OAuth (`GITLAB_MCP_OAUTH`)

> **Somente para implantações em servidor/remotas.** Este modo exige que o servidor MCP esteja implantado em uma URL HTTPS acessível publicamente. Para uso local/desktop, veja `GITLAB_USE_OAUTH` acima.

Para clientes MCP remotos que suportam a especificação MCP OAuth (por exemplo, Claude.ai). O servidor atua como um servidor de autorização OAuth 2.0 completo — requisições não autenticadas recebem uma resposta `401 + WWW-Authenticate`, que aciona automaticamente o fluxo OAuth no navegador do lado do cliente.

Clientes MCP remotos como OpenCode, MCPJam e Claude.ai podem enviar sua própria URL de callback durante a autorização. Se não for possível registrar no GitLab cada URL de callback de cliente, habilite `GITLAB_OAUTH_CALLBACK_PROXY=true`. Com o modo de proxy de callback, o GitLab precisa de apenas um Redirect URI registrado: `{MCP_SERVER_URL}/callback`.

`GITLAB_OAUTH_REDIRECT_URI` é usado apenas pelo OAuth local (`GITLAB_USE_OAUTH`). Ele não substitui URLs de callback de clientes MCP OAuth remotos e não deve ser usado para corrigir erros remotos `Unregistered redirect_uri`.

Essa variável existe porque o fluxo OAuth local abre um navegador na mesma máquina do servidor MCP e recebe o callback em um servidor HTTP local, por exemplo `http://127.0.0.1:8888/callback`.

O MCP OAuth remoto funciona de forma diferente. No modo `GITLAB_MCP_OAUTH=true`, o cliente MCP fornece sua própria URL de callback durante `/authorize`. `GITLAB_OAUTH_REDIRECT_URI` não substitui essa URL fornecida pelo cliente.

| Modo             | Habilitar com           | Variável de callback               | Redirect URI no GitLab                                 |
| ---------------- | ----------------------- | ---------------------------------- | ------------------------------------------------------ |
| OAuth local      | `GITLAB_USE_OAUTH=true` | `GITLAB_OAUTH_REDIRECT_URI`        | `http://127.0.0.1:8888/callback` ou seu callback local |
| MCP OAuth remoto | `GITLAB_MCP_OAUTH=true` | `GITLAB_OAUTH_CALLBACK_PROXY=true` | `{MCP_SERVER_URL}/callback`                            |

Use `GITLAB_OAUTH_REDIRECT_URI` somente quando o próprio servidor MCP receber o callback local do navegador. Use `GITLAB_OAUTH_CALLBACK_PROXY=true` quando um cliente MCP remoto for o responsável pela URL de callback.

**Como funciona**: você implanta este servidor MCP em um local com uma URL HTTPS pública. Os clientes MCP se conectam a `{MCP_SERVER_URL}/mcp`. O servidor processa o fluxo OAuth 2.0, trocando credenciais com o GitLab em nome do cliente.

**Pré-requisitos:**

1. Uma URL HTTPS de servidor acessível publicamente (`MCP_SERVER_URL`) — use [ngrok](https://ngrok.com) para testes locais
2. Um aplicativo OAuth do GitLab previamente registrado com os scopes `api` ou `read_api`
   — acesse `Admin area` → `Applications` e defina o Redirect URI como `{MCP_SERVER_URL}/callback`

| Variável de ambiente          | Obrigatória | Descrição                                                                                                                                                                |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GITLAB_MCP_OAUTH`            | sim         | Defina como `true` para habilitar                                                                                                                                        |
| `GITLAB_API_URL`              | sim         | URL base da API do GitLab                                                                                                                                                |
| `GITLAB_OAUTH_APP_ID`         | sim         | Application ID do OAuth do GitLab                                                                                                                                        |
| `MCP_SERVER_URL`              | sim         | URL HTTPS pública deste servidor MCP                                                                                                                                     |
| `STREAMABLE_HTTP`             | sim         | Deve ser `true`                                                                                                                                                          |
| `GITLAB_OAUTH_CALLBACK_PROXY` | opcional    | Defina como `true` para usar a URL `/callback` fixa do servidor MCP                                                                                                      |
| `GITLAB_OAUTH_SCOPES`         | opcional    | Scopes separados por vírgula (padrão: `api,read_api,read_user`)                                                                                                          |
| `GITLAB_OAUTH_ALLOWED_GROUPS` | opcional    | Caminhos completos de grupos GitLab separados por vírgula — apenas membros desses grupos e subgrupos podem obter um token (substitui o obsoleto `GITLAB_ALLOWED_GROUPS`) |

Quando `STREAMABLE_HTTP=true`, credenciais GitLab do lado do servidor (`GITLAB_PERSONAL_ACCESS_TOKEN`, `GITLAB_JOB_TOKEN`, `GITLAB_AUTH_COOKIE_PATH` ou `GITLAB_USE_OAUTH`) exigem `REMOTE_AUTHORIZATION=true`, `GITLAB_MCP_OAUTH=true` ou `STREAMABLE_HTTP_AUTH_TOKEN`.

> **Solução de problemas para `Unregistered redirect_uri`**
>
> Verifique o `redirect_uri` na URL do navegador. Se ele apontar para um callback do cliente, como `http://127.0.0.1:xxxxx/.../callback`, habilite:
>
> ```env
> GITLAB_OAUTH_CALLBACK_PROXY=true
> ```
>
> Não corrija o MCP OAuth remoto alterando `GITLAB_OAUTH_REDIRECT_URI`. Essa variável é usada apenas pelo OAuth local (`GITLAB_USE_OAUTH`).

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

Configuração do cliente MCP:

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

#### Usando autorização remota (`REMOTE_AUTHORIZATION`)

> **Somente para implantações em servidor/remotas.** Cada chamador HTTP fornece seu próprio token do GitLab diretamente nos headers da requisição — sem fluxo OAuth.

Para implantações multiusuário ou multitenant em que cada chamador fornece seu próprio token do GitLab no header HTTP. Não há fluxo OAuth — o servidor MCP encaminha o token ao GitLab em nome do chamador.

**Prioridade de headers**: `Private-Token` > `JOB-TOKEN` > `Authorization: Bearer`

| Variável de ambiente                                           | Obrigatória | Descrição                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REMOTE_AUTHORIZATION`                                         | sim         | Defina como `true` para habilitar                                                                                                                                                                                                                                                            |
| `STREAMABLE_HTTP`                                              | sim         | Deve ser `true`                                                                                                                                                                                                                                                                              |
| `ENABLE_DYNAMIC_API_URL`                                       | opcional    | Permite definir a URL do GitLab por requisição pelo header `X-GitLab-API-URL`                                                                                                                                                                                                                |
| `GITLAB_ALLOWED_HOSTS`                                         | opcional    | Lista de hosts permitidos para `X-GitLab-API-URL`, separados por vírgula; os hosts em `GITLAB_API_URL` são sempre permitidos. Também são confiáveis como destinos de redirecionamento de downloads (assets de release, artefatos de jobs, anexos enviados); liste aqui hosts de rede privada |
| `GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY`                  | opcional    | Permite apenas `initialize`, `notifications/initialized`, `tools/list` e `server/discover` sem autenticação (chamadas de ferramentas continuam exigindo autenticação)                                                                                                                        |
| `MCP_SERVER_URL` / `MCP_ALLOWED_HOSTS` / `MCP_ALLOWED_ORIGINS` | opcional    | Hosts/origens públicos permitidos para `/mcp`, usados na proteção contra DNS rebinding                                                                                                                                                                                                       |
| `MCP_TRUST_PROXY`                                              | opcional    | Confia nos headers `Forwarded` / `X-Forwarded-*` atrás de um reverse proxy (URLs de download, `req.ip` do Express, rate limiting por IP em `/mcp` e rate limiting do OAuth)                                                                                                                  |

`GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY=true` é útil para gateways MCP ou UIs administrativas que precisam inspecionar metadados das ferramentas antes de o usuário fornecer um token do GitLab. Mantenha essa opção desabilitada, a menos que sua implantação possa expor com segurança a lista de ferramentas.

Quando `MCP_SERVER_URL` não está definido, as URLs de download remotas usam como fallback o endereço local do servidor. Defina `MCP_TRUST_PROXY=true` somente quando o servidor for acessível por um reverse proxy confiável e o acesso direto dos clientes ao servidor MCP estiver bloqueado. Isso habilita o `trust proxy` do Express para Streamable HTTP e SSE, deriva URLs públicas de download a partir de `Forwarded` / `X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-Prefix` e mantém o rate limiting dos endpoints OAuth funcional quando o proxy envia em `X-Forwarded-For` endereços com porta do cliente (por exemplo, `1.2.3.4:5678`). Após a introdução dessa flag, implantações OAuth+proxy existentes precisam defini-la explicitamente.

**Exemplos de headers:**

```http
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

ou com Bearer token:

```http
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ `REMOTE_AUTHORIZATION` não é compatível com transporte SSE. É obrigatório usar `STREAMABLE_HTTP=true`.

### Variáveis de ambiente

Consulte a documentação de referência dedicada para a lista completa de variáveis de ambiente:

- [Referência de variáveis de ambiente](./docs/configuration/environment-variables.md)

A maioria dos usuários precisa apenas de uma destas combinações iniciais:

- **PAT local**: `GITLAB_PERSONAL_ACCESS_TOKEN`, `GITLAB_API_URL`
- **OAuth local**: `GITLAB_USE_OAUTH=true`, `GITLAB_OAUTH_CLIENT_ID`, `GITLAB_OAUTH_REDIRECT_URI`, `GITLAB_API_URL`
- **HTTP remoto multiusuário**: `STREAMABLE_HTTP=true`, `REMOTE_AUTHORIZATION=true` (ou `GITLAB_MCP_OAUTH=true`), `MCP_TRUST_PROXY=true` (atrás de reverse proxy), `MAX_REQUESTS_PER_MINUTE=300`, `MCP_SERVER_URL` ou `MCP_ALLOWED_HOSTS`, `HOST`, `PORT`
- **Múltiplas implantações em paralelo**: defina um `MCP_SERVER_NAME` diferente para cada instância (por exemplo, `gitlab-selfhosted-readonly`) para distingui-las em clientes, logs e telemetria
- **HPA com múltiplos Pods (stateless)**: configuração acima + `OAUTH_STATELESS_MODE=true`, `OAUTH_STATELESS_SECRET` (igual em todos os Pods). Veja [Modo Stateless](./docs/configuration/stateless-mode.md).

Variáveis usadas com frequência:

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
- `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR`
- `OAUTH_STATELESS_MODE`
- `OAUTH_STATELESS_SECRET`

A documentação de referência também inclui:

- variáveis de autenticação e OAuth
- variáveis do proxy MCP OAuth
- variáveis de filtragem de projetos e ferramentas
- descoberta dinâmica de ferramentas via `discover_tools` (habilitação de toolsets sob demanda)
- variáveis de transporte e sessão
- variáveis de proxy e TLS

Para detalhes do modo de proxy de callback, veja [GitLab MCP OAuth Callback Proxy](./docs/auth/oauth-callback-proxy.md).

#### Limites de sessão SSE

`GET /sse` está sujeito aos mesmos controles de transporte remoto do Streamable HTTP:

- **Capacidade:** no máximo `MAX_SESSIONS` sessões SSE simultâneas (padrão 1000); conexões excedentes recebem `503`.
- **Limite de criação:** novas conexões são limitadas por IP do cliente a `MAX_REQUESTS_PER_MINUTE` (padrão 60); conexões excedentes recebem `429`.
- **Timeout de inatividade:** sessões sem uma requisição `POST /messages` durante `SESSION_TIMEOUT_SECONDS` (padrão 1 hora) são encerradas, então clientes inativos precisam se reconectar em vez de ocupar indefinidamente um slot de capacidade. Diferentemente do Streamable HTTP, manter o stream SSE aberto **não** conta como atividade.
- Quando a instância atinge a capacidade, `/health` retorna `503` e `status: "degraded"`.

Ajuste esses limites com [`MAX_SESSIONS`](./docs/configuration/environment-variables.md#max_sessions), `MAX_REQUESTS_PER_MINUTE` e `SESSION_TIMEOUT_SECONDS`.

### Configuração de autorização remota (suporte multiusuário)

Com `REMOTE_AUTHORIZATION=true`, o servidor MCP pode atender vários usuários, cada um fornecendo seu próprio token do GitLab por headers HTTP. Isso é útil para:

- instâncias compartilhadas do servidor MCP em que cada usuário precisa de suas próprias permissões de acesso ao GitLab
- integrações com IDEs capazes de injetar tokens específicos de cada usuário nas requisições MCP

**Exemplo de configuração:**

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

**Configuração do cliente:**

A IDE ou cliente MCP deve enviar um dos seguintes headers em cada requisição:

```http
Authorization: Bearer glpat-xxxxxxxxxxxxxxxxxxxx
```

ou

```http
Private-Token: glpat-xxxxxxxxxxxxxxxxxxxx
```

O token é armazenado por sessão (identificada pelo header `mcp-session-id`) e reutilizado nas requisições seguintes da mesma sessão.

#### Exemplo de configuração de autorização remota no Cursor

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

**Observações importantes:**

- A autorização remota **funciona apenas com o transporte Streamable HTTP**
- Cada sessão é isolada. O token de uma sessão não pode acessar os dados de outra sessão. Os tokens são limpos automaticamente quando a sessão é encerrada.
- **Timeout de sessão:** os tokens de autenticação expiram após `SESSION_TIMEOUT_SECONDS` (padrão 1 hora) sem atividade. Após o timeout, o cliente precisa enviar novamente os headers de autenticação. A sessão de transporte permanece ativa.
- Cada requisição reinicia o timer de timeout da sessão.
- **Rate limiting:** requisições a `/mcp` são limitadas por IP do cliente a `MAX_REQUESTS_PER_MINUTE`; ao usar OAuth ou autorização remota, também são limitadas por sessão MCP (padrão 60). Veja [environment-variables.md](docs/configuration/environment-variables.md#max_requests_per_minute).
- **Limite de capacidade:** o servidor aceita no máximo `MAX_SESSIONS` sessões simultâneas (padrão 1000).

### Configuração de MCP OAuth (OAuth nativo do Claude.ai)

Com `GITLAB_MCP_OAUTH=true`, o servidor atua como um proxy OAuth para sua instância GitLab. Claude.ai e qualquer cliente compatível com a especificação MCP processam automaticamente o fluxo completo de autenticação no navegador, sem necessidade de gerenciar manualmente um Personal Access Token.

**Pré-requisitos:**

É necessário um **aplicativo OAuth do GitLab previamente registrado**. O GitLab limita aplicativos não verificados registrados dinamicamente ao scope `mcp`, que não é suficiente para chamadas à API (é necessário `api` ou `read_api`).

1. Acesse sua instância GitLab → **Admin Area > Applications** (nível da instância) ou **User Settings > Applications** (pessoal).
2. Crie um novo aplicativo:
   - **Confidential**: desmarcado
   - **Scopes**: `api`, `read_api`, `read_user` ou os scopes que você pretende solicitar via `GITLAB_OAUTH_SCOPES`
3. Salve e copie o **Application ID**. Esse valor é `GITLAB_OAUTH_APP_ID`.

**Como funciona:**

1. O usuário adiciona a URL do servidor MCP ao Claude.ai.
2. O Claude.ai descobre os endpoints OAuth por meio de `/.well-known/oauth-authorization-server`.
3. O Claude.ai se registra usando Dynamic Client Registration (`POST /register`). O servidor MCP processa isso localmente e atribui um client ID virtual a cada cliente.
4. O Claude.ai usa o aplicativo OAuth previamente registrado para redirecionar o navegador do usuário à página de login do GitLab.
5. Após a autenticação, o GitLab redireciona para `https://claude.ai/api/mcp/auth_callback`.
6. O Claude.ai envia `Authorization: Bearer <token>` em cada requisição MCP.
7. O servidor valida o token com o GitLab e o armazena por sessão.

**Configuração do servidor:**

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

Desenvolvimento local (HTTP permitido):

```bash
MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true \
STREAMABLE_HTTP=true \
GITLAB_MCP_OAUTH=true \
GITLAB_OAUTH_APP_ID=your-gitlab-oauth-app-client-id \
MCP_SERVER_URL=http://localhost:3002 \
GITLAB_API_URL=https://gitlab.com/api/v4 \
node build/index.js
```

**Configuração do Claude.ai:**

```json
{
  "mcpServers": {
    "GitLab": {
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
```

Não é necessário definir `headers`. O Claude.ai obtém o token via OAuth.

**Variáveis de ambiente:**

| Variável                                    | Obrigatória | Descrição                                                                                                                                                                                                                                        |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GITLAB_MCP_OAUTH`                          | sim         | Defina como `true` para habilitar                                                                                                                                                                                                                |
| `GITLAB_OAUTH_APP_ID`                       | sim         | Client ID do aplicativo OAuth do GitLab previamente registrado                                                                                                                                                                                   |
| `MCP_SERVER_URL`                            | sim         | URL HTTPS pública do servidor MCP                                                                                                                                                                                                                |
| `GITLAB_API_URL`                            | sim         | URL da API da instância GitLab (por exemplo, `https://gitlab.com/api/v4`)                                                                                                                                                                        |
| `STREAMABLE_HTTP`                           | sim         | Deve ser `true` (SSE não é suportado)                                                                                                                                                                                                            |
| `GITLAB_OAUTH_SCOPES`                       | não         | Scopes do GitLab a solicitar, separados por vírgula. O padrão é `api`, ou `read_api` quando `GITLAB_READ_ONLY_MODE=true`. O aplicativo previamente registrado deve ter pelo menos esses scopes configurados.                                     |
| `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR`        | não         | Limite rolling de Dynamic Client Registration (`POST /register`) por IP do cliente. Padrão `20`/hora, intervalo `1`–`1000`. Aumente se múltiplas janelas de IDE estiverem atingindo o limite. Não está relacionado aos limites da API do GitLab. |
| `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL` | não         | Apenas para desenvolvimento local via HTTP                                                                                                                                                                                                       |

**Observações importantes:**

- MCP OAuth **funciona apenas com transporte Streamable HTTP** (incompatível com `SSE=true`).
- Cada sessão de usuário mantém seu próprio token OAuth; as sessões são completamente isoladas.
- Timeout de sessão, rate limiting e limite de capacidade são os mesmos do modo `REMOTE_AUTHORIZATION` (`SESSION_TIMEOUT_SECONDS`, `MAX_REQUESTS_PER_MINUTE`, `MAX_SESSIONS`).
- **Rate limiting do DCR:** `POST /register` é limitado por IP do cliente por `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR` (padrão 20/hora). Isso é independente do limite de `/mcp` e das cotas da API do GitLab. Veja [environment-variables.md](docs/configuration/environment-variables.md#oauth_register_rate_limit_per_hour).
- **Fallback de autenticação por header:** quando os headers `Private-Token` ou `JOB-TOKEN` estão presentes, a validação OAuth é ignorada e o token bruto é usado diretamente nessa sessão. Isso permite usar fluxos OAuth, PAT e CI job token na mesma instância do servidor. `Authorization: Bearer` é sempre tratado como token OAuth. Para autenticação PAT por header, use `Private-Token`.

## Arquivos de Agent Skill

Para agentes de IA que suportam carregamento de skills/instructions (Claude Code, GitHub Copilot, Cursor etc.), arquivos de skill pré-configurados estão disponíveis em [`skills/gitlab-mcp/`](./skills/gitlab-mcp/).

- **[SKILL.md](./skills/gitlab-mcp/SKILL.md)** — guia principal com visão geral dos toolsets, workflows importantes e dicas de parâmetros
- **[reference/](./skills/gitlab-mcp/reference/)** — documentação detalhada de workflows para code review, merge requests, issues, pipelines e triagem de vulnerabilidades

Instale usando a CLI `skills`:

```bash
npx skills add zereight/gitlab-mcp --skill gitlab-mcp-skill
```

Registre o diretório da skill no seu cliente de IA para obter orientações melhores de uso das ferramentas sem depender totalmente da resposta completa de ListTools.

## Ferramentas 🛠️

Para a lista completa de ferramentas, consulte a [seção Tools do README em inglês](./README.md#tools-%EF%B8%8F). O servidor atual fornece ferramentas relacionadas a merge requests, issues, pipelines, deployments, environments, artifacts, milestones, Wiki, repositórios, releases, usuários, eventos, work items, webhooks, busca de código, variáveis CI/CD, dependency proxy, triagem de vulnerabilidades e execução GraphQL.

### Títulos e slugs de páginas Wiki

O GitLab deriva o **slug** de uma página Wiki (sua URL, `/-/wikis/<slug>`) a partir do título da página. Portanto, passar `title` para `update_wiki_page` / `update_group_wiki_page` **renomeia a página e altera sua URL** — em páginas aninhadas, isso também pode mover a página para outro caminho — quebrando links existentes.

Para alterar apenas o **título exibido** mantendo a URL estável, **não** passe `title`. Em vez disso, armazene o título exibido no YAML front matter do conteúdo da página e atualize o conteúdo:

```markdown
---
title: Meu título personalizado
---

Corpo da página…
```

O GitLab mantém o slug/URL intacto e exibe o título do front matter na interface. Para lê-lo, use `get_wiki_page` com `render_html: true`, que preenche o campo `front_matter` — o campo `title` simples sempre reflete o valor derivado do slug.

## Testes 🧪

O projeto inclui cobertura abrangente de testes, incluindo autorização remota:

```bash
# Executar todos os testes (validação da API + autorização remota)
npm test

# Executar apenas os testes de autorização remota
npm run test:remote-auth

# Executar todos os testes, incluindo testes MCP somente leitura
npm run test:all

# Executar apenas a validação da API
npm run test:integration
```

Todos os testes de autorização remota usam um servidor GitLab mockado e não exigem credenciais reais do GitLab.
