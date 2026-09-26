# Human CLI Usage — Design Spec

**Date:** 2026-09-17
**Status:** Implemented (generic `tool` layer + curated phases 1–3)
**Approach:** Two-layer CLI. A schema-driven generic `tool` layer covering all registry tools from day one, plus a curated resource-command layer for daily use. No new API surface, no new dependencies.

---

## Overview

The installed binary (`zereight-mcp-gitlab`) already ships everywhere via npm and Homebrew, but today it only serves two roles: MCP server and the single `auth` subcommand. This spec designs a third role: a human-usable CLI in the style of `gh`, so installed users can run everyday GitLab operations from the shell without an MCP client.

Non-goals for this design:

- No new GitLab API coverage. Every command maps to an existing tool in `tools/registry.ts`.
- No interactive prompts in v1. Destructive commands take an explicit `--yes` flag instead.
- No new runtime dependencies. Output rendering is hand-rolled.

---

## Current state

- `package.json` exposes two bin aliases (`mcp-gitlab`, `zereight-mcp-gitlab`) pointing at `build/index.js`.
- `Formula/zereight-mcp-gitlab.rb` wraps the npm tarball and symlinks the bins, so the Homebrew install is already a shell-runnable binary.
- `cli-command.ts` (`getPositionalCliCommand`) reads the first positional arg; `index.ts` `main()` branches to `runAuthCommandAsync()` for `auth` and to `runServer()` otherwise.
- All other flags (`--token`, `--api-url`, `--permission-mode`, …) are server settings parsed in `config.ts`.
- Tool inventory: 263 tools in `allTools`, grouped into 21 toolsets in `TOOLSET_DEFINITIONS`. Shared tools (e.g. `get_branch`, `list_branches`) resolve to the last-defined toolset via `TOOLSET_BY_TOOL_NAME` with a `console.warn`.

---

## Command model

Two layers. The generic layer guarantees full coverage with zero per-tool code. The curated layer adds short memorable forms for the tools people run every day.

```text
zereight-mcp-gitlab auth ...                        # unchanged
zereight-mcp-gitlab tool <tool-name> [options]      # generic, all 263 tools
zereight-mcp-gitlab <group> <action> [options]      # curated, phased rollout
zereight-mcp-gitlab --help | <group> --help         # generated help
```

### Generic layer: `tool`

```bash
zereight-mcp-gitlab tool list_issues --project-id 123 --state opened
zereight-mcp-gitlab tool get_merge_request --project-id 123 --merge-request-iid 45 --output json
zereight-mcp-gitlab tool create_issue --args-json '{"project_id":"123","title":"bug"}'
```

- Tool name is exact (`snake_case`, as in the registry). No aliases, no fuzzy matching.
- Flags mirror input-schema keys in kebab-case (`project_id` → `--project-id`). Required schema fields are required flags.
- `--args-json '{...}'` is the escape hatch for nested objects and arrays.
- `--output json` (default for this layer) prints the raw tool result. `--output table` picks the curated renderer when one exists for that tool, else falls back to JSON with a stderr note.
- `--help` after a tool name prints its description plus generated flag list from `toJSONSchema`.

### Curated layer: resource groups

Group names mirror toolset IDs in kebab-case. `mr` is the only short alias.

| Group | Toolset | Phase |
|---|---|---|
| `mr` (`merge-requests`) | `merge_requests` (45 tools) | 1 reads, 2 writes |
| `issue` | `issues` (24 tools) | 1 reads, 2 writes |
| `pipeline` | `pipelines` (56 tools) | 1 reads, 2 writes |
| `project` | `projects` (11 tools) | 1 |
| `branch` | `branches` (15 tools) | 1 |
| `user` | `users` (7 tools) | 1 (`whoami`) |
| `repo` | `repositories` (7 tools) | 2 |
| `label` | `labels` (5 tools) | 2 |
| `release` | `releases` (7 tools) | 2 |
| `tag` | `tags` (5 tools) | 2 |
| `variable` | `variables` (10 tools) | 2 |
| `milestone` | `milestones` (17 tools) | 3 |
| `wiki` | `wiki` (10 tools) | 3 |
| `group` | `groups` (1 tool) | 3 |
| `ci` | `ci` (4 tools) | 3 |
| `webhook` | `webhooks` (6 tools) | 3 |
| `workitem` | `workitems` (18 tools) | 3 |
| `search` | `search` (3 tools) | 3 |
| `vulnerability` | `vulnerabilities` (4 tools) | 3 |
| `dependency-proxy` | `dependency_proxy` (4 tools) | 3 |
| `orbit` | `orbit` (4 tools) | 3 |

### Phase 1 curated commands (explicit list)

Actions use short verbs. Each maps to exactly one tool. Curated flags may use short forms where the schema key is long (`--mr-iid` for `merge_request_iid`); the generic layer always uses exact kebab-cased schema keys.

