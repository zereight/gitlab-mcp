### Added

- `update_file_patch` changes part of an existing UTF-8 file with search/replace
  blocks or a unified diff, so a client sends only the changed lines instead of
  the whole file. The server reads the file from the branch, applies the patch,
  and commits with the file's `last_commit_id`; a dry run returns the diff only.
