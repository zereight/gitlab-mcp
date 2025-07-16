import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import path from "path";

import {config} from "./config.js"
import { GitlabHandler } from "./gitlabhandler.js"

import {
  ForkRepositorySchema,
  CreateBranchSchema,
  CreateOrUpdateFileSchema,
  SearchRepositoriesSchema,
  CreateRepositorySchema,
  GetFileContentsSchema,
  PushFilesSchema,
  CreateIssueSchema,
  CreateMergeRequestSchema,
  GetMergeRequestSchema,
  GetMergeRequestDiffsSchema,
  UpdateMergeRequestSchema,
  ListIssuesSchema,
  GetIssueSchema,
  UpdateIssueSchema,
  DeleteIssueSchema,
  ListIssueLinksSchema,
  ListIssueDiscussionsSchema,
  GetIssueLinkSchema,
  CreateIssueLinkSchema,
  DeleteIssueLinkSchema,
  ListNamespacesSchema,
  GetNamespaceSchema,
  VerifyNamespaceSchema,
  GetProjectSchema,
  ListProjectsSchema,
  ListLabelsSchema,
  GetLabelSchema,
  CreateLabelSchema,
  UpdateLabelSchema,
  DeleteLabelSchema,
  CreateNoteSchema,
  CreateMergeRequestThreadSchema,
  ListGroupProjectsSchema,
  ListWikiPagesSchema,
  GetWikiPageSchema,
  CreateWikiPageSchema,
  UpdateWikiPageSchema,
  DeleteWikiPageSchema,
  GetRepositoryTreeSchema,
  GetPipelineSchema,
  ListPipelinesSchema,
  ListPipelineJobsSchema,
  CreatePipelineSchema,
  RetryPipelineSchema,
  CancelPipelineSchema,
  GetPipelineJobOutputSchema,
  UpdateMergeRequestNoteSchema,
  CreateMergeRequestNoteSchema,
  ListMergeRequestDiscussionsSchema,
  UpdateIssueNoteSchema,
  CreateIssueNoteSchema,
  ListMergeRequestsSchema,
  ListProjectMilestonesSchema,
  GetProjectMilestoneSchema,
  CreateProjectMilestoneSchema,
  EditProjectMilestoneSchema,
  DeleteProjectMilestoneSchema,
  GetMilestoneIssuesSchema,
  GetMilestoneMergeRequestsSchema,
  PromoteProjectMilestoneSchema,
  GetMilestoneBurndownEventsSchema,
  GetBranchDiffsSchema,
  GetUsersSchema,
  ListCommitsSchema,
  GetCommitSchema,
  GetCommitDiffSchema,
  ListMergeRequestDiffsSchema,
  GetCurrentUserSchema,
} from "./schemas.js";
import { createCookieJar } from "./authhelpers.js";
import { CookieJar } from "tough-cookie";

