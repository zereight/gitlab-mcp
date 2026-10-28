### Changed

- Pull requests now add user-facing notes in `changelog.d/` instead of editing
  `CHANGELOG.md` together. `scripts/release.sh` merges those fragments into the
  version section when cutting a release. Use the `no-changelog` label when a
  user sees no change.
- Dependabot now opens weekly grouped npm patch and minor PRs (majors ignored)
  and monthly GitHub Actions PRs. Existing auto-merge still applies to patch
  updates only.
- GitHub Actions that were still on floating tags are pinned to commit SHAs.
  Lint, production `npm audit`, and Prettier check now fail the PR job instead
  of being swallowed.
