# Pipelines, Jobs & Deployments

Pipeline + job control (trigger, retry, cancel, play manual jobs, fetch logs/artifacts), project runners, and the deployments/environments view.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=core,pipelines` and `GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint` (or `GITLAB_TOOLSETS=all`). If you already set `GITLAB_TOOLSETS`, append `pipelines` to your existing list instead of replacing it. If `GITLAB_TOOLS` is already set, append `validate_ci_lint,validate_project_ci_lint` instead of replacing that list. `USE_PIPELINE=true` is deprecated (removed in next major (v3.0.0)).

## Tools in this group

- [`list_pipelines`](#list_pipelines) — 📖 Read-only
- [`get_pipeline`](#get_pipeline) — 📖 Read-only
- [`get_pipeline_variables`](#get_pipeline_variables) — 📖 Read-only
- [`get_pipeline_test_report`](#get_pipeline_test_report) — 📖 Read-only
- [`get_pipeline_test_report_summary`](#get_pipeline_test_report_summary) — 📖 Read-only
- [`delete_pipeline`](#delete_pipeline) — ✏️ Writes
- [`update_pipeline_metadata`](#update_pipeline_metadata) — ✏️ Writes
- [`list_deployments`](#list_deployments) — 📖 Read-only
- [`get_deployment`](#get_deployment) — 📖 Read-only
- [`create_deployment`](#create_deployment) — ✏️ Writes
- [`update_deployment`](#update_deployment) — ✏️ Writes
- [`delete_deployment`](#delete_deployment) — ✏️ Writes
- [`list_deployment_merge_requests`](#list_deployment_merge_requests) — 📖 Read-only
- [`approve_deployment`](#approve_deployment) — ✏️ Writes
- [`list_environments`](#list_environments) — 📖 Read-only
- [`get_environment`](#get_environment) — 📖 Read-only
- [`update_environment`](#update_environment) — ✏️ Writes
- [`delete_environment`](#delete_environment) — ✏️ Writes
- [`stop_environment`](#stop_environment) — ✏️ Writes
- [`stop_stale_environments`](#stop_stale_environments) — ✏️ Writes
- [`delete_review_app_environments`](#delete_review_app_environments) — ✏️ Writes
- [`list_pipeline_triggers`](#list_pipeline_triggers) — 📖 Read-only
- [`get_pipeline_trigger`](#get_pipeline_trigger) — 📖 Read-only
- [`create_pipeline_trigger`](#create_pipeline_trigger) — ✏️ Writes
- [`update_pipeline_trigger`](#update_pipeline_trigger) — ✏️ Writes
- [`delete_pipeline_trigger`](#delete_pipeline_trigger) — ✏️ Writes
- [`trigger_pipeline`](#trigger_pipeline) — ✏️ Writes
- [`list_pipeline_jobs`](#list_pipeline_jobs) — 📖 Read-only
- [`list_pipeline_trigger_jobs`](#list_pipeline_trigger_jobs) — 📖 Read-only
- [`get_pipeline_job`](#get_pipeline_job) — 📖 Read-only
- [`get_pipeline_job_output`](#get_pipeline_job_output) — 📖 Read-only
- [`create_pipeline`](#create_pipeline) — ✏️ Writes
- [`retry_pipeline`](#retry_pipeline) — ✏️ Writes
- [`cancel_pipeline`](#cancel_pipeline) — ✏️ Writes
- [`list_pipeline_schedules`](#list_pipeline_schedules) — 📖 Read-only
- [`get_pipeline_schedule`](#get_pipeline_schedule) — 📖 Read-only
- [`list_pipeline_schedule_pipelines`](#list_pipeline_schedule_pipelines) — 📖 Read-only
- [`create_pipeline_schedule`](#create_pipeline_schedule) — ✏️ Writes
- [`update_pipeline_schedule`](#update_pipeline_schedule) — ✏️ Writes
- [`delete_pipeline_schedule`](#delete_pipeline_schedule) — ✏️ Writes
- [`play_pipeline_schedule`](#play_pipeline_schedule) — ✏️ Writes
- [`take_ownership_pipeline_schedule`](#take_ownership_pipeline_schedule) — ✏️ Writes
- [`get_pipeline_schedule_variable`](#get_pipeline_schedule_variable) — 📖 Read-only
- [`create_pipeline_schedule_variable`](#create_pipeline_schedule_variable) — ✏️ Writes
- [`update_pipeline_schedule_variable`](#update_pipeline_schedule_variable) — ✏️ Writes
- [`delete_pipeline_schedule_variable`](#delete_pipeline_schedule_variable) — ✏️ Writes
- [`play_pipeline_job`](#play_pipeline_job) — ✏️ Writes
- [`play_pipeline_jobs`](#play_pipeline_jobs) — ✏️ Writes
- [`retry_pipeline_job`](#retry_pipeline_job) — ✏️ Writes
- [`cancel_pipeline_job`](#cancel_pipeline_job) — ✏️ Writes
- [`erase_pipeline_job`](#erase_pipeline_job) — ✏️ Writes
- [`wait_for_pipeline`](#wait_for_pipeline) — 📖 Read-only
- [`wait_for_job`](#wait_for_job) — 📖 Read-only
- [`list_job_artifacts`](#list_job_artifacts) — 📖 Read-only
- [`download_job_artifacts`](#download_job_artifacts) — 📖✏️ Reads and writes
- [`get_job_artifact_file`](#get_job_artifact_file) — 📖 Read-only
- [`list_project_runners`](#list_project_runners) — 📖 Read-only
- [`get_runner`](#get_runner) — 📖 Read-only

---

### `list_pipelines`

*📖 Read-only*

List pipelines with filtering options. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `scope` | enum (`running` \| `pending` \| `finished` \| `branches` \| `tags`) |  | The scope of pipelines |
| `status` | enum (`created` \| `waiting_for_resource` \| `preparing` \| `pending` \| `running` \| `success` \| `failed` \| `canceled` \| `skipped` \| `manual` \| `scheduled`) |  | The status of pipelines |
| `ref` | string |  | The ref of pipelines |
| `sha` | string |  | The SHA of pipelines |
| `yaml_errors` | boolean |  | Returns pipelines with invalid configurations |
| `username` | string |  | The username of the user who triggered pipelines |
| `updated_after` | string |  | Return pipelines updated after the specified date |
| `updated_before` | string |  | Return pipelines updated before the specified date |
| `order_by` | enum (`id` \| `status` \| `ref` \| `updated_at` \| `user_id`) |  | Order pipelines by |
| `sort` | enum (`asc` \| `desc`) |  | Sort pipelines |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_pipeline`

