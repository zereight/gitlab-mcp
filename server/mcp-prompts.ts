// npm ships build/ only, so the text is inlined.

/**
 * Static MCP prompt catalog. These wrap the multi-step tool workflows documented in
 * skills/gitlab-mcp/ so MCP clients that surface prompts (e.g. slash commands) can
 * trigger them without the agent needing to read the Skill first. Kept inline (not
 * loaded from skills/gitlab-mcp/*.md) since only "build" ships in the npm package.
 */
const prompts = [
  {
    name: "review_merge_request",
    description: "Review a merge request's diff in batches and leave threaded comments.",
    arguments: [
      { name: "project_id", description: "Numeric project ID or URL-encoded path", required: true },
      { name: "merge_request_iid", description: "Merge request IID", required: true },
    ],
    render: (args: Record<string, string>) =>
      `Review merge request !${args.merge_request_iid ?? "<iid>"} in project ${args.project_id ?? "<project_id>"}:\n` +
      `1. Call list_merge_request_changed_files to get the changed file list (use excluded_file_patterns for lockfiles/dist/generated files).\n` +
      `2. Call get_merge_request_file_diff in batches of 3-5 files, prioritizing source over config/tests.\n` +
      `3. Leave inline findings with create_merge_request_thread (position: new_path/new_line). For a general note, call discover_tools with category "merge_requests", then create_merge_request_note.\n` +
      `4. Summarize the review verdict in a final top-level note.`,
  },
  {
    name: "triage_pipeline_failure",
    description: "Find the failing job in a pipeline and pull its log tail for diagnosis.",
    arguments: [
      { name: "project_id", description: "Numeric project ID or URL-encoded path", required: true },
      { name: "pipeline_id", description: "Pipeline ID", required: true },
    ],
    render: (args: Record<string, string>) =>
      `Diagnose pipeline ${args.pipeline_id ?? "<pipeline_id>"} in project ${args.project_id ?? "<project_id>"}:\n` +
      `1. Call list_pipeline_jobs to find jobs with status "failed".\n` +
      `2. Call get_pipeline_job_output (or the job trace tool) on each failed job, focusing on the tail of the log.\n` +
      `3. Identify the root cause (compile error, test failure, timeout, runner issue) and quote the relevant log lines.\n` +
      `4. Suggest the fix or the next diagnostic step.`,
  },
  {
    name: "triage_vulnerabilities",
    description: "List a project's open vulnerabilities and propose a remediation priority order.",
    arguments: [
      { name: "project_id", description: "Numeric project ID or URL-encoded path", required: true },
    ],
    render: (args: Record<string, string>) =>
      `Triage vulnerabilities for project ${args.project_id ?? "<project_id>"}:\n` +
      `1. Call list_project_vulnerabilities once with state=detected and once with state=confirmed ` +
      `(the tool only accepts one state per call). Follow pageInfo.endCursor with the "after" ` +
      `param while pageInfo.hasNextPage is true, and aggregate both states' results.\n` +
      `2. Group the aggregated results by severity (critical > high > medium > low) and by whether a fix is already available.\n` +
      `3. Propose a remediation order, calling out any critical/high items with no available fix.`,
  },
] as const;

export function listMcpPrompts(): {
  prompts: readonly {
    name: string;
    description: string;
    arguments: readonly { name: string; description: string; required: boolean }[];
  }[];
} {
  return {
    prompts: prompts.map(({ name, description, arguments: args }) => ({
      name,
      description,
      arguments: args,
    })),
  };
}

export function getMcpPrompt(
  name: string,
  args: Record<string, string>
): {
  description: string;
  messages: readonly {
    role: "user";
    content: { type: "text"; text: string };
  }[];
} {
  const prompt = prompts.find(p => p.name === name);
  if (!prompt) {
    throw new Error(`Unknown prompt: ${name}`);
  }
  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: prompt.render(args),
        },
      },
    ],
  };
}
