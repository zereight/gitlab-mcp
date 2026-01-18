import * as z from "zod";
import {
  ListPipelinesSchema,
  GetPipelineSchema,
  ListPipelineJobsSchema,
  ListPipelineTriggerJobsSchema,
  GetPipelineJobOutputSchema,
} from "./schema-readonly";
import {
  CreatePipelineSchema,
  RetryPipelineSchema,
  CancelPipelineSchema,
  PlayPipelineJobSchema,
  RetryPipelineJobSchema,
  CancelPipelineJobSchema,
} from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { enhancedFetch } from "../../utils/fetch";
import { logger } from "../../logger";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Pipelines tools registry - unified registry containing all pipeline operation tools with their handlers
 */
export const pipelinesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "list_pipelines",
    {
      name: "list_pipelines",
      description:
        "BROWSE: Search and monitor CI/CD pipelines in a project. Use when: Monitoring build/deployment status, Finding specific pipeline runs, Analyzing CI/CD history and trends. Supports filtering by status, branch, user, and date range. Returns pipeline ID, status, ref, commit SHA, and timing information.",
      inputSchema: z.toJSONSchema(ListPipelinesSchema),
      handler: async (args: unknown) => {
        const options = ListPipelinesSchema.parse(args);

        return gitlab.get(`projects/${normalizeProjectId(options.project_id)}/pipelines`, {
          query: toQuery(options, ["project_id"]),
        });
      },
    },
  ],
  [
    "get_pipeline",
    {
      name: "get_pipeline",
      description:
        "ANALYZE: Get comprehensive details about a specific pipeline run. Use when: Debugging CI/CD failures and issues, Inspecting pipeline configuration and timing, Understanding what triggered the run. Returns commit details, branch/tag info, duration metrics, and failure reasons. Essential for pipeline troubleshooting.",
      inputSchema: z.toJSONSchema(GetPipelineSchema),
      handler: async (args: unknown) => {
        const options = GetPipelineSchema.parse(args);

        return gitlab.get(
          `projects/${normalizeProjectId(options.project_id)}/pipelines/${options.pipeline_id}`
        );
      },
    },
  ],
  [
    "list_pipeline_jobs",
    {
      name: "list_pipeline_jobs",
      description:
        "INSPECT: Get all CI/CD jobs within a pipeline run. Use when: Identifying failed jobs and stages, Understanding pipeline job structure, Analyzing job timing and performance. Returns job names, stages, status, duration, and runner info. Supports filtering by scope (failed, success, manual) for targeted troubleshooting.",
      inputSchema: z.toJSONSchema(ListPipelineJobsSchema),
      handler: async (args: unknown) => {
        const options = ListPipelineJobsSchema.parse(args);

        return gitlab.get(
          `projects/${normalizeProjectId(options.project_id)}/pipelines/${options.pipeline_id}/jobs`,
          { query: toQuery(options, ["project_id", "pipeline_id"]) }
        );
      },
    },
  ],
  [
    "list_pipeline_trigger_jobs",
    {
      name: "list_pipeline_trigger_jobs",
      description:
        "BRIDGE: List jobs that trigger downstream pipelines in multi-project setups. Use when: Understanding cross-project CI/CD flows, Debugging pipeline dependencies, Analyzing parent-child pipeline connections. Bridge jobs link projects together. Returns trigger configuration and downstream pipeline status.",
      inputSchema: z.toJSONSchema(ListPipelineTriggerJobsSchema),
      handler: async (args: unknown) => {
        const options = ListPipelineTriggerJobsSchema.parse(args);

        return gitlab.get(
          `projects/${normalizeProjectId(options.project_id)}/pipelines/${options.pipeline_id}/bridges`,
          { query: toQuery(options, ["project_id", "pipeline_id"]) }
        );
      },
    },
  ],
  [
    "get_pipeline_job",
    {
      name: "get_pipeline_job",
      description:
        "DETAILS: Get detailed information about a specific CI/CD job. Use when: Debugging individual job failures, Inspecting job configuration and variables, Understanding job dependencies and artifacts. Shows job script, runner tags, artifact paths, and failure details. Essential for job-level troubleshooting.",
      inputSchema: z.toJSONSchema(GetPipelineJobOutputSchema),
      handler: async (args: unknown) => {
        const options = GetPipelineJobOutputSchema.parse(args);

        return gitlab.get(
          `projects/${normalizeProjectId(options.project_id)}/jobs/${options.job_id}`
        );
      },
    },
  ],
  [
    "get_pipeline_job_output",
    {
      name: "get_pipeline_job_output",
      description:
        "LOGS: Fetch console output/logs from a CI/CD job execution. Use when: Debugging job failures and errors, Reviewing test results and build output, Analyzing command execution traces. Supports output limiting for large logs. Returns raw text showing all commands and output. Critical for troubleshooting CI/CD issues.",
      inputSchema: z.toJSONSchema(GetPipelineJobOutputSchema),
      handler: async (args: unknown) => {
        const options = GetPipelineJobOutputSchema.parse(args);
        const { project_id, job_id, limit, max_lines, start } = options;

        // Custom handling - trace endpoint returns text, needs line processing
        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/jobs/${job_id}/trace`;
        const response = await enhancedFetch(apiUrl);

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        let trace = await response.text();
        const lines = trace.split("\n");
        const totalLines = lines.length;

        const defaultMaxLines = 200;
        let processedLines: string[] = [];

        let maxLinesToShow = defaultMaxLines;
        if (max_lines !== undefined) {
          maxLinesToShow = max_lines;
        } else if (limit !== undefined) {
          maxLinesToShow = limit;
        }

        let outOfBoundsMessage = "";

        if (start !== undefined && start < 0) {
          processedLines = lines.slice(start);
          if (processedLines.length > maxLinesToShow) {
            processedLines = processedLines.slice(-maxLinesToShow);
          }
        } else if (start !== undefined && start >= 0) {
          if (start >= totalLines) {
            processedLines = [];
            outOfBoundsMessage = `[OUT OF BOUNDS: Start position ${start} exceeds total lines ${totalLines}. Available range: 0-${totalLines - 1}]`;
          } else {
            processedLines = lines.slice(start, start + maxLinesToShow);
            if (start + maxLinesToShow > totalLines) {
              const availableFromStart = totalLines - start;
              outOfBoundsMessage = `[PARTIAL REQUEST: Requested ${maxLinesToShow} lines from position ${start}, but only ${availableFromStart} lines available]`;
            }
          }
        } else {
          processedLines = lines.slice(-maxLinesToShow);
        }

        const actualDataLines = processedLines.length;

        if (outOfBoundsMessage) {
          processedLines.unshift(outOfBoundsMessage);
        }

        if (processedLines.length < totalLines && !outOfBoundsMessage) {
          const truncatedCount = totalLines - actualDataLines;
          processedLines.unshift(
            `[LOG TRUNCATED: Showing last ${actualDataLines} of ${totalLines} lines - ${truncatedCount} lines hidden]`
          );
        }

        trace = processedLines.join("\n");

        return { trace, totalLines, shownLines: actualDataLines };
      },
    },
  ],
  [
    "create_pipeline",
    {
      name: "create_pipeline",
      description:
        "CREATE: Trigger a new CI/CD pipeline run on demand. Use when: Manually starting builds or deployments, Running tests on specific branches, Initiating custom pipeline workflows. Requires ref (branch/tag) specification. Can pass variables to customize pipeline behavior. Returns created pipeline details immediately.",
      inputSchema: z.toJSONSchema(CreatePipelineSchema),
      handler: async (args: unknown) => {
        const options = CreatePipelineSchema.parse(args);
        const { project_id, ref, variables } = options;

        // Custom handling - ref in query, variables in body with detailed error handling
        const queryParams = new URLSearchParams();
        queryParams.set("ref", ref);

        const body: Record<string, unknown> = {};
        if (variables && variables.length > 0) {
          body.variables = variables;
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/pipeline?${queryParams}`;

        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
          try {
            const errorBody = (await response.json()) as Record<string, unknown>;

            if (errorBody.message) {
              if (typeof errorBody.message === "string") {
                errorMessage += ` - ${errorBody.message}`;
              } else if (typeof errorBody.message === "object" && errorBody.message !== null) {
                const errorDetails: string[] = [];
                const messageObj = errorBody.message as Record<string, unknown>;

                Object.keys(messageObj).forEach(key => {
                  const value = messageObj[key];
                  if (Array.isArray(value)) {
                    errorDetails.push(`${key}: ${value.join(", ")}`);
                  } else {
                    errorDetails.push(`${key}: ${String(value)}`);
                  }
                });

                if (errorDetails.length > 0) {
                  errorMessage += ` - ${errorDetails.join("; ")}`;
                }
              }
            }
            if (typeof errorBody.error === "string") {
              errorMessage += ` - ${errorBody.error}`;
            }
            if (Array.isArray(errorBody.errors)) {
              errorMessage += ` - ${errorBody.errors.map(e => String(e)).join(", ")}`;
            }

            logger.error(
              { status: response.status, errorBody, url: apiUrl },
              "create_pipeline failed"
            );
          } catch {
            logger.error(
              { status: response.status, url: apiUrl },
              "create_pipeline failed (could not parse error)"
            );
          }
          throw new Error(errorMessage);
        }

        const pipeline = (await response.json()) as Record<string, unknown>;
        return pipeline;
      },
    },
  ],
  [
    "retry_pipeline",
    {
      name: "retry_pipeline",
      description:
        "RETRY: Re-run a previously failed or canceled pipeline with same configuration. Use when: Retrying after fixing flaky tests, Recovering from temporary failures, Re-running without losing successful job results. Retries failed/canceled jobs while preserving successful ones. More efficient than creating new pipeline.",
      inputSchema: z.toJSONSchema(RetryPipelineSchema),
      handler: async (args: unknown) => {
        const options = RetryPipelineSchema.parse(args);

        return gitlab.post(
          `projects/${normalizeProjectId(options.project_id)}/pipelines/${options.pipeline_id}/retry`
        );
      },
    },
  ],
  [
    "cancel_pipeline",
    {
      name: "cancel_pipeline",
      description:
        'CANCEL: Stop a currently executing pipeline and all its jobs. Use when: Halting unnecessary or incorrect runs, Stopping problematic deployments, Freeing up busy runners. Cancels all pending and running jobs immediately. Pipeline status changes to "canceled" and cannot be resumed.',
      inputSchema: z.toJSONSchema(CancelPipelineSchema),
      handler: async (args: unknown) => {
        const options = CancelPipelineSchema.parse(args);

        return gitlab.post(
          `projects/${normalizeProjectId(options.project_id)}/pipelines/${options.pipeline_id}/cancel`
        );
      },
    },
  ],
  [
    "play_pipeline_job",
    {
      name: "play_pipeline_job",
      description:
        "PLAY: Trigger a manual job that requires user intervention. Use when: Executing deployment gates and approvals, Running optional or conditional jobs, Proceeding with manual pipeline steps. Manual jobs pause pipeline flow until explicitly triggered. Can pass job variables for runtime configuration.",
      inputSchema: z.toJSONSchema(PlayPipelineJobSchema),
      handler: async (args: unknown) => {
        const options = PlayPipelineJobSchema.parse(args);
        const { project_id, job_id, ...body } = options;

        return gitlab.post(`projects/${normalizeProjectId(project_id)}/jobs/${job_id}/play`, {
          body,
          contentType: "json",
        });
      },
    },
  ],
  [
    "retry_pipeline_job",
    {
      name: "retry_pipeline_job",
      description:
        "RETRY JOB: Re-run a specific failed or canceled job within a pipeline. Use when: Retrying individual job failures, Avoiding full pipeline re-run, Fixing targeted job issues. Preserves pipeline context and job dependencies. More efficient and targeted than full pipeline retry.",
      inputSchema: z.toJSONSchema(RetryPipelineJobSchema),
      handler: async (args: unknown) => {
        const options = RetryPipelineJobSchema.parse(args);

        return gitlab.post(
          `projects/${normalizeProjectId(options.project_id)}/jobs/${options.job_id}/retry`
        );
      },
    },
  ],
  [
    "cancel_pipeline_job",
    {
      name: "cancel_pipeline_job",
      description:
        'CANCEL JOB: Stop a specific running job without affecting other pipeline jobs. Use when: Canceling long-running or stuck jobs, Stopping problematic jobs while preserving others, Freeing specific job resources. Job status changes to "canceled". Pipeline continues if other jobs can proceed.',
      inputSchema: z.toJSONSchema(CancelPipelineJobSchema),
      handler: async (args: unknown) => {
        const options = CancelPipelineJobSchema.parse(args);

        return gitlab.post(
          `projects/${normalizeProjectId(options.project_id)}/jobs/${options.job_id}/cancel`
        );
      },
    },
  ],
]);

export function getPipelinesReadOnlyToolNames(): string[] {
  return [
    "list_pipelines",
    "get_pipeline",
    "list_pipeline_jobs",
    "list_pipeline_trigger_jobs",
    "get_pipeline_job",
    "get_pipeline_job_output",
  ];
}

export function getPipelinesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(pipelinesToolRegistry.values());
}

export function getFilteredPipelinesTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getPipelinesReadOnlyToolNames();
    return Array.from(pipelinesToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getPipelinesToolDefinitions();
}
