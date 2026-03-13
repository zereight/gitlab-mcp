# gitlab-mcp

GitLab MCP server with broad GitLab coverage across 15 toolsets for merge requests, issues, repositories, pipelines, tags, and more.

## Toolsets

| Toolset                   | Default | Enable with                                          |
| ------------------------- | ------- | ---------------------------------------------------- |
| merge_requests (40 tools) | yes     | -                                                    |
| issues (20 tools)         | yes     | -                                                    |
| repositories (7 tools)    | yes     | -                                                    |
| branches (4 tools)        | yes     | -                                                    |
| projects (8 tools)        | yes     | -                                                    |
| labels (5 tools)          | yes     | -                                                    |
| users (5 tools)           | yes     | -                                                    |
| pipelines (19 tools)      | no      | `USE_PIPELINE=true` or `GITLAB_TOOLSETS=pipelines`   |
| milestones (9 tools)      | no      | `USE_MILESTONE=true` or `GITLAB_TOOLSETS=milestones` |
| wiki (10 tools)           | no      | `USE_GITLAB_WIKI=true` or `GITLAB_TOOLSETS=wiki`     |
| releases (7 tools)        | no      | `GITLAB_TOOLSETS=releases`                           |
| tags (5 tools)            | no      | `GITLAB_TOOLSETS=tags`                               |
| workitems (18 tools)      | no      | `GITLAB_TOOLSETS=workitems`                          |
| webhooks (3 tools)        | no      | `GITLAB_TOOLSETS=webhooks`                           |
| search (3 tools)          | no      | `GITLAB_TOOLSETS=search`                             |

Enable all: `GITLAB_TOOLSETS=all`

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

### File Operations

- Read: `get_file_contents`, `get_repository_tree`
- Write: `create_or_update_file` (single file), `push_files` (multiple files in one commit)

## Parameter Hints

- **project_id**: numeric ID or URL-encoded path (`group%2Fsubgroup%2Fproject`)
- **MR lookup**: provide `mergeRequestIid` OR `branchName` (not both)
- **list_issues**: default scope = created by current user. Use `scope: "all"` for all issues
- **list_merge_requests**: without project_id returns user's MRs across all projects
- **execute_graphql**: escape double quotes in query strings

## Destructive Tools (require caution)

`delete_issue`, `delete_label`, `delete_wiki_page`, `delete_group_wiki_page`, `delete_milestone`, `delete_release`, `delete_tag`, `delete_merge_request_note`, `delete_merge_request_discussion_note`, `delete_draft_note`, `delete_issue_link`, `merge_merge_request`, `push_files`

## Advanced

- **GraphQL**: `execute_graphql` for queries not covered by REST tools
- **Zoekt search**: `search_code`, `search_project_code`, `search_group_code` (requires advanced search enabled)
- **Work Items**: GraphQL-based alternative to issues (Premium/Ultimate features)
