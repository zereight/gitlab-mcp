/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { zodToJsonSchema } from "zod-to-json-schema";
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
import { enhancedFetch } from "../../utils/fetch";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { cleanGidsFromObject } from "../../utils/idConversion";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Pipelines tools registry - unified registry containing all pipeline operation tools with their handlers
 */
export const pipelinesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // Read-only tools
  [
    "list_pipelines",
    {
      name: "list_pipelines",
      description:
        "BROWSE: Search and monitor CI/CD pipelines in a project. Use when: Monitoring build/deployment status, Finding specific pipeline runs, Analyzing CI/CD history and trends. Supports filtering by status, branch, user, and date range. Returns pipeline ID, status, ref, commit SHA, and timing information.",
      inputSchema: zodToJsonSchema(ListPipelinesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListPipelinesSchema.parse(args);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== "project_id") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(options.project_id)}/pipelines?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const pipelines = await response.json();
        return cleanGidsFromObject(pipelines);
      },
    },
  ],
  [
    "get_pipeline",
    {
      name: "get_pipeline",
      description:
        "ANALYZE: Get comprehensive details about a specific pipeline run. Use when: Debugging CI/CD failures and issues, Inspecting pipeline configuration and timing, Understanding what triggered the run. Returns commit details, branch/tag info, duration metrics, and failure reasons. Essential for pipeline troubleshooting.",
      inputSchema: zodToJsonSchema(GetPipelineSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetPipelineSchema.parse(args);
        const { project_id, pipeline_id } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/pipelines/${pipeline_id}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const pipeline = await response.json();
        return cleanGidsFromObject(pipeline);
      },
    },
  ],
  [
    "list_pipeline_jobs",
    {
      name: "list_pipeline_jobs",
      description:
        "INSPECT: Get all CI/CD jobs within a pipeline run. Use when: Identifying failed jobs and stages, Understanding pipeline job structure, Analyzing job timing and performance. Returns job names, stages, status, duration, and runner info. Supports filtering by scope (failed, success, manual) for targeted troubleshooting.",
      inputSchema: zodToJsonSchema(ListPipelineJobsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListPipelineJobsSchema.parse(args);
        const { project_id, pipeline_id } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            key !== "project_id" &&
            key !== "pipeline_id"
          ) {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/pipelines/${pipeline_id}/jobs?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const jobs = await response.json();
        return cleanGidsFromObject(jobs);
      },
    },
  ],
  [
    "list_pipeline_trigger_jobs",
    {
      name: "list_pipeline_trigger_jobs",
      description:
        "BRIDGE: List jobs that trigger downstream pipelines in multi-project setups. Use when: Understanding cross-project CI/CD flows, Debugging pipeline dependencies, Analyzing parent-child pipeline connections. Bridge jobs link projects together. Returns trigger configuration and downstream pipeline status.",
      inputSchema: zodToJsonSchema(ListPipelineTriggerJobsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListPipelineTriggerJobsSchema.parse(args);
        const { project_id, pipeline_id } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            key !== "project_id" &&
            key !== "pipeline_id"
          ) {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/pipelines/${pipeline_id}/bridges?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const bridges = await response.json();
        return cleanGidsFromObject(bridges);
      },
    },
  ],
  [
    "get_pipeline_job",
    {
      name: "get_pipeline_job",
      description:
        "DETAILS: Get detailed information about a specific CI/CD job. Use when: Debugging individual job failures, Inspecting job configuration and variables, Understanding job dependencies and artifacts. Shows job script, runner tags, artifact paths, and failure details. Essential for job-level troubleshooting.",
      inputSchema: zodToJsonSchema(GetPipelineJobOutputSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetPipelineJobOutputSchema.parse(args);
        const { project_id, job_id } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/jobs/${job_id}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const job = await response.json();
        return cleanGidsFromObject(job);
      },
    },
  ],
  [
    "get_pipeline_job_output",
    {
      name: "get_pipeline_job_output",
      description:
        "LOGS: Fetch console output/logs from a CI/CD job execution. Use when: Debugging job failures and errors, Reviewing test results and build output, Analyzing command execution traces. Supports output limiting for large logs. Returns raw text showing all commands and output. Critical for troubleshooting CI/CD issues.",
      inputSchema: zodToJsonSchema(GetPipelineJobOutputSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetPipelineJobOutputSchema.parse(args);
        const { project_id, job_id, limit, max_lines, start } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/jobs/${job_id}/trace`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        let trace = await response.text();
        const lines = trace.split("\n");
        const totalLines = lines.length;

        // Default to 500 lines if no limit specified (to prevent token overflow)
        const defaultMaxLines = 500;
        let processedLines: string[] = [];

        // Determine the number of lines to show
        let maxLinesToShow = defaultMaxLines;
        if (max_lines !== undefined) {
          maxLinesToShow = max_lines;
        } else if (limit !== undefined) {
          // Always treat limit as line count, not character count
          maxLinesToShow = limit;
        }

        // Apply start and limit logic
        let outOfBoundsMessage = "";

        if (start !== undefined && start < 0) {
          // Negative start means from end
          processedLines = lines.slice(start);
          if (processedLines.length > maxLinesToShow) {
            processedLines = processedLines.slice(-maxLinesToShow);
          }
        } else if (start !== undefined && start >= 0) {
          // Positive start means from beginning
          if (start >= totalLines) {
            // Start position is beyond available lines
            processedLines = [];
            outOfBoundsMessage = `[OUT OF BOUNDS: Start position ${start} exceeds total lines ${totalLines}. Available range: 0-${totalLines - 1}]`;
          } else {
            processedLines = lines.slice(start, start + maxLinesToShow);
            if (start + maxLinesToShow > totalLines) {
              // Requested range partially out of bounds
              const availableFromStart = totalLines - start;
              outOfBoundsMessage = `[PARTIAL REQUEST: Requested ${maxLinesToShow} lines from position ${start}, but only ${availableFromStart} lines available]`;
            }
          }
        } else {
          // No start, just take last maxLinesToShow
          processedLines = lines.slice(-maxLinesToShow);
        }

        // Store the actual data lines count before adding info headers
        const actualDataLines = processedLines.length;

        // Add out-of-bounds info if applicable
        if (outOfBoundsMessage) {
          processedLines.unshift(outOfBoundsMessage);
        }

        // Add truncation info if we truncated (and not already out of bounds)
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
  // Write tools
  [
    "create_pipeline",
    {
      name: "create_pipeline",
      description:
        "CREATE: Trigger a new CI/CD pipeline run on demand. Use when: Manually starting builds or deployments, Running tests on specific branches, Initiating custom pipeline workflows. Requires ref (branch/tag) specification. Can pass variables to customize pipeline behavior. Returns created pipeline details immediately.",
      inputSchema: zodToJsonSchema(CreatePipelineSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreatePipelineSchema.parse(args);
        const { project_id, ref, variables } = options;

        // Build query parameters - ref is required in query string
        const queryParams = new URLSearchParams();
        queryParams.set("ref", ref);

        // Build request body - variables go in body if provided
        const body: Record<string, unknown> = {};
        if (variables && variables.length > 0) {
          body.variables = variables;
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/pipeline?${queryParams}`;

        const headers: Record<string, string> = {
          Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          "Content-Type": "application/json",
        };

        const requestOptions: RequestInit = {
          method: "POST",
          headers,
        };

        // Always send body as JSON, even if empty
        requestOptions.body = JSON.stringify(body);

        const response = await enhancedFetch(apiUrl, requestOptions);

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const pipeline = await response.json();
        return cleanGidsFromObject(pipeline);
      },
    },
  ],
  [
    "retry_pipeline",
    {
      name: "retry_pipeline",
      description:
        "RETRY: Re-run a previously failed or canceled pipeline with same configuration. Use when: Retrying after fixing flaky tests, Recovering from temporary failures, Re-running without losing successful job results. Retries failed/canceled jobs while preserving successful ones. More efficient than creating new pipeline.",
      inputSchema: zodToJsonSchema(RetryPipelineSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = RetryPipelineSchema.parse(args);
        const { project_id, pipeline_id } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/pipelines/${pipeline_id}/retry`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const pipeline = await response.json();
        return cleanGidsFromObject(pipeline);
      },
    },
  ],
  [
    "cancel_pipeline",
    {
      name: "cancel_pipeline",
      description:
        'CANCEL: Stop a currently executing pipeline and all its jobs. Use when: Halting unnecessary or incorrect runs, Stopping problematic deployments, Freeing up busy runners. Cancels all pending and running jobs immediately. Pipeline status changes to "canceled" and cannot be resumed.',
      inputSchema: zodToJsonSchema(CancelPipelineSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CancelPipelineSchema.parse(args);
        const { project_id, pipeline_id } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/pipelines/${pipeline_id}/cancel`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const pipeline = await response.json();
        return cleanGidsFromObject(pipeline);
      },
    },
  ],
  [
    "play_pipeline_job",
    {
      name: "play_pipeline_job",
      description:
        "PLAY: Trigger a manual job that requires user intervention. Use when: Executing deployment gates and approvals, Running optional or conditional jobs, Proceeding with manual pipeline steps. Manual jobs pause pipeline flow until explicitly triggered. Can pass job variables for runtime configuration.",
      inputSchema: zodToJsonSchema(PlayPipelineJobSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = PlayPipelineJobSchema.parse(args);
        const { project_id, job_id } = options;

        const body: Record<string, unknown> = {};
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== "project_id" && key !== "job_id") {
            body[key] = value;
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/jobs/${job_id}/play`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const job = await response.json();
        return cleanGidsFromObject(job);
      },
    },
  ],
  [
    "retry_pipeline_job",
    {
      name: "retry_pipeline_job",
      description:
        "RETRY JOB: Re-run a specific failed or canceled job within a pipeline. Use when: Retrying individual job failures, Avoiding full pipeline re-run, Fixing targeted job issues. Preserves pipeline context and job dependencies. More efficient and targeted than full pipeline retry.",
      inputSchema: zodToJsonSchema(RetryPipelineJobSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = RetryPipelineJobSchema.parse(args);
        const { project_id, job_id } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/jobs/${job_id}/retry`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const job = await response.json();
        return cleanGidsFromObject(job);
      },
    },
  ],
  [
    "cancel_pipeline_job",
    {
      name: "cancel_pipeline_job",
      description:
        'CANCEL JOB: Stop a specific running job without affecting other pipeline jobs. Use when: Canceling long-running or stuck jobs, Stopping problematic jobs while preserving others, Freeing specific job resources. Job status changes to "canceled". Pipeline continues if other jobs can proceed.',
      inputSchema: zodToJsonSchema(CancelPipelineJobSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CancelPipelineJobSchema.parse(args);
        const { project_id, job_id } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/jobs/${job_id}/cancel`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const job = await response.json();
        return cleanGidsFromObject(job);
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
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

/**
 * Get all tool definitions from the registry (for backward compatibility)
 */
export function getPipelinesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(pipelinesToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredPipelinesTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getPipelinesReadOnlyToolNames();
    return Array.from(pipelinesToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getPipelinesToolDefinitions();
}
