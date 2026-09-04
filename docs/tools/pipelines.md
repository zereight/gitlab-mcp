# Pipelines, Jobs & Deployments

Pipeline + job control (trigger, retry, cancel, play manual jobs, fetch logs/artifacts), and the deployments/environments view.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=pipelines` (or `GITLAB_TOOLSETS=all`), or use the legacy `USE_PIPELINE=true` flag for backward compatibility.

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
- [`download_job_artifacts`](#download_job_artifacts) — 📖 Read-only
- [`get_job_artifact_file`](#get_job_artifact_file) — 📖 Read-only

---

### `list_pipelines`

*📖 Read-only*

List pipelines with filtering options. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Get details of a specific pipeline. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |

### `get_pipeline_variables`

*📖 Read-only*

Get variables configured for a pipeline. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_pipeline_test_report`

*📖 Read-only*

Get pipeline test report. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_pipeline_test_report_summary`

*📖 Read-only*

Get pipeline test report summary. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `delete_pipeline`

*✏️ Writes*

Delete a pipeline. Requires the project Owner role, cannot be undone, and does not automatically delete child pipelines. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |

### `update_pipeline_metadata`

*✏️ Writes*

Update pipeline metadata. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `name` | string | ✓ | New pipeline name |

### `list_deployments`

*📖 Read-only*

List deployments with filtering options. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Get deployment details, including approval_summary, approvals, and pending_approval_count when GitLab provides them. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |

### `create_deployment`

*✏️ Writes*

Create a deployment. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Update a deployment status. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |
| `status` | enum (`running` \| `success` \| `failed` \| `canceled`) | ✓ |  |

### `delete_deployment`

*✏️ Writes*

Delete a deployment. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |

### `list_deployment_merge_requests`

*📖 Read-only*

List merge requests shipped with a deployment. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `approve_deployment`

*✏️ Writes*

Approve or reject a protected-environment deployment. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

List environments in a project. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Get details of a specific environment. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment_id` | string | ✓ | The ID of the environment |

### `update_environment`

*✏️ Writes*

Update an environment. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Delete a stopped environment. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment_id` | string | ✓ | The ID of the environment |

### `stop_environment`

*✏️ Writes*

Stop an environment. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment_id` | string | ✓ | The ID of the environment |
| `force` | boolean |  |  |

### `stop_stale_environments`

*✏️ Writes*

Stop eligible stale environments; protected environments are excluded and environments are stopped, not deleted. Use this to stop eligible stale environments in a project. GitLab excludes protected environments, and this operation stops environments without deleting them. It requires the necessary project permission and returns the result or a validation, permission, or rate-limit error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `before` | string | ✓ |  |

### `delete_review_app_environments`

*✏️ Writes*

Schedule deletion of stopped review-app environments one week later; dry_run defaults to true and actual scheduling requires dry_run=false. Use this to clean up stopped review-app environments after verifying the scope. GitLab schedules deletion one week later rather than deleting environments immediately; `dry_run` defaults to `true`, so actual scheduling requires `dry_run: false`. It requires the necessary project permission and returns the cleanup result or a validation, permission, or rate-limit error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `before` | string |  |  |
| `limit` | number |  |  |
| `dry_run` | boolean |  | Preview the cleanup when true (default); set to false to schedule deletion one week later |

### `list_pipeline_triggers`

*📖 Read-only*

List project pipeline trigger tokens. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |

### `get_pipeline_trigger`

*📖 Read-only*

Get a project pipeline trigger. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `trigger_id` | string | ✓ |  |

### `create_pipeline_trigger`

*✏️ Writes*

Create a project pipeline trigger. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `description` | string | ✓ |  |

### `update_pipeline_trigger`

*✏️ Writes*

Update a project pipeline trigger. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `trigger_id` | string | ✓ |  |
| `description` | string | ✓ |  |

### `delete_pipeline_trigger`

*✏️ Writes*

Delete a project pipeline trigger. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ |  |
| `trigger_id` | string | ✓ |  |

### `trigger_pipeline`

*✏️ Writes*

Trigger a pipeline with a pipeline trigger token. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

List all jobs in a specific pipeline. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

List trigger jobs (bridges) in a pipeline. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Get details of a GitLab pipeline job number. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |

### `get_pipeline_job_output`

*📖 Read-only*

