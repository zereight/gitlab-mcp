# Resolve Issue Thread Support

This document describes the enhanced `update_issue_note` tool that now supports resolving and unresolving issue discussion threads.

## Overview

The `update_issue_note` tool has been enhanced to support the GitLab API's thread resolution feature, allowing you to mark issue discussions as resolved or unresolved. This is particularly useful for tracking the status of feedback, questions, and action items in issue discussions.

## API Reference

- **GitLab API Documentation**: [Resolve an issue thread](https://docs.gitlab.com/api/discussions/#resolve-an-issue-thread)
- **Endpoint**: `PUT /projects/:id/issues/:issue_iid/discussions/:discussion_id/notes/:note_id`

## Usage

### Resolve an Issue Thread

To mark a discussion thread as resolved:

```json
{
  "name": "update_issue_note",
  "arguments": {
    "project_id": "mygroup/myproject",
    "issue_iid": "123",
    "discussion_id": "abc123def456",
    "note_id": "789",
    "resolved": true
  }
}
```

### Unresolve an Issue Thread

To mark a discussion thread as unresolved:

```json
{
  "name": "update_issue_note",
  "arguments": {
    "project_id": "mygroup/myproject",
    "issue_iid": "123",
    "discussion_id": "abc123def456",
    "note_id": "789",
    "resolved": false
  }
}
```

### Update Note Body (Existing Functionality)

The existing functionality to update the note body still works as before:

```json
{
  "name": "update_issue_note",
  "arguments": {
    "project_id": "mygroup/myproject",
    "issue_iid": "123",
    "discussion_id": "abc123def456",
    "note_id": "789",
    "body": "Updated note content"
  }
}
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | The ID or URL-encoded path of the project |
| `issue_iid` | string/number | Yes | The internal ID of the issue |
| `discussion_id` | string | Yes | The ID of the discussion thread |
| `note_id` | string/number | Yes | The ID of the note to update |
| `body` | string | No* | The new content of the note |
| `resolved` | boolean | No* | Whether to resolve (true) or unresolve (false) the thread |

\* At least one of `body` or `resolved` must be provided, but not both at the same time (per GitLab API requirements).

## Validation Rules

The tool enforces the following validation rules to comply with GitLab API requirements:

1. **At least one parameter**: Either `body` or `resolved` must be provided
2. **Mutually exclusive**: You cannot provide both `body` and `resolved` in the same request

### Valid Examples

✅ Resolve a thread:
```json
{ "resolved": true }
```

✅ Unresolve a thread:
```json
{ "resolved": false }
```

✅ Update note body:
```json
{ "body": "New content" }
```

### Invalid Examples

❌ No parameters:
```json
{}
```
Error: "At least one of 'body' or 'resolved' must be provided"

❌ Both parameters:
```json
{ "body": "New content", "resolved": true }
```
Error: "Only one of 'body' or 'resolved' can be provided, not both"

## Implementation Details

The implementation follows the same pattern as `update_merge_request_discussion_note` for consistency:

1. The function signature accepts optional `body` and `resolved` parameters
2. The payload is constructed conditionally based on which parameter is provided
3. Schema validation ensures API compliance

## Use Cases

### 1. Mark Resolved After Addressing Feedback

When you've addressed feedback in an issue discussion, you can mark the thread as resolved:

```json
{
  "name": "update_issue_note",
  "arguments": {
    "project_id": "team/backend",
    "issue_iid": "42",
    "discussion_id": "discussion-id",
    "note_id": "note-id",
    "resolved": true
  }
}
```

### 2. Reopen Discussion

If you need to revisit a resolved discussion:

```json
{
  "name": "update_issue_note",
  "arguments": {
    "project_id": "team/backend",
    "issue_iid": "42",
    "discussion_id": "discussion-id",
    "note_id": "note-id",
    "resolved": false
  }
}
```

### 3. Batch Resolution in Workflows

Combine with other tools to automate issue management workflows:

```javascript
// Example: Resolve all discussions in an issue that mention "LGTM"
const discussions = await listIssueDiscussions(projectId, issueIid);
for (const discussion of discussions) {
  for (const note of discussion.notes) {
    if (note.body.includes("LGTM") && !note.resolved) {
      await updateIssueNote(projectId, issueIid, discussion.id, note.id, undefined, true);
    }
  }
}
```

## Permissions

To resolve issue threads, you must have permission to update the issue. Typically, this includes:
- Issue participants
- Project members with Developer role or higher
- Issue authors
- Project maintainers and owners

## Related Tools

- `list_issue_discussions` - List all discussions in an issue
- `create_issue_note` - Add a new note to an issue discussion
- `update_merge_request_discussion_note` - Similar functionality for merge request discussions
- `resolve_merge_request_thread` - Resolve an entire merge request thread

## Changelog

- **v2.0.24** (2026-01-18): Added support for resolving issue threads via the `resolved` parameter
