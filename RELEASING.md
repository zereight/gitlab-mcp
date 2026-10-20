# Releasing

This document describes how `@zereight/mcp-gitlab` is released, what needs
maintainer approval, and which versions get fixes. Contributors don't need to
do anything for a release.

## Cadence

- **Stable release:** every Tuesday at 18:55 US Eastern (`America/New_York`).
  That is 22:55 UTC during daylight saving time and 23:55 UTC otherwise. It
  ships everything merged to `main` since the last release.
- **Skipped week:** when nothing user-facing merged since the last release,
  there is no stable release that week. Docs-only, CI-only, and bot-only
  changes don't trigger a release on their own.
- **Hotfix:** out of band, as soon as the fix is merged. See
  [Hotfixes](#hotfixes).

A PR merged after the Tuesday cut ships in the next release that is actually
cut (normally the following Tuesday).

## What goes into a stable release

A change ships in the next stable release when:

- It is merged to `main` through a reviewed pull request.
- CI is green: the PR checks passed, and the latest `Live API Tests` and
  `Deploy Documentation` runs on `main` passed.
- It has maintainer approval if it needs one (see [Approval](#approval)).

## Hotfixes

A hotfix ships out of band for:

- **A security fix.** Follow [Security releases](#security-releases).
- **An outage.** The released package or image fails to install, start, or
  authenticate for a supported setup.
- **A severe regression.** A recent release breaks a core workflow, loses or
  corrupts data, or writes to the wrong GitLab resource.

Process:

1. Open an issue with the impact and the affected versions. Security issues use
   a private advisory instead.
2. Fix it on a branch from `main` with a regression test. Keep the PR minimal.
3. Merge after review and green CI.
4. Check `git log <last tag>..origin/main`. `scripts/release.sh` releases `main`
   as it is, so everything merged since the last tag ships with the hotfix.
   Revert anything that isn't ready.
5. Cut the release with `scripts/release.sh` and comment on the issue with the
   published version.

## Approval

The maintainer cuts every release. These changes need explicit maintainer
approval, as an approving review on the PR, before they are released:

- **Breaking changes.** Only in a major release, and only with a migration
  path: a deprecation warning in an earlier release, plus migration steps in
  `CHANGELOG.md` and the release notes. The v3.0 removal of legacy flags
  ([#815](https://github.com/zereight/gitlab-mcp/issues/815)) is the model.
- **User-facing behavior or config.** Tool names, arguments, defaults, env
  vars, CLI flags, and permission modes. `README*.md` and `docs/` must match in
  the same PR.
- **Workflows, permissions, and publishing.** `.github/workflows/`, workflow
  `permissions:` or secrets, release and publish scripts, and package or
  registry metadata. These paths are listed in `.github/CODEOWNERS`.
- **Security releases.** The fix, the advisory text, and the publish time.

## Security releases

Vulnerabilities are reported through GitHub private vulnerability reporting
(see [SECURITY.md](SECURITY.md)).

1. **Triage in a private advisory.** Confirm the report, rate the severity, and
   record the affected versions.
2. **Fix in private.** Use the advisory's temporary private fork or a private
   branch. Don't push the fix to a public branch or open a public PR before the
   release. Keep exploit details out of commit messages and PR titles.
3. **Request a CVE** from the advisory. The GHSA ID exists once the advisory is
   drafted.
4. **Coordinate the publish.** Agree on a date with the reporter, merge the fix
   into `main`, and cut a hotfix with `scripts/release.sh` right away.
5. **Publish the advisory** only after the fixed version is on npm
   (`npm view @zereight/mcp-gitlab@<version>`) and Docker Hub
   (`zereight050/gitlab-mcp:<version>`). Set the patched version first.
6. **Notify.** Credit the reporter, add the GHSA link to the GitHub release
   notes, and comment on related public issues.

## Supported versions

| Version                           | Support                        |
| --------------------------------- | ------------------------------ |
| Latest minor of the current major | Bug and security fixes         |
| 2.x, after v3.0 is released       | Security fixes only, see below |
| Older minors and majors           | None                           |

Until v3.0 is released, only the latest 2.x release is supported.

After v3.0 is released, 2.x gets security fixes until 2027-02-28 or 90 days
after the v3.0 release, whichever is later. They ship as a new release on the
latest 2.x line. `scripts/release.sh` only releases from `main`, so this needs
a `v2` maintenance branch and a script change when v3.0 ships.

## How publishing works

`scripts/release.sh` (`npm run release`) cuts a release:

1. It checks that `gh` is installed, the working tree is clean, the branch is
   `main`, and `HEAD` matches `origin/main`. It refuses to release when no
   commit since the last tag references a PR (`#123`), and exits without a
   release when `HEAD` is already the current tag.
2. It bumps the patch version (`npm version patch`). If the current version is
   tagged locally but not on the remote, it releases that tag instead; a minor
   or major release uses this path.
3. It syncs the version into `server.json` and
   `.well-known/mcp/server-card.json`, and pins the `npx` examples in
   `README*.md` and `docs/` to the previous release, the last known-good
   version. It runs the MCP Registry preflight
   (`npm run release:mcp-registry -- --check`) and `make docs`.
4. It commits `chore(release): vX.Y.Z`, tags `vX.Y.Z`, pushes both, and creates
   the GitHub release with generated notes.

The release notes list the PRs referenced since the previous tag, grouped by PR
title prefix (`feat`, `fix`, `docs`, ...), followed by contributors. The script
reads at most 20 PR numbers, so check the notes when more PRs merged. PRs opened
by `github-actions[bot]` (Homebrew formula, tool docs, Star History) are left
out. Dependabot PRs stay in. Releases below v3.0.0 also carry the
[#815](https://github.com/zereight/gitlab-mcp/issues/815) deprecation notice.

Publishing a stable GitHub release starts these workflows, directly or in turn.
A pre-release skips them; see [Pre-release builds](#pre-release-builds-next).

- **`npm-publish.yml`** builds the tag and publishes `@zereight/mcp-gitlab` to
  npm with trusted publishing (OIDC) and provenance. The workflow uses no npm
  token. Its `sync-homebrew` job then opens an
  `automation/homebrew-formula` PR that updates
  `Formula/zereight-mcp-gitlab.rb`.
- **`docker-publish.yml`** builds `linux/amd64` and `linux/arm64` images, pushes
  `zereight050/gitlab-mcp:<version>` and `latest` to Docker Hub with the
  `DOCKERHUB_*` secrets, and updates the Docker Hub README.
- **`mcp-registry-publish.yml`** starts when the release's Docker Publish run
  succeeds (`workflow_run`), not on the release itself. It checks out the
  release commit, waits until the npm version and the Docker tag are visible,
  then publishes `server.json` to the MCP Registry as
  `io.github.zereight/gitlab-mcp`, authenticated with GitHub OIDC. If Docker
  Publish fails, the registry publish is skipped.
- **`mcpb-release.yml`** packs the Claude Desktop bundle and uploads
  `gitlab-mcp.mcpb` to the GitHub release.

To retry a failed step, re-run the failed workflow run, or dispatch
`docker-publish.yml`, `mcp-registry-publish.yml`, `mcpb-release.yml`, or
`homebrew-formula.yml` by hand. Re-running a release's Docker Publish run
starts the registry publish again once it passes. To dispatch
`mcp-registry-publish.yml`, set `ref` to the release tag. Don't use
`manual-release.yml`: it skips the version sync in `scripts/release.sh`, and a
release it creates with `GITHUB_TOKEN` doesn't start the publish workflows.

After a release:

- Check that the release workflows passed (`gh run list --event release`), and
  the MCP Registry publish
  (`gh run list --workflow mcp-registry-publish.yml --event workflow_run`).
- Merge the `automation/homebrew-formula` PR.
- Comment on linked issues with the published version. Close them after the
  reporter confirms.

## Pre-release builds (`@next`)

`npm-publish.yml` also publishes pre-release builds to the npm `next` dist-tag,
so a reporter can try a merged fix before the next stable release with
`npx -y @zereight/mcp-gitlab@next`.

- A push to `main` that changes the package (TypeScript sources outside
  `test/`, `scripts/`, and `mcp-server/`, `package.json`, `package-lock.json`,
  or the TypeScript config) publishes `<next patch>-next.<run number>`, for
  example `2.3.5-next.123`. `chore(release):` commits and pushes by
  `github-actions[bot]` are skipped.
- A GitHub pre-release publishes its tag version, which must look like
  `vX.Y.Z-rc.1`.
- The version is set in the job workspace only and never committed back. The
  publish uses trusted publishing (OIDC) and provenance like `latest`, always
  with `--tag next`. `next` runs one at a time, so overlapping pushes don't
  race.
- A pre-release doesn't publish `latest` to npm, sync the Homebrew formula,
  push Docker images, update the MCP Registry, or upload the MCP bundle.
  `scripts/release.sh` ignores pre-release tags and versions when it picks the
  previous tag and the docs pin.
- Right after a stable release, `next` can be older than `latest` until the
  next push to `main` publishes a new build.