/**
 * Read version from package.json
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../package.json");
let SERVER_VERSION = "unknown";
try {
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    SERVER_VERSION = packageJson.version || SERVER_VERSION;
  }
} catch (error) {
  // Warning: Could not read version from package.json - silently continue
}

// create the underlying mcp server
const server = new Server(
  {
    name: "better-gitlab-mcp-server",
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);



// Define all available tools
const allTools = [
  {
    name: "create_or_update_file",
    description: "Create or update a single file in a GitLab project",
    inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema),
  },
  {
    name: "search_repositories",
    description: "Search for GitLab projects",
    inputSchema: zodToJsonSchema(SearchRepositoriesSchema),
  },
  {
    name: "create_repository",
    description: "Create a new GitLab project",
    inputSchema: zodToJsonSchema(CreateRepositorySchema),
  },
  {
    name: "get_file_contents",
    description: "Get the contents of a file or directory from a GitLab project",
    inputSchema: zodToJsonSchema(GetFileContentsSchema),
  },
  {
    name: "push_files",
    description: "Push multiple files to a GitLab project in a single commit",
    inputSchema: zodToJsonSchema(PushFilesSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue in a GitLab project",
    inputSchema: zodToJsonSchema(CreateIssueSchema),
  },
  {
    name: "create_merge_request",
    description: "Create a new merge request in a GitLab project",
    inputSchema: zodToJsonSchema(CreateMergeRequestSchema),
  },
  {
    name: "fork_repository",
    description: "Fork a GitLab project to your account or specified namespace",
    inputSchema: zodToJsonSchema(ForkRepositorySchema),
  },
  {
    name: "create_branch",
    description: "Create a new branch in a GitLab project",
    inputSchema: zodToJsonSchema(CreateBranchSchema),
  },
  {
    name: "get_merge_request",
    description:
      "Get details of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(GetMergeRequestSchema),
  },
  {
    name: "get_merge_request_diffs",
    description:
      "Get the changes/diffs of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(GetMergeRequestDiffsSchema),
  },
  {
    name: "list_merge_request_diffs",
    description:
      "List merge request diffs with pagination support (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(ListMergeRequestDiffsSchema),
  },
  {
    name: "get_branch_diffs",
    description: "Get the changes/diffs between two branches or commits in a GitLab project",
    inputSchema: zodToJsonSchema(GetBranchDiffsSchema),
  },
  {
    name: "update_merge_request",
    description: "Update a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: zodToJsonSchema(UpdateMergeRequestSchema),
  },
  {
    name: "create_note",
    description: "Create a new note (comment) to an issue or merge request",
    inputSchema: zodToJsonSchema(CreateNoteSchema),
  },
  {
    name: "create_merge_request_thread",
    description: "Create a new thread on a merge request",
    inputSchema: zodToJsonSchema(CreateMergeRequestThreadSchema),
  },
  {
    name: "mr_discussions",
    description: "List discussion items for a merge request",
    inputSchema: zodToJsonSchema(ListMergeRequestDiscussionsSchema),
  },
  {
    name: "update_merge_request_note",
    description: "Modify an existing merge request thread note",
    inputSchema: zodToJsonSchema(UpdateMergeRequestNoteSchema),
  },
  {
    name: "create_merge_request_note",
    description: "Add a new note to an existing merge request thread",
    inputSchema: zodToJsonSchema(CreateMergeRequestNoteSchema),
  },
  {
    name: "update_issue_note",
    description: "Modify an existing issue thread note",
    inputSchema: zodToJsonSchema(UpdateIssueNoteSchema),
  },
  {
    name: "create_issue_note",
    description: "Add a new note to an existing issue thread",
    inputSchema: zodToJsonSchema(CreateIssueNoteSchema),
  },
  {
    name: "list_issues",
    description: "List issues in a GitLab project with filtering options",
    inputSchema: zodToJsonSchema(ListIssuesSchema),
  },
  {
    name: "get_issue",
    description: "Get details of a specific issue in a GitLab project",
    inputSchema: zodToJsonSchema(GetIssueSchema),
  },
  {
    name: "update_issue",
    description: "Update an issue in a GitLab project",
    inputSchema: zodToJsonSchema(UpdateIssueSchema),
  },
  {
    name: "delete_issue",
    description: "Delete an issue from a GitLab project",
    inputSchema: zodToJsonSchema(DeleteIssueSchema),
  },
  {
    name: "list_issue_links",
    description: "List all issue links for a specific issue",
    inputSchema: zodToJsonSchema(ListIssueLinksSchema),
  },
  {
    name: "list_issue_discussions",
    description: "List discussions for an issue in a GitLab project",
    inputSchema: zodToJsonSchema(ListIssueDiscussionsSchema),
  },
  {
    name: "get_issue_link",
    description: "Get a specific issue link",
    inputSchema: zodToJsonSchema(GetIssueLinkSchema),
  },
  {
    name: "create_issue_link",
    description: "Create an issue link between two issues",
    inputSchema: zodToJsonSchema(CreateIssueLinkSchema),
  },
  {
    name: "delete_issue_link",
    description: "Delete an issue link",
    inputSchema: zodToJsonSchema(DeleteIssueLinkSchema),
  },
  {
    name: "list_namespaces",
    description: "List all namespaces available to the current user",
    inputSchema: zodToJsonSchema(ListNamespacesSchema),
  },
  {
    name: "get_namespace",
    description: "Get details of a namespace by ID or path",
    inputSchema: zodToJsonSchema(GetNamespaceSchema),
  },
  {
    name: "verify_namespace",
    description: "Verify if a namespace path exists",
    inputSchema: zodToJsonSchema(VerifyNamespaceSchema),
  },
  {
    name: "get_project",
    description: "Get details of a specific project",
    inputSchema: zodToJsonSchema(GetProjectSchema),
  },
  {
    name: "list_projects",
    description: "List projects accessible by the current user",
    inputSchema: zodToJsonSchema(ListProjectsSchema),
  },
  {
    name: "list_labels",
    description: "List labels for a project",
    inputSchema: zodToJsonSchema(ListLabelsSchema),
  },
  {
    name: "get_label",
    description: "Get a single label from a project",
    inputSchema: zodToJsonSchema(GetLabelSchema),
  },
  {
    name: "create_label",
    description: "Create a new label in a project",
    inputSchema: zodToJsonSchema(CreateLabelSchema),
  },
  {
    name: "update_label",
    description: "Update an existing label in a project",
    inputSchema: zodToJsonSchema(UpdateLabelSchema),
  },
  {
    name: "delete_label",
    description: "Delete a label from a project",
    inputSchema: zodToJsonSchema(DeleteLabelSchema),
  },
  {
    name: "list_group_projects",
    description: "List projects in a GitLab group with filtering options",
    inputSchema: zodToJsonSchema(ListGroupProjectsSchema),
  },
  {
    name: "list_wiki_pages",
    description: "List wiki pages in a GitLab project",
    inputSchema: zodToJsonSchema(ListWikiPagesSchema),
  },
  {
    name: "get_wiki_page",
    description: "Get details of a specific wiki page",
    inputSchema: zodToJsonSchema(GetWikiPageSchema),
  },
  {
    name: "create_wiki_page",
    description: "Create a new wiki page in a GitLab project",
    inputSchema: zodToJsonSchema(CreateWikiPageSchema),
  },
  {
    name: "update_wiki_page",
    description: "Update an existing wiki page in a GitLab project",
    inputSchema: zodToJsonSchema(UpdateWikiPageSchema),
  },
  {
    name: "delete_wiki_page",
    description: "Delete a wiki page from a GitLab project",
    inputSchema: zodToJsonSchema(DeleteWikiPageSchema),
  },
  {
    name: "get_repository_tree",
    description: "Get the repository tree for a GitLab project (list files and directories)",
    inputSchema: zodToJsonSchema(GetRepositoryTreeSchema),
  },
  {
    name: "list_pipelines",
    description: "List pipelines in a GitLab project with filtering options",
    inputSchema: zodToJsonSchema(ListPipelinesSchema),
  },
  {
    name: "get_pipeline",
    description: "Get details of a specific pipeline in a GitLab project",
    inputSchema: zodToJsonSchema(GetPipelineSchema),
  },
  {
    name: "list_pipeline_jobs",
    description: "List all jobs in a specific pipeline",
    inputSchema: zodToJsonSchema(ListPipelineJobsSchema),
  },
  {
    name: "get_pipeline_job",
    description: "Get details of a GitLab pipeline job number",
    inputSchema: zodToJsonSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "get_pipeline_job_output",
    description: "Get the output/trace of a GitLab pipeline job with optional pagination to limit context window usage",
    inputSchema: zodToJsonSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "create_pipeline",
    description: "Create a new pipeline for a branch or tag",
    inputSchema: zodToJsonSchema(CreatePipelineSchema),
  },
  {
    name: "retry_pipeline",
    description: "Retry a failed or canceled pipeline",
    inputSchema: zodToJsonSchema(RetryPipelineSchema),
  },
  {
    name: "cancel_pipeline",
    description: "Cancel a running pipeline",
    inputSchema: zodToJsonSchema(CancelPipelineSchema),
  },
  {
    name: "list_merge_requests",
    description: "List merge requests in a GitLab project with filtering options",
    inputSchema: zodToJsonSchema(ListMergeRequestsSchema),
  },
  {
    name: "list_milestones",
    description: "List milestones in a GitLab project with filtering options",
    inputSchema: zodToJsonSchema(ListProjectMilestonesSchema),
  },
  {
    name: "get_milestone",
    description: "Get details of a specific milestone",
    inputSchema: zodToJsonSchema(GetProjectMilestoneSchema),
  },
  {
    name: "create_milestone",
    description: "Create a new milestone in a GitLab project",
    inputSchema: zodToJsonSchema(CreateProjectMilestoneSchema),
  },
  {
    name: "edit_milestone",
    description: "Edit an existing milestone in a GitLab project",
    inputSchema: zodToJsonSchema(EditProjectMilestoneSchema),
  },
  {
    name: "delete_milestone",
    description: "Delete a milestone from a GitLab project",
    inputSchema: zodToJsonSchema(DeleteProjectMilestoneSchema),
  },
  {
    name: "get_milestone_issue",
    description: "Get issues associated with a specific milestone",
    inputSchema: zodToJsonSchema(GetMilestoneIssuesSchema),
  },
  {
    name: "get_milestone_merge_requests",
    description: "Get merge requests associated with a specific milestone",
    inputSchema: zodToJsonSchema(GetMilestoneMergeRequestsSchema),
  },
  {
    name: "promote_milestone",
    description: "Promote a milestone to the next stage",
    inputSchema: zodToJsonSchema(PromoteProjectMilestoneSchema),
  },
  {
    name: "get_milestone_burndown_events",
    description: "Get burndown events for a specific milestone",
    inputSchema: zodToJsonSchema(GetMilestoneBurndownEventsSchema),
  },
  {
    name: "get_users",
    description: "Get GitLab user details by usernames",
    inputSchema: zodToJsonSchema(GetUsersSchema),
  },
  {
    name: "list_commits",
    description: "List repository commits with filtering options",
    inputSchema: zodToJsonSchema(ListCommitsSchema),
  },
  {
    name: "get_commit",
    description: "Get details of a specific commit",
    inputSchema: zodToJsonSchema(GetCommitSchema),
  },
  {
    name: "get_commit_diff",
    description: "Get changes/diffs of a specific commit",
    inputSchema: zodToJsonSchema(GetCommitDiffSchema),
  },
  {
    name: "get_current_user",
    description: "Get details of the current authenticated user",
    inputSchema: zodToJsonSchema(GetCurrentUserSchema),
  }
];

// Define which tools are read-only
const readOnlyTools = [
  "search_repositories",
  "get_file_contents",
  "get_merge_request",
  "get_merge_request_diffs",
  "get_branch_diffs",
  "mr_discussions",
  "list_issues",
  "list_merge_requests",
  "get_issue",
  "list_issue_links",
  "list_issue_discussions",
  "get_issue_link",
  "list_namespaces",
  "get_namespace",
  "verify_namespace",
  "get_project",
  "get_pipeline",
  "list_pipelines",
  "list_pipeline_jobs",
  "get_pipeline_job",
  "get_pipeline_job_output",
  "list_projects",
  "list_labels",
  "get_label",
  "list_group_projects",
  "get_repository_tree",
  "list_milestones",
  "get_milestone",
  "get_milestone_issue",
  "get_milestone_merge_requests",
  "get_milestone_burndown_events",
  "list_wiki_pages",
  "get_wiki_page",
  "get_users",
  "list_commits",
  "get_commit",
  "get_commit_diff",
  "get_current_user",
];

// Define which tools are related to wiki and can be toggled by USE_GITLAB_WIKI
const wikiToolNames = [
  "list_wiki_pages",
  "get_wiki_page",
  "create_wiki_page",
  "update_wiki_page",
  "delete_wiki_page",
  "upload_wiki_attachment",
];

// Define which tools are related to milestones and can be toggled by USE_MILESTONE
const milestoneToolNames = [
  "list_milestones",
  "get_milestone",
  "create_milestone",
  "edit_milestone",
  "delete_milestone",
  "get_milestone_issue",
  "get_milestone_merge_requests",
  "promote_milestone",
  "get_milestone_burndown_events",
];

// Define which tools are related to pipelines and can be toggled by USE_PIPELINE
const pipelineToolNames = [
  "list_pipelines",
  "get_pipeline",
  "list_pipeline_jobs",
  "get_pipeline_job",
  "get_pipeline_job_output",
  "create_pipeline",
  "retry_pipeline",
  "cancel_pipeline",
];


server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Apply read-only filter first
  const tools0 = config.GITLAB_READ_ONLY_MODE
    ? allTools.filter(tool => readOnlyTools.includes(tool.name))
    : allTools;
  // Toggle wiki tools by USE_GITLAB_WIKI flag
  const tools1 = config.USE_GITLAB_WIKI
    ? tools0
    : tools0.filter(tool => !wikiToolNames.includes(tool.name));
  // Toggle milestone tools by USE_MILESTONE flag
  const tools2 = config.USE_MILESTONE
    ? tools1
    : tools1.filter(tool => !milestoneToolNames.includes(tool.name));
  // Toggle pipeline tools by USE_PIPELINE flag
  let tools = config.USE_PIPELINE ? tools2 : tools2.filter(tool => !pipelineToolNames.includes(tool.name));

  // <<< START: Gemini 호환성을 위해 $schema 제거 >>>
  tools = tools.map(tool => {
    // inputSchema가 존재하고 객체인지 확인
    if (tool.inputSchema && typeof tool.inputSchema === "object" && tool.inputSchema !== null) {
      // $schema 키가 존재하면 삭제
      if ("$schema" in tool.inputSchema) {
        // 불변성을 위해 새로운 객체 생성 (선택적이지만 권장)
        const modifiedSchema = { ...tool.inputSchema };
        delete modifiedSchema.$schema;
        return { ...tool, inputSchema: modifiedSchema };
      }
    }
    // 변경이 필요 없으면 그대로 반환
    return tool;
  });
  // <<< END: Gemini 호환성을 위해 $schema 제거 >>>

  return {
    tools, // $schema가 제거된 도구 목록 반환
  };
});

// TODO: im pretty sure that the cookie jar should be scoped by token? instead of being global
// but i need to look into it. just don't use the cookie jar feature with oauth or passthrough...
const globalCookieJar = createCookieJar();

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }
    let cookieJar: CookieJar | undefined = undefined;
    if(config.GITLAB_AUTH_COOKIE_PATH) {
      cookieJar = globalCookieJar;
    }
    // Create GitlabSession instance
    // TODO: we silently do nothing if the authInfo is not properly forwared. should we do something?
    const gitlabSession = new GitlabHandler(extra.authInfo?.token || "", cookieJar);
    if(cookieJar) {
      await gitlabSession.ensureSessionForCookieJar();
    }
    logger.info(request.params.name)
    switch (request.params.name) {
      case "fork_repository": {
        if (config.GITLAB_PROJECT_ID) {
          throw new Error("Direct project ID is set. So fork_repository is not allowed");
        }
        const forkArgs = ForkRepositorySchema.parse(request.params.arguments);
        try {
          const forkedProject = await gitlabSession.forkProject(forkArgs.project_id, forkArgs.namespace);
          return {
            content: [{ type: "text", text: JSON.stringify(forkedProject, null, 2) }],
          };
        } catch (forkError) {
          console.error("Error forking repository:", forkError);
          let forkErrorMessage = "Failed to fork repository";
          if (forkError instanceof Error) {
            forkErrorMessage = `${forkErrorMessage}: ${forkError.message}`;
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: forkErrorMessage }, null, 2),
              },
            ],
          };
        }
      }

      case "create_branch": {
        const args = CreateBranchSchema.parse(request.params.arguments);
        let ref = args.ref;
        if (!ref) {
          ref = await gitlabSession.getDefaultBranchRef(args.project_id);
        }

        const branch = await gitlabSession.createBranch(args.project_id, {
          name: args.branch,
          ref,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
        };
      }

      case "get_branch_diffs": {
        const args = GetBranchDiffsSchema.parse(request.params.arguments);
        const diffResp = await gitlabSession.getBranchDiffs(args.project_id, args.from, args.to, args.straight);

        if (args.excluded_file_patterns?.length) {
          const regexPatterns = args.excluded_file_patterns.map(pattern => new RegExp(pattern));

          // Helper function to check if a path matches any regex pattern
          const matchesAnyPattern = (path: string): boolean => {
            if (!path) return false;
            return regexPatterns.some(regex => regex.test(path));
          };

          // Filter out files that match any of the regex patterns on new files
          diffResp.diffs = diffResp.diffs.filter(diff => !matchesAnyPattern(diff.new_path));
        }
        return {
          content: [{ type: "text", text: JSON.stringify(diffResp, null, 2) }],
        };
      }

      case "search_repositories": {
        const args = SearchRepositoriesSchema.parse(request.params.arguments);
        const results = await gitlabSession.searchProjects(args.search, args.page, args.per_page);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "create_repository": {
        if (config.GITLAB_PROJECT_ID) {
          throw new Error("Direct project ID is set. So fork_repository is not allowed");
        }
        const args = CreateRepositorySchema.parse(request.params.arguments);
        const repository = await gitlabSession.createRepository(args);
        return {
          content: [{ type: "text", text: JSON.stringify(repository, null, 2) }],
        };
      }

      case "get_file_contents": {
        const args = GetFileContentsSchema.parse(request.params.arguments);
        const contents = await gitlabSession.getFileContents(args.project_id, args.file_path, args.ref);
        return {
          content: [{ type: "text", text: JSON.stringify(contents, null, 2) }],
        };
      }

      case "create_or_update_file": {
        const args = CreateOrUpdateFileSchema.parse(request.params.arguments);
        const result = await gitlabSession.createOrUpdateFile(
          args.project_id,
          args.file_path,
          args.content,
          args.commit_message,
          args.branch,
          args.previous_path,
          args.last_commit_id,
          args.commit_id
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "push_files": {
        const args = PushFilesSchema.parse(request.params.arguments);
        const result = await gitlabSession.createCommit(
          args.project_id,
          args.commit_message,
          args.branch,
          args.files.map(f => ({ path: f.file_path, content: f.content }))
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_issue": {
        const args = CreateIssueSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const issue = await gitlabSession.createIssue(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "create_merge_request": {
        const args = CreateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const mergeRequest = await gitlabSession.createMergeRequest(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "update_merge_request_note": {
        const args = UpdateMergeRequestNoteSchema.parse(request.params.arguments);
        const note = await gitlabSession.updateMergeRequestNote(
          args.project_id,
          args.merge_request_iid,
          args.discussion_id,
          args.note_id,
          args.body, // Now optional
          args.resolved // Now one of body or resolved must be provided, not both
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_merge_request_note": {
        const args = CreateMergeRequestNoteSchema.parse(request.params.arguments);
        const note = await gitlabSession.createMergeRequestNote(
          args.project_id,
          args.merge_request_iid,
          args.discussion_id,
          args.body,
          args.created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "update_issue_note": {
        const args = UpdateIssueNoteSchema.parse(request.params.arguments);
        const note = await gitlabSession.updateIssueNote(
          args.project_id,
          args.issue_iid,
          args.discussion_id,
          args.note_id,
          args.body
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_issue_note": {
        const args = CreateIssueNoteSchema.parse(request.params.arguments);
        const note = await gitlabSession.createIssueNote(
          args.project_id,
          args.issue_iid,
          args.discussion_id,
          args.body,
          args.created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "get_merge_request": {
       const args = GetMergeRequestSchema.parse(request.params.arguments);
        const mergeRequest = await gitlabSession.getMergeRequest(
          args.project_id,
          args.merge_request_iid,
          args.source_branch
        );
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "get_merge_request_diffs": {
        const args = GetMergeRequestDiffsSchema.parse(request.params.arguments);
        const diffs = await gitlabSession.getMergeRequestDiffs(
          args.project_id,
          args.merge_request_iid,
          args.source_branch,
          args.view
        );
        return {
          content: [{ type: "text", text: JSON.stringify(diffs, null, 2) }],
        };
      }

      case "list_merge_request_diffs": {
        const args = ListMergeRequestDiffsSchema.parse(request.params.arguments);
        const changes = await gitlabSession.listMergeRequestDiffs(
          args.project_id,
          args.merge_request_iid,
          args.source_branch,
          args.page,
          args.per_page,
          args.unidiff
        );
        return {
          content: [{ type: "text", text: JSON.stringify(changes, null, 2) }],
        };
      }

      case "update_merge_request": {
        const args = UpdateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, source_branch, ...options } = args;
        const mergeRequest = await gitlabSession.updateMergeRequest(
          project_id,
          options,
          merge_request_iid,
          source_branch
        );
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "mr_discussions": {
        const args = ListMergeRequestDiscussionsSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, ...options } = args;
        const discussions = await gitlabSession.listMergeRequestDiscussions(
          project_id,
          merge_request_iid,
          options
        );
        return {
          content: [{ type: "text", text: JSON.stringify(discussions, null, 2) }],
        };
      }

      case "list_namespaces": {
        const args = ListNamespacesSchema.parse(request.params.arguments);
        const namespaces = await gitlabSession.listNamespaces({
          search: args.search,
          owned_only: args.owned,
          top_level_only: undefined
        });

        return {
          content: [{ type: "text", text: JSON.stringify(namespaces, null, 2) }],
        };
      }

      case "get_namespace": {
        const args = GetNamespaceSchema.parse(request.params.arguments);
        const namespace = await gitlabSession.getNamespace(args.namespace_id);

        return {
          content: [{ type: "text", text: JSON.stringify(namespace, null, 2) }],
        };
      }

      case "verify_namespace": {
        const args = VerifyNamespaceSchema.parse(request.params.arguments);
        const namespaceExists = await gitlabSession.verifyNamespaceExistence(args.path);

        return {
          content: [{ type: "text", text: JSON.stringify(namespaceExists, null, 2) }],
        };
      }

      case "get_project": {
        const args = GetProjectSchema.parse(request.params.arguments);
        const project = await gitlabSession.getProject(args.project_id);

        return {
          content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
        };
      }

      case "list_projects": {
        const args = ListProjectsSchema.parse(request.params.arguments);
        const projects = await gitlabSession.listProjects(args);

        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        };
      }

      case "get_users": {
        const args = GetUsersSchema.parse(request.params.arguments);
        const usersMap = await gitlabSession.getUsers(args.usernames);

        return {
          content: [{ type: "text", text: JSON.stringify(usersMap, null, 2) }],
        };
      }

      case "create_note": {
        const args = CreateNoteSchema.parse(request.params.arguments);
        const { project_id, noteable_type, noteable_iid, body } = args;

        const note = await gitlabSession.createNote(project_id, noteable_type, noteable_iid, body);
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_merge_request_thread": {
        const args = CreateMergeRequestThreadSchema.parse(request.params.arguments);
        const { project_id, merge_request_iid, body, position, created_at } = args;

        const thread = await gitlabSession.createMergeRequestThread(
          project_id,
          merge_request_iid,
          body,
          position,
          created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(thread, null, 2) }],
        };
      }

      case "list_issues": {
        const args = ListIssuesSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const issues = await gitlabSession.listIssues(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
        };
      }

      case "get_issue": {
        const args = GetIssueSchema.parse(request.params.arguments);
        const issue = await gitlabSession.getIssue(args.project_id, args.issue_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "update_issue": {
        const args = UpdateIssueSchema.parse(request.params.arguments);
        const { project_id, issue_iid, ...options } = args;
        const issue = await gitlabSession.updateIssue(project_id, issue_iid, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "delete_issue": {
        const args = DeleteIssueSchema.parse(request.params.arguments);
        await gitlabSession.deleteIssue(args.project_id, args.issue_iid);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: "success", message: "Issue deleted successfully" },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_issue_links": {
        const args = ListIssueLinksSchema.parse(request.params.arguments);
        const links = await gitlabSession.listIssueLinks(args.project_id, args.issue_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(links, null, 2) }],
        };
      }

      case "list_issue_discussions": {
        const args = ListIssueDiscussionsSchema.parse(request.params.arguments);
        const { project_id, issue_iid, ...options } = args;

        const discussions = await gitlabSession.listIssueDiscussions(project_id, issue_iid, options);
        return {
          content: [{ type: "text", text: JSON.stringify(discussions, null, 2) }],
        };
      }

      case "get_issue_link": {
        const args = GetIssueLinkSchema.parse(request.params.arguments);
        const link = await gitlabSession.getIssueLink(args.project_id, args.issue_iid, args.issue_link_id);
        return {
          content: [{ type: "text", text: JSON.stringify(link, null, 2) }],
        };
      }

      case "create_issue_link": {
        const args = CreateIssueLinkSchema.parse(request.params.arguments);
        const link = await gitlabSession.createIssueLink(
          args.project_id,
          args.issue_iid,
          args.target_project_id,
          args.target_issue_iid,
          args.link_type
        );
        return {
          content: [{ type: "text", text: JSON.stringify(link, null, 2) }],
        };
      }

      case "delete_issue_link": {
        const args = DeleteIssueLinkSchema.parse(request.params.arguments);
        await gitlabSession.deleteIssueLink(args.project_id, args.issue_iid, args.issue_link_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Issue link deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_labels": {
        const args = ListLabelsSchema.parse(request.params.arguments);
        const labels = await gitlabSession.listLabels(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(labels, null, 2) }],
        };
      }

      case "get_label": {
        const args = GetLabelSchema.parse(request.params.arguments);
        const label = await gitlabSession.getLabel(args.project_id, args.label_id, args.include_ancestor_groups);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "create_label": {
        const args = CreateLabelSchema.parse(request.params.arguments);
        const label = await gitlabSession.createLabel(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "update_label": {
        const args = UpdateLabelSchema.parse(request.params.arguments);
        const { project_id, label_id, ...options } = args;
        const label = await gitlabSession.updateLabel(project_id, label_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "delete_label": {
        const args = DeleteLabelSchema.parse(request.params.arguments);
        await gitlabSession.deleteLabel(args.project_id, args.label_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: "success", message: "Label deleted successfully" },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_group_projects": {
        const args = ListGroupProjectsSchema.parse(request.params.arguments);
        const projects = await gitlabSession.listGroupProjects(args);
        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        };
      }

      case "list_wiki_pages": {
        const { project_id, page, per_page, with_content } = ListWikiPagesSchema.parse(
          request.params.arguments
        );
        const wikiPages = await gitlabSession.listWikiPages(project_id, { page, per_page, with_content });
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPages, null, 2) }],
        };
      }

      case "get_wiki_page": {
        const { project_id, slug } = GetWikiPageSchema.parse(request.params.arguments);
        const wikiPage = await gitlabSession.getWikiPage(project_id, slug);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "create_wiki_page": {
        const { project_id, title, content, format } = CreateWikiPageSchema.parse(
          request.params.arguments
        );
        const wikiPage = await gitlabSession.createWikiPage(project_id, title, content, format);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "update_wiki_page": {
        const { project_id, slug, title, content, format } = UpdateWikiPageSchema.parse(
          request.params.arguments
        );
        const wikiPage = await gitlabSession.updateWikiPage(project_id, slug, title, content, format);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "delete_wiki_page": {
        const { project_id, slug } = DeleteWikiPageSchema.parse(request.params.arguments);
        await gitlabSession.deleteWikiPage(project_id, slug);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Wiki page deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_repository_tree": {
        const args = GetRepositoryTreeSchema.parse(request.params.arguments);
        const tree = await gitlabSession.getRepositoryTree(args);
        return {
          content: [{ type: "text", text: JSON.stringify(tree, null, 2) }],
        };
      }

      case "list_pipelines": {
        const args = ListPipelinesSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const pipelines = await gitlabSession.listPipelines(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(pipelines, null, 2) }],
        };
      }

      case "get_pipeline": {
        const { project_id, pipeline_id } = GetPipelineSchema.parse(request.params.arguments);
        const pipeline = await gitlabSession.getPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pipeline, null, 2),
            },
          ],
        };
      }

      case "list_pipeline_jobs": {
        const { project_id, pipeline_id, ...options } = ListPipelineJobsSchema.parse(
          request.params.arguments
        );
        const jobs = await gitlabSession.listPipelineJobs(project_id, pipeline_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobs, null, 2),
            },
          ],
        };
      }

      case "get_pipeline_job": {
        const { project_id, job_id } = GetPipelineJobOutputSchema.parse(request.params.arguments);
        const jobDetails = await gitlabSession.getPipelineJob(project_id, job_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobDetails, null, 2),
            },
          ],
        };
      }

      case "get_pipeline_job_output": {
        const { project_id, job_id, limit, offset } = GetPipelineJobOutputSchema.parse(request.params.arguments);
        const jobOutput = await gitlabSession.getPipelineJobOutput(project_id, job_id, limit, offset);
        return {
          content: [
            {
              type: "text",
              text: jobOutput,
            },
          ],
        };
      }

      case "create_pipeline": {
        const { project_id, ref, variables } = CreatePipelineSchema.parse(request.params.arguments);
        const pipeline = await gitlabSession.createPipeline(project_id, ref, variables);
        return {
          content: [
            {
              type: "text",
              text: `Created pipeline #${pipeline.id} for ${ref}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "retry_pipeline": {
        const { project_id, pipeline_id } = RetryPipelineSchema.parse(request.params.arguments);
        const pipeline = await gitlabSession.retryPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: `Retried pipeline #${pipeline.id}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "cancel_pipeline": {
        const { project_id, pipeline_id } = CancelPipelineSchema.parse(request.params.arguments);
        const pipeline = await gitlabSession.cancelPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: `Canceled pipeline #${pipeline.id}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "list_merge_requests": {
        const args = ListMergeRequestsSchema.parse(request.params.arguments);
        const mergeRequests = await gitlabSession.listMergeRequests(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequests, null, 2) }],
        };
      }

      case "list_milestones": {
        const { project_id, ...options } = ListProjectMilestonesSchema.parse(
          request.params.arguments
        );
        const milestones = await gitlabSession.listProjectMilestones(project_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestones, null, 2),
            },
          ],
        };
      }

      case "get_milestone": {
        const { project_id, milestone_id } = GetProjectMilestoneSchema.parse(
          request.params.arguments
        );
        const milestone = await gitlabSession.getProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "create_milestone": {
        const { project_id, ...options } = CreateProjectMilestoneSchema.parse(
          request.params.arguments
        );
        const milestone = await gitlabSession.createProjectMilestone(project_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "edit_milestone": {
        const { project_id, milestone_id, ...options } = EditProjectMilestoneSchema.parse(
          request.params.arguments
        );
        const milestone = await gitlabSession.editProjectMilestone(project_id, milestone_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "delete_milestone": {
        const { project_id, milestone_id } = DeleteProjectMilestoneSchema.parse(
          request.params.arguments
        );
        await gitlabSession.deleteProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Milestone deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_milestone_issue": {
        const { project_id, milestone_id } = GetMilestoneIssuesSchema.parse(
          request.params.arguments
        );
        const issues = await gitlabSession.getMilestoneIssues(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(issues, null, 2),
            },
          ],
        };
      }

      case "get_milestone_merge_requests": {
        const { project_id, milestone_id } = GetMilestoneMergeRequestsSchema.parse(
          request.params.arguments
        );
        const mergeRequests = await gitlabSession.getMilestoneMergeRequests(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(mergeRequests, null, 2),
            },
          ],
        };
      }

      case "promote_milestone": {
        const { project_id, milestone_id } = PromoteProjectMilestoneSchema.parse(
          request.params.arguments
        );
        const milestone = await gitlabSession.promoteProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "get_milestone_burndown_events": {
        const { project_id, milestone_id } = GetMilestoneBurndownEventsSchema.parse(
          request.params.arguments
        );
        const events = await gitlabSession.getMilestoneBurndownEvents(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(events, null, 2),
            },
          ],
        };
      }

      case "list_commits": {
        const args = ListCommitsSchema.parse(request.params.arguments);
        const commits = await gitlabSession.listCommits(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(commits, null, 2) }],
        };
      }

      case "get_commit": {
        const args = GetCommitSchema.parse(request.params.arguments);
        const commit = await gitlabSession.getCommit(args.project_id, args.sha, args.stats);
        return {
          content: [{ type: "text", text: JSON.stringify(commit, null, 2) }],
        };
      }

      case "get_commit_diff": {
        const args = GetCommitDiffSchema.parse(request.params.arguments);
        const diff = await gitlabSession.getCommitDiff(args.project_id, args.sha);
        return {
          content: [{ type: "text", text: JSON.stringify(diff, null, 2) }],
        };
      }
      case "get_current_user": {
        const user = await gitlabSession.getCurrentUser();
        return {
          content: [{ type: "text", text: JSON.stringify(user, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    logger.debug(request.params)
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map(e => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});

export const mcpserver = server
