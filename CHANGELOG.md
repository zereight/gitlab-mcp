## [1.0.63] - 2025-06-12

### Added

- 📊 **CI Job Log Pagination**: Added pagination support for CI job logs to prevent context window flooding
  - `get_pipeline_job_output` now supports optional `limit` and `offset` parameters
  - Default limit is 1000 lines when pagination is used
  - Returns lines from the end of the log, with configurable offset
  - Includes truncation metadata showing what was skipped
  - Maintains backward compatibility (no parameters = full log)
  - See: [PR #97](https://github.com/zereight/gitlab-mcp/pull/97)

---

## [1.0.62] - 2025-06-10

### Fixed

- 🔐 **Private Token Authentication Fix**: Fixed Private-Token header authentication for GitLab API
  - Removed incorrect `Bearer ` prefix from Private-Token header in legacy authentication mode
  - Fixed authentication issues when using older GitLab instances with private tokens
  - Ensures proper API authentication for both new and legacy GitLab configurations
  - See: [PR #91](https://github.com/zereight/gitlab-mcp/pull/91), [Issue #88](https://github.com/zereight/gitlab-mcp/issues/88)

---

## [1.0.60] - 2025-06-07

### Added

- 📄 **Merge Request Enhancement**: Added support for `remove_source_branch` and `squash` options for merge requests
  - Enhanced merge request functionality with additional configuration options
  - Allows automatic source branch removal after merge
  - Supports squash commits for cleaner Git history
  - See: [PR #86](https://github.com/zereight/gitlab-mcp/pull/86)

### Fixed

- 🔧 **Issue Assignment Fix**: Fixed list issues assignee username handling
  - Corrected assignee username field in issue listing functionality
  - Improved user assignment data processing for GitLab issues
  - See: [PR #87](https://github.com/zereight/gitlab-mcp/pull/87), [Issue #74](https://github.com/zereight/gitlab-mcp/issues/74)

---

## [1.0.54] - 2025-05-31

### Added

- 🌐 **Multi-Platform Support**: Added support for multiple platforms to improve compatibility across different environments

  - Enhanced platform detection and configuration handling
  - Improved cross-platform functionality for GitLab MCP server
  - See: [PR #71](https://github.com/zereight/gitlab-mcp/pull/71), [Issue #69](https://github.com/zereight/gitlab-mcp/issues/69)

- 🔐 **Custom SSL Configuration**: Added custom SSL options for enhanced security and flexibility
  - Support for custom SSL certificates and configurations
  - Improved HTTPS connection handling with custom SSL settings
  - Better support for self-signed certificates and custom CA configurations
  - See: [PR #72](https://github.com/zereight/gitlab-mcp/pull/72), [Issue #70](https://github.com/zereight/gitlab-mcp/issues/70)

---

## [1.0.48] - 2025-05-29

### Added

- 🎯 **Milestone Management Tools**: Added comprehensive milestone management functionality
  - `create_milestone`: Create new milestones for GitLab projects
  - `update_milestone`: Update existing milestone properties (title, description, dates, state)
  - `delete_milestone`: Delete milestones from projects
  - `list_milestones`: List and filter project milestones
  - `get_milestone`: Get detailed information about specific milestones
  - See: [PR #59](https://github.com/zereight/gitlab-mcp/pull/59)

### Fixed

- 🐳 **Docker Image Push Script**: Added automated Docker image push script for easier deployment
  - Simplifies the Docker image build and push process
  - See: [PR #60](https://github.com/zereight/gitlab-mcp/pull/60)

---

## [1.0.47] - 2025-05-29

### Added

- 🔄 **List Merge Requests Tool**: Added functionality to list and filter merge requests in GitLab projects
  - `list_merge_requests`: List merge requests with comprehensive filtering options
  - Supports filtering by state, scope, author, assignee, reviewer, labels, and more
  - Includes pagination support for large result sets
  - See: [PR #56](https://github.com/zereight/gitlab-mcp/pull/56)

### Fixed

- Fixed issue where GitLab users without profile pictures would cause JSON-RPC errors

  - Changed `avatar_url` field to be nullable in GitLabUserSchema
  - This allows proper handling of users without avatars in GitLab API responses
  - See: [PR #55](https://github.com/zereight/gitlab-mcp/pull/55)

- Fixed issue where GitLab pipelines without illustrations would cause JSON-RPC errors
  - Changed `illustration` field to be nullable in GitLabPipelineSchema
  - This allows proper handling of pipelines without illustrations
  - See: [PR #58](https://github.com/zereight/gitlab-mcp/pull/58), [Issue #57](https://github.com/zereight/gitlab-mcp/issues/57)

---

## [1.0.46] - 2025-05-27

### Fixed

- Fixed issue where GitLab issues and milestones with null descriptions would cause JSON-RPC errors
  - Changed `description` field to be nullable with default empty string in schemas
  - This allows proper handling of GitLab issues/milestones without descriptions
  - See: [PR #53](https://github.com/zereight/gitlab-mcp/pull/53), [Issue #51](https://github.com/zereight/gitlab-mcp/issues/51)

---

## [1.0.45] - 2025-05-24

### Added

- 🔄 **Pipeline Management Tools**: Added GitLab pipeline status monitoring and management functionality
  - `list_pipelines`: List project pipelines with various filtering options
  - `get_pipeline`: Get detailed information about a specific pipeline
  - `list_pipeline_jobs`: List all jobs in a specific pipeline
  - `get_pipeline_job`: Get detailed information about a specific pipeline job
  - `get_pipeline_job_output`: Get execution logs/output from pipeline jobs
- 📊 Pipeline status summary and analysis support
  - Example: "How many of the last N pipelines are successful?"
  - Example: "Can you make a summary of the output in the last pipeline?"
- See: [PR #52](https://github.com/zereight/gitlab-mcp/pull/52)

---

## [1.0.42] - 2025-05-22

### Added

- Added support for creating and updating issue notes (comments) in GitLab.
- You can now add or edit comments on issues.
- See: [PR #47](https://github.com/zereight/gitlab-mcp/pull/47)

---

## [1.0.38] - 2025-05-17

### Fixed

- Added `expanded` property to `start` and `end` in `GitLabDiscussionNoteSchema`  
  Now you can expand or collapse more information at the start and end of discussion notes.  
  Example: In code review, you can choose to show or hide specific parts of the discussion.  
  (See: [PR #40](https://github.com/zereight/gitlab-mcp/pull/40))
