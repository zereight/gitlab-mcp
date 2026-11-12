### Changed

- Documented that `execute_graphql` is refused (not scoped) when
  `GITLAB_PROJECT_ID`, `GITLAB_ALLOWED_PROJECT_IDS`, or a session project
  scope is set, and cited the split 2.1.30 advisories
  (`GHSA-5648-rgj9-v224`, `GHSA-64mg-3vx9-g74j`, `GHSA-24vp-rch2-gjqq`).
- Clarified that `GITLAB_PROJECT_ID` is a default project, not a lock; use
  `GITLAB_ALLOWED_PROJECT_IDS` to restrict which projects tools may operate on.
  Without `ENABLE_STRICT_PROJECT_SCOPE=true`, listings and searches can still
  return results outside that allowlist.
- Documented that the opt-in `gitlab_api_request` allowlist checks only the
  request path. It does not check project IDs in query parameters or the
  request body, so a request such as an issue move can target another project
  through `to_project_id`. This applies whether or not
  `ENABLE_STRICT_PROJECT_SCOPE` is set.