Get the output/trace of a pipeline job with optional pagination. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `limit` | number |  | Maximum number of lines to return from the end of the log (default/max: 1000) |
| `offset` | number |  | Number of lines to skip from the end of the log (default: 0) |

### `create_pipeline`

*✏️ Writes*

Create a new pipeline for a branch or tag. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `ref` | string | ✓ | The branch or tag to run the pipeline on |
| `variables` | array<object> |  | An array of variables to use for the pipeline |
| `inputs` | object |  | Input parameters for the pipeline (key-value pairs for spec:inputs) |

### `retry_pipeline`

*✏️ Writes*

Retry a failed or canceled pipeline. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline to retry |

### `cancel_pipeline`

*✏️ Writes*

Cancel a running pipeline. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline to cancel |

### `list_pipeline_schedules`

*📖 Read-only*

List pipeline schedules in a project, optionally filtered to active or inactive. Use this to survey a project's scheduled pipelines and their `cron`, `next_run_at`, and `active` state, optionally narrowed with `scope` to `active` or `inactive`; use `list_pipelines` for pipelines that already ran and `get_pipeline_schedule` when the schedule ID is known. The list response carries no `variables` — call `get_pipeline_schedule` for those — and includes `inputs` only for Maintainers, Owners, or the schedule owner. It is read-only and paginated, requires project access, and returns schedule records or an error when the project is missing or access is denied.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `scope` | enum (`active` \| `inactive`) |  | Return only active or only inactive pipeline schedules |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_pipeline_schedule`

*📖 Read-only*

Get details of a specific pipeline schedule, including its variables and last pipeline. Use this to inspect one schedule's cron, owner, last pipeline, variables, and inputs; use `list_pipeline_schedules` to discover schedule IDs and `list_pipeline_schedule_pipelines` for the pipelines it produced. It is read-only, returns `variables` and `inputs` only to Maintainers, Owners, or the schedule owner, and returns the schedule or an error when the schedule is missing or access is denied.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |

### `list_pipeline_schedule_pipelines`

*📖 Read-only*

List the pipelines that a pipeline schedule has triggered. Use this to review the pipelines a schedule has actually triggered, for example to see whether the nightly run succeeded; use `get_pipeline` for one pipeline's full detail and `list_pipelines` for project-wide filtering. Narrow the result with `scope`, `status`, `sort`, and the `created_*` / `updated_*` date bounds. It is read-only and paginated, requires project access, and returns pipeline records or an error when the schedule is missing or access is denied.

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

Create a new pipeline schedule for a branch or tag. Use this to add a recurring pipeline for a branch or tag; use `create_pipeline` to run a pipeline once now and `update_pipeline_schedule` once the schedule exists. `ref` accepts a short name or a full ref such as `refs/heads/main`, which you should prefer when a branch and tag share a name; `cron_timezone` defaults to `UTC` and `active` defaults to true. It creates remote CI configuration, requires the Developer, Maintainer, or Owner role plus permission to run pipelines on the target ref, and returns the new schedule or a validation, cron, ref, or permission error.

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

Update an existing pipeline schedule. Use this to change an existing schedule's cron, ref, description, inputs, or `active` flag; call `take_ownership_pipeline_schedule` first when the schedule belongs to another user, because GitLab rejects edits from non-owners. Every field is optional and GitLab reschedules the next run after the update. It changes remote CI configuration, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns the updated schedule or a validation, cron, or permission error.

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

Delete a pipeline schedule. Use this only after confirming the schedule with `get_pipeline_schedule`; use `update_pipeline_schedule` with `active: false` to pause a schedule instead of removing it. The operation permanently removes the schedule and its variables, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns a confirmation or a missing-resource or permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule to delete |

### `play_pipeline_schedule`

*✏️ Writes*

Run a pipeline schedule immediately. Use this to run a schedule's pipeline immediately without waiting for its cron; it does not shift `next_run_at`, so the regular cadence continues unchanged, and it does not modify the schedule itself. Use `create_pipeline` when you want a one-off pipeline that is unrelated to a schedule. It creates a pipeline on GitLab, requires ownership of the schedule and permission to run pipelines on its ref, is rate-limited to once per minute per schedule, and returns GitLab's acknowledgement message or a permission, rate-limit, or missing-schedule error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule to run |

