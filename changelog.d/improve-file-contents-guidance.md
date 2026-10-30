### Changed

- `get_file_contents` no longer claims to read directories. The GitLab Files API
  it calls answers 404 for a directory, so its description now says it reads one
  file, notes the default-branch fallback and the UTF-8/base64 output, and points
  directories at `get_repository_tree`. `get_repository_tree` now says it lists
  one level unless `recursive` is true. When the Files API answers 404, the
  `File not found: <path>` error now ends with
  `Next: check file_path and ref; to list a directory, use get_repository_tree.`;
  it used to carry no hint. The HTTP status in the error's `_meta` is unchanged.
