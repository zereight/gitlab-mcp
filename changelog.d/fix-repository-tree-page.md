### Added

- `get_repository_tree` accepts `page` for offset pagination. Calls that pass it
  get a structured response with `items` and, when more pages exist, `next_page`.
  Calls without `page` or `pagination` keep the array response.

### Fixed

- `get_repository_tree` silently returned the first page again when called with
  `page`, because the schema stripped the parameter and the request never sent it.
- `get_repository_tree` no longer returns the `x-next-page` page number as
  `next_page_token`. GitLab does not accept it as `page_token`. When a keyset
  request gets offset pagination headers back, the response returns
  `next_page` and says so in `pagination_note` instead of reporting the final
  page.
