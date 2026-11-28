### Fixed

- `upload_markdown` now tells the model where `file_path` is resolved. The
  `file_path` description says the path is relative to the server's working
  directory and that absolute paths and `..` are rejected. Path errors (absolute
  path, `..`, symlink, file not found) come back as tool results with a `Next:`
  hint instead of internal errors.
- An absolute local path (`upload_markdown` `file_path`, the download tools'
  `local_path`) is now reported as "absolute paths are not allowed" instead of
  "directory traversal is not allowed".
