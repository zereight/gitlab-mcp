### Security

- After a release, the automatic MCP Registry publish checks out only the
  commit that this repository's release tag points at, after checking that it
  matches the commit Docker Publish built. It no longer checks out a ref taken
  straight from the `workflow_run` event. A manual `workflow_dispatch` run still
  publishes `inputs.ref` or the commit it was started from, without this check.
- Every workflow now sets read-only token permissions at the top level. Write
  access is granted only to the jobs that push, upload, or open pull requests.
- Stable GitHub releases now carry a signed build provenance attestation for
  `gitlab-mcp.mcpb`, attached as `gitlab-mcp.mcpb.sigstore.json`. Check it with
  `gh attestation verify`, passing `--repo zereight/gitlab-mcp`,
  `--signer-workflow` for `mcpb-release.yml`, and `--source-ref` for the release
  tag. A manual MCP Bundle run must now start from the release tag it attaches
  the bundle to.
- The docs build requires `pymdown-extensions` 11.0.1 or later, and the dev-only
  `minimatch` used by `@typescript-eslint/typescript-estree` is constrained to
  `^11.0.1`, to clear known advisories.
