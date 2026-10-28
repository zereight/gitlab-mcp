# Unreleased notes

Each pull request writes its release notes in its own file here, so two pull
requests never change the same lines of `CHANGELOG.md`. Name the file after the
branch, with `-` for `/`: `changelog.d/fix-list-issues-timeout.md`.

Put each change that a user can see in one of these groups: `Added`, `Changed`,
`Deprecated`, `Removed`, `Fixed`, `Security`, `Breaking changes`. A file can have
more than one group:

```md
### Fixed

- `list_issues` no longer sends blank `labels[]=` filters that GitLab rejected
  with HTTP 400.
```

`scripts/release.sh` moves the items of every file into a new version section of
`CHANGELOG.md` and deletes the files. The Changelog workflow checks each file. A
pull request with no change that a user can see gets the `no-changelog` label.
