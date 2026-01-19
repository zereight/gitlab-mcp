/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as z from "zod";
import {
  // Consolidated schemas
  BrowseProjectsSchema,
  BrowseNamespacesSchema,
  BrowseCommitsSchema,
  BrowseEventsSchema,
  // Kept as-is schemas
  GetUsersSchema,
  ListProjectMembersSchema,
  ListGroupIterationsSchema,
  DownloadAttachmentSchema,
  ListTodosSchema,
} from "./schema-readonly";
import {
  // Consolidated schemas
  ManageRepositorySchema,
  // Kept as-is schemas
  CreateBranchSchema,
  CreateGroupSchema,
  ManageTodosSchema,
} from "./schema";
import { enhancedFetch } from "../../utils/fetch";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { smartUserSearch, type UserSearchParams } from "../../utils/smart-user-search";
import { cleanGidsFromObject } from "../../utils/idConversion";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Core tools registry - CQRS consolidated (Issue #16)
 * Reduced from 18 tools to 10 tools + 2 todos tools = 12 total
 */
export const coreToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // CONSOLIDATED TOOLS (5 tools replacing 13 old tools)
  // ============================================================================

  // browse_projects: Consolidates search_repositories, list_projects, get_project
  [
    "browse_projects",
    {
      name: "browse_projects",
      description:
        "PROJECT DISCOVERY: Find, browse, or inspect GitLab projects. Use 'search' to find projects by name/topic across all GitLab. Use 'list' to browse your accessible projects or projects within a specific group. Use 'get' with project_id to retrieve full details of a known project. Filter by visibility, language, or ownership.",
      inputSchema: z.toJSONSchema(BrowseProjectsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = BrowseProjectsSchema.parse(args);
        const { action, project_id, q, group_id, ...otherOptions } = options;

        switch (action) {
          case "search": {
            const queryParams = new URLSearchParams();

            // Handle search query
            if (q) {
              let finalSearchTerms = q;

              // Parse topic: operator
              const topicMatches = q.match(/topic:(\w+)/g);
              if (topicMatches) {
                const topics = topicMatches.map(match => match.replace("topic:", ""));
                queryParams.set("topic", topics.join(","));
                finalSearchTerms = finalSearchTerms.replace(/topic:\w+/g, "").trim();
              }

              if (finalSearchTerms) {
                // Let URLSearchParams handle encoding naturally (spaces become %20)
                // GitLab API accepts both %20 and + for spaces in search queries
                queryParams.set("search", finalSearchTerms);
              }
            }

            // Add programming language filter
            if (otherOptions.with_programming_language) {
              queryParams.set("with_programming_language", otherOptions.with_programming_language);
            }

            // Add other search options
            const searchParams = ["visibility", "order_by", "sort", "per_page", "page"];
            searchParams.forEach(key => {
              const value = otherOptions[key];
              if (value !== undefined) {
                queryParams.set(key, String(value));
              }
            });

            queryParams.set("active", "true");

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const projects = await response.json();
            return cleanGidsFromObject(projects);
          }

          case "list": {
            const queryParams = new URLSearchParams();

            // Build query parameters
            const listParams = [
              "visibility",
              "archived",
              "owned",
              "starred",
              "membership",
              "search",
              "simple",
              "order_by",
              "sort",
              "per_page",
              "page",
              "include_subgroups",
              "with_shared",
              "with_programming_language",
            ];
            listParams.forEach(key => {
              const value = otherOptions[key];
              if (value !== undefined) {
                queryParams.set(key, String(value));
              }
            });

            // Set defaults
            if (!queryParams.has("order_by")) queryParams.set("order_by", "created_at");
            if (!queryParams.has("sort")) queryParams.set("sort", "desc");
            if (!queryParams.has("simple")) queryParams.set("simple", "true");
            if (!queryParams.has("per_page")) queryParams.set("per_page", "20");

            let apiUrl: string;
            if (group_id) {
              apiUrl = `${process.env.GITLAB_API_URL}/api/v4/groups/${encodeURIComponent(group_id)}/projects?${queryParams}`;
            } else {
              queryParams.set("active", "true");
              apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects?${queryParams}`;
            }

            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const projects = await response.json();
            return cleanGidsFromObject(projects);
          }

          case "get": {
            if (!project_id) {
              throw new Error('project_id is required for "get" action');
            }

            const queryParams = new URLSearchParams();
            if (otherOptions.statistics) queryParams.set("statistics", "true");
            if (otherOptions.license) queryParams.set("license", "true");

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const project = await response.json();
            return cleanGidsFromObject(project);
          }

          default:
            throw new Error(`Unknown action: ${action as string}`);
        }
      },
    },
  ],

  // browse_namespaces: Consolidates list_namespaces, get_namespace, verify_namespace
  [
    "browse_namespaces",
    {
      name: "browse_namespaces",
      description:
        "NAMESPACE OPERATIONS: Explore GitLab groups and user namespaces. Use 'list' to discover available namespaces for project creation. Use 'get' with namespace_id to retrieve full details including storage stats. Use 'verify' to check if a namespace path exists before creating projects or groups.",
      inputSchema: z.toJSONSchema(BrowseNamespacesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = BrowseNamespacesSchema.parse(args);
        const { action, namespace_id, ...otherOptions } = options;

        switch (action) {
          case "list": {
            const queryParams = new URLSearchParams();
            const listParams = [
              "search",
              "owned_only",
              "top_level_only",
              "with_statistics",
              "min_access_level",
              "per_page",
              "page",
            ];
            listParams.forEach(key => {
              const value = otherOptions[key];
              if (value !== undefined) {
                queryParams.set(key, String(value));
              }
            });

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const namespaces = await response.json();
            return cleanGidsFromObject(namespaces);
          }

          case "get": {
            if (!namespace_id) {
              throw new Error('namespace_id is required for "get" action');
            }

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces/${encodeURIComponent(namespace_id)}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const namespace = await response.json();
            return cleanGidsFromObject(namespace);
          }

          case "verify": {
            if (!namespace_id) {
              throw new Error('namespace_id is required for "verify" action');
            }

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces/${encodeURIComponent(namespace_id)}`;
            const response = await enhancedFetch(apiUrl);

            return {
              exists: response.ok,
              status: response.status,
              namespace: namespace_id,
              data: response.ok ? await response.json() : null,
            };
          }

          default:
            throw new Error(`Unknown action: ${action as string}`);
        }
      },
    },
  ],

  // browse_commits: Consolidates list_commits, get_commit, get_commit_diff
  [
    "browse_commits",
    {
      name: "browse_commits",
      description:
        "COMMIT HISTORY: Explore repository commit history. Use 'list' to browse commits with optional date range, author, or file path filters. Use 'get' with sha to retrieve commit metadata and stats. Use 'diff' to see actual code changes in a commit. Essential for code review and change tracking.",
      inputSchema: z.toJSONSchema(BrowseCommitsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = BrowseCommitsSchema.parse(args);
        const { action, project_id, sha, ...otherOptions } = options;

        switch (action) {
          case "list": {
            const queryParams = new URLSearchParams();
            const listParams = [
              "ref_name",
              "since",
              "until",
              "path",
              "author",
              "all",
              "with_stats",
              "first_parent",
              "order",
              "trailers",
              "per_page",
              "page",
            ];
            listParams.forEach(key => {
              const value = otherOptions[key];
              if (value !== undefined) {
                queryParams.set(key, String(value));
              }
            });

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          case "get": {
            if (!sha) {
              throw new Error('sha is required for "get" action');
            }

            const queryParams = new URLSearchParams();
            if (otherOptions.stats) queryParams.set("stats", "true");

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits/${encodeURIComponent(sha)}?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          case "diff": {
            if (!sha) {
              throw new Error('sha is required for "diff" action');
            }

            const queryParams = new URLSearchParams();
            if (otherOptions.unidiff) queryParams.set("unidiff", "true");

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits/${encodeURIComponent(sha)}/diff?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          default:
            throw new Error(`Unknown action: ${action as string}`);
        }
      },
    },
  ],

  // browse_events: Consolidates list_events, get_project_events
  [
    "browse_events",
    {
      name: "browse_events",
      description:
        "ACTIVITY FEED: Track GitLab activity and events. Use 'user' to see YOUR recent activity across all projects (commits, issues, MRs). Use 'project' with project_id to monitor a specific project's activity feed. Filter by date range or action type (pushed, commented, merged, etc.).",
      inputSchema: z.toJSONSchema(BrowseEventsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = BrowseEventsSchema.parse(args);
        const { action, project_id, event_action, ...otherOptions } = options;

        const queryParams = new URLSearchParams();
        const eventParams = ["target_type", "before", "after", "sort", "per_page", "page"];
        eventParams.forEach(key => {
          const value = otherOptions[key];
          if (value !== undefined) {
            queryParams.set(key, String(value));
          }
        });

        // event_action maps to 'action' in the API
        if (event_action) {
          queryParams.set("action", event_action);
        }

        let apiUrl: string;
        switch (action) {
          case "user":
            apiUrl = `${process.env.GITLAB_API_URL}/api/v4/events?${queryParams}`;
            break;

          case "project":
            if (!project_id) {
              throw new Error('project_id is required for "project" action');
            }
            apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/events?${queryParams}`;
            break;

          default:
            throw new Error(`Unknown action: ${action as string}`);
        }

        const response = await enhancedFetch(apiUrl);

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      },
    },
  ],

  // manage_repository: Consolidates create_repository, fork_repository
  [
    "manage_repository",
    {
      name: "manage_repository",
      description:
        "REPOSITORY MANAGEMENT: Create or fork GitLab projects. Use 'create' to start a new project with custom settings (visibility, features, namespace). Use 'fork' with project_id to create your own copy of an existing project for independent development or contribution back via MRs.",
      inputSchema: z.toJSONSchema(ManageRepositorySchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ManageRepositorySchema.parse(args);
        const {
          action,
          name,
          namespace,
          project_id,
          namespace_path,
          fork_name,
          fork_path,
          ...otherOptions
        } = options;

        switch (action) {
          case "create": {
            if (!name) {
              throw new Error('name is required for "create" action');
            }

            // Resolve namespace path to ID if provided
            let namespaceId: string | undefined;
            let resolvedNamespace: { id: string; full_path: string } | null = null;
            if (namespace) {
              const namespaceApiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces/${encodeURIComponent(namespace)}`;
              const namespaceResponse = await enhancedFetch(namespaceApiUrl);

              if (namespaceResponse.ok) {
                resolvedNamespace = (await namespaceResponse.json()) as {
                  id: string;
                  full_path: string;
                };
                namespaceId = String(resolvedNamespace.id);
              } else {
                throw new Error(`Namespace '${namespace}' not found or not accessible`);
              }
            }

            // Check if project already exists
            const targetNamespacePath = resolvedNamespace
              ? resolvedNamespace.full_path
              : "current-user";
            const projectPath = `${targetNamespacePath}/${name}`;
            const checkProjectUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(projectPath)}`;
            const checkResponse = await enhancedFetch(checkProjectUrl);

            if (checkResponse.ok) {
              const existingProject = (await checkResponse.json()) as { id: string };
              throw new Error(
                `Project '${projectPath}' already exists (ID: ${existingProject.id}).`
              );
            }

            // Create project
            const body = new URLSearchParams();
            body.set("name", name);

            // Generate path from name
            const generatedPath = name
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "");
            body.set("path", generatedPath);

            if (namespaceId) body.set("namespace_id", namespaceId);
            if (otherOptions.description) body.set("description", otherOptions.description);
            if (otherOptions.visibility) body.set("visibility", otherOptions.visibility);
            if (otherOptions.initialize_with_readme) body.set("initialize_with_readme", "true");

            // Add optional feature flags
            const featureFlags = [
              "issues_enabled",
              "merge_requests_enabled",
              "jobs_enabled",
              "wiki_enabled",
              "snippets_enabled",
              "lfs_enabled",
              "request_access_enabled",
              "only_allow_merge_if_pipeline_succeeds",
              "only_allow_merge_if_all_discussions_are_resolved",
            ];
            featureFlags.forEach(flag => {
              const value = otherOptions[flag];
              if (value !== undefined) {
                body.set(flag, String(value));
              }
            });

            const createApiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects`;
            const createResponse = await enhancedFetch(createApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: body.toString(),
            });

            if (!createResponse.ok) {
              throw new Error(
                `GitLab API error: ${createResponse.status} ${createResponse.statusText}`
              );
            }

            const project = await createResponse.json();
            return {
              ...project,
              validation: {
                namespace_resolved: namespace ? `${namespace} -> ${namespaceId}` : "current-user",
                generated_path: generatedPath,
              },
            };
          }

          case "fork": {
            if (!project_id) {
              throw new Error('project_id is required for "fork" action');
            }

            const body = new URLSearchParams();
            if (namespace) body.set("namespace", namespace);
            if (namespace_path) body.set("namespace_path", namespace_path);
            if (fork_name) body.set("name", fork_name);
            if (fork_path) body.set("path", fork_path);

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/fork`;
            const response = await enhancedFetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: body.toString(),
            });

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          default:
            throw new Error(`Unknown action: ${action as string}`);
        }
      },
    },
  ],

  // ============================================================================
  // KEPT AS-IS TOOLS (5 tools - no consolidation needed)
  // ============================================================================

  [
    "get_users",
    {
      name: "get_users",
      description:
        "FIND USERS: Search GitLab users with smart pattern detection. Auto-detects emails, usernames, or names. Supports transliteration and multi-phase fallback search.",
      inputSchema: z.toJSONSchema(GetUsersSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetUsersSchema.parse(args);
        const { smart_search, search, username, public_email, ...otherParams } = options;

        const hasUsernameOrEmail = Boolean(username) || Boolean(public_email);
        const hasOnlySearch = Boolean(search) && !hasUsernameOrEmail;
        const shouldUseSmartSearch =
          smart_search === false ? false : smart_search === true || hasOnlySearch;

        if (shouldUseSmartSearch && (search || username || public_email)) {
          const query = search ?? username ?? public_email ?? "";
          const additionalParams: UserSearchParams = {};

          Object.entries(otherParams).forEach(([key, value]) => {
            if (value !== undefined && key !== "smart_search") {
              additionalParams[key] = value;
            }
          });

          return await smartUserSearch(query, additionalParams);
        } else {
          const queryParams = new URLSearchParams();
          Object.entries(options).forEach(([key, value]) => {
            if (value !== undefined && key !== "smart_search") {
              queryParams.set(key, String(value));
            }
          });

          const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/users?${queryParams}`;
          const response = await enhancedFetch(apiUrl);

          if (!response.ok) {
            throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
          }

          const users = await response.json();
          return cleanGidsFromObject(users);
        }
      },
    },
  ],

  [
    "list_project_members",
    {
      name: "list_project_members",
      description:
        "TEAM MEMBERS: List project members with access levels. Shows: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner.",
      inputSchema: z.toJSONSchema(ListProjectMembersSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListProjectMembersSchema.parse(args);
        const { project_id } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/members?${queryParams}`;
        const response = await enhancedFetch(apiUrl);

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const members = await response.json();
        return cleanGidsFromObject(members);
      },
    },
  ],

  [
    "list_group_iterations",
    {
      name: "list_group_iterations",
      description:
        "SPRINTS: List iterations/sprints for agile planning. Filter by state: current, upcoming, closed. Requires GitLab Premium.",
      inputSchema: z.toJSONSchema(ListGroupIterationsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListGroupIterationsSchema.parse(args);
        const { group_id } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "group_id") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/groups/${encodeURIComponent(group_id)}/iterations?${queryParams}`;
        const response = await enhancedFetch(apiUrl);

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      },
    },
  ],

  [
    "download_attachment",
    {
      name: "download_attachment",
      description:
        "DOWNLOAD: Retrieve file attachments from issues/MRs. Requires secret token and filename from attachment URL.",
      inputSchema: z.toJSONSchema(DownloadAttachmentSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = DownloadAttachmentSchema.parse(args);
        const { project_id, secret, filename } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/uploads/${secret}/${filename}`;
        const response = await enhancedFetch(apiUrl);

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const attachment = await response.arrayBuffer();
        return {
          filename,
          content: Buffer.from(attachment).toString("base64"),
          contentType: response.headers.get("content-type") ?? "application/octet-stream",
        };
      },
    },
  ],

  [
    "create_branch",
    {
      name: "create_branch",
      description:
        "NEW BRANCH: Create a Git branch from existing ref. Required before creating MRs. Ref can be branch name, tag, or commit SHA.",
      inputSchema: z.toJSONSchema(CreateBranchSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateBranchSchema.parse(args);

        const body = new URLSearchParams();
        body.set("branch", options.branch);
        body.set("ref", options.ref);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/repository/branches`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      },
    },
  ],

  [
    "create_group",
    {
      name: "create_group",
      description:
        "CREATE GROUP: Create a new GitLab group/namespace. Groups organize projects and teams. Can create subgroups with parent_id.",
      inputSchema: z.toJSONSchema(CreateGroupSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateGroupSchema.parse(args);
        const body = new URLSearchParams();

        body.set("name", options.name);
        body.set("path", options.path);

        if (options.description) body.set("description", options.description);
        if (options.visibility) body.set("visibility", options.visibility);
        if (options.parent_id !== undefined) body.set("parent_id", String(options.parent_id));
        if (options.lfs_enabled !== undefined) body.set("lfs_enabled", String(options.lfs_enabled));
        if (options.request_access_enabled !== undefined)
          body.set("request_access_enabled", String(options.request_access_enabled));
        if (options.default_branch_protection !== undefined)
          body.set("default_branch_protection", String(options.default_branch_protection));
        if (options.avatar) body.set("avatar", options.avatar);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/groups`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      },
    },
  ],

  // ============================================================================
  // NEW TOOLS (Issue #4 - Todos Management)
  // ============================================================================

  [
    "list_todos",
    {
      name: "list_todos",
      description:
        "TASK QUEUE: View your GitLab todos (notifications requiring action). Todos are auto-created when you're assigned to issues/MRs, @mentioned, requested as reviewer, or CI pipelines fail. Filter by state (pending/done), action type (assigned, mentioned, review_requested), or target type (Issue, MergeRequest).",
      inputSchema: z.toJSONSchema(ListTodosSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListTodosSchema.parse(args);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/todos?${queryParams}`;
        const response = await enhancedFetch(apiUrl);

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const todos = await response.json();
        return cleanGidsFromObject(todos);
      },
    },
  ],

  [
    "manage_todos",
    {
      name: "manage_todos",
      description:
        "TODO ACTIONS: Manage your GitLab todo items. Use 'mark_done' with id to complete a single todo after handling it. Use 'mark_all_done' to clear your entire todo queue at once. Use 'restore' with id to undo a completed todo and return it to pending state.",
      inputSchema: z.toJSONSchema(ManageTodosSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ManageTodosSchema.parse(args);
        const { action, id } = options;

        if ((action === "mark_done" || action === "restore") && id === undefined) {
          throw new Error(`Todo ID is required for action '${action}'`);
        }

        let apiUrl: string;
        switch (action) {
          case "mark_done":
            apiUrl = `${process.env.GITLAB_API_URL}/api/v4/todos/${id}/mark_as_done`;
            break;
          case "mark_all_done":
            apiUrl = `${process.env.GITLAB_API_URL}/api/v4/todos/mark_all_as_done`;
            break;
          case "restore":
            apiUrl = `${process.env.GITLAB_API_URL}/api/v4/todos/${id}/mark_as_pending`;
            break;
          default:
            throw new Error(`Unknown action: ${action as string}`);
        }

        const response = await enhancedFetch(apiUrl, { method: "POST" });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        if (action === "mark_all_done") {
          return { success: true, message: "All todos marked as done" };
        }

        const todo = await response.json();
        return cleanGidsFromObject(todo);
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getCoreReadOnlyToolNames(): string[] {
  return [
    // Consolidated read tools
    "browse_projects",
    "browse_namespaces",
    "browse_commits",
    "browse_events",
    // Kept as-is read tools
    "get_users",
    "list_project_members",
    "list_group_iterations",
    "download_attachment",
    "list_todos",
  ];
}

/**
 * Get all tool definitions from the registry
 */
export function getCoreToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(coreToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredCoreTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getCoreReadOnlyToolNames();
    return Array.from(coreToolRegistry.values()).filter(tool => readOnlyNames.includes(tool.name));
  }
  return getCoreToolDefinitions();
}