*📖 Read-only*

Get details of a specific pipeline. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |

### `get_pipeline_variables`

*📖 Read-only*

Get variables configured for a pipeline.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_pipeline_test_report`

*📖 Read-only*

Get pipeline test report.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_pipeline_test_report_summary`

*📖 Read-only*

Get pipeline test report summary.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `delete_pipeline`

*✏️ Writes*

Delete a pipeline. Requires the project Owner role, cannot be undone, and does not automatically delete child pipelines. Verify the target first with a get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |

### `update_pipeline_metadata`

*✏️ Writes*

Update pipeline metadata.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `name` | string | ✓ | New pipeline name |

### `list_deployments`

*📖 Read-only*

List deployments with filtering options. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment` | string |  | Filter by environment name |
| `ref` | string |  | Filter by ref |
| `sha` | string |  | Filter by commit SHA (if supported by your GitLab version) |
| `status` | string |  | Filter by deployment status |
| `updated_after` | string |  | Return deployments updated after the specified date |
| `updated_before` | string |  | Return deployments updated before the specified date |
| `order_by` | enum (`id` \| `iid` \| `created_at` \| `updated_at` \| `ref` \| `status` \| `environment`) |  | Order deployments by |
| `sort` | enum (`asc` \| `desc`) |  | Sort deployments |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_deployment`

*📖 Read-only*

Get deployment details, including approval_summary, approvals, and pending_approval_count when GitLab provides them. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |

### `create_deployment`

*✏️ Writes*

Create a deployment. If the resource already exists, use the update tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `environment` | string | ✓ |  |
| `sha` | string | ✓ |  |
| `ref` | string | ✓ |  |
| `tag` | boolean | ✓ |  |
| `status` | enum (`running` \| `success` \| `failed` \| `canceled`) | ✓ |  |

