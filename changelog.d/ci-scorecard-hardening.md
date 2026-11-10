### Security

- The MCP Registry publish workflow checks out only the commit that this
  repository's release tag points at, after checking that it matches the commit
  Docker Publish built. It no longer checks out a ref taken straight from the
  `workflow_run` event.
- Every workflow now sets read-only token permissions at the top level. Write
  access is granted only to the jobs that push, upload, or open pull requests.
- GitHub releases now carry a signed build provenance attestation for
  `gitlab-mcp.mcpb`, attached as `gitlab-mcp.mcpb.sigstore.json`. Check it with
  `gh attestation verify gitlab-mcp.mcpb --repo zereight/gitlab-mcp`.
- The docs build requires `pymdown-extensions` 11.0.1 or later, and the dev-only
  `minimatch` used by `@typescript-eslint/typescript-estree` is pinned to 11.x,
  to clear known advisories.
