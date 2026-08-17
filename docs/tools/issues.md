# Issues

Issue CRUD, links, discussions and notes, todos, and emoji reactions.

## Tools in this group

- [`create_issue`](#create_issue) — ✏️ Writes
- [`list_issues`](#list_issues) — 📖 Read-only
- [`my_issues`](#my_issues) — 📖 Read-only
- [`get_issue`](#get_issue) — 📖 Read-only
- [`update_issue`](#update_issue) — ✏️ Writes
- [`update_issue_description_patch`](#update_issue_description_patch) — ✏️ Writes
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

Create a new issue. Use this to open a new issue; use `update_issue` for an existing issue and `create_issue_note` to add discussion without changing issue fields. The operation creates remote project data, requires issue creation permission, and returns the new issue or a validation, permission, or duplicate-related error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `title` | string | ✓ | Issue title |
| `description` | string |  | Issue description |
| `assignee_ids` | array<number> |  | Array of user IDs to assign |
| `labels` | array<string> |  | Array of label names |
| `milestone_id` | string |  | Milestone ID to assign |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | The type of issue. One of issue, incident, test_case or task. |
| `weight` | number |  | Weight of the issue (numeric, typically hours of work) |

### `list_issues`

*📖 Read-only*

List issues (default: created by current user; use scope='all' for all). Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional - if not provided, lists issues across all accessible projects) |
| `assignee_id` | string |  | Return issues assigned to the given user ID (user id, none, or any). Mutually exclusive with assignee_username. |
| `assignee_username` | array<string> |  | Return issues assigned to the given username. Mutually exclusive with assignee_id. |
| `author_id` | string |  | Return issues created by the given user ID. Mutually exclusive with author_username. |
| `author_username` | string |  | Return issues created by the given username. Mutually exclusive with author_id. |
| `confidential` | boolean |  | Filter confidential or public issues |
| `created_after` | string |  | Return issues created after the given time |
| `created_before` | string |  | Return issues created before the given time |
| `due_date` | string |  | Return issues that have the due date |
| `labels` | array<string> |  | Array of label names |
| `milestone` | string |  | Milestone title |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | Filter to a given type of issue. One of issue, incident, test_case or task |
| `iteration_id` | string |  | Return issues assigned to the given iteration ID. None returns issues that do not belong to an iteration. Any returns issues that belong to an iteration.  |
| `scope` | enum (`created_by_me` \| `assigned_to_me` \| `all`) |  | Return issues from a specific scope |
| `search` | string |  | Search for specific terms |
| `state` | enum (`opened` \| `closed` \| `all`) |  | Return issues with a specific state |
| `updated_after` | string |  | Return issues updated after the given time |
| `updated_before` | string |  | Return issues updated before the given time |
| `with_labels_details` | boolean |  | Return more details for each label |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `my_issues`

*📖 Read-only*

List issues assigned to the authenticated user. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Get details of a specific issue. Returns a slim milestone by default; set full_response=true for the complete milestone object. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `full_response` | boolean |  | If true, return the complete issue object including the full milestone description. Default returns a slim milestone (id, iid, title, state, web_url) to reduce token usage. |

### `update_issue`

*✏️ Writes*

Update an issue. Returns a slim confirmation by default; set full_response=true for the complete updated issue object. Use this to change fields on an existing issue; use `update_issue_description_patch` for a targeted description edit that avoids sending the full body, and use `create_issue_note` for discussion. The operation mutates issue state, requires issue-edit permission, and returns the updated issue or a validation/permission/conflict error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `title` | string |  | The title of the issue |
| `description` | string |  | The description of the issue |
| `assignee_ids` | array<number> |  | Array of user IDs to assign issue to |
| `confidential` | boolean |  | Set the issue to be confidential |
| `discussion_locked` | boolean |  | Flag to lock discussions |
| `due_date` | string |  | Date the issue is due (YYYY-MM-DD) |
| `labels` | array<string> |  | Array of label names |
| `milestone_id` | string |  | Milestone ID to assign |
| `state_event` | enum (`close` \| `reopen`) |  | Update issue state (close/reopen) |
| `weight` | number |  | Weight of the issue (numeric, typically hours of work) |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | The type of issue. One of issue, incident, test_case or task. |
| `full_response` | boolean |  | If true, return the complete updated issue object. Default returns a slim confirmation (iid, title, state, web_url, updated_at) to reduce token usage. |

### `update_issue_description_patch`

*✏️ Writes*

Apply a patch (search/replace or unified diff) to an issue description. Reduces token usage by allowing small changes without sending the full description. Supports dry_run to preview changes and create_note to summarize updates. Use this for a targeted search/replace or unified-diff change to an issue description; use `dry_run` before applying an uncertain patch and `create_note` when an audit summary is wanted. It changes the issue description when not dry-running, requires issue-edit permission, and returns the patch result or a mismatch/validation/permission error.

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

### `delete_issue`

*✏️ Writes*

Delete an issue. Use this only after confirming the issue and intended permanent removal; use `update_issue` to close or edit an issue without deleting it. The operation permanently removes issue data, requires delete permission, and returns the deletion result or a missing-resource, permission, or policy error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |

### `list_todos`

*📖 Read-only*

List GitLab to-do items for the current user. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `action` | enum (`assigned` \| `mentioned` \| `build_failed` \| `marked` \| `approval_required` \| `unmergeable` \| `directly_addressed` \| `merge_train_removed` \| `member_access_requested`) |  | Filter by to-do action |
| `author_id` | number |  | Filter by author ID |
| `project_id` | number |  | Filter by project ID |
| `group_id` | number |  | Filter by group ID |
| `state` | enum (`pending` \| `done`) |  | Filter by to-do state |
| `type` | enum (`Issue` \| `MergeRequest` \| `Commit` \| `Epic` \| `DesignManagement::Design` \| `AlertManagement::Alert` \| `Project` \| `Namespace` \| `Vulnerability` \| `WikiPage::Meta`) |  | Filter by to-do target type |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `mark_todo_done`

*✏️ Writes*

Mark a GitLab to-do item as done. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `id` | number | ✓ | The ID of the to-do item |

### `mark_all_todos_done`

*✏️ Writes*

Mark all pending GitLab to-do items as done for the current user. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

_No parameters._

### `create_issue_note`

*✏️ Writes*

Add a note to an issue, optionally replying to a discussion thread. Use this to add a note to an existing issue, optionally as a reply to a discussion; use `update_issue` for issue fields and `create_note` only when the generic endpoint is required. The operation creates remote discussion content, requires note permission, and returns the note or a missing-issue/thread/permission error.

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

Modify an existing issue thread note. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or complete URL-encoded path to project |
| `issue_iid` | string |  | The IID of an issue |
| `discussion_id` | string |  | The ID of a thread |
| `note_id` | string |  | The ID of a thread note |
| `body` | string |  | The content of the note or reply |
| `resolved` | boolean |  | Resolve or unresolve the note |

### `list_issue_links`

*📖 Read-only*

List all issue links for a specific issue. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of a project's issue |

### `list_issue_discussions`

*📖 Read-only*

List discussions for an issue. Use this to inspect threaded discussions for an issue; use `list_issues` for issue records and `get_issue` for one issue's fields. It is read-only and returns discussion items, while invalid identifiers, missing issues, and permission failures are reported as errors.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_issue_link`

*📖 Read-only*

Get a specific issue link. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of a project's issue |
| `issue_link_id` | string | ✓ | ID of an issue relationship |

### `create_issue_link`

*✏️ Writes*

Create an issue link between two issues. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Delete an issue link. Use this to remove an existing relationship between two issues; use `list_issue_links` or `get_issue_link` to verify the link first. The operation changes issue relationships, requires issue-edit permission, and returns the result or an error when the link is missing or access is denied.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of a project's issue |
| `issue_link_id` | string | ✓ | The ID of an issue relationship |

### `create_note`

*✏️ Writes*

Create a new note (comment) to an issue or merge request. Use this for a top-level comment on an issue or merge request when no typed discussion operation is needed; use `create_merge_request_thread` or `create_issue_note` for threaded replies. The operation creates remote discussion content, requires note permission, and returns the created note or a target/permission/validation error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or namespace/project_path |
| `noteable_type` | enum (`issue` \| `merge_request`) | ✓ | Type of noteable (issue or merge_request) |
| `noteable_iid` | string | ✓ | IID of the issue or merge request |
| `body` | string | ✓ | Note content |

### `list_issue_emoji_reactions`

*📖 Read-only*

List all emoji reactions on an issue. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |

### `list_issue_note_emoji_reactions`

*📖 Read-only*

List all emoji reactions on an issue note. Pass discussion_id for discussion thread replies. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `note_id` | string | ✓ | The ID of a note (comment or thread reply) |
| `discussion_id` | string |  | The ID of a discussion thread. Required for notes that are discussion replies; omit for top-level notes. |

### `create_issue_emoji_reaction`

*✏️ Writes*

Add an emoji reaction to an issue (e.g. thumbsup, rocket, eyes). Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `delete_issue_emoji_reaction`

*✏️ Writes*

Remove an emoji reaction from an issue. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `award_id` | string | ✓ | The ID of the emoji reaction to delete |

### `create_issue_note_emoji_reaction`

*✏️ Writes*

Add an emoji reaction to an issue note. Pass discussion_id for discussion thread replies. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Remove an emoji reaction from an issue note. Pass discussion_id for discussion thread replies. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `note_id` | string | ✓ | The ID of a note (comment or thread reply) |
| `discussion_id` | string |  | The ID of a discussion thread. Required for notes that are discussion replies; omit for top-level notes. |
| `award_id` | string | ✓ | The ID of the emoji reaction to delete |
