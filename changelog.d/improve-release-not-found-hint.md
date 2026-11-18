### Changed

- A `404` from `get_release`, `update_release`, `delete_release`, and `create_release_evidence`
  now says that `tag_name` must be the Git tag of an existing release, and that `list_releases`
  lists them, instead of the generic hint about `project_id` and the `iid`. Those tools take a tag
  name, so the old hint named the wrong argument. Only the error text changes; success results are
  the same.
