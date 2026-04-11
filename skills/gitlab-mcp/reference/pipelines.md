# Pipeline Operations

> **Opt-in toolset**: Enable with `USE_PIPELINE=true` or `GITLAB_TOOLSETS=pipelines`

## List & Inspect

```
list_pipelines             -> list pipelines with filters (status, ref, source)
get_pipeline               -> pipeline details (status, duration, coverage)
list_pipeline_jobs         -> all jobs in a pipeline
list_pipeline_trigger_jobs -> trigger/bridge jobs (downstream pipelines)
get_pipeline_job           -> single job details
get_pipeline_job_output    -> job log output (supports pagination for large logs)
```

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
retry_pipeline_job         -> retry a single failed job
cancel_pipeline_job        -> cancel a single running job
```

## Artifacts

```
list_job_artifacts         -> list files in a job's artifact archive
get_job_artifact_file      -> get content of a single artifact file
download_job_artifacts     -> download full artifact archive (zip) to local_path
```

## Deployments & Environments

```
list_deployments           -> list deployments with filters
get_deployment             -> deployment details
list_environments          -> list project environments
get_environment            -> environment details
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