### `update_deployment`

*✏️ Writes*

Update a deployment status. Use the create tool for new resources.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |
| `status` | enum (`running` \| `success` \| `failed` \| `canceled`) | ✓ |  |

### `delete_deployment`

*✏️ Writes*

Delete a deployment. Verify the target first with a get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |

### `list_deployment_merge_requests`

*📖 Read-only*

List merge requests shipped with a deployment.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `approve_deployment`

*✏️ Writes*

Approve or reject a protected-environment deployment.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |
| `status` | enum (`approved` \| `rejected`) | ✓ |  |
| `comment` | string |  |  |
| `represented_as` | string |  |  |

### `list_environments`

*📖 Read-only*

List environments in a project. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `name` | string |  | Return environments with this exact name |
| `search` | string |  | Search environments by name |
| `states` | enum (`available` \| `stopped`) |  | Filter environments by state |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_environment`

*📖 Read-only*

Get details of a specific environment. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment_id` | string | ✓ | The ID of the environment |

### `update_environment`

*✏️ Writes*

Update an environment.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment_id` | string | ✓ | The ID of the environment |
| `external_url` | string (uri) \| null |  |  |
| `tier` | enum (`production` \| `staging` \| `testing` \| `development` \| `other`) |  |  |
| `auto_stop_setting` | enum (`always` \| `with_action`) |  |  |

### `delete_environment`

*✏️ Writes*

Delete a stopped environment. Verify the target first with a get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment_id` | string | ✓ | The ID of the environment |

### `stop_environment`

*✏️ Writes*

Stop an environment.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment_id` | string | ✓ | The ID of the environment |
| `force` | boolean |  |  |

### `stop_stale_environments`

*✏️ Writes*

Stop eligible stale environments; protected environments are excluded and environments are stopped, not deleted. Stop eligible stale environments. GitLab excludes protected environments; this does not delete them.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `before` | string | ✓ |  |

### `delete_review_app_environments`

*✏️ Writes*

Schedule deletion of stopped review-app environments one week later; dry_run defaults to true and actual scheduling requires dry_run=false. Schedule deletion of stopped review-app environments one week later. `dry_run` defaults to true.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `before` | string |  |  |
| `limit` | number |  |  |
| `dry_run` | boolean |  | Preview the cleanup when true (default); set to false to schedule deletion one week later |

### `list_pipeline_triggers`

*📖 Read-only*

List project pipeline trigger tokens. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |

### `get_pipeline_trigger`

*📖 Read-only*

Get a project pipeline trigger. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `trigger_id` | string | ✓ |  |

### `create_pipeline_trigger`

*✏️ Writes*

Create a project pipeline trigger. If the resource already exists, use the update tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `description` | string | ✓ |  |

### `update_pipeline_trigger`

*✏️ Writes*

Update a project pipeline trigger. Use the create tool for new resources.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `trigger_id` | string | ✓ |  |
| `description` | string | ✓ |  |

### `delete_pipeline_trigger`

*✏️ Writes*

Delete a project pipeline trigger. Verify the target first with a get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `trigger_id` | string | ✓ |  |

### `trigger_pipeline`

*✏️ Writes*

Trigger a pipeline with a pipeline trigger token.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `token` | string | ✓ |  |
| `ref` | string | ✓ |  |
| `variables` | object |  |  |
| `inputs` | object |  | Structured pipeline inputs; supported from GitLab 17.10 behind a feature flag and generally available from GitLab 18.1. Omit on older GitLab versions. |

### `list_pipeline_jobs`

*📖 Read-only*

List all jobs in a specific pipeline. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `scope` | enum (`created` \| `pending` \| `running` \| `failed` \| `success` \| `canceled` \| `skipped` \| `manual`) |  | The scope of jobs to show |
| `include_retried` | boolean |  | Whether to include retried jobs |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `list_pipeline_trigger_jobs`

*📖 Read-only*

List trigger jobs (bridges) in a pipeline.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `scope` | enum (`canceled` \| `canceling` \| `created` \| `failed` \| `manual` \| `pending` \| `preparing` \| `running` \| `scheduled` \| `skipped` \| `success` \| `waiting_for_resource`) |  | The scope of trigger jobs to show |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_pipeline_job`

