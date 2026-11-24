### Added

- `get_file_contents` accepts optional `offset` (zero-based first line) and
  `limit` (default and maximum 1000 lines) to return only part of a UTF-8 file,
  with `offset`, `returned_lines` and `total_lines` for paging. Without them the
  whole file is returned as before; base64 content is always returned whole.
