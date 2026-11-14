### Changed

- `get_file_contents` no longer claims to read directories. The GitLab Files API
  it calls answers 404 for a directory, so its description now says it reads one
  file, notes the default-branch fallback, and points directories at
  `get_repository_tree`. Its description also says that `encoding` is `utf8` when
  a UTF-8 round-trip test passes, so a binary whose bytes are valid UTF-8 (such as
  one with `0x00`) comes back as `utf8`; clients should read `encoding`. `get_repository_tree` now says it lists
  one level unless `recursive` is true. When the Files API answers 404, the
  `File not found: <path>` error now ends with
  `Next: check file_path and ref; to list a directory, use get_repository_tree.`;
  it used to carry no hint. The HTTP status in the error's `_meta` is unchanged.
