### Security

- Evaluate `excluded_file_patterns` with a linear-time regex engine and bound pattern size. Each pattern is limited to 200 characters, and each call to 50 patterns.

### Changed

- `excluded_file_patterns` on `get_merge_request_diffs`, `list_merge_request_changed_files`, and `get_branch_diffs` now uses RE2 regex syntax. Lookahead, lookbehind, backreferences, and `\uXXXX` escapes are not supported; such a pattern is ignored with a warning, and the other patterns still apply.
