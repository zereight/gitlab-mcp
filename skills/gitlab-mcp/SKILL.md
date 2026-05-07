---
name: gitlab-mcp-skill
description: Use this skill when working with the GitLab MCP server tools for merge requests, issues, repositories, pipelines, work items, webhooks, search, and related GitLab workflows.
---

# gitlab-mcp

GitLab MCP server providing 172 tools: 170 tools across 16 toolsets, plus `execute_graphql` and the always-available `discover_tools` meta-tool.

## Toolsets

| Toolset                   | Default | Enable with                                          |
| ------------------------- | ------- | ---------------------------------------------------- |
| merge_requests (40 tools) | yes     | -                                                    |
| issues (23 tools)         | yes     | -                                                    |
| repositories (7 tools)    | yes     | -                                                    |
| branches (6 tools)        | yes     | -                                                    |
| projects (8 tools)        | yes     | -                                                    |
| labels (5 tools)          | yes     | -                                                    |
| ci (2 tools)              | yes     | -                                                    |
| users (5 tools)           | yes     | -                                                    |
| pipelines (19 tools)      | no      | `USE_PIPELINE=true` or `GITLAB_TOOLSETS=pipelines`   |
| milestones (9 tools)      | no      | `USE_MILESTONE=true` or `GITLAB_TOOLSETS=milestones` |
| wiki (10 tools)           | no      | `USE_GITLAB_WIKI=true` or `GITLAB_TOOLSETS=wiki`     |
| releases (7 tools)        | no      | `GITLAB_TOOLSETS=releases`                           |
| tags (5 tools)            | no      | `GITLAB_TOOLSETS=tags`                               |
| workitems (18 tools)      | no      | `GITLAB_TOOLSETS=workitems`                          |
| webhooks (3 tools)        | no      | `GITLAB_TOOLSETS=webhooks`                           |
| search (3 tools)          | no      | `GITLAB_TOOLSETS=search`                             |

Enable all: `GITLAB_TOOLSETS=all`. Use `GITLAB_TOOLS` to enable individual tools outside their toolset. `discover_tools` can activate opt-in categories for the current session.

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

### Work Items (see reference/work-items.md)

`list_work_items` -> `get_work_item` -> `update_work_item` -> `create_work_item_note`

### Webhooks & Search

- Webhooks: see reference/webhooks.md
- Code search: see reference/search.md

### File Operations

- Read: `get_file_contents`, `get_repository_tree`
- Write: `create_or_update_file` (single file), `push_files` (multiple files in one commit)

## Parameter Hints

- **project_id**: numeric ID or URL-encoded path (`group%2Fsubgroup%2Fproject`)
- **MR lookup**: provide `mergeRequestIid` OR `branchName` (not both)
- **list_issues**: default scope = created by current user. Use `scope: "all"` for all issues
- **list_merge_requests**: without project_id returns user's MRs across all projects
- **emoji reactions**: merge request, issue, and work item reaction tools use GitLab emoji names like `thumbsup`, `rocket`, or `eyes`
- **work items**: status and custom fields require GitLab Premium/Ultimate features
- **execute_graphql**: escape double quotes in query strings

## Destructive Tools (require caution)

`delete_issue`, `delete_label`, `delete_wiki_page`, `delete_group_wiki_page`, `delete_milestone`, `delete_release`, `delete_tag`, `delete_merge_request_note`, `delete_merge_request_discussion_note`, `delete_draft_note`, `delete_issue_link`, `delete_merge_request_emoji_reaction`, `delete_merge_request_note_emoji_reaction`, `delete_issue_emoji_reaction`, `delete_issue_note_emoji_reaction`, `delete_work_item_emoji_reaction`, `delete_work_item_note_emoji_reaction`, `merge_merge_request`, `push_files`

## Advanced

- **Dynamic discovery**: `discover_tools` lists and activates opt-in toolsets at runtime
- **GraphQL**: `execute_graphql` for queries not covered by REST tools
- **Zoekt search**: `search_code`, `search_project_code`, `search_group_code` (requires advanced search enabled)
- **Work Items**: GraphQL-based alternative to issues (Premium/Ultimate features)
