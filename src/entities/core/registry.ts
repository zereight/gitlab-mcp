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

        switch (options.action) {
          case "search": {
            const { q, with_programming_language, visibility, order_by, sort, per_page, page } =
              options;
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
                // Let URLSearchParams handle encoding (spaces become '+' per x-www-form-urlencoded)
                // GitLab API accepts both '+' and '%20' for spaces in search queries
                queryParams.set("search", finalSearchTerms);
              }
            }

            // Add options
            if (with_programming_language)
              queryParams.set("with_programming_language", with_programming_language);
            if (visibility) queryParams.set("visibility", visibility);
            if (order_by) queryParams.set("order_by", order_by);
            if (sort) queryParams.set("sort", sort);
            if (per_page) queryParams.set("per_page", String(per_page));
            if (page) queryParams.set("page", String(page));

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
            const {
              group_id,
              search,
              owned,
              starred,
              membership,
              simple,
              with_programming_language,
              include_subgroups,
              with_shared,
              visibility,
              archived,
              order_by,
              sort,
              per_page,
              page,
            } = options;
            const queryParams = new URLSearchParams();

            // Build query parameters
            if (visibility) queryParams.set("visibility", visibility);
            if (archived !== undefined) queryParams.set("archived", String(archived));
            if (owned !== undefined) queryParams.set("owned", String(owned));
            if (starred !== undefined) queryParams.set("starred", String(starred));
            if (membership !== undefined) queryParams.set("membership", String(membership));
            if (search) queryParams.set("search", search);
            if (simple !== undefined) queryParams.set("simple", String(simple));
            if (order_by) queryParams.set("order_by", order_by);
            if (sort) queryParams.set("sort", sort);
            if (per_page) queryParams.set("per_page", String(per_page));
            if (page) queryParams.set("page", String(page));
            if (include_subgroups !== undefined)
              queryParams.set("include_subgroups", String(include_subgroups));
            if (with_shared !== undefined) queryParams.set("with_shared", String(with_shared));
            if (with_programming_language)
              queryParams.set("with_programming_language", with_programming_language);

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
            const { project_id, statistics, license } = options;

            const queryParams = new URLSearchParams();
            if (statistics) queryParams.set("statistics", "true");
            if (license) queryParams.set("license", "true");

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const project = await response.json();
            return cleanGidsFromObject(project);
          }

          default: {
            const _exhaustive: never = options;
            throw new Error(`Unknown action: ${(_exhaustive as { action: string }).action}`);
          }
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

        switch (options.action) {
          case "list": {
            const {
              search,
              owned_only,
              top_level_only,
              with_statistics,
              min_access_level,
              per_page,
              page,
            } = options;
            const queryParams = new URLSearchParams();

            if (search) queryParams.set("search", search);
            if (owned_only !== undefined) queryParams.set("owned_only", String(owned_only));
            if (top_level_only !== undefined)
              queryParams.set("top_level_only", String(top_level_only));
            if (with_statistics !== undefined)
              queryParams.set("with_statistics", String(with_statistics));
            if (min_access_level !== undefined)
              queryParams.set("min_access_level", String(min_access_level));
            if (per_page) queryParams.set("per_page", String(per_page));
            if (page) queryParams.set("page", String(page));

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const namespaces = await response.json();
            return cleanGidsFromObject(namespaces);
          }

          case "get": {
            const { namespace_id } = options;

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces/${encodeURIComponent(namespace_id)}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const namespace = await response.json();
            return cleanGidsFromObject(namespace);
          }

          case "verify": {
            const { namespace_id } = options;

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces/${encodeURIComponent(namespace_id)}`;
            const response = await enhancedFetch(apiUrl);

            return {
              exists: response.ok,
              status: response.status,
              namespace: namespace_id,
              data: response.ok ? await response.json() : null,
            };
          }

          default: {
            const _exhaustive: never = options;
            throw new Error(`Unknown action: ${(_exhaustive as { action: string }).action}`);
          }
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

        switch (options.action) {
          case "list": {
            const {
              project_id,
              ref_name,
              since,
              until,
              path,
              author,
              all,
              with_stats,
              first_parent,
              order,
              trailers,
              per_page,
              page,
            } = options;
            const queryParams = new URLSearchParams();

            if (ref_name) queryParams.set("ref_name", ref_name);
            if (since) queryParams.set("since", since);
            if (until) queryParams.set("until", until);
            if (path) queryParams.set("path", path);
            if (author) queryParams.set("author", author);
            if (all !== undefined) queryParams.set("all", String(all));
            if (with_stats !== undefined) queryParams.set("with_stats", String(with_stats));
            if (first_parent !== undefined) queryParams.set("first_parent", String(first_parent));
            if (order) queryParams.set("order", order);
            if (trailers !== undefined) queryParams.set("trailers", String(trailers));
            if (per_page) queryParams.set("per_page", String(per_page));
            if (page) queryParams.set("page", String(page));

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          case "get": {
            const { project_id, sha, stats } = options;

            const queryParams = new URLSearchParams();
            if (stats) queryParams.set("stats", "true");

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits/${encodeURIComponent(sha)}?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          case "diff": {
            const { project_id, sha, unidiff } = options;

            const queryParams = new URLSearchParams();
            if (unidiff) queryParams.set("unidiff", "true");

            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits/${encodeURIComponent(sha)}/diff?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          default: {
            const _exhaustive: never = options;
            throw new Error(`Unknown action: ${(_exhaustive as { action: string }).action}`);
          }
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

        // Build common query params based on action type
        const buildQueryParams = (opts: {
          target_type?: string;
          event_action?: string;
          before?: string;
          after?: string;
          sort?: string;
          per_page?: number;
          page?: number;
        }) => {
          const queryParams = new URLSearchParams();
          if (opts.target_type) queryParams.set("target_type", opts.target_type);
          if (opts.event_action) queryParams.set("action", opts.event_action);
          if (opts.before) queryParams.set("before", opts.before);
          if (opts.after) queryParams.set("after", opts.after);
          if (opts.sort) queryParams.set("sort", opts.sort);
          if (opts.per_page) queryParams.set("per_page", String(opts.per_page));
          if (opts.page) queryParams.set("page", String(opts.page));
          return queryParams;
        };

        switch (options.action) {
          case "user": {
            const queryParams = buildQueryParams(options);
            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/events?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          case "project": {
            const { project_id } = options;
            const queryParams = buildQueryParams(options);
            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/events?${queryParams}`;
            const response = await enhancedFetch(apiUrl);

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
          }

          default: {
            const _exhaustive: never = options;
            throw new Error(`Unknown action: ${(_exhaustive as { action: string }).action}`);
          }
        }
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

        switch (options.action) {
          case "create": {
            const {
              name,
              namespace,
              description,
              visibility,
              initialize_with_readme,
              issues_enabled,
              merge_requests_enabled,
              jobs_enabled,
              wiki_enabled,
              snippets_enabled,
              lfs_enabled,
              request_access_enabled,
              only_allow_merge_if_pipeline_succeeds,
              only_allow_merge_if_all_discussions_are_resolved,
            } = options;

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
            if (description) body.set("description", description);
            if (visibility) body.set("visibility", visibility);
            if (initialize_with_readme) body.set("initialize_with_readme", "true");

            // Add optional feature flags
            if (issues_enabled !== undefined) body.set("issues_enabled", String(issues_enabled));
            if (merge_requests_enabled !== undefined)
              body.set("merge_requests_enabled", String(merge_requests_enabled));
            if (jobs_enabled !== undefined) body.set("jobs_enabled", String(jobs_enabled));
            if (wiki_enabled !== undefined) body.set("wiki_enabled", String(wiki_enabled));
            if (snippets_enabled !== undefined)
              body.set("snippets_enabled", String(snippets_enabled));
            if (lfs_enabled !== undefined) body.set("lfs_enabled", String(lfs_enabled));
            if (request_access_enabled !== undefined)
              body.set("request_access_enabled", String(request_access_enabled));
            if (only_allow_merge_if_pipeline_succeeds !== undefined)
              body.set(
                "only_allow_merge_if_pipeline_succeeds",
                String(only_allow_merge_if_pipeline_succeeds)
              );
            if (only_allow_merge_if_all_discussions_are_resolved !== undefined)
              body.set(
                "only_allow_merge_if_all_discussions_are_resolved",
                String(only_allow_merge_if_all_discussions_are_resolved)
              );

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
            const { project_id, namespace, namespace_path, fork_name, fork_path } = options;

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

          default: {
            const _exhaustive: never = options;
            throw new Error(`Unknown action: ${(_exhaustive as { action: string }).action}`);
          }
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
        "TODO ACTIONS: Manage your GitLab todo items. Use 'mark_done' with id to complete a single todo (returns the updated todo object). Use 'mark_all_done' to clear your entire todo queue (returns success status). Use 'restore' with id to undo a completed todo (returns the restored todo object).",
      inputSchema: z.toJSONSchema(ManageTodosSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ManageTodosSchema.parse(args);

        switch (options.action) {
          case "mark_done": {
            const { id } = options;
            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/todos/${id}/mark_as_done`;
            const response = await enhancedFetch(apiUrl, { method: "POST" });

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const todo = await response.json();
            return cleanGidsFromObject(todo);
          }

          case "mark_all_done": {
            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/todos/mark_all_as_done`;
            const response = await enhancedFetch(apiUrl, { method: "POST" });

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            return { success: true, message: "All todos marked as done" };
          }

          case "restore": {
            const { id } = options;
            const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/todos/${id}/mark_as_pending`;
            const response = await enhancedFetch(apiUrl, { method: "POST" });

            if (!response.ok) {
              throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const todo = await response.json();
            return cleanGidsFromObject(todo);
          }

          default: {
            const _exhaustive: never = options;
            throw new Error(`Unknown action: ${(_exhaustive as { action: string }).action}`);
          }
        }
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
