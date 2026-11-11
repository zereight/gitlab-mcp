### Fixed

- `create_tag`, `list_tags`, and `get_tag` no longer fail with `created_at: Invalid input: expected string, received undefined` on GitLab versions before 16.11, whose tag responses have no top-level `created_at`. The tag was already created; only the response parsing failed (#1015).
