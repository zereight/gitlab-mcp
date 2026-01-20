# GitLab MCP Tools Reference

> Auto-generated from source code. Do not edit manually.
> Generated: 2026-01-20 | Tools: 39 | Version: 6.17.0

## Table of Contents

- [Core (11)](#core)
- [Work Items (2)](#work-items)
- [Merge Requests (5)](#merge-requests)
- [Labels (2)](#labels)
- [Milestones (2)](#milestones)
- [Pipelines (3)](#pipelines)
- [Variables (2)](#variables)
- [Files (2)](#files)
- [Wiki (2)](#wiki)
- [Snippets (2)](#snippets)
- [Webhooks (2)](#webhooks)
- [Integrations (2)](#integrations)
- [Todos (2)](#todos)

---

## Core

### browse_projects

PROJECT DISCOVERY: Find, browse, or inspect GitLab projects. Use 'search' to find projects by name/topic across all GitLab. Use 'list' to browse your accessible projects or projects within a specific group. Use 'get' with project_id to retrieve full details of a known project. Filter by visibility, language, or ownership.

#### Actions

| Action | Description |
|--------|-------------|
| `search` | Find projects by criteria using global search API |
| `list` | Browse accessible projects with optional group scope |
| `get` | Retrieve specific project details |

#### Parameters

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project identifier. Numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab"). |
| `license` | boolean | No | Include license information. |
| `statistics` | boolean | No | Include repository statistics. |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `simple` | boolean | Yes | Return minimal fields for faster response. Default: true. |
| `archived` | boolean | No | Filter by archive status. true=archived only, false=active only. |
| `group_id` | string | No | Group ID to list projects within. If omitted, lists YOUR accessible projects. |
| `include_subgroups` | boolean | No | Include projects from subgroups (requires group_id). |
| `membership` | boolean | No | Show only projects where you have membership. |
| `order_by` | string | No | Sort field for results. |
| `owned` | boolean | No | Show only projects you own (not just member of). |
| `page` | integer | No | Page number for pagination. |
| `per_page` | integer | No | Results per page (1-100). |
| `search` | string | No | Text filter for list action (filters results by name/description). |
| `sort` | string | No | Sort direction: asc or desc. |
| `starred` | boolean | No | Show only starred/favorited projects. |
| `visibility` | string | No | Filter by visibility: public, internal, or private. |
| `with_programming_language` | string | No | Filter by programming language (e.g., "javascript", "python"). |
| `with_shared` | boolean | No | Include shared projects (requires group_id). |

**Action `search`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `archived` | boolean | No | Filter by archive status. true=archived only, false=active only. |
| `order_by` | string | No | Sort field for results. |
| `page` | integer | No | Page number for pagination. |
| `per_page` | integer | No | Results per page (1-100). |
| `q` | string | No | Global search query. Searches project names, paths, descriptions. |
| `sort` | string | No | Sort direction: asc or desc. |
| `visibility` | string | No | Filter by visibility: public, internal, or private. |
| `with_programming_language` | string | No | Filter by programming language (e.g., "javascript", "python"). |

#### Example

```json
{
  "action": "search"
}
```

---

### browse_namespaces

NAMESPACE OPERATIONS: Explore GitLab groups and user namespaces. Use 'list' to discover available namespaces for project creation. Use 'get' with namespace_id to retrieve full details including storage stats. Use 'verify' to check if a namespace path exists before creating projects or groups.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | Browse namespaces with optional filtering |
| `get` | Retrieve namespace details |
| `verify` | Check if namespace exists |

#### Parameters

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace_id` | string | Yes | Namespace ID or path. |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `min_access_level` | number | No | Minimum access level: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner. |
| `owned_only` | boolean | No | Show only namespaces you own. |
| `page` | integer | No | Page number for pagination. |
| `per_page` | integer | No | Results per page (1-100). |
| `search` | string | No | Search namespaces by name/path. |
| `top_level_only` | boolean | No | Show only root-level namespaces. |
| `with_statistics` | boolean | No | Include storage/count statistics. |

**Action `verify`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace_id` | string | Yes | Namespace ID or path. |

#### Example

```json
{
  "action": "list"
}
```

---

### browse_commits

COMMIT HISTORY: Explore repository commit history. Use 'list' to browse commits with optional date range, author, or file path filters. Use 'get' with sha to retrieve commit metadata and stats. Use 'diff' to see actual code changes in a commit. Essential for code review and change tracking.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | Browse commit history |
| `get` | Retrieve commit details |
| `diff` | Get code changes in a commit |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project ID or URL-encoded path. |

**Action `diff`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sha` | string | Yes | Commit SHA. Can be full SHA, short hash, or ref name. |
| `page` | integer | No | Page number for pagination. |
| `per_page` | integer | No | Results per page (1-100). |
| `unidiff` | boolean | No | Return unified diff format. |

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sha` | string | Yes | Commit SHA. Can be full SHA, short hash, or ref name. |
| `stats` | boolean | No | Include file change statistics. |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `all` | boolean | No | Include commits from all branches. |
| `author` | string | No | Filter by author name or email. |
| `first_parent` | boolean | No | Follow only first parent (linear history). |
| `order` | string | No | Commit ordering: default or topo. |
| `page` | integer | No | Page number for pagination. |
| `path` | string | No | Filter commits affecting this file/directory path. |
| `per_page` | integer | No | Results per page (1-100). |
| `ref_name` | string | No | Branch/tag name. Defaults to default branch. |
| `since` | string | No | Start date filter (ISO 8601 format). |
| `trailers` | boolean | No | Include Git trailers (Signed-off-by, etc.). |
| `until` | string | No | End date filter (ISO 8601 format). |
| `with_stats` | boolean | No | Include stats for each commit. |

#### Example

```json
{
  "action": "list",
  "project_id": "my-group/my-project"
}
```

---

### browse_events

ACTIVITY FEED: Track GitLab activity and events. Use 'user' to see YOUR recent activity across all projects (commits, issues, MRs). Use 'project' with project_id to monitor a specific project's activity feed. Filter by date range or action type (pushed, commented, merged, etc.).

#### Actions

| Action | Description |
|--------|-------------|
| `user` | Show your activity across all projects |
| `project` | Show specific project activity |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `after` | string | No | Show events after this date (YYYY-MM-DD). |
| `before` | string | No | Show events before this date (YYYY-MM-DD). |
| `event_action` | string | No | Filter by event action. |
| `page` | integer | No | Page number for pagination. |
| `per_page` | integer | No | Results per page (1-100). |
| `sort` | string | No | Sort order: asc=oldest first, desc=newest first. |
| `target_type` | string | No | Filter by target type. |

**Action `project`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project ID. |

#### Example

```json
{
  "action": "user"
}
```

---

### manage_repository

REPOSITORY MANAGEMENT: Create or fork GitLab projects. Use 'create' to start a new project with custom settings (visibility, features, namespace). Use 'fork' with project_id to create your own copy of an existing project for independent development or contribution back via MRs.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new project |
| `fork` | Fork an existing project |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `issues_enabled` | boolean | No | Enable issue tracking. |
| `jobs_enabled` | boolean | No | Enable CI/CD jobs. |
| `lfs_enabled` | boolean | No | Enable Git LFS. |
| `merge_requests_enabled` | boolean | No | Enable merge requests. |
| `namespace` | string | No | Target namespace path. Omit for current user namespace. |
| `only_allow_merge_if_all_discussions_are_resolved` | boolean | No | Require resolved discussions for merge. |
| `only_allow_merge_if_pipeline_succeeds` | boolean | No | Require passing pipelines for merge. |
| `request_access_enabled` | boolean | No | Allow access requests. |
| `snippets_enabled` | boolean | No | Enable code snippets. |
| `wiki_enabled` | boolean | No | Enable project wiki. |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Project name. |
| `description` | string | No | Project description. |
| `initialize_with_readme` | boolean | No | Create initial README.md file. |
| `visibility` | string | No | Project visibility level. |

**Action `fork`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Source project to fork. Numeric ID or URL-encoded path. |
| `fork_name` | string | No | New name for forked project (maps to API 'name' parameter). |
| `fork_path` | string | No | New path for forked project (maps to API 'path' parameter). |
| `namespace_path` | string | No | Target namespace path for fork. |

#### Example

```json
{
  "action": "create",
  "name": "example_name"
}
```

---

### get_users [tier: Free]

FIND USERS: Search GitLab users with smart pattern detection. Auto-detects emails, usernames, or names. Supports transliteration and multi-phase fallback search.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `per_page` | integer | Yes | Number of items per page (max 100) |
| `active` | boolean | No | Filter for active (true) or inactive (false) users. |
| `blocked` | boolean | No | Filter for blocked users. |
| `created_after` | string | No | Filter users created after this date (ISO 8601). |
| `created_before` | string | No | Filter users created before this date (ISO 8601). |
| `exclude_active` | boolean | No | Exclude active users. |
| `exclude_external` | boolean | No | Exclude external users. |
| `exclude_humans` | boolean | No | Exclude human users. |
| `exclude_internal` | boolean | No | Exclude internal system users. |
| `external` | boolean | No | Filter for external users with limited access. |
| `humans` | boolean | No | Filter for human users only (exclude bots). |
| `page` | integer | No | Page number |
| `public_email` | string | No | Find user by exact public email address. |
| `search` | string | No | Partial text search across name, username, and email. |
| `smart_search` | boolean | No | Enable smart search with auto-detection and transliteration. Auto-enabled for search parameter. |
| `username` | string | No | Exact username to search for. Case-sensitive. |
| `without_project_bots` | boolean | No | Exclude project bot users. |

#### Example

```json
{
  "per_page": 10
}
```

---

### list_project_members [tier: Free]

TEAM MEMBERS: List project members with access levels. Shows: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `per_page` | integer | Yes | Number of items per page (max 100) |
| `project_id` | string | Yes | Project ID or URL-encoded path. |
| `page` | integer | No | Page number |
| `query` | string | No | Search members by name or username. |
| `user_ids` | string[] | No | Filter to specific user IDs. |

#### Example

```json
{
  "project_id": "my-group/my-project",
  "per_page": 10
}
```

---

### list_group_iterations [tier: Premium]

SPRINTS: List iterations/sprints for agile planning. Filter by state: current, upcoming, closed. Requires GitLab Premium.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `group_id` | string | Yes | Group ID or URL-encoded path. |
| `per_page` | integer | Yes | Number of items per page (max 100) |
| `include_ancestors` | boolean | No | Include iterations from parent groups. |
| `page` | integer | No | Page number |
| `search` | string | No | Search iterations by title. |
| `state` | string | No | Filter by iteration state. |

#### Example

```json
{
  "group_id": "my-group",
  "per_page": 10
}
```

---

### download_attachment [tier: Free]

DOWNLOAD: Retrieve file attachments from issues/MRs. Requires secret token and filename from attachment URL.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | Yes | Original filename of the attachment. |
| `project_id` | string | Yes | Project ID or URL-encoded path. |
| `secret` | string | Yes | Security token from the attachment URL. |

#### Example

```json
{
  "project_id": "my-group/my-project",
  "secret": "example_secret",
  "filename": "example_filename"
}
```

---

### create_branch [tier: Free]

NEW BRANCH: Create a Git branch from existing ref. Required before creating MRs. Ref can be branch name, tag, or commit SHA.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch` | string | Yes | New branch name. |
| `project_id` | string | Yes | Target project for new branch. |
| `ref` | string | Yes | Source reference (branch name or commit SHA). |

#### Example

```json
{
  "project_id": "my-group/my-project",
  "branch": "main",
  "ref": "main"
}
```

---

### create_group

CREATE GROUP: Create a new GitLab group/namespace. Groups organize projects and teams. Can create subgroups with parent_id.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Group display name. |
| `path` | string | Yes | Group path for URLs (URL-safe). |
| `visibility` | string | Yes | Group visibility level. |
| `avatar` | string | No | Group avatar URL. |
| `default_branch_protection` | number | No | Branch protection level: 0=none, 1=partial, 2=full. |
| `description` | string | No | Group description. |
| `lfs_enabled` | boolean | No | Enable Git LFS. |
| `parent_id` | number | No | Parent group ID for subgroup. |
| `request_access_enabled` | boolean | No | Allow access requests. |

#### Example

```json
{
  "name": "example_name",
  "path": "path/to/file.txt",
  "visibility": "private"
}
```

---

## Work Items

### browse_work_items

BROWSE work items. Actions: "list" shows work items with filtering (groups return epics, projects return issues/tasks), "get" retrieves single work item by ID with full widget details.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List work items with filtering |
| `get` | Get single work item details |

#### Parameters

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Work item ID to retrieve |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `first` | number | Yes | Number of items to return |
| `namespace` | string | Yes | Namespace path (group or project). Groups return epics, projects return issues/tasks. |
| `simple` | boolean | Yes | Return simplified structure with essential fields only. RECOMMENDED: Use default true for most cases. |
| `state` | string[] | Yes | Filter by work item state. Defaults to OPEN items only. Use ["OPEN", "CLOSED"] for all items. |
| `after` | string | No | Cursor for pagination (use endCursor from previous response) |
| `types` | string[] | No | Filter by work item types |

#### Example

```json
{
  "action": "list",
  "namespace": "my-group/my-project",
  "state": [],
  "first": 10,
  "simple": true
}
```

---

### manage_work_item

MANAGE work items. Actions: "create" creates new work item (Epics need GROUP namespace, Issues/Tasks need PROJECT), "update" modifies properties/widgets, "delete" permanently removes.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new work item |
| `update` | Update an existing work item |
| `delete` | Delete a work item |

#### Parameters

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | Yes | CRITICAL: Namespace path (group OR project). For Epics use GROUP path (e.g. "my-group"). For Issues/Tasks use PROJECT path (e.g. "my-group/my-project"). |
| `title` | string | Yes | Title of the work item |
| `workItemType` | string | Yes | Type of work item |
| `assigneeIds` | string[] | No | Array of assignee user IDs |
| `description` | string | No | Description of the work item |
| `labelIds` | string[] | No | Array of label IDs |
| `milestoneId` | string | No | Milestone ID |

**Action `delete`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Work item ID |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Work item ID |
| `assigneeIds` | string[] | No | Array of assignee user IDs |
| `description` | string | No | Description of the work item |
| `labelIds` | string[] | No | Array of label IDs |
| `milestoneId` | string | No | Milestone ID |
| `state` | string | No | State event for the work item (CLOSE, REOPEN) |
| `title` | string | No | Title of the work item |

#### Example

```json
{
  "action": "create",
  "namespace": "my-group/my-project",
  "workItemType": "EPIC",
  "title": "Example title"
}
```

---

## Merge Requests

### browse_merge_requests

BROWSE merge requests. Actions: "list" shows MRs with filtering, "get" retrieves single MR by IID or branch, "diffs" shows file changes, "compare" diffs two branches/commits.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List merge requests with filtering |
| `get` | Get single MR by IID or branch name |
| `diffs` | Get file changes/diffs for an MR |
| `compare` | Compare two branches or commits |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | No | Project ID or URL-encoded path. Optional for cross-project search. |

**Action `compare`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | Yes | Source reference: branch name or commit SHA |
| `to` | string | Yes | Target reference: branch name or commit SHA |
| `straight` | boolean | No | true=straight diff, false=three-way diff from common ancestor |

**Action `diffs`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merge_request_iid` | string | Yes | Internal MR ID unique to project |
| `include_diverged_commits_count` | boolean | No | Include count of commits the source branch is behind target |
| `include_rebase_in_progress` | boolean | No | Check if MR is currently being rebased |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch_name` | string | No | Find MR by its source branch name |
| `include_diverged_commits_count` | boolean | No | Include count of commits the source branch is behind target |
| `include_rebase_in_progress` | boolean | No | Check if MR is currently being rebased |
| `merge_request_iid` | string | No | Internal MR ID. Required unless branch_name provided. |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `approved_by_ids` | string[] | No | Filter MRs approved by user IDs |
| `approved_by_usernames` | string[] | No | Filter MRs approved by usernames |
| `assignee_id` | number | No | Filter by assignee's user ID |
| `assignee_username` | string | No | Filter by assignee's username |
| `author_id` | number | No | Filter by author's user ID |
| `author_username` | string | No | Filter by author's username |
| `created_after` | string | No | Filter MRs created after (ISO 8601) |
| `created_before` | string | No | Filter MRs created before (ISO 8601) |
| `deployed_after` | string | No | Filter MRs deployed after |
| `deployed_before` | string | No | Filter MRs deployed before |
| `environment` | string | No | Filter by deployment environment |
| `in` | string | No | Search scope |
| `labels` | string | string[] | No | Filter by labels |
| `milestone` | string | No | Filter by milestone title. Use "None" or "Any". |
| `min_access_level` | number | No | Minimum access level filter (10-50) |
| `my_reaction_emoji` | string | No | Filter MRs you've reacted to |
| `not` | object | No | Exclusion filters |
| `order_by` | string | No | Sort field |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |
| `reviewer_id` | number | No | Filter by reviewer user ID |
| `reviewer_username` | string | No | Filter by reviewer username |
| `scope` | string | No | Filter scope |
| `search` | string | No | Text search in title/description |
| `sort` | string | No | Sort direction |
| `source_branch` | string | No | Filter by source branch |
| `state` | string | No | MR state filter |
| `target_branch` | string | No | Filter by target branch |
| `updated_after` | string | No | Filter MRs modified after (ISO 8601) |
| `updated_before` | string | No | Filter MRs modified before (ISO 8601) |
| `view` | string | No | Response detail level |
| `wip` | string | No | Draft/WIP filter |
| `with_api_entity_associations` | boolean | No | Include extra API associations |
| `with_labels_details` | boolean | No | Return full label objects |
| `with_merge_status_recheck` | boolean | No | Trigger async recheck of merge status |

#### Example

```json
{
  "action": "list"
}
```

---

### browse_mr_discussions

BROWSE MR discussions and draft notes. Actions: "list" shows all discussion threads, "drafts" lists unpublished draft notes, "draft" gets single draft note.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List all discussion threads on an MR |
| `drafts` | List unpublished draft notes on an MR |
| `draft` | Get single draft note details |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merge_request_iid` | string | Yes | Internal MR ID unique to project |
| `project_id` | string | Yes | Project ID or URL-encoded path |

**Action `draft`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `draft_note_id` | string | Yes | Unique identifier of the draft note |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |

#### Example

```json
{
  "action": "list",
  "project_id": "my-group/my-project",
  "merge_request_iid": "1"
}
```

---

### manage_merge_request

MANAGE merge requests. Actions: "create" creates new MR, "update" modifies existing MR, "merge" merges approved MR into target branch.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new merge request |
| `update` | Update an existing merge request |
| `merge` | Merge an approved merge request |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project ID or URL-encoded path |
| `squash` | boolean | No | Combine all commits into one when merging |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_branch` | string | Yes | Branch containing changes to merge |
| `target_branch` | string | Yes | Branch to merge into |
| `title` | string | Yes | MR title/summary |
| `allow_collaboration` | boolean | No | Let maintainers push to source branch |
| `allow_maintainer_to_push` | boolean | No | Deprecated - use allow_collaboration |
| `assignee_id` | string | No | Single assignee user ID |
| `assignee_ids` | string[] | No | Multiple assignee IDs |
| `description` | string | No | MR description (Markdown) |
| `labels` | string | string[] | No | Labels to categorize MR |
| `milestone_id` | string | No | Associate MR with milestone |
| `remove_source_branch` | boolean | No | Auto-delete source branch after merge |
| `reviewer_ids` | string[] | No | User IDs for code reviewers |
| `target_project_id` | string | No | Target project for cross-project MRs |

**Action `merge`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merge_request_iid` | string | Yes | Internal MR ID unique to project |
| `merge_commit_message` | string | No | Custom merge commit message |
| `merge_when_pipeline_succeeds` | boolean | No | Merge when pipeline succeeds |
| `sha` | string | No | SHA of the head commit |
| `should_remove_source_branch` | boolean | No | Remove source branch after merge |
| `squash_commit_message` | string | No | Custom squash commit message |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merge_request_iid` | string | Yes | Internal MR ID unique to project |
| `add_labels` | string | string[] | No | Labels to add |
| `allow_collaboration` | boolean | No | Let maintainers push to source branch |
| `allow_maintainer_to_push` | boolean | No | Deprecated - use allow_collaboration |
| `assignee_id` | string | No | Single assignee user ID |
| `assignee_ids` | string[] | No | Multiple assignee IDs |
| `description` | string | No | MR description (Markdown) |
| `discussion_locked` | boolean | No | Lock discussion thread |
| `labels` | string | string[] | No | Labels to categorize MR |
| `milestone_id` | string | No | Associate MR with milestone |
| `remove_labels` | string | string[] | No | Labels to remove |
| `remove_source_branch` | boolean | No | Auto-delete source branch after merge |
| `reviewer_ids` | string[] | No | User IDs for code reviewers |
| `state_event` | string | No | State event: close or reopen |
| `target_branch` | string | No | Branch to merge into |
| `title` | string | No | MR title/summary |

#### Example

```json
{
  "action": "create",
  "project_id": "my-group/my-project",
  "source_branch": "example_source_branch",
  "target_branch": "example_target_branch",
  "title": "Example title"
}
```

---

### manage_mr_discussion

MANAGE MR discussions. Actions: "comment" adds comment to issue/MR, "thread" starts new discussion, "reply" responds to existing thread, "update" modifies note.

#### Actions

| Action | Description |
|--------|-------------|
| `comment` | Add a comment to an issue or merge request |
| `thread` | Start a new discussion thread on an MR |
| `reply` | Reply to an existing discussion thread |
| `update` | Update an existing note/comment |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `body` | string | Yes | New content/text for the note |
| `project_id` | string | Yes | Project ID or URL-encoded path |

**Action `comment`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `noteable_id` | string | Yes | ID of the noteable object |
| `noteable_type` | string | Yes | Type of noteable: issue or merge_request |
| `confidential` | boolean | No | Confidential note flag |
| `created_at` | string | No | Date time string (ISO 8601) |

**Action `reply`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `discussion_id` | string | Yes | ID of the discussion to reply to |
| `merge_request_iid` | string | Yes | Internal MR ID unique to project |
| `created_at` | string | No | Date time string (ISO 8601) |

**Action `thread`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merge_request_iid` | string | Yes | Internal MR ID unique to project |
| `commit_id` | string | No | SHA of commit to start discussion on |
| `position` | object | No | Position for diff note |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merge_request_iid` | string | Yes | Internal MR ID unique to project |
| `note_id` | string | Yes | ID of the note to update |

#### Example

```json
{
  "action": "comment",
  "project_id": "my-group/my-project",
  "noteable_type": "issue",
  "noteable_id": "123",
  "body": "example_body"
}
```

---

### manage_draft_notes

MANAGE draft notes. Actions: "create" creates draft note, "update" modifies draft, "publish" publishes single draft, "publish_all" publishes all drafts, "delete" removes draft.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new draft note |
| `update` | Update an existing draft note |
| `publish` | Publish a single draft note |
| `publish_all` | Publish all draft notes at once |
| `delete` | Delete a draft note |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merge_request_iid` | string | Yes | Internal MR ID unique to project |
| `project_id` | string | Yes | Project ID or URL-encoded path |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `note` | string | Yes | Content of the draft note |
| `commit_id` | string | No | SHA of commit to start discussion on |
| `in_reply_to_discussion_id` | string | No | Discussion ID to reply to |
| `position` | object | No | Position for diff note |

**Action `delete`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `draft_note_id` | string | Yes | ID of the draft note |

**Action `publish`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `draft_note_id` | string | Yes | ID of the draft note |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `draft_note_id` | string | Yes | ID of the draft note |
| `note` | string | Yes | New content for the draft note |
| `position` | object | No | Position for diff note |

#### Example

```json
{
  "action": "create",
  "project_id": "my-group/my-project",
  "merge_request_iid": "1",
  "note": "example_note"
}
```

---

## Labels

### browse_labels

BROWSE labels. Actions: "list" shows all labels in project/group with filtering, "get" retrieves single label details by ID or name.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List labels with optional filtering |
| `get` | Get a single label by ID or title |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | Yes | Namespace path (group or project) |
| `include_ancestor_groups` | boolean | No | Include ancestor groups when listing or getting labels |

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `label_id` | string | Yes | The ID or title of the label |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |
| `search` | string | No | Keyword to filter labels by |
| `with_counts` | boolean | No | Include issue and merge request counts |

#### Example

```json
{
  "action": "list",
  "namespace": "my-group/my-project"
}
```

---

### manage_label

MANAGE labels. Actions: "create" adds new label (requires name and color), "update" modifies existing label, "delete" removes label permanently.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new label |
| `update` | Update an existing label |
| `delete` | Delete a label |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | Yes | Namespace path (group or project) |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `color` | string | Yes | The color of the label in 6-digit hex notation with leading '#' (e.g. #FFAABB) or CSS color name |
| `name` | string | Yes | The name of the label |
| `description` | string | No | The description of the label |
| `priority` | number | No | The priority of the label. Must be greater or equal than zero or null to remove the priority. |

**Action `delete`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `label_id` | string | Yes | The ID or title of the label |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `label_id` | string | Yes | The ID or title of the label |
| `color` | string | No | The color of the label in 6-digit hex notation with leading '#' (e.g. #FFAABB) or CSS color name |
| `description` | string | No | The description of the label |
| `name` | string | No | The name of the label |
| `new_name` | string | No | The new name of the label |
| `priority` | number | No | The priority of the label. Must be greater or equal than zero or null to remove the priority. |

#### Example

```json
{
  "action": "create",
  "namespace": "my-group/my-project",
  "name": "example_name",
  "color": "example_color"
}
```

---

## Milestones

### browse_milestones

BROWSE milestones. Actions: "list" shows milestones with filtering, "get" retrieves single milestone, "issues" lists issues in milestone, "merge_requests" lists MRs in milestone, "burndown" gets burndown chart data.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List milestones with optional filtering |
| `get` | Get a single milestone by ID |
| `issues` | List issues assigned to a milestone |
| `merge_requests` | List merge requests assigned to a milestone |
| `burndown` | Get burndown chart data for a milestone |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | Yes | Namespace path (group or project) |

**Action `burndown`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `milestone_id` | string | Yes | The ID of a project or group milestone |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `milestone_id` | string | Yes | The ID of a project or group milestone |

**Action `issues`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `milestone_id` | string | Yes | The ID of a project or group milestone |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iids` | string[] | No | Return only the milestones having the given iid |
| `include_ancestors` | boolean | No | Include ancestor groups |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |
| `search` | string | No | Return only milestones with a title or description matching the provided string |
| `state` | string | No | Return only active or closed milestones |
| `title` | string | No | Return only milestones with a title matching the provided string |
| `updated_after` | string | No | Return milestones updated after the specified date (ISO 8601 format) |
| `updated_before` | string | No | Return milestones updated before the specified date (ISO 8601 format) |

**Action `merge_requests`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `milestone_id` | string | Yes | The ID of a project or group milestone |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |

#### Example

```json
{
  "action": "list",
  "namespace": "my-group/my-project"
}
```

---

### manage_milestone

MANAGE milestones. Actions: "create" creates new milestone, "update" modifies existing milestone, "delete" removes milestone, "promote" elevates project milestone to group level.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new item |
| `update` | Update an existing item |
| `delete` | Delete an item |
| `promote` | Perform promote operation |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | Yes | Namespace path (group or project) |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | The title of the milestone |
| `description` | string | No | The description of the milestone |
| `due_date` | string | No | The due date of the milestone (YYYY-MM-DD) |
| `start_date` | string | No | The start date of the milestone (YYYY-MM-DD) |

**Action `delete`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `milestone_id` | string | Yes | The ID of the milestone to delete |

**Action `promote`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `milestone_id` | string | Yes | The ID of the project milestone to promote to group level |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `milestone_id` | string | Yes | The ID of the milestone to update |
| `description` | string | No | The new description of the milestone |
| `due_date` | string | No | The due date of the milestone (YYYY-MM-DD) |
| `start_date` | string | No | The start date of the milestone (YYYY-MM-DD) |
| `state_event` | string | No | State event to apply: 'close' or 'activate' |
| `title` | string | No | The new title of the milestone |

#### Example

```json
{
  "action": "create",
  "namespace": "my-group/my-project",
  "title": "Example title"
}
```

---

## Pipelines

### browse_pipelines

BROWSE pipelines. Actions: "list" searches pipelines with filtering, "get" retrieves single pipeline details, "jobs" lists jobs in pipeline, "triggers" lists bridge/trigger jobs, "job" gets single job details, "logs" fetches job console output.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List pipelines with filtering |
| `get` | Get single pipeline details |
| `jobs` | List jobs in a pipeline |
| `triggers` | List bridge/trigger jobs in a pipeline |
| `job` | Get single job details |
| `logs` | Get job console output/logs |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project ID or URL-encoded path |

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pipeline_id` | string | Yes | The ID of the pipeline |

**Action `job`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | The ID of the job |

**Action `jobs`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pipeline_id` | string | Yes | The ID of the pipeline |
| `include_retried` | boolean | No | Include retried jobs in the response |
| `job_scope` | string[] | No | Scope of jobs to show |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No | Filter by name of user who triggered pipeline |
| `order_by` | string | No | Order pipelines by |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |
| `ref` | string | No | Filter by branch or tag ref |
| `scope` | string | No | Pipeline scope filter |
| `sha` | string | No | Filter by SHA |
| `sort` | string | No | Sort order |
| `source` | string | No | Pipeline source filter |
| `status` | string | No | Pipeline status filter |
| `updated_after` | string | No | ISO 8601 datetime to filter by updated_after |
| `updated_before` | string | No | ISO 8601 datetime to filter by updated_before |
| `username` | string | No | Filter by username who triggered pipeline |
| `yaml_errors` | boolean | No | Filter by YAML errors |

**Action `logs`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | The ID of the job |
| `limit` | number | No | Maximum number of lines to return. Combined with start, acts as line count |
| `max_lines` | number | No | Maximum number of lines to return (alternative to limit) |
| `start` | number | No | Start from specific line number (0-based). Positive from beginning, negative from end (e.g., -100 = last 100 lines) |

**Action `triggers`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pipeline_id` | string | Yes | The ID of the pipeline |
| `include_retried` | boolean | No | Include retried jobs in the response |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |
| `trigger_scope` | string[] | No | Scope of trigger jobs to show |

#### Example

```json
{
  "action": "list",
  "project_id": "my-group/my-project"
}
```

---

### manage_pipeline

MANAGE pipelines. Actions: "create" triggers new pipeline on branch/tag with optional variables, "retry" re-runs failed/canceled pipeline, "cancel" stops running pipeline.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Trigger a new pipeline on branch/tag |
| `retry` | Re-run a failed/canceled pipeline |
| `cancel` | Stop a running pipeline |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project ID or URL-encoded path |

**Action `cancel`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pipeline_id` | string | Yes | The ID of the pipeline |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ref` | string | Yes | The branch or tag to run the pipeline on |
| `variables` | object[] | No | Variables to pass to the pipeline |

**Action `retry`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pipeline_id` | string | Yes | The ID of the pipeline |

#### Example

```json
{
  "action": "create",
  "project_id": "my-group/my-project",
  "ref": "main"
}
```

---

### manage_pipeline_job

MANAGE pipeline jobs. Actions: "play" triggers manual job with optional variables, "retry" re-runs failed/canceled job, "cancel" stops running job.

#### Actions

| Action | Description |
|--------|-------------|
| `play` | Trigger a manual job |
| `retry` | Re-run a failed/canceled job |
| `cancel` | Stop a running job |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | The ID of the job |
| `project_id` | string | Yes | Project ID or URL-encoded path |

**Action `cancel`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `force` | boolean | No | Force cancellation of the job |

**Action `play`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_variables_attributes` | object[] | No | Variables to pass to the job |

#### Example

```json
{
  "action": "play",
  "project_id": "my-group/my-project",
  "job_id": "123"
}
```

---

## Variables

### browse_variables

BROWSE CI/CD variables. Actions: "list" shows all variables in project/group with pagination, "get" retrieves single variable details by key with optional environment scope filter.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List all CI/CD variables |
| `get` | Get a single CI/CD variable by key |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | Yes | Namespace path (group or project) |

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | The key of the CI/CD variable. Maximum 255 characters, alphanumeric and underscore only. |
| `filter` | object | No | Filter parameters for variable lookup |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |

#### Example

```json
{
  "action": "list",
  "namespace": "my-group/my-project"
}
```

---

### manage_variable

MANAGE CI/CD variables. Actions: "create" adds new variable (requires key and value), "update" modifies existing variable, "delete" removes variable permanently. Supports environment scoping and protection settings.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new CI/CD variable |
| `update` | Update an existing CI/CD variable |
| `delete` | Delete a CI/CD variable |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | The key of the CI/CD variable. Maximum 255 characters, only alphanumeric and underscore characters allowed. |
| `namespace` | string | Yes | Namespace path (group or project) |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `value` | string | Yes | The value of the CI/CD variable. For file type variables, this is the file content. |
| `description` | string | No | Optional description explaining the purpose of this variable (GitLab 16.2+). |
| `environment_scope` | string | No | The environment scope. Use "*" for all environments (default), or specify like "production", "staging". |
| `masked` | boolean | No | Whether this variable should be masked in job logs. MASKING REQUIREMENTS: Value must be at least 8 characters, single line with no spaces, only A-Z a-z 0-9 + / = . ~ - _ @ : characters. |
| `protected` | boolean | No | Whether this variable is protected. Protected variables are only available to protected branches/tags. |
| `raw` | boolean | No | Whether variable expansion is disabled. When true, variables like $OTHER_VAR in the value will NOT be expanded. |
| `variable_type` | string | No | The type of variable: "env_var" for environment variables (default) or "file" for file variables. |

**Action `delete`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter` | object | No | Filter parameters to identify the specific variable |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `description` | string | No | Optional description explaining the purpose of this variable (GitLab 16.2+). |
| `environment_scope` | string | No | The environment scope. Use "*" for all environments (default), or specify like "production", "staging". |
| `filter` | object | No | Filter parameters to identify the specific variable |
| `masked` | boolean | No | Whether this variable should be masked in job logs. MASKING REQUIREMENTS: Value must be at least 8 characters, single line with no spaces, only A-Z a-z 0-9 + / = . ~ - _ @ : characters. |
| `protected` | boolean | No | Whether this variable is protected. Protected variables are only available to protected branches/tags. |
| `raw` | boolean | No | Whether variable expansion is disabled. When true, variables like $OTHER_VAR in the value will NOT be expanded. |
| `value` | string | No | The value of the CI/CD variable. For file type variables, this is the file content. |
| `variable_type` | string | No | The type of variable: "env_var" for environment variables (default) or "file" for file variables. |

#### Example

```json
{
  "action": "create",
  "namespace": "my-group/my-project",
  "key": "example_key",
  "value": "example_value"
}
```

---

## Files

### browse_files

BROWSE repository files. Actions: "tree" lists files/folders with pagination, "content" reads file contents. Use for exploring project structure or reading source code.

#### Actions

| Action | Description |
|--------|-------------|
| `tree` | List files and folders in a directory |
| `content` | Read file contents |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project ID or URL-encoded path |
| `ref` | string | No | Branch, tag, or commit SHA |

**Action `content`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to the file to read |

**Action `tree`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number |
| `path` | string | No | Directory path to list |
| `per_page` | integer | No | Results per page (max 100) |
| `recursive` | boolean | No | Include nested directories |

#### Example

```json
{
  "action": "tree",
  "project_id": "my-group/my-project"
}
```

---

### manage_files

MANAGE repository files. Actions: "single" creates/updates one file, "batch" commits multiple files atomically, "upload" adds markdown attachments.

#### Actions

| Action | Description |
|--------|-------------|
| `single` | Create or update a single file |
| `batch` | Commit multiple files atomically |
| `upload` | Upload a file as markdown attachment |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project ID or URL-encoded path |

**Action `batch`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch` | string | Yes | Target branch name |
| `commit_message` | string | Yes | Commit message |
| `files` | object[] | Yes | Files to commit (at least one required) |
| `author_email` | string | No | Commit author email |
| `author_name` | string | No | Commit author name |
| `start_branch` | string | No | Base branch to start from |

**Action `single`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch` | string | Yes | Target branch name |
| `commit_message` | string | Yes | Commit message |
| `content` | string | Yes | File content (text or base64 encoded) |
| `file_path` | string | Yes | Path to the file |
| `author_email` | string | No | Commit author email |
| `author_name` | string | No | Commit author name |
| `encoding` | string | No | Content encoding (default: text) |
| `execute_filemode` | boolean | No | Set executable permission |
| `last_commit_id` | string | No | Last known commit ID for conflict detection |
| `start_branch` | string | No | Base branch to start from |

**Action `upload`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | string | Yes | Base64 encoded file content |
| `filename` | string | Yes | Name of the file |

#### Example

```json
{
  "action": "single",
  "project_id": "my-group/my-project",
  "file_path": "path/to/file.txt",
  "content": "File content here",
  "commit_message": "example_commit_message",
  "branch": "main"
}
```

---

## Wiki

### browse_wiki

BROWSE wiki pages. Actions: "list" shows all wiki pages in project/group, "get" retrieves single wiki page content by slug.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List all wiki pages |
| `get` | Get a single wiki page by slug |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | Yes | Namespace path (group or project) |

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | Yes | URL-encoded slug of the wiki page |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |
| `with_content` | boolean | No | Include content of the wiki pages |

#### Example

```json
{
  "action": "list",
  "namespace": "my-group/my-project"
}
```

---

### manage_wiki

MANAGE wiki pages. Actions: "create" adds new wiki page, "update" modifies existing page, "delete" removes wiki page permanently.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new wiki page |
| `update` | Update an existing wiki page |
| `delete` | Delete a wiki page |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | Yes | Namespace path (group or project) |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Content of the wiki page |
| `title` | string | Yes | Title of the wiki page |
| `format` | string | No | Content format (markdown, rdoc, asciidoc, org). Defaults to markdown. |

**Action `delete`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | Yes | URL-encoded slug of the wiki page |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | Yes | URL-encoded slug of the wiki page |
| `content` | string | No | New content of the wiki page |
| `format` | string | No | Content format (markdown, rdoc, asciidoc, org). Defaults to markdown. |
| `title` | string | No | New title of the wiki page |

#### Example

```json
{
  "action": "create",
  "namespace": "my-group/my-project",
  "title": "Example title",
  "content": "File content here"
}
```

---

## Snippets

### browse_snippets

BROWSE GitLab code snippets. Actions: "list" shows snippets by scope (personal/project/public) with filtering, "get" retrieves single snippet metadata or raw content. Snippets are reusable code blocks, configs, or text with versioning support.

#### Actions

| Action | Description |
|--------|-------------|
| `list` | List snippets with filtering by scope and visibility |
| `get` | Get single snippet details or raw content |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | No | Project ID or URL-encoded path. Required for project snippets, leave empty for personal snippets |

**Action `get`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The ID of the snippet to retrieve |
| `raw` | boolean | Yes | Return raw content of snippet files instead of metadata |

**Action `list`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scope` | string | Yes | Scope of snippets: "personal" for current user, "project" for project-specific (requires projectId), "public" for all public snippets |
| `created_after` | string | No | Return snippets created after this date (ISO 8601). Example: '2024-01-01T00:00:00Z' |
| `created_before` | string | No | Return snippets created before this date (ISO 8601). Example: '2024-12-31T23:59:59Z' |
| `page` | number | No | Page number |
| `per_page` | number | No | Number of items per page |
| `visibility` | string | No | Filter by visibility: private (author only), internal (authenticated users), public (everyone) |

#### Example

```json
{
  "action": "list",
  "scope": "personal"
}
```

---

### manage_snippet

MANAGE GitLab snippets. Actions: "create" creates new snippet with multiple files and visibility control, "update" modifies title/description/visibility/files (supports file create/update/delete/move), "delete" permanently removes snippet. Supports personal and project snippets.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new snippet with one or more files |
| `update` | Update an existing snippet metadata or files |
| `delete` | Permanently delete a snippet |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | No | Project ID or URL-encoded path to create a project snippet. Leave empty for personal snippet |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `files` | object[] | Yes | Array of files to include. At least one file required. Each needs file_path and content |
| `title` | string | Yes | The title of the snippet. Displayed in snippet list and as page title. Max 255 chars |
| `visibility` | string | Yes | Visibility: 'private' (author only), 'internal' (authenticated users), 'public' (everyone). Defaults to 'private' |
| `description` | string | No | Optional description explaining the snippet purpose. Supports markdown |

**Action `delete`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The ID of the snippet to delete. This operation cannot be undone |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The ID of the snippet to update |
| `description` | string | No | Update the snippet description. Supports markdown |
| `files` | object[] | No | Array of file operations. Each file must specify 'action': create/update/delete/move. Move requires previous_path |
| `title` | string | No | Update the snippet title. Max 255 chars |
| `visibility` | string | No | Update the visibility level |

#### Example

```json
{
  "action": "create",
  "title": "Example title",
  "visibility": "private",
  "files": []
}
```

---

## Webhooks

### list_webhooks [tier: Free]

List all webhooks configured for a project or group. Use to discover existing integrations, audit webhook configurations, debug delivery issues, or understand event subscriptions. Shows webhook URLs, enabled event types, SSL settings, and delivery status. Group webhooks (Premium tier) are inherited by all child projects.

#### Example

```json
{
  "scope": "example_scope",
  "projectId": "my-group/my-project",
  "per_page": 10
}
```

---

### manage_webhook [tier: Free]

Manage webhooks with full CRUD operations plus testing. Actions: 'create' (add new webhook with URL and event types), 'read' (get webhook details - SAFE FOR READ-ONLY MODE), 'update' (modify URL, events, or settings), 'delete' (remove webhook), 'test' (trigger test delivery for specific event type). Use for setting up CI/CD automation, configuring notifications, integrating external systems, debugging deliveries, or managing event subscriptions. Test action sends actual HTTP request to configured URL. Group webhooks require Premium tier. NOTE: In read-only mode, only 'read' action is allowed; write operations are blocked at handler level.

#### Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new item |
| `read` | Read item details |
| `update` | Update an existing item |
| `delete` | Delete an item |
| `test` | Test a webhook |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scope` | string | Yes | Scope of webhook (project or group) |
| `groupId` | string | No | Group ID or path (required if scope=group) |
| `projectId` | string | No | Project ID or path (required if scope=project) |

**Action `create`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Webhook URL (required) |
| `confidential_issues_events` | boolean | No | Enable confidential issue events |
| `confidential_note_events` | boolean | No | Enable confidential note events |
| `deployment_events` | boolean | No | Enable deployment events |
| `description` | string | No | Webhook description (GitLab 16.11+) |
| `emoji_events` | boolean | No | Enable emoji events |
| `enable_ssl_verification` | boolean | No | Enable SSL certificate verification |
| `feature_flag_events` | boolean | No | Enable feature flag events |
| `issues_events` | boolean | No | Enable issue events |
| `job_events` | boolean | No | Enable job/build events |
| `member_events` | boolean | No | Enable member events |
| `merge_requests_events` | boolean | No | Enable merge request events |
| `name` | string | No | Human-readable webhook name (GitLab 16.11+) |
| `note_events` | boolean | No | Enable note/comment events |
| `pipeline_events` | boolean | No | Enable pipeline events |
| `project_events` | boolean | No | Enable project events (group webhooks only) |
| `push_events` | boolean | No | Enable push events |
| `push_events_branch_filter` | string | No | Branch filter for push events (wildcard supported) |
| `releases_events` | boolean | No | Enable release events |
| `resource_access_token_events` | boolean | No | Enable resource access token events |
| `subgroup_events` | boolean | No | Enable subgroup events (group webhooks only) |
| `tag_push_events` | boolean | No | Enable tag push events |
| `token` | string | No | Secret token for webhook validation |
| `wiki_page_events` | boolean | No | Enable wiki page events |

**Action `delete`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hookId` | string | Yes | Webhook ID (required) |

**Action `read`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hookId` | string | Yes | Webhook ID (required) |

**Action `test`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hookId` | string | Yes | Webhook ID (required) |
| `trigger` | string | Yes | Event type to test (required) |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hookId` | string | Yes | Webhook ID (required) |
| `confidential_issues_events` | boolean | No | Enable confidential issue events |
| `confidential_note_events` | boolean | No | Enable confidential note events |
| `deployment_events` | boolean | No | Enable deployment events |
| `description` | string | No | Webhook description (GitLab 16.11+) |
| `emoji_events` | boolean | No | Enable emoji events |
| `enable_ssl_verification` | boolean | No | Enable SSL certificate verification |
| `feature_flag_events` | boolean | No | Enable feature flag events |
| `issues_events` | boolean | No | Enable issue events |
| `job_events` | boolean | No | Enable job/build events |
| `member_events` | boolean | No | Enable member events |
| `merge_requests_events` | boolean | No | Enable merge request events |
| `name` | string | No | Human-readable webhook name (GitLab 16.11+) |
| `note_events` | boolean | No | Enable note/comment events |
| `pipeline_events` | boolean | No | Enable pipeline events |
| `project_events` | boolean | No | Enable project events (group webhooks only) |
| `push_events` | boolean | No | Enable push events |
| `push_events_branch_filter` | string | No | Branch filter for push events (wildcard supported) |
| `releases_events` | boolean | No | Enable release events |
| `resource_access_token_events` | boolean | No | Enable resource access token events |
| `subgroup_events` | boolean | No | Enable subgroup events (group webhooks only) |
| `tag_push_events` | boolean | No | Enable tag push events |
| `token` | string | No | Secret token for webhook validation |
| `url` | string | No | Webhook URL |
| `wiki_page_events` | boolean | No | Enable wiki page events |

#### Example

```json
{
  "action": "create",
  "scope": "project",
  "url": "https://example.com/webhook"
}
```

---

## Integrations

### list_integrations

LIST all active integrations for a project. Returns integrations like Slack, Jira, Discord, Microsoft Teams, Jenkins, etc. Only shows enabled/configured integrations.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project ID or URL-encoded path |
| `page` | integer | No | Page number |
| `per_page` | integer | No | Number of items per page |

#### Example

```json
{
  "project_id": "my-group/my-project"
}
```

---

### manage_integration

MANAGE project integrations. Actions: "get" retrieves integration settings (read-only), "update" modifies or enables integration with specific config, "disable" removes integration. Supports 50+ integrations: Slack, Jira, Discord, Teams, Jenkins, etc. Note: gitlab-slack-application cannot be created via API - requires OAuth install from UI.

#### Actions

| Action | Description |
|--------|-------------|
| `get` | Get integration settings (read-only) |
| `update` | Update or enable integration with specific config |
| `disable` | Disable and remove integration |

#### Parameters

**Common** (all actions):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `integration` | string | Yes | Integration type slug (e.g., slack, jira, discord). Note: gitlab-slack-application cannot be created via API - it requires OAuth installation from GitLab UI. |
| `project_id` | string | Yes | Project ID or URL-encoded path |

**Action `update`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `active` | boolean | No | Enable or disable the integration without full configuration |
| `confidential_issues_events` | boolean | No | Trigger integration on confidential issue events |
| `config` | object | No | Integration-specific configuration parameters. Pass as key-value pairs. Examples: webhook_url, token, channel, etc. See GitLab API documentation for integration-specific fields. |
| `deployment_events` | boolean | No | Trigger integration on deployment events |
| `issues_events` | boolean | No | Trigger integration on issue events |
| `job_events` | boolean | No | Trigger integration on job events |
| `merge_requests_events` | boolean | No | Trigger integration on merge request events |
| `note_events` | boolean | No | Trigger integration on note events |
| `pipeline_events` | boolean | No | Trigger integration on pipeline events |
| `push_events` | boolean | No | Trigger integration on push events |
| `releases_events` | boolean | No | Trigger integration on release events |
| `tag_push_events` | boolean | No | Trigger integration on tag push events |
| `vulnerability_events` | boolean | No | Trigger integration on vulnerability events |
| `wiki_page_events` | boolean | No | Trigger integration on wiki page events |

#### Example

```json
{
  "action": "get",
  "project_id": "my-group/my-project",
  "integration": "slack"
}
```

---

## Todos

### list_todos

TASK QUEUE: View your GitLab todos (notifications requiring action). Todos are auto-created when you're assigned to issues/MRs, @mentioned, requested as reviewer, or CI pipelines fail. Filter by state (pending/done), action type (assigned, mentioned, review_requested), or target type (Issue, MergeRequest).

#### Actions

| Action | Description |
|--------|-------------|
| `assigned` | Perform assigned operation |
| `mentioned` | Perform mentioned operation |
| `build_failed` | Perform build_failed operation |
| `marked` | Perform marked operation |
| `approval_required` | Perform approval_required operation |
| `unmergeable` | Perform unmergeable operation |
| `directly_addressed` | Perform directly_addressed operation |
| `merge_train_removed` | Perform merge_train_removed operation |
| `review_requested` | Perform review_requested operation |
| `member_access_requested` | Perform member_access_requested operation |
| `review_submitted` | Perform review_submitted operation |

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `per_page` | integer | Yes | Number of items per page (max 100) |
| `action` | string | No | Filter by action type. |
| `author_id` | number | No | Filter by author ID. |
| `group_id` | number | No | Filter by group ID. |
| `page` | integer | No | Page number |
| `project_id` | number | No | Filter by project ID. |
| `state` | string | No | Filter todos by state: pending=active, done=completed. |
| `type` | string | No | Filter by target type. |

#### Example

```json
{
  "action": "assigned",
  "per_page": 10
}
```

---

### manage_todos

TODO ACTIONS: Manage your GitLab todo items. Use 'mark_done' with id to complete a single todo (returns the updated todo object). Use 'mark_all_done' to clear your entire todo queue (returns success status). Use 'restore' with id to undo a completed todo (returns the restored todo object).

#### Actions

| Action | Description |
|--------|-------------|
| `mark_done` | Mark a single todo as done |
| `mark_all_done` | Mark all todos as done (clears entire queue) |
| `restore` | Restore a completed todo to pending state |

#### Parameters

**Action `mark_done`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Todo ID to mark as done |

**Action `restore`**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Todo ID to restore |

#### Example

```json
{
  "action": "mark_done",
  "id": "123"
}
```

---

[20:51:08.070] [32mINFO[39m (gitlab-mcp): [36mUsing in-memory session storage (sessions will be lost on restart)[39m
