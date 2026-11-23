### Added

- `update_file_patch` changes part of an existing UTF-8 file with search/replace
  blocks or a unified diff, so a client sends only the changed lines instead of
  the whole file. The server reads the file from the branch, applies the patch,
  and commits with the file's `last_commit_id`; a dry run returns the diff only.

### Fixed

- `update_issue_description_patch` (and the new `update_file_patch`) only treat
  `<<<<<<< SEARCH`, `=======` and `>>>>>>> REPLACE` as markers when they are whole
  lines. A setext heading or a `# ==========` banner inside a block no longer splits
  it mid-line; a text line that is exactly `=======` is rejected as ambiguous, with a
  hint to use `unified_diff`.