```text
mr list [--project-id ID | --group-id ID] [--state opened]     # list_merge_requests / list_group_merge_requests
mr view --project-id ID --mr-iid N                             # get_merge_request
mr diff --project-id ID --mr-iid N                             # get_merge_request_diffs
mr files --project-id ID --mr-iid N                            # list_merge_request_changed_files
mr discussions --project-id ID --mr-iid N                      # mr_discussions
mr pipelines --project-id ID --mr-iid N                        # list_merge_request_pipelines
mr approvals --project-id ID --mr-iid N                        # get_merge_request_approval_state

issue list --project-id ID [--state opened] [--assignee-username NAME]  # list_issues
issue mine                                                     # my_issues
issue view --project-id ID --issue-iid N                       # get_issue
issue discussions --project-id ID --issue-iid N                # list_issue_discussions

pipeline list --project-id ID [--status failed]                # list_pipelines
pipeline view --project-id ID --pipeline-id N                  # get_pipeline
pipeline jobs --project-id ID --pipeline-id N                  # list_pipeline_jobs
pipeline log --project-id ID --job-id N                        # get_pipeline_job_output

project list [--search TEXT]                                   # list_projects
project view --project-id ID                                   # get_project

branch list --project-id ID                                    # list_branches
branch view --project-id ID --branch NAME                      # get_branch
commit list --project-id ID [--ref NAME]                       # list_commits
commit view --project-id ID --sha SHA                          # get_commit

user whoami                                                    # whoami
```

Phase 1 is read-only on purpose: no confirmation UX needed, safe to ship behind no flag.

### Phase 2 curated commands (writes)

Same groups, plus `repo`, `label`, `release`, `tag`, `variable`. Every destructive tool (`delete_*`, `erase_*`, `purge_*`, `merge_*`) requires `--yes`; without it the command prints what it would do and exits 2. Non-destructive writes (`create_*`, `update_*`, `approve_*`, `retry_*`) run directly but echo the resulting URL or ID.

```text
mr create --project-id ID --source BRANCH --target BRANCH --title TEXT
mr approve --project-id ID --mr-iid N
mr merge --project-id ID --mr-iid N --yes
mr note --project-id ID --mr-iid N --body TEXT
issue create --project-id ID --title TEXT [--description TEXT]
issue close --project-id ID --issue-iid N
pipeline retry --project-id ID --pipeline-id N
```

Phase 3 curates the remaining groups on demand. Nothing is ever blocked: any tool without a curated form stays reachable via `tool <name>`.

---

## Arguments and configuration

- Auth and instance config reuse the existing surface unchanged: `--token`, `--api-url`, plus env vars (`GITLAB_PERSONAL_ACCESS_TOKEN`, `GITLAB_API_URL`, OAuth token file). Precedence stays CLI-over-env.
- `--permission-mode=readonly` (or env) refuses write commands with a usage error (exit 2) before any network call.
- Global flags: `--output table|json`, `--yes`, `--help`. Resource flags are per-command, kebab-cased schema keys.
- `--api-url` behavior (strip `/api/v4` where needed) matches the server.

---

## Output format

- Curated commands default to `--output table`: one line per item for lists (`ID  STATE  TITLE`), key-value summary for single gets. `--output json` prints the raw tool result for scripting.
- Generic `tool` commands default to `--output json`.
- Human output goes to stdout; diagnostics, warnings, and the version notice go to stderr, so `... --output json | jq` stays clean.
- Errors print a one-line message (`GitLab API error: 404 Not Found`) to stderr. Token and secret masking reuses `utils/redact-sensitive.ts`.
- Exit codes: `0` success, `1` API/auth/runtime failure, `2` usage error (unknown command, missing flag, refused write).

Example:

```bash
$ zereight-mcp-gitlab mr list --project-id 123 --state opened
IID  STATE   TITLE
45   opened  fix: pipeline retry race
44   opened  chore: bump deps

$ zereight-mcp-gitlab mr list --project-id 123 --output json | jq '.[0].iid'
45
```

---

## Implementation sketch

1. New `cli/` directory: router, schema-driven arg parser (reads `toJSONSchema` output), table renderers per curated command, help generator.
2. Extend `getPositionalCliCommand` to two levels (`<group> <action>`) and dispatch in `main()` before `runServer()`. `auth` keeps working as today.
3. Extract the `CallTool` dispatch in `index.ts` into a callable `runTool(name, args)` so CLI and MCP paths share one execution boundary. This is the main refactor; everything else is additive.
4. Update the Homebrew `test` block and `docs/getting-started/cli-arguments.md` for the new subcommands.
5. Tests: unit tests for arg parsing against a sample of schemas, plus a smoke test running `tool whoami`-style reads against the mock suite.

---

## Open questions

- Flags-only vs positional IDs (`mr view 123 45` vs `--project-id 123 --mr-iid 45`)? Flags-only is proposed for uniformity with schema keys.
- Table as curated default vs always-JSON? Table is proposed for shell ergonomics.
- Should the generic `tool` layer be documented as advanced/hidden to steer users toward curated commands?
- Destructive confirm UX: `--yes` flag only, or also an interactive prompt when stdin is a TTY?
