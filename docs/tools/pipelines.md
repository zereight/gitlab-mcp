# Pipelines, Jobs & Deployments

Pipeline + job control (trigger, retry, cancel, play manual jobs, fetch logs/artifacts), and the deployments/environments view.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=pipelines` (or `GITLAB_TOOLSETS=all`), or use the legacy `USE_PIPELINE=true` flag for backward compatibility.

## Tools in this group

- [`list_pipelines`](#list_pipelines) — 📖 Read-only
- [`get_pipeline`](#get_pipeline) — 📖 Read-only
- [`list_deployments`](#list_deployments) — 📖 Read-only
- [`get_deployment`](#get_deployment) — 📖 Read-only
- [`list_environments`](#list_environments) — 📖 Read-only
- [`get_environment`](#get_environment) — 📖 Read-only
- [`list_pipeline_jobs`](#list_pipeline_jobs) — 📖 Read-only
- [`list_pipeline_trigger_jobs`](#list_pipeline_trigger_jobs) — 📖 Read-only
- [`get_pipeline_job`](#get_pipeline_job) — 📖 Read-only
- [`get_pipeline_job_output`](#get_pipeline_job_output) — 📖 Read-only
- [`create_pipeline`](#create_pipeline) — ✏️ Writes
- [`retry_pipeline`](#retry_pipeline) — ✏️ Writes
- [`cancel_pipeline`](#cancel_pipeline) — ✏️ Writes
- [`play_pipeline_job`](#play_pipeline_job) — ✏️ Writes
- [`retry_pipeline_job`](#retry_pipeline_job) — ✏️ Writes
- [`cancel_pipeline_job`](#cancel_pipeline_job) — ✏️ Writes
- [`list_job_artifacts`](#list_job_artifacts) — 📖 Read-only
- [`download_job_artifacts`](#download_job_artifacts) — 📖 Read-only
- [`get_job_artifact_file`](#get_job_artifact_file) — 📖 Read-only

---

### `list_pipelines`

*📖 Read-only*

List pipelines with filtering options

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

Get details of a specific pipeline

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline |

### `list_deployments`

*📖 Read-only*

List deployments with filtering options

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

Get details of a specific deployment

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `deployment_id` | string | ✓ | The ID of the deployment |

### `list_environments`

*📖 Read-only*

List environments in a project

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

Get details of a specific environment

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `environment_id` | string | ✓ | The ID of the environment |

### `list_pipeline_jobs`

*📖 Read-only*

List all jobs in a specific pipeline

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

List trigger jobs (bridges) in a pipeline

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

Get details of a GitLab pipeline job number

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |

### `get_pipeline_job_output`

*📖 Read-only*

Get the output/trace of a pipeline job with optional pagination

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `limit` | number |  | Maximum number of lines to return from the end of the log (default/max: 1000) |
| `offset` | number |  | Number of lines to skip from the end of the log (default: 0) |

### `create_pipeline`

*✏️ Writes*

Create a new pipeline for a branch or tag

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `ref` | string | ✓ | The branch or tag to run the pipeline on |
| `variables` | array<object> |  | An array of variables to use for the pipeline |
| `inputs` | object |  | Input parameters for the pipeline (key-value pairs for spec:inputs) |

### `retry_pipeline`

*✏️ Writes*

Retry a failed or canceled pipeline

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline to retry |

### `cancel_pipeline`

*✏️ Writes*

Cancel a running pipeline

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `pipeline_id` | string | ✓ | The ID of the pipeline to cancel |

### `play_pipeline_job`

*✏️ Writes*

Run a manual pipeline job

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `job_variables_attributes` | array<object> |  | Custom job variables to use when running the job |

### `retry_pipeline_job`

*✏️ Writes*

Retry a failed or canceled pipeline job

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |

### `cancel_pipeline_job`

*✏️ Writes*

Cancel a running pipeline job

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `force` | boolean |  | Force cancellation of the job |

### `list_job_artifacts`

*📖 Read-only*

List artifact files in a job's archive

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `path` | string |  | Directory path within the artifacts archive (defaults to root) |
| `recursive` | boolean |  | Whether to list artifacts recursively |

### `download_job_artifacts`

*📖 Read-only*

Download job artifact archive (zip) and save to a local path

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `local_path` | string |  | Local directory to save the artifact archive (defaults to current directory) |

### `get_job_artifact_file`

*📖 Read-only*

Get content of a single file from a job's artifacts

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `job_id` | string | ✓ | The ID of the job |
| `artifact_path` | string | ✓ | Path to the file within the artifacts archive |
