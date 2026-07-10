---
name: gitlab-mcp-skill
description: Use this skill when working with the GitLab MCP server tools for merge requests, issues, repositories, pipelines, work items, variables, dependency proxy, webhooks, search, CI catalog, and related GitLab workflows.
---

# gitlab-mcp

GitLab MCP server providing 212 tools: 210 tools across 19 toolsets, plus `execute_graphql` and the always-available `discover_tools` meta-tool.

For exact generated parameter tables, see `docs/tools/`. Use this file for workflow shape and high-signal parameter hints.

## Toolsets

| Toolset | Default | Enable with |
|---|---|---|
| merge_requests (43 tools) | yes | - |
| issues (24 tools) | yes | - |
| repositories (7 tools) | yes | - |
| branches (15 tools) | yes | - |
| projects (10 tools) | yes | - |
| labels (5 tools) | yes | - |
| ci (4 tools) | yes | - |
| groups (1 tool) | yes | - |
| users (7 tools) | yes | - |
| pipelines (19 tools) | no | `USE_PIPELINE=true` or `GITLAB_TOOLSETS=pipelines` |
| milestones (17 tools) | no | `USE_MILESTONE=true` or `GITLAB_TOOLSETS=milestones` |
| wiki (10 tools) | no | `USE_GITLAB_WIKI=true` or `GITLAB_TOOLSETS=wiki` |
| releases (7 tools) | no | `GITLAB_TOOLSETS=releases` |
| tags (5 tools) | no | `GITLAB_TOOLSETS=tags` |
| workitems (18 tools) | no | `GITLAB_TOOLSETS=workitems` |
| webhooks (3 tools) | no | `GITLAB_TOOLSETS=webhooks` |
| search (3 tools) | no | `GITLAB_TOOLSETS=search` |
| variables (10 tools) | no | `GITLAB_TOOLSETS=variables` |
| dependency_proxy (4 tools) | no | `GITLAB_TOOLSETS=dependency_proxy` |

Enable all: `GITLAB_TOOLSETS=all`. Use `GITLAB_TOOLS` to enable individual tools outside their toolset. `discover_tools` can list and activate opt-in categories for the current session. `execute_graphql` is not in a toolset; enable it explicitly with `GITLAB_TOOLS=execute_graphql`.

## Key Workflows

### Code Review (see reference/code-review.md)

1. `list_merge_request_changed_files` - get file paths only (no diffs)
2. `get_merge_request_file_diff` - get diffs for 3-5 files per call (batch)
3. `create_merge_request_thread` or `create_draft_note` - leave review comments
4. `bulk_publish_draft_notes` - publish all drafts at once

### MR Lifecycle (see reference/merge-requests.md)

`create_merge_request` -> review -> `approve_merge_request` -> `merge_merge_request`

### Issue Management (see reference/issues.md)

`create_issue` -> `create_issue_link` -> `create_issue_note` -> `update_issue`

Use `update_issue_description_patch` for small edits to long issue descriptions instead of resending the full body.

### Projects & Namespaces

- `get_project`, `list_projects`, `update_project` - inspect or change project settings
- `list_namespaces`, `get_namespace`, `verify_namespace` - find target namespaces before creating projects/groups
- `verify_namespace.parent_id` scopes nested namespace checks
- `create_repository.namespace_id` creates a project under a group namespace

### Branches & Commits

- `create_branch`, `list_branches`, `get_branch`, `delete_branch`
- Protected branches: `list_protected_branches`, `get_protected_branch`, `protect_branch`, `unprotect_branch`, `update_default_branch`
- Commits: `list_commits`, `get_commit`, `get_commit_diff`, `get_file_blame`, `list_commit_statuses`, `create_commit_status`

### CI

- Lint configs: `validate_ci_lint`, `validate_project_ci_lint`
- Catalog: `list_ci_catalog_resources`, `get_ci_catalog_resource`
- Pipelines/jobs/deployments: see reference/pipelines.md

### Work Items (see reference/work-items.md)

`list_work_items` -> `get_work_item` -> `update_work_item` -> `create_work_item_note`

### Variables & Dependency Proxy

Enable with `GITLAB_TOOLSETS=variables` or `GITLAB_TOOLSETS=dependency_proxy`.

- Variables: project/group CRUD tools (`list_*_variables`, `get_*_variable`, `create_*_variable`, `update_*_variable`, `delete_*_variable`)
- Dependency proxy: `get_dependency_proxy_settings`, `update_dependency_proxy_settings`, `list_dependency_proxy_blobs`, `purge_dependency_proxy_cache`

### Webhooks & Search

- Webhooks: see reference/webhooks.md
- Code search: see reference/search.md

### File Operations

- Read: `get_file_contents`, `get_repository_tree`
- Write: `create_or_update_file` (single file), `push_files` (multiple files in one commit)

## Parameter Hints

- **project_id**: numeric ID or URL-encoded path (`group%2Fsubgroup%2Fproject`)
- **namespace_id**: numeric namespace ID for `create_repository`; use `list_namespaces`/`verify_namespace` first
- **parent_id**: scope subgroup creation or `verify_namespace` for nested groups
- **MR lookup**: provide `mergeRequestIid` OR `branchName` (not both)
- **list_issues**: default scope = created by current user. Use `scope: "all"` for all issues
- **list_merge_requests**: without project_id returns user's MRs across all projects
- **CI catalog resource lookup**: provide exactly one of `id` or `full_path`
- **emoji reactions**: merge request, issue, and work item reaction tools use GitLab emoji names like `thumbsup`, `rocket`, or `eyes`
- **work items**: status and custom fields require GitLab Premium/Ultimate features
- **execute_graphql**: escape double quotes in query strings

## Destructive Tools (require caution)

`delete_branch`, `delete_draft_note`, `delete_group_milestone`, `delete_group_variable`, `delete_group_wiki_page`, `delete_issue`, `delete_issue_emoji_reaction`, `delete_issue_link`, `delete_issue_note_emoji_reaction`, `delete_label`, `delete_merge_request_discussion_note`, `delete_merge_request_emoji_reaction`, `delete_merge_request_note`, `delete_merge_request_note_emoji_reaction`, `delete_milestone`, `delete_project_variable`, `delete_release`, `delete_tag`, `delete_wiki_page`, `delete_work_item_emoji_reaction`, `delete_work_item_note_emoji_reaction`, `merge_merge_request`, `protect_branch`, `purge_dependency_proxy_cache`, `push_files`, `unprotect_branch`, `update_default_branch`

## Advanced

- **Dynamic discovery**: `discover_tools` lists and activates opt-in toolsets at runtime
- **GraphQL**: `execute_graphql` for queries not covered by REST tools
- **Tool docs**: `docs/tools/` is generated from `tools/registry.ts`; prefer it for exact schemas
- **Zoekt search**: `search_code`, `search_project_code`, `search_group_code` (requires advanced search enabled)
- **Work Items**: GraphQL-based alternative to issues (Premium/Ultimate features)
