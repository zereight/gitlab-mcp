# Pipeline Operations

> **Opt-in toolset**: Enable with `USE_PIPELINE=true` or `GITLAB_TOOLSETS=pipelines`

## List & Inspect

```text
list_pipelines             -> list pipelines with filters (status, ref, source)
get_pipeline               -> pipeline details (status, duration, coverage)
get_pipeline_variables     -> variables configured on a pipeline
get_pipeline_test_report   -> full unit test report
get_pipeline_test_report_summary -> summarized unit test report
update_pipeline_metadata   -> rename a pipeline
delete_pipeline            -> permanently delete a pipeline and related data
list_pipeline_jobs         -> all jobs in a pipeline
list_pipeline_trigger_jobs -> trigger/bridge jobs (downstream pipelines)
get_pipeline_job           -> single job details
get_pipeline_job_output    -> job log output (supports pagination for large logs)
```

Inspection tools take `project_id` and `pipeline_id`; variables and test reports also accept
`page` and `per_page`. Reading requires project pipeline access. `update_pipeline_metadata`
also takes `name` and requires permission to administer pipelines. `delete_pipeline` requires
the project Owner role and irreversibly deletes the pipeline plus related jobs, logs, artifacts,
and triggers; child pipelines are not automatically deleted.

## Create & Control

```
create_pipeline            -> trigger new pipeline for a branch/tag
  project_id: "my-group/my-project"
  ref: "main"
  variables: [{ key: "DEPLOY_ENV", value: "staging" }]
```

```
retry_pipeline             -> retry all failed jobs in a pipeline
cancel_pipeline            -> cancel running pipeline
play_pipeline_job          -> run a manual job
play_pipeline_jobs         -> run multiple manual jobs sequentially
retry_pipeline_job         -> retry a single failed job
cancel_pipeline_job        -> cancel a single running job
erase_pipeline_job         -> erase a job log and artifacts
wait_for_pipeline          -> poll until a pipeline reaches a terminal status
wait_for_job               -> poll until a job reaches a terminal status
```

`play_pipeline_job` and `retry_pipeline_job` accept `job_inputs` for typed manual-job inputs.

## Artifacts

```
list_job_artifacts         -> list files in a job's artifact archive
get_job_artifact_file      -> get content of a single artifact file
download_job_artifacts     -> download full artifact archive (zip) to local_path
```

## Deployments & Environments

```
list_deployments           -> list deployments with filters
get_deployment             -> deployment details, including approval_summary, approvals, and pending_approval_count when GitLab provides them
create_deployment          -> create a deployment record
update_deployment          -> update deployment status
delete_deployment          -> delete a deployment
list_deployment_merge_requests -> merge requests shipped by a deployment
approve_deployment         -> approve or reject a protected deployment
list_environments          -> list project environments
get_environment            -> environment details
update_environment         -> update environment settings
delete_environment         -> delete a stopped environment
stop_environment           -> stop one environment
stop_stale_environments    -> stop environments older than a cutoff
delete_review_app_environments -> clean up stopped review apps
```

`stop_stale_environments` excludes protected environments and only stops (never deletes).
`delete_review_app_environments` schedules deletion one week later and defaults to `dry_run: true`.

## Pipeline Triggers

```
list/get/create/update/delete_pipeline_trigger -> manage project trigger tokens
trigger_pipeline             -> run a pipeline with a trigger token
```

## Common Patterns

### Check why a pipeline failed

1. `list_pipelines` with `status: "failed"` -> get pipeline ID
2. `list_pipeline_jobs` -> find failed job(s)
3. `get_pipeline_job_output` -> read error logs

### Retry failed pipeline

1. `retry_pipeline` -> retries all failed jobs
   OR
2. `retry_pipeline_job` -> retry specific job only

### Download test results

1. `list_job_artifacts` -> find the test report file path
2. `get_job_artifact_file` -> read the report content
