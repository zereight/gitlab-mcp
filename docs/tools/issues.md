# Issues

Issue CRUD, links, discussions and notes, todos, and emoji reactions.

!!! note "Feature toggle"
    Opt-in. Prefer `discover_tools` at runtime, or persist with `GITLAB_TOOLSETS=core,issues`. An explicit GITLAB_TOOLSETS list replaces core; include core to keep the default set. If you already set `GITLAB_TOOLSETS`, append `issues` to your existing list instead of replacing it (leave `GITLAB_TOOLSETS=all` unchanged). Avoid `GITLAB_TOOLSETS=all` (loads ~all schemas into tools/list). 8 of these tools (`create_issue`, `list_issues`, `my_issues`, `get_issue`, `update_issue`, `update_issue_description_patch`, `create_issue_note`, `list_issue_discussions`) are already enabled by default via `core`; the toggle applies to the rest. With `GITLAB_TOOL_PROFILE=slim` and `GITLAB_TOOLSETS` unset, `discover_tools` skips 6 of these tools (`list_issue_emoji_reactions`, `list_issue_note_emoji_reactions`, `create_issue_emoji_reaction`, `delete_issue_emoji_reaction`, `create_issue_note_emoji_reaction`, `delete_issue_note_emoji_reaction`); add a tool name to `GITLAB_TOOLS` to expose it. Setting `GITLAB_TOOLSETS` disables the slim profile.

## Tools in this group