*📖 Read-only*

Get details of a GitLab pipeline job number. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |

### `get_pipeline_job_output`

*📖 Read-only*

Get a pipeline job trace. It is read-only. Without pattern, lines come from the end of the log: limit is the maximum lines (default and max 1000) and offset is how many lines to skip from the end (default 0). With pattern, the full log is searched and limit and offset are ignored; a log over 10,000,000 characters is searched only in its last 10,000,000 characters, which can start partway through a line, and the result says which line that is. pattern is a substring unless regex is true, which treats it as an RE2 regular expression matched in linear time (no backreferences or lookaround); invalid or unsupported expressions, expressions over 1,000 compiled instructions (large {n} repetitions), and patterns longer than 500 characters return an error. case_sensitive defaults to false. context_lines (default 5, maximum 50) includes lines before and after each match, and overlapping windows are merged. max_matches (default 20, maximum 100) caps returned matches, and returned lines stop at 100,000 characters of text in total. Results are plain text with 1-based line numbers from the start of the log plus total_lines, total_matches, shown_matches, truncated, and output_truncated (true when the character limit cut the output). ANSI escape codes and GitLab section_start/section_end markers are removed before matching and in returned fragments. Provide project_id as a numeric ID or URL-encoded path and job_id as the job ID.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `limit` | number |  | Maximum number of lines to return from the end of the log (default/max: 1000). Ignored when pattern is set. |
| `offset` | number |  | Number of lines to skip from the end of the log (default: 0). Ignored when pattern is set. |
| `pattern` | string |  | Substring to search for in the full job log. When set, the full log (only its last 10,000,000 characters when longer) is searched and limit and offset are ignored. Empty is treated as omitted. Maximum 500 characters. |
| `regex` | boolean |  | When true, treat pattern as an RE2 regular expression, matched in linear time. Backreferences and lookaround are not supported. Invalid, unsupported or overly complex expressions return an error. Default: false. |
| `case_sensitive` | boolean |  | Match case when true. Default: false (case-insensitive). Used only when pattern is set. |
| `context_lines` | integer |  | Lines of context before and after each match (default: 5, maximum: 50). Overlapping windows are merged. Used only when pattern is set. |
| `max_matches` | integer |  | Maximum number of matches to return (default: 20, maximum: 100). total_matches still counts every hit and truncated is true when more exist. Used only when pattern is set. |

### `create_pipeline`

*✏️ Writes*

Create a new pipeline for a branch or tag.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `ref` | string | ✓ | The branch or tag to run the pipeline on |
| `variables` | array<object> |  | An array of variables to use for the pipeline |
| `inputs` | object |  | Input parameters for the pipeline (key-value pairs for spec:inputs) |

### `retry_pipeline`

*✏️ Writes*

Retry a failed or canceled pipeline.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline to retry |

### `cancel_pipeline`

*✏️ Writes*

Cancel a running pipeline.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline to cancel |

### `list_pipeline_schedules`

*📖 Read-only*

