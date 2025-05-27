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