- [`create_issue`](#create_issue) — ✏️ Writes
- [`list_issues`](#list_issues) — 📖 Read-only
- [`my_issues`](#my_issues) — 📖 Read-only
- [`get_issue`](#get_issue) — 📖 Read-only
- [`update_issue`](#update_issue) — ✏️ Writes
- [`update_issue_description_patch`](#update_issue_description_patch) — ✏️ Writes
- [`reorder_issue`](#reorder_issue) — ✏️ Writes
- [`delete_issue`](#delete_issue) — ✏️ Writes
- [`list_todos`](#list_todos) — 📖 Read-only
- [`mark_todo_done`](#mark_todo_done) — ✏️ Writes
- [`mark_all_todos_done`](#mark_all_todos_done) — ✏️ Writes
- [`create_issue_note`](#create_issue_note) — ✏️ Writes
- [`update_issue_note`](#update_issue_note) — ✏️ Writes
- [`list_issue_links`](#list_issue_links) — 📖 Read-only
- [`list_issue_discussions`](#list_issue_discussions) — 📖 Read-only
- [`get_issue_link`](#get_issue_link) — 📖 Read-only
- [`create_issue_link`](#create_issue_link) — ✏️ Writes
- [`delete_issue_link`](#delete_issue_link) — ✏️ Writes
- [`create_note`](#create_note) — ✏️ Writes
- [`list_issue_emoji_reactions`](#list_issue_emoji_reactions) — 📖 Read-only
- [`list_issue_note_emoji_reactions`](#list_issue_note_emoji_reactions) — 📖 Read-only
- [`create_issue_emoji_reaction`](#create_issue_emoji_reaction) — ✏️ Writes
- [`delete_issue_emoji_reaction`](#delete_issue_emoji_reaction) — ✏️ Writes
- [`create_issue_note_emoji_reaction`](#create_issue_note_emoji_reaction) — ✏️ Writes
- [`delete_issue_note_emoji_reaction`](#delete_issue_note_emoji_reaction) — ✏️ Writes

---

### `create_issue`

*✏️ Writes*

Create a new issue. Open a new issue. Use `update_issue` for an existing issue and `create_issue_note` for discussion.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `title` | string | ✓ | Issue title |
| `description` | string |  | Issue description |
| `assignee_ids` | array<number> |  | Assignee user IDs |
| `labels` | array<string> |  | Label names |
| `milestone_id` | string |  | Milestone ID |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | issue, incident, test_case, or task |
| `weight` | number |  | Issue weight |

### `list_issues`

*📖 Read-only*

List issues (default: created by current user; use scope='all' for all). Use this for issue management. Optional `project_id`. Use `get_issue` when the iid is known and `my_issues` for assignments.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Omit to list issues across accessible projects. |
| `assignee_id` | string |  | User ID, none, or any. Mutually exclusive with assignee_username. |
| `assignee_username` | array<string> |  | Username. Mutually exclusive with assignee_id. |
| `author_id` | string |  | Author user ID. Mutually exclusive with author_username. |
| `author_username` | string |  | Author username. Mutually exclusive with author_id. |
| `confidential` | boolean |  | Confidential or public |
| `created_after` | string |  | Created after |
| `created_before` | string |  | Created before |
| `due_date` | string |  | Due date |
| `labels` | array<string> |  | Label names |
| `milestone` | string |  | Milestone title |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | issue, incident, test_case, or task |
| `iteration_id` | string |  | Iteration ID, none (no iteration), or any (has an iteration). |
| `scope` | enum (`created_by_me` \| `assigned_to_me` \| `all`) |  | Issue scope |
| `search` | string |  | Search terms |
| `state` | enum (`opened` \| `closed` \| `all`) |  | Issue state |
| `updated_after` | string |  | Updated after |
| `updated_before` | string |  | Updated before |
| `with_labels_details` | boolean |  | Include label details |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `my_issues`

*📖 Read-only*

List issues assigned to the authenticated user. Use this for issue management. Use `list_issues` for project-wide listing and `get_issue` for one issue. Requires classic read_user or fine-grained User:Read.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional to search across all accessible projects) |
| `state` | enum (`opened` \| `closed` \| `all`) |  | Return issues with a specific state (default: opened) |
| `labels` | array<string> |  | Array of label names to filter by |
| `milestone` | string |  | Milestone title to filter by |
| `search` | string |  | Search for specific terms in title and description |
| `created_after` | string |  | Return issues created after the given time (ISO 8601) |
| `created_before` | string |  | Return issues created before the given time (ISO 8601) |
| `updated_after` | string |  | Return issues updated after the given time (ISO 8601) |
| `updated_before` | string |  | Return issues updated before the given time (ISO 8601) |
| `per_page` | number |  | Number of items per page (default: 20, max: 100) |
| `page` | number |  | Page number for pagination (default: 1) |

### `get_issue`

*📖 Read-only*

Get one issue. Slim nested milestone by default; full_response=true for the complete milestone. Use this for issue management. Use `list_issues` or `my_issues` to discover issues first.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | Issue IID |
| `full_response` | boolean |  | If true, include the complete milestone (including description). Default is slim (id, iid, title, state, web_url). |

### `update_issue`

*✏️ Writes*

Update an issue. Slim confirmation by default; full_response=true for the complete object. Change fields on an existing issue. Use `update_issue_description_patch` for a targeted description edit and `create_issue_note` for discussion.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | Issue IID |
| `title` | string |  | Issue title |
| `description` | string |  | Issue description |
| `assignee_ids` | array<number> |  | Assignee user IDs |
| `confidential` | boolean |  | Confidential |
| `discussion_locked` | boolean |  | Lock discussions |
| `due_date` | string |  | Due date (YYYY-MM-DD) |
| `labels` | array<string> |  | Label names |
| `milestone_id` | string |  | Milestone ID |
| `state_event` | enum (`close` \| `reopen`) |  | close or reopen |
| `weight` | number |  | Issue weight |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | issue, incident, test_case, or task |
| `full_response` | boolean |  | If true, return the complete updated issue. Default is slim (iid, title, state, web_url, updated_at). |

### `update_issue_description_patch`

*✏️ Writes*

Patch an issue description (search/replace or unified diff) without resending the full body. dry_run previews; create_note summarizes.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `patch_type` | enum (`search_replace` \| `unified_diff`) | ✓ | Type of patch format to apply |
| `patch` | string | ✓ | The patch content to apply to the issue description |
| `dry_run` | boolean |  | If true, preview changes without updating the issue |
| `create_note` | boolean |  | If true, add a note summarizing the change after update |
| `allow_multiple` | boolean |  | For search_replace: allow multiple matches to all be replaced (default: false — fail on duplicate) |

### `reorder_issue`

*✏️ Writes*

Move an issue within the manual sort order shown on issue boards. move_after_id and move_before_id take the neighbor issue's global id (the `id` field), not its iid; pass at least one. Returns the reordered issue.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `move_after_id` | integer |  | Global issue id (the `id` field, not the project-scoped `iid`) of the issue that should come after this one |
| `move_before_id` | integer |  | Global issue id (the `id` field, not the project-scoped `iid`) of the issue that should come before this one |

### `delete_issue`

*✏️ Writes*

Delete an issue. Permanently delete an issue. Use `update_issue` to close or edit without deleting.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |

### `list_todos`

*📖 Read-only*

List GitLab to-do items for the current user.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `action` | enum (`assigned` \| `mentioned` \| `build_failed` \| `marked` \| `approval_required` \| `unmergeable` \| `directly_addressed` \| `merge_train_removed` \| `member_access_requested`) |  | Filter by to-do action |
| `author_id` | number |  | Filter by author ID |
| `project_id` | number |  | Filter by project ID |
| `group_id` | number |  | Filter by group ID |
| `state` | enum (`pending` \| `done`) |  | Filter by to-do state |
| `type` | enum (`Issue` \| `MergeRequest` \| `Commit` \| `Epic` \| `DesignManagement::Design` \| `AlertManagement::Alert` \| `Project` \| `Namespace` \| `Vulnerability` \| `WikiPage::Meta`) |  | Filter by to-do target type |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `mark_todo_done`

*✏️ Writes*

Mark a GitLab to-do item as done.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `id` | number | ✓ | The ID of the to-do item |

### `mark_all_todos_done`

*✏️ Writes*

Mark all pending GitLab to-do items as done for the current user.

**Parameters**

_No parameters._

### `create_issue_note`

*✏️ Writes*

Add a note to an issue, optionally replying to a discussion thread. Add a note to an existing issue, optionally as a reply. Use `update_issue` for issue fields.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `discussion_id` | string |  | The ID of a thread. If provided, replies to that thread; otherwise creates a top-level note |
| `body` | string | ✓ | The content of the note or reply |
| `created_at` | string |  | Date the note was created at (ISO 8601 format) |

### `update_issue_note`

*✏️ Writes*

Modify an existing issue thread note. Use the create tool for new resources.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `discussion_id` | string | ✓ | The ID of a thread |
| `note_id` | string | ✓ | The ID of a thread note |
| `body` | string |  | The content of the note or reply |
| `resolved` | boolean |  | Resolve or unresolve the note |

### `list_issue_links`

*📖 Read-only*

List all issue links for a specific issue. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of a project's issue |

### `list_issue_discussions`

*📖 Read-only*

List discussions for an issue. List threaded discussions for an issue. Use `list_issues` or `get_issue` for issue records.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `get_issue_link`

*📖 Read-only*

Get a specific issue link. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of a project's issue |
| `issue_link_id` | string | ✓ | ID of an issue relationship |

### `create_issue_link`

*✏️ Writes*

Create an issue link between two issues.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of a project's issue |
| `target_project_id` | string | ✓ | The ID or URL-encoded path of a target project |
| `target_issue_iid` | string | ✓ | The internal ID of a target project's issue |
| `link_type` | enum (`relates_to` \| `blocks` \| `is_blocked_by`) |  | The type of the relation, defaults to relates_to |

### `delete_issue_link`

*✏️ Writes*

Delete an issue link. Remove a relationship between two issues. Verify first with `list_issue_links` or `get_issue_link`.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of a project's issue |
| `issue_link_id` | string | ✓ | The ID of an issue relationship |

### `create_note`

*✏️ Writes*

Create a new note (comment) to an issue or merge request. Add a top-level comment on an issue or merge request. Use `create_merge_request_thread` or `create_issue_note` for typed discussion.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or namespace/project_path |
| `noteable_type` | enum (`issue` \| `merge_request`) | ✓ | Type of noteable (issue or merge_request) |
| `noteable_iid` | string | ✓ | IID of the issue or merge request |
| `body` | string | ✓ | Note content |

### `list_issue_emoji_reactions`

*📖 Read-only*

List all emoji reactions on an issue.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |

### `list_issue_note_emoji_reactions`

*📖 Read-only*

List all emoji reactions on an issue note. Pass discussion_id for discussion thread replies.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `note_id` | string | ✓ | The ID of a note (comment or thread reply) |
| `discussion_id` | string |  | The ID of a discussion thread. Required for notes that are discussion replies; omit for top-level notes. |

### `create_issue_emoji_reaction`

*✏️ Writes*

Add an emoji reaction to an issue (e.g. thumbsup, rocket, eyes).

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `delete_issue_emoji_reaction`

*✏️ Writes*

Remove an emoji reaction from an issue. Verify the target first with a get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `award_id` | string | ✓ | The ID of the emoji reaction to delete |

### `create_issue_note_emoji_reaction`

*✏️ Writes*

Add an emoji reaction to an issue note. Pass discussion_id for discussion thread replies.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `note_id` | string | ✓ | The ID of a note (comment or thread reply) |
| `discussion_id` | string |  | The ID of a discussion thread. Required for notes that are discussion replies; omit for top-level notes. |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `delete_issue_note_emoji_reaction`

*✏️ Writes*

Remove an emoji reaction from an issue note. Pass discussion_id for discussion thread replies. Verify the target first with a get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `note_id` | string | ✓ | The ID of a note (comment or thread reply) |
| `discussion_id` | string |  | The ID of a discussion thread. Required for notes that are discussion replies; omit for top-level notes. |
| `award_id` | string | ✓ | The ID of the emoji reaction to delete |
