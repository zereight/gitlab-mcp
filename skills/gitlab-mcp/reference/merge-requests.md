# Merge Request Workflow

## Create

```
create_merge_request
  project_id: "my-group/my-project"
  title: "Add user authentication"
  source_branch: "feature/auth"
  target_branch: "main"
  description: "Implements OAuth2 login flow"
  assignee_id: 123
  labels: "feature,auth"
```

## Read & Track

```
get_merge_request           -> full MR details (by IID or branch name)
list_merge_requests         -> list with filters (state, labels, author, etc.)
  - without project_id: current user's MRs across all projects
  - with project_id: MRs in that project
get_merge_request_conflicts -> check for merge conflicts
```

## Update

```
update_merge_request
  project_id: "my-group/my-project"
  mergeRequestIid: 42
  title: "Updated title"
  state_event: "close"  # or "reopen"
  assignee_ids: [123, 456]
  labels: "feature,reviewed"
```

## Review & Approve

See [code-review.md](code-review.md) for the full diff review workflow.

```
approve_merge_request       -> approve
unapprove_merge_request     -> retract approval
get_merge_request_approval_state -> check who approved, rules status
```

## Merge

```
merge_merge_request
  project_id: "my-group/my-project"
  mergeRequestIid: 42
  should_remove_source_branch: true
  squash: true
  merge_when_pipeline_succeeds: true
```

**Warning**: `merge_merge_request` is destructive - cannot be undone.

## Discussion Management

### Threads (inline code comments)

```
create_merge_request_thread     -> new thread on a diff line
resolve_merge_request_thread    -> mark thread resolved
```

### Notes (general comments)

```
create_merge_request_note       -> add comment
get_merge_request_notes         -> list all comments
update_merge_request_note       -> edit comment
delete_merge_request_note       -> remove comment
```

### Discussion notes (replies in threads)

```
mr_discussions                         -> list all discussions
create_merge_request_discussion_note   -> reply to thread
update_merge_request_discussion_note   -> edit reply
delete_merge_request_discussion_note   -> remove reply
```

### Draft notes (pending review)

```
create_draft_note          -> create pending comment
list_draft_notes           -> see all drafts
update_draft_note          -> edit before publishing
delete_draft_note          -> discard
publish_draft_note         -> publish single draft
bulk_publish_draft_notes   -> publish all drafts at once
```

## Branch Comparison

Compare without an existing MR:

```
get_branch_diffs
  project_id: "my-group/my-project"
  from: "main"
  to: "feature/auth"
```
