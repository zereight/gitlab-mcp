### Changed

- Documented that `execute_graphql` is refused (not scoped) when
  `GITLAB_PROJECT_ID`, `GITLAB_ALLOWED_PROJECT_IDS`, or a session project
  scope is set, and cited the split 2.1.30 advisories
  (`GHSA-5648-rgj9-v224`, `GHSA-64mg-3vx9-g74j`, `GHSA-24vp-rch2-gjqq`).
