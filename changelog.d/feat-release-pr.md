### Changed

- Releases are now cut through a `chore(release): vX.Y.Z` pull request instead
  of a direct push to `main`. `scripts/release.sh` opens the PR, waits for the
  required checks and a review, merges it, and tags the merge commit so the
  GitHub release still starts the publish workflows. See
  [RELEASING.md](https://github.com/zereight/gitlab-mcp/blob/main/RELEASING.md).
