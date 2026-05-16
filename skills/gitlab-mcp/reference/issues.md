# Issue Management

## Create

```
create_issue
  project_id: "my-group/my-project"
  title: "Login page returns 500"
  description: "Steps to reproduce..."
  labels: "bug,critical"
  assignee_ids: [123]
  milestone_id: 5
```

## Read

```
get_issue         -> single issue details
list_issues       -> project issues (default: created by current user)
  scope: "all"    -> list ALL issues (not just current user's)
  state: "opened" -> filter by state
  labels: "bug"   -> filter by labels
my_issues         -> issues assigned to current user across all projects
```

**Important**: `list_issues` defaults to showing only issues created by the current user.
Pass `scope: "all"` to see all project issues.

## Update

```
update_issue
  project_id: "my-group/my-project"
  issue_iid: 10
  state_event: "close"    # or "reopen"
  labels: "bug,resolved"
  assignee_ids: [456]
```

### Patch-based description update (token-efficient)

```
update_issue_description_patch
  project_id: "my-group/my-project"
  issue_iid: 10
  patch_type: "search_replace"  # or "unified_diff"
  patch: |
    <<<<<<< SEARCH
    Status: In progress
    =======
    Status: Ready for review
    >>>>>>> REPLACE
  dry_run: false
  create_note: true
```

Applies a small patch to the issue description without sending the full text.
Reduces token usage for AI agents editing long descriptions.

**Search/Replace format**:
```
<<<<<<< SEARCH
text to find
=======
replacement text
>>>>>>> REPLACE
```

**Options**:
- `dry_run: true` — preview changes without updating
- `create_note: true` — add a comment summarizing the change after update
- `allow_multiple: true` — allow multiple matches to all be replaced (search_replace only)

**Error handling**:
- Search text not found → fails with clear message
- Multiple matches (without `allow_multiple`) → fails with count
- Patch results in identical description → fails (no-op)
- Unified diff doesn't match → fails

## Delete

```
delete_issue   -> permanently delete (destructive, cannot be undone)
```

## Issue Links

Link related issues:

```
create_issue_link
  project_id: "my-group/my-project"
  issue_iid: 10
  target_project_id: "my-group/other-project"
  target_issue_iid: 20
  link_type: "relates_to"  # or "blocks", "is_blocked_by"
```

```
list_issue_links   -> list all linked issues
get_issue_link     -> get specific link details
delete_issue_link  -> remove a link
```

## Discussions & Notes

Add comments:

```
create_issue_note
  project_id: "my-group/my-project"
  issue_iid: 10
  body: "Confirmed, this is a regression"
  discussion_id: "abc123"   # optional: reply to existing thread
```

```
update_issue_note         -> edit a comment
list_issue_discussions    -> list all discussion threads
```

### Emoji reactions

```
list_issue_emoji_reactions       -> list reactions on an issue
create_issue_emoji_reaction      -> add reaction to an issue
delete_issue_emoji_reaction      -> remove reaction from an issue
list_issue_note_emoji_reactions  -> list reactions on an issue note or thread reply
create_issue_note_emoji_reaction -> add reaction to an issue note or thread reply
delete_issue_note_emoji_reaction -> remove reaction from an issue note or thread reply
```

Generic note creation (works for both issues and MRs):

```
create_note
  project_id: "my-group/my-project"
  noteable_type: "Issue"    # or "MergeRequest"
  noteable_iid: 10
  body: "Note content"
```