List pipeline schedules in a project, optionally filtered to active or inactive. List scheduled pipelines (`cron`, `next_run_at`, `active`). The list has no `variables` — call `get_pipeline_schedule` for those.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `scope` | enum (`active` \| `inactive`) |  | Return only active or only inactive pipeline schedules |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_pipeline_schedule`

*📖 Read-only*

Get details of a specific pipeline schedule, including its variables and last pipeline. Inspect one schedule including variables and inputs (Maintainer/Owner/schedule owner only).

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |

### `list_pipeline_schedule_pipelines`

*📖 Read-only*

List the pipelines that a pipeline schedule has triggered. List pipelines a schedule has triggered. Use `get_pipeline` for one pipeline and `list_pipelines` for project-wide filtering.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |
| `scope` | enum (`running` \| `pending` \| `finished` \| `branches` \| `tags`) |  | The scope of pipelines |
| `status` | enum (`created` \| `waiting_for_resource` \| `preparing` \| `waiting_for_callback` \| `pending` \| `running` \| `success` \| `failed` \| `canceling` \| `canceled` \| `skipped` \| `manual` \| `scheduled`) |  | The status of pipelines |
| `sort` | enum (`asc` \| `desc`) |  | Sort pipelines (default: asc) |
| `updated_after` | string |  | Return pipelines updated after the specified ISO 8601 date |
| `updated_before` | string |  | Return pipelines updated before the specified ISO 8601 date |
| `created_after` | string |  | Return pipelines created after the specified ISO 8601 date |
| `created_before` | string |  | Return pipelines created before the specified ISO 8601 date |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `create_pipeline_schedule`

*✏️ Writes*

Create a new pipeline schedule for a branch or tag. Add a recurring pipeline. Prefer a full ref such as `refs/heads/main` when a branch and tag share a name. `cron_timezone` defaults to UTC.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `description` | string | ✓ | The description of the pipeline schedule |
| `ref` | string | ✓ | The branch or tag the scheduled pipeline runs on. Use the full ref (e.g. 'refs/heads/main') when a branch and tag share a name |
| `cron` | string | ✓ | The cron schedule expression, for example `0 1 * * *` |
| `cron_timezone` | string |  | The time zone for the cron expression, for example 'UTC' (default) or 'Asia/Tokyo' |
| `active` | boolean |  | Whether the pipeline schedule is active (default: true) |
| `inputs` | array<object> |  | Inputs passed to the scheduled pipeline, each an object with `name` (a `spec:inputs` entry) and `value` (a string, number, boolean, or array) — for example [{"name": "deploy_strategy", "value": "blue-green"}]. Requires GitLab 18.1 or later |

### `update_pipeline_schedule`

*✏️ Writes*

Update an existing pipeline schedule. Change an existing schedule. Call `take_ownership_pipeline_schedule` first when the schedule belongs to another user.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule to update |
| `description` | string |  | The new description of the pipeline schedule |
| `ref` | string |  | The new branch or tag the scheduled pipeline runs on. Use the full ref (e.g. 'refs/heads/main') when a branch and tag share a name |
| `cron` | string |  | The new cron schedule expression, for example `0 1 * * *` |
| `cron_timezone` | string |  | The new time zone for the cron expression, for example 'UTC' or 'Asia/Tokyo' |
| `active` | boolean |  | Whether the pipeline schedule is active |
| `inputs` | array<object> |  | Inputs to add or change, each an object with `name` and `value`; to remove one, pass its `name` with `destroy` set to true — for example [{"name": "deploy_strategy", "destroy": true}]. Requires GitLab 18.1 or later |

### `delete_pipeline_schedule`

*✏️ Writes*

Delete a pipeline schedule. Permanently remove a schedule and its variables. Pause with `update_pipeline_schedule` `active: false` instead when possible.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule to delete |

### `play_pipeline_schedule`

*✏️ Writes*

Run a pipeline schedule immediately. Run a schedule immediately without shifting `next_run_at`. Rate-limited to once per minute per schedule.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule to run |

### `take_ownership_pipeline_schedule`

*✏️ Writes*

Take ownership of a pipeline schedule. Transfer schedule ownership to the current user. Required before updating or deleting someone else's schedule.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule to take ownership of |

### `get_pipeline_schedule_variable`

*📖 Read-only*

Get a single variable of a pipeline schedule. Read one schedule variable by key. Separate from project-level CI/CD variables.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |
| `key` | string | ✓ | The key of the variable |

### `create_pipeline_schedule_variable`

*✏️ Writes*

Create a variable for a pipeline schedule. Attach a new variable to a schedule. `variable_type` defaults to `env_var`; `key` is /[a-zA-Z0-9_]+/ up to 255 characters.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |
| `key` | string | ✓ | The key of the variable (max 255 characters, must match /[a-zA-Z0-9_]+/) |
| `value` | string | ✓ | The value of the variable |
| `variable_type` | enum (`env_var` \| `file`) |  | The type of variable: 'env_var' (default) or 'file' |

### `update_pipeline_schedule_variable`

*✏️ Writes*

Update a variable of a pipeline schedule. Change the value or type of an existing schedule variable.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |
| `key` | string | ✓ | The key of the variable to update |
| `value` | string | ✓ | The new value of the variable |
| `variable_type` | enum (`env_var` \| `file`) |  | The type of variable: 'env_var' or 'file' |

### `delete_pipeline_schedule_variable`

*✏️ Writes*

Delete a variable from a pipeline schedule. Permanently remove a schedule variable. Later scheduled pipelines no longer receive it.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |
| `key` | string | ✓ | The key of the variable to delete |

### `play_pipeline_job`

*✏️ Writes*

Run a manual pipeline job.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `job_variables_attributes` | array<object> |  | Custom job variables to use when running the job |
| `job_inputs` | object |  | Typed job input values |

### `play_pipeline_jobs`

*✏️ Writes*

Play multiple manual pipeline jobs sequentially.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_ids` | array<string> | ✓ | Job IDs to play, in dependency order |
| `job_variables_attributes` | array<object> |  | Custom job variables to use when running each job |
| `timeout_seconds` | integer |  | Maximum seconds to wait for each job to reach a terminal status (applied per job; total duration scales with the batch size) |
| `poll_interval_seconds` | integer |  | Seconds between status polls while waiting for each job |

