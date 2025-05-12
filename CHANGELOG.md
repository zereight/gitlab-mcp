## [Released] - 2025-05-13

### Fixed

- **GitLab MCP Server:** Modified GitLab API helper functions to decode the `project_id` using `decodeURIComponent()` before processing. This resolves API call failures caused by differences in project ID encoding between Gemini and other AI models. API requests are now handled consistently regardless of the model.
