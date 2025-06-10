## [1.0.62] - 2025-06-10

### Fixed

- 🔐 **Private Token Authentication Fix**: Fixed Private-Token header authentication for GitLab API
  - Removed incorrect `Bearer ` prefix from Private-Token header in legacy authentication mode
  - Fixed authentication issues when using older GitLab instances with private tokens
  - Ensures proper API authentication for both new and legacy GitLab configurations
  - See: [PR #91](https://github.com/zereight/gitlab-mcp/pull/91), [Issue #88](https://github.com/zereight/gitlab-mcp/issues/88)

---