### `retry_pipeline_job`

*✏️ Writes*

Retry a failed or canceled pipeline job.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `job_inputs` | object |  | Typed job input values |

### `cancel_pipeline_job`

*✏️ Writes*

Cancel a running pipeline job.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `force` | boolean |  | Force cancellation of the job |

### `erase_pipeline_job`

*✏️ Writes*

Erase a pipeline job log and artifacts.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |

### `wait_for_pipeline`

*📖 Read-only*

Wait for a pipeline to reach a terminal status.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `timeout_seconds` | integer |  | Maximum seconds to wait for this pipeline to reach a terminal status |
| `poll_interval_seconds` | integer |  | Seconds between status polls while waiting for this pipeline |

### `wait_for_job`

*📖 Read-only*

Wait for a job to reach a terminal status.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `timeout_seconds` | integer |  | Maximum seconds to wait for this job to reach a terminal status |
| `poll_interval_seconds` | integer |  | Seconds between status polls while waiting for this job |

### `list_job_artifacts`

*📖 Read-only*

List artifact files in a job's archive.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `path` | string |  | Directory path within the artifacts archive (defaults to root) |
| `recursive` | boolean |  | Whether to list artifacts recursively |

### `download_job_artifacts`

*📖✏️ Reads and writes*

Download job artifact archive (zip) and save it under the download directory. Retrieve a job artifact archive. Remote HTTP returns a download URL; local stdio saves under GITLAB_DOWNLOAD_DIR, never overwrites, and is rejected in readonly mode.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `local_path` | string |  | Subdirectory of the download directory to save the archive in (optional, defaults to the download directory itself). Names starting with a dot are rejected |

### `get_job_artifact_file`

*📖 Read-only*

Get content of a single file from a job's artifacts.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `artifact_path` | string | ✓ | Path to the file within the artifacts archive |

### `list_project_runners`

*📖 Read-only*

List runners available to a project. List runners a project can use, including ancestor group and allowed instance runners. Payload omits tags — call `get_runner` for tag_list. Never returns runners_token or the runner authentication token.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `type` | enum (`instance_type` \| `group_type` \| `project_type`) |  | Runner type: instance_type, group_type, or project_type |
| `status` | enum (`online` \| `offline` \| `stale` \| `never_contacted` \| `active` \| `paused`) |  | Runner status: online, offline, stale, or never_contacted. active and paused are deprecated; use the paused filter instead. offline may also include stale runners |
| `paused` | boolean |  | true returns only runners ignoring new jobs; false returns only runners accepting new jobs |
| `tag_list` | array<string> |  | Runner tags that must match. Sent to GitLab as a comma-separated tag_list |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_runner`

*📖 Read-only*

Get one runner by ID. Get tag_list, run_untagged, locked, and access_level for a runner id. With GITLAB_ALLOWED_PROJECT_IDS or a session project scope, the runner must appear on an allowed project's list — pass project_id when more than one project is allowed. Never returns runners_token or the runner authentication token; token_expires_at is expiry metadata, not the token.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `runner_id` | string | ✓ | The ID of the runner |
| `project_id` | string |  | Project ID or URL-encoded path used to verify the runner is on that project's runner list. Required when GITLAB_ALLOWED_PROJECT_IDS or a session project scope lists more than one project. |
