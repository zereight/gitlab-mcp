# Code Review Workflow

## Overview

Efficient code review uses a 2-step approach: list files first, then fetch diffs in batches.
This avoids loading the entire diff payload at once.

## Step 1: List Changed Files

```
list_merge_request_changed_files
  project_id: "my-group/my-project"
  mergeRequestIid: 42
```

Returns file paths with metadata:

- `new_path`, `old_path` - file locations
- `new_file`, `deleted_file`, `renamed_file` - change type flags

Use `excluded_file_patterns` to skip generated files:

```
excluded_file_patterns: ["*.lock", "*.min.js", "dist/**"]
```

## Step 2: Batch Diff Retrieval

```
get_merge_request_file_diff
  project_id: "my-group/my-project"
  mergeRequestIid: 42
  file_paths: ["src/api.ts", "src/utils.ts", "src/types.ts"]
```

**Batch 3-5 files per call** for optimal balance between API calls and response size.
For large MRs (20+ files), prioritize reviewing:

1. Source code files first (skip configs, lockfiles)
2. New files before modified files
3. Core logic before tests

## Step 3: Leave Comments

### Option A: Thread comments (visible immediately)

```
create_merge_request_thread
  project_id: "my-group/my-project"
  mergeRequestIid: 42
  body: "Consider using a const here"
  position:
    new_path: "src/api.ts"
    new_line: 15
```

Reply to existing threads:

```
create_merge_request_discussion_note
  project_id: "my-group/my-project"
  mergeRequestIid: 42
  discussion_id: "abc123"
  body: "Good point, updated"
```

### Option B: Draft notes (batch review)

Create drafts, then publish all at once:

```
create_draft_note -> create_draft_note -> create_draft_note
  ... repeat for each comment ...
bulk_publish_draft_notes
  project_id: "my-group/my-project"
  mergeRequestIid: 42
```

This mimics GitHub's "pending review" pattern - all comments appear simultaneously.

## Step 4: Resolve Threads

```
resolve_merge_request_thread
  project_id: "my-group/my-project"
  mergeRequestIid: 42
  discussion_id: "abc123"
  resolved: true
```

## Alternative: Full Diff Methods

For small MRs where batching is unnecessary:

- `get_merge_request_diffs` - all diffs at once (can be large)
- `list_merge_request_diffs` - paginated diffs

For comparing arbitrary refs:

- `get_branch_diffs` - compare two branches or commits
- `get_commit_diff` - single commit changes

## Version Comparison

Track review progress across force-pushes:

```
list_merge_request_versions  ->  get versions list
get_merge_request_version    ->  get specific version details
```