### `take_ownership_pipeline_schedule`

*✏️ Writes*

Take ownership of a pipeline schedule. Use this to transfer a schedule's ownership to the authenticated user, which is the prerequisite for `update_pipeline_schedule` or `delete_pipeline_schedule` on someone else's schedule; it does not otherwise change the cron, ref, or variables. It changes remote ownership, requires the Maintainer or Owner role, and returns the schedule with its new owner or a permission or missing-schedule error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule to take ownership of |

### `get_pipeline_schedule_variable`

*📖 Read-only*

Get a single variable of a pipeline schedule. Use this to read one variable attached to a pipeline schedule by key; use `get_pipeline_schedule` to list every variable at once and `get_project_variable` for project-level CI/CD variables, which are a separate set. It is read-only, requires the Maintainer or Owner role or ownership of the schedule (GitLab 18.7 or later exposes this endpoint), and returns the variable or an error when the schedule, key, or permission is missing.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |
| `key` | string | ✓ | The key of the variable |

### `create_pipeline_schedule_variable`

*✏️ Writes*

Create a variable for a pipeline schedule. Use this to attach a new variable to a pipeline schedule so its scheduled pipelines receive it; use `update_pipeline_schedule_variable` when the key already exists and `create_project_variable` for a project-wide variable. `variable_type` defaults to `env_var` and `key` is limited to 255 characters matching /[a-zA-Z0-9_]+/. It creates remote CI configuration, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns the new variable or a validation, duplicate-key, or permission error.

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

Update a variable of a pipeline schedule. Use this to change the value or type of an existing pipeline schedule variable; use `create_pipeline_schedule_variable` when the key does not exist yet. It changes remote CI configuration that scheduled pipelines consume, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns the updated variable or a missing-key, validation, or permission error.

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

Delete a variable from a pipeline schedule. Use this only after confirming the key with `get_pipeline_schedule` or `get_pipeline_schedule_variable`; use `update_pipeline_schedule_variable` to change a value without removing it. The operation permanently removes the variable from the schedule so later scheduled pipelines no longer receive it, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns a confirmation or a missing-key or permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_schedule_id` | string | ✓ | The ID of the pipeline schedule |
| `key` | string | ✓ | The key of the variable to delete |

### `play_pipeline_job`

*✏️ Writes*

Run a manual pipeline job. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `job_variables_attributes` | array<object> |  | Custom job variables to use when running the job |
| `job_inputs` | object |  | Typed job input values |

### `play_pipeline_jobs`

*✏️ Writes*

Play multiple manual pipeline jobs sequentially. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Retry a failed or canceled pipeline job. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `job_inputs` | object |  | Typed job input values |

### `cancel_pipeline_job`

*✏️ Writes*

Cancel a running pipeline job. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `force` | boolean |  | Force cancellation of the job |

### `erase_pipeline_job`

*✏️ Writes*

Erase a pipeline job log and artifacts. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |

### `wait_for_pipeline`

*📖 Read-only*

Wait for a pipeline to reach a terminal status. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |
| `timeout_seconds` | integer |  | Maximum seconds to wait for this pipeline to reach a terminal status |
| `poll_interval_seconds` | integer |  | Seconds between status polls while waiting for this pipeline |

### `wait_for_job`

*📖 Read-only*

Wait for a job to reach a terminal status. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `timeout_seconds` | integer |  | Maximum seconds to wait for this job to reach a terminal status |
| `poll_interval_seconds` | integer |  | Seconds between status polls while waiting for this job |

### `list_job_artifacts`

*📖 Read-only*

List artifact files in a job's archive. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `path` | string |  | Directory path within the artifacts archive (defaults to root) |
| `recursive` | boolean |  | Whether to list artifacts recursively |

### `download_job_artifacts`

*📖 Read-only*

Download job artifact archive (zip) and save to a local path. Use this to retrieve a pipeline job's artifact archive; remote HTTP mode returns a download URL while local mode saves the archive to a local path. It is read-only but may create a local file in stdio mode, requires job/project access, and returns the download result or an artifact/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `local_path` | string |  | Local directory to save the artifact archive (defaults to current directory) |

### `get_job_artifact_file`

*📖 Read-only*

Get content of a single file from a job's artifacts. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `artifact_path` | string | ✓ | Path to the file within the artifacts archive |
