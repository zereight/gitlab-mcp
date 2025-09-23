/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  SearchRepositoriesSchema,
  ListNamespacesSchema,
  GetNamespaceSchema,
  VerifyNamespaceSchema,
  GetProjectSchema,
  ListProjectsSchema,
  ListProjectMembersSchema,
  GetUsersSchema,
  ListCommitsSchema,
  GetCommitSchema,
  GetCommitDiffSchema,
  ListEventsSchema,
  GetProjectEventsSchema,
  ListGroupIterationsSchema,
  DownloadAttachmentSchema,
} from "./schema-readonly";
import {
  CreateRepositorySchema,
  ForkRepositorySchema,
  CreateBranchSchema,
  CreateGroupSchema,
} from "./schema";
import { enhancedFetch } from "../../utils/fetch";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { smartUserSearch, type UserSearchParams } from "../../utils/smart-user-search";
import { cleanGidsFromObject } from "../../utils/idConversion";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Core tools registry - unified registry containing all core tools with their handlers
 */
export const coreToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // Read-only tools
  [
    "search_repositories",
    {
      name: "search_repositories",
      description:
        "DISCOVER projects across ALL of GitLab using search criteria. Use when: You DON'T know the project name/path, Looking for ANY project (not just yours), Searching by language/keywords/topics. Use with_programming_language parameter for efficient language filtering. See also: Use list_projects for YOUR accessible projects only.",
      inputSchema: zodToJsonSchema(SearchRepositoriesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = SearchRepositoriesSchema.parse(args);

        // Extract parameters
        const { q, with_programming_language, ...otherOptions } = options;
        const queryParams = new URLSearchParams();

        // Handle programming language filtering
        let finalLanguage = with_programming_language;
        let finalSearchTerms = q ?? "";

        // Parse operators from q parameter
        if (q && !with_programming_language) {
          const languageMatch = q.match(/language:(\w+)/);
          if (languageMatch) {
            finalLanguage = languageMatch[1];
            finalSearchTerms = q.replace(/language:\w+/g, "").trim();
          }
        }

        // Parse user: operator
        if (q) {
          const userMatch = q.match(/user:(\w+)/);
          if (userMatch) {
            // For now, we'll use owned=true as a proxy since we can't easily map username to user_id
            // This is a limitation of GitLab API requiring user_id rather than username
            queryParams.set("owned", "true");
            finalSearchTerms = finalSearchTerms.replace(/user:\w+/g, "").trim();
          }
        }

        // Parse topic: operator
        if (q) {
          const topicMatches = q.match(/topic:(\w+)/g);
          if (topicMatches) {
            const topics = topicMatches.map(match => match.replace("topic:", ""));
            queryParams.set("topic", topics.join(","));
            finalSearchTerms = finalSearchTerms.replace(/topic:\w+/g, "").trim();
          }
        }

        // Set programming language filter
        if (finalLanguage) {
          queryParams.set("with_programming_language", finalLanguage);
        }

        // Set search terms
        if (finalSearchTerms) {
          // Convert spaces to + for GitLab API
          queryParams.set("search", finalSearchTerms.replace(/\s+/g, "+"));
        }

        // Add other options
        Object.entries(otherOptions).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.set(key, String(value));
          }
        });

        // Only return active projects (exclude archived and marked for deletion)
        queryParams.set("active", "true");

        // Make REAL GitLab API call to search projects
        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const projects = await response.json();

        // Return only essential fields for minimal token usage
        interface Project {
          id: number;
          name: string;
          path_with_namespace: string;
          description: string | null;
        }

        const minimalProjects = (projects as Project[]).map((project: Project) => ({
          id: project.id,
          name: project.name,
          path_with_namespace: project.path_with_namespace,
          description: project.description,
        }));

        return minimalProjects;
      },
    },
  ],
  [
    "list_projects",
    {
      name: "list_projects",
      description:
        "List GitLab projects with flexible scoping. DEFAULT (no group_id): Lists YOUR accessible projects across GitLab (owned/member/starred). Use for: browsing your projects, finding your work, managing personal project lists. GROUP SCOPE (with group_id): Lists all projects within a specific group/organization. Use for: exploring team structure, finding organizational projects, auditing group resources. Parameters automatically validate based on scope.",
      inputSchema: zodToJsonSchema(ListProjectsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListProjectsSchema.parse(args);
        const { group_id, ...otherOptions } = options;

        // Parameter validation based on scope
        if (group_id) {
          // GROUP SCOPE: Validate no user-only parameters
          const userOnlyParams = [
            "active",
            "imported",
            "membership",
            "statistics",
            "with_programming_language",
            "wiki_checksum_failed",
            "repository_checksum_failed",
            "id_after",
            "id_before",
            "last_activity_after",
            "last_activity_before",
            "marked_for_deletion_on",
            "repository_storage",
          ];
          const invalidParams = userOnlyParams.filter(param => otherOptions[param] !== undefined);
          if (invalidParams.length > 0) {
            throw new Error(
              `Invalid parameters for group scope: ${invalidParams.join(", ")}. These parameters are only valid without group_id (user scope).`
            );
          }

          // Build query parameters (excluding group_id) with sensible defaults for group scope
          const queryParams = new URLSearchParams();

          // Set sensible defaults for group scope
          const groupDefaults = {
            order_by: "created_at",
            sort: "desc",
            simple: true,
            per_page: 20,
          };

          // Merge defaults with user options (user options take precedence)
          const finalParameters = { ...groupDefaults, ...otherOptions };

          Object.entries(finalParameters).forEach(([key, value]) => {
            if (value !== undefined) {
              queryParams.set(key, String(value));
            }
          });

          // GROUP API: GET /groups/:id/projects
          const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/groups/${encodeURIComponent(group_id)}/projects?${queryParams}`;
          const response = await enhancedFetch(apiUrl, {
            headers: {
              Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            },
          });

          if (!response.ok) {
            throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
          }

          const projects = await response.json();
          return cleanGidsFromObject(projects);
        } else {
          // USER SCOPE: Validate no group-only parameters
          const groupOnlyParams = [
            "include_subgroups",
            "with_shared",
            "with_security_reports",
            "topic",
            "with_issues_enabled",
            "with_merge_requests_enabled",
          ];
          const invalidParams = groupOnlyParams.filter(param => otherOptions[param] !== undefined);
          if (invalidParams.length > 0) {
            throw new Error(
              `Invalid parameters for user scope: ${invalidParams.join(", ")}. These parameters require group_id (group scope).`
            );
          }

          // Build query parameters with sensible defaults for user scope
          const queryParams = new URLSearchParams();

          // Set sensible defaults
          const defaults = {
            active: true,
            order_by: "created_at",
            sort: "desc",
            simple: true,
            per_page: 20,
          };

          // Merge defaults with user options (user options take precedence)
          const finalParameters = { ...defaults, ...otherOptions };

          Object.entries(finalParameters).forEach(([key, value]) => {
            if (value !== undefined) {
              queryParams.set(key, String(value));
            }
          });

          // USER API: GET /projects
          const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects?${queryParams}`;
          const response = await enhancedFetch(apiUrl, {
            headers: {
              Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            },
          });

          if (!response.ok) {
            throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
          }

          const projects = await response.json();
          return cleanGidsFromObject(projects);
        }
      },
    },
  ],
  [
    "list_namespaces",
    {
      name: "list_namespaces",
      description:
        "BROWSE: List GitLab namespaces (groups and user namespaces) accessible to you. Use when: Discovering available groups for project creation, Browsing organizational structure, Finding where to create/fork projects. Returns both user and group namespaces. See also: get_namespace for specific namespace details.",
      inputSchema: zodToJsonSchema(ListNamespacesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListNamespacesSchema.parse(args);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const namespaces = await response.json();
        return cleanGidsFromObject(namespaces);
      },
    },
  ],
  [
    "get_users",
    {
      name: "get_users",
      description:
        'FIND USERS: Search and retrieve GitLab users with intelligent pattern detection. RECOMMENDED: Use "search" parameter for most queries - automatically detects emails, usernames, or names with automatic transliteration and multi-phase fallback search. ADVANCED: Use "username" or "public_email" for exact matches when you need precise control. Supports filtering by active status, creation date, and user type (human/bot).',
      inputSchema: zodToJsonSchema(GetUsersSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetUsersSchema.parse(args);
        const { smart_search, search, username, public_email, ...otherParams } = options;

        // Smart search logic:
        // 1. If only 'search' parameter is provided → auto-enable smart search (unless explicitly disabled)
        // 2. If username/email are provided → use legacy behavior (unless smart_search explicitly enabled)
        // 3. Respect explicit smart_search setting when provided
        const hasUsernameOrEmail = Boolean(username) || Boolean(public_email);
        const hasOnlySearch = Boolean(search) && !hasUsernameOrEmail;

        const shouldUseSmartSearch =
          smart_search === false ? false : smart_search === true || hasOnlySearch;

        if (shouldUseSmartSearch && (search || username || public_email)) {
          // Smart search mode: auto-detect pattern and use intelligent search strategy
          const query = search ?? username ?? public_email ?? "";
          const additionalParams: UserSearchParams = {};

          // Pass through all other filter parameters
          Object.entries(otherParams).forEach(([key, value]) => {
            if (value !== undefined && key !== "smart_search") {
              additionalParams[key] = value;
            }
          });

          const result = await smartUserSearch(query, additionalParams);
          return result;
        } else {
          // Legacy mode: direct GitLab API call with all provided parameters
          const queryParams = new URLSearchParams();
          Object.entries(options).forEach(([key, value]) => {
            if (value !== undefined && key !== "smart_search") {
              queryParams.set(key, String(value));
            }
          });

          const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/users?${queryParams}`;
          const response = await enhancedFetch(apiUrl, {
            headers: {
              Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            },
          });

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
    "get_project",
    {
      name: "get_project",
      description:
        "GET DETAILS: Retrieve comprehensive project information including settings and metadata. Use when: Need complete project details, Checking project configuration, Getting project statistics. Accepts either project_id (numeric ID or URL-encoded path) or namespace (group/project format). See also: list_projects to find projects first.",
      inputSchema: zodToJsonSchema(GetProjectSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetProjectSchema.parse(args);
        const { project_id, namespace } = options;

        // Determine project identifier: use namespace if provided, otherwise project_id
        const projectIdentifier = namespace ?? project_id;
        if (!projectIdentifier) {
          throw new Error("Either project_id or namespace must be provided");
        }

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id" && key !== "namespace") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(projectIdentifier)}?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const project = await response.json();
        return cleanGidsFromObject(project);
      },
    },
  ],
  // Additional core read-only tools
  [
    "get_namespace",
    {
      name: "get_namespace",
      description:
        "GET DETAILS: Retrieve comprehensive namespace information (group or user). Use when: Need complete namespace metadata, Checking namespace settings, Getting storage statistics. Requires namespace ID or URL-encoded path. See also: list_namespaces to browse all namespaces.",
      inputSchema: zodToJsonSchema(GetNamespaceSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetNamespaceSchema.parse(args);
        const { namespace_id } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces/${encodeURIComponent(namespace_id)}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const namespace = await response.json();
        return cleanGidsFromObject(namespace);
      },
    },
  ],
  [
    "verify_namespace",
    {
      name: "verify_namespace",
      description:
        "CHECK EXISTS: Verify if a namespace (group or user) exists and is accessible. ONLY works with namespaces - NOT project paths. Use when: Checking group/user namespace availability, Validating group references before creation, Testing namespace access permissions. For projects use get_project instead. Returns exists=true/false with namespace details if found.",
      inputSchema: zodToJsonSchema(VerifyNamespaceSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = VerifyNamespaceSchema.parse(args);
        const { namespace } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces/${encodeURIComponent(namespace)}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        return {
          exists: response.ok,
          status: response.status,
          namespace: namespace,
          data: response.ok ? await response.json() : null,
        };
      },
    },
  ],
  [
    "list_project_members",
    {
      name: "list_project_members",
      description:
        "TEAM MEMBERS: List all members of a project with their access levels. Use when: Auditing project access, Finding collaborators, Checking user permissions. Shows access levels: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner. Supports username filtering.",
      inputSchema: zodToJsonSchema(ListProjectMembersSchema),
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
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const members = await response.json();
        return cleanGidsFromObject(members);
      },
    },
  ],
  [
    "list_commits",
    {
      name: "list_commits",
      description:
        "HISTORY: List repository commit history with filtering. Use when: Analyzing project history, Finding commits by author/date, Tracking file changes. Supports date ranges (since/until), author filter, and specific file paths. See also: get_commit for specific commit details.",
      inputSchema: zodToJsonSchema(ListCommitsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListCommitsSchema.parse(args);
        const { project_id } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const commits = await response.json();
        return commits;
      },
    },
  ],
  [
    "get_commit",
    {
      name: "get_commit",
      description:
        "COMMIT DETAILS: Get comprehensive information about a specific commit. Use when: Inspecting commit metadata, Reviewing change statistics, Getting commit message/author. Shows additions/deletions per file with stats=true. See also: get_commit_diff for actual code changes.",
      inputSchema: zodToJsonSchema(GetCommitSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetCommitSchema.parse(args);
        const { project_id, commit_sha } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id" && key !== "commit_sha") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits/${encodeURIComponent(commit_sha)}?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const commit = await response.json();
        return commit;
      },
    },
  ],
  [
    "get_commit_diff",
    {
      name: "get_commit_diff",
      description:
        "COMMIT DIFF: Get actual code changes from a commit. Use when: Reviewing code modifications, Generating patches, Analyzing line-by-line changes. Returns unified diff format (git diff style). See also: get_commit for metadata without diff.",
      inputSchema: zodToJsonSchema(GetCommitDiffSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetCommitDiffSchema.parse(args);
        const { project_id, commit_sha } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id" && key !== "commit_sha") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/repository/commits/${encodeURIComponent(commit_sha)}/diff?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const diff = await response.json();
        return diff;
      },
    },
  ],
  [
    "list_group_iterations",
    {
      name: "list_group_iterations",
      description:
        "SPRINTS: List iterations/sprints for agile planning (Premium feature). Use when: Viewing sprint schedules, Tracking iteration progress, Planning releases. Filter by state: current=active sprint, upcoming=future, closed=completed. Requires GitLab Premium or higher.",
      inputSchema: zodToJsonSchema(ListGroupIterationsSchema),
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
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const iterations = await response.json();
        return iterations;
      },
    },
  ],
  [
    "download_attachment",
    {
      name: "download_attachment",
      description:
        "DOWNLOAD: Retrieve uploaded file attachments from issues/MRs/wikis. Use when: Downloading images from issues, Getting attached documents, Retrieving uploaded files. Requires secret token and filename from the attachment URL (/uploads/[secret]/[filename]).",
      inputSchema: zodToJsonSchema(DownloadAttachmentSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = DownloadAttachmentSchema.parse(args);
        const { project_id, secret, filename } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/uploads/${secret}/${filename}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

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
    "list_events",
    {
      name: "list_events",
      description:
        "USER ACTIVITY: List YOUR activity events across all projects. Use when: Tracking your contributions, Auditing your actions, Reviewing your history. Date format: YYYY-MM-DD only (not timestamps). Filters: action=created/updated/pushed, target_type=issue/merge_request.",
      inputSchema: zodToJsonSchema(ListEventsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListEventsSchema.parse(args);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/events?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const events = await response.json();
        return events;
      },
    },
  ],
  [
    "get_project_events",
    {
      name: "get_project_events",
      description:
        "PROJECT ACTIVITY: List all events within a specific project. Use when: Monitoring project activity, Tracking team contributions, Auditing project changes. Date format: YYYY-MM-DD only (not timestamps). Shows: commits, issues, MRs, member changes.",
      inputSchema: zodToJsonSchema(GetProjectEventsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetProjectEventsSchema.parse(args);
        const { project_id } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(project_id)}/events?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const events = await response.json();
        return events;
      },
    },
  ],

  // Write tools
  [
    "create_repository",
    {
      name: "create_repository",
      description:
        "CREATE NEW: Initialize a new GitLab project/repository with automatic validation. Features: (1) Automatically checks if project already exists before creation, (2) Resolves namespace paths to IDs automatically, (3) Generates URL-safe project path from name, (4) Returns detailed validation information. Use when: Starting new projects, Setting up repository structure, Automating project creation. Creates in your namespace by default if no namespace specified.",
      inputSchema: zodToJsonSchema(CreateRepositorySchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateRepositorySchema.parse(args);
        const { namespace, name, ...otherOptions } = options;

        // Step 1: Resolve namespace path to ID if provided
        let namespaceId: string | undefined;
        let resolvedNamespace: { id: string; full_path: string } | null = null;
        if (namespace) {
          const namespaceApiUrl = `${process.env.GITLAB_API_URL}/api/v4/namespaces/${encodeURIComponent(namespace)}`;
          const namespaceResponse = await enhancedFetch(namespaceApiUrl, {
            headers: {
              Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            },
          });

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

        // Step 2: Check if project already exists in target namespace
        const targetNamespacePath = resolvedNamespace
          ? resolvedNamespace.full_path
          : "current-user";
        const projectPath = `${targetNamespacePath}/${name}`;

        const checkProjectUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(projectPath)}`;
        const checkResponse = await enhancedFetch(checkProjectUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (checkResponse.ok) {
          const existingProject = (await checkResponse.json()) as { id: string };
          throw new Error(
            `Project '${projectPath}' already exists (ID: ${existingProject.id}). Use a different name or update the existing project.`
          );
        }

        // Step 3: Create project
        const body = new URLSearchParams();

        // Add required name
        body.set("name", name);

        // Generate path from name (replace spaces and special chars)
        const generatedPath = name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        body.set("path", generatedPath);

        // Add namespace_id if resolved
        if (namespaceId) {
          body.set("namespace_id", namespaceId);
        }

        // Add all other options
        Object.entries(otherOptions).forEach(([key, value]) => {
          if (value !== undefined) {
            if (Array.isArray(value)) {
              body.set(key, value.join(","));
            } else {
              body.set(key, String(value));
            }
          }
        });

        const createApiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects`;
        const createResponse = await enhancedFetch(createApiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!createResponse.ok) {
          throw new Error(
            `GitLab API error: ${createResponse.status} ${createResponse.statusText}`
          );
        }

        const project = await createResponse.json();

        // Step 4: Return enhanced result with validation info
        return {
          ...project,
          validation: {
            namespace_resolved: namespace ? `${namespace} → ${namespaceId}` : "current-user",
            project_name_available: true,
            created_in_expected_namespace:
              !namespace ||
              (project as { namespace: { full_path: string } }).namespace.full_path ===
                resolvedNamespace?.full_path,
            generated_path: generatedPath,
          },
        };
      },
    },
  ],
  [
    "fork_repository",
    {
      name: "fork_repository",
      description:
        "FORK: Create your own copy of an existing project. Use when: Contributing to other projects, Creating experimental versions, Maintaining custom forks. Preserves fork relationship for MRs back to parent. Target namespace optional (defaults to your namespace).",
      inputSchema: zodToJsonSchema(ForkRepositorySchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ForkRepositorySchema.parse(args);

        const body = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id") {
            body.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/fork`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const fork = await response.json();
        return fork;
      },
    },
  ],
  [
    "create_branch",
    {
      name: "create_branch",
      description:
        "NEW BRANCH: Create a Git branch from existing ref. Use when: Starting new features, Preparing bug fixes, Creating release branches. REQUIRED before creating MRs. Ref can be: branch name (main), tag (v1.0), or commit SHA. Branch names cannot contain spaces.",
      inputSchema: zodToJsonSchema(CreateBranchSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateBranchSchema.parse(args);

        const body = new URLSearchParams();
        body.set("branch", options.branch);
        body.set("ref", options.ref);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/repository/branches`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const branch = await response.json();
        return branch;
      },
    },
  ],
  [
    "create_group",
    {
      name: "create_group",
      description:
        "CREATE GROUP: Create a new GitLab group/namespace for organizing projects and teams. Use when: Setting up team spaces, Creating organizational structure, Establishing project hierarchies. Groups can contain projects and subgroups.",
      inputSchema: zodToJsonSchema(CreateGroupSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateGroupSchema.parse(args);
        const body = new URLSearchParams();

        // Add required fields
        body.set("name", options.name);
        body.set("path", options.path);

        // Add optional fields
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
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const group = await response.json();
        return group;
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getCoreReadOnlyToolNames(): string[] {
  // Return tools that are considered read-only
  return [
    "search_repositories",
    "list_namespaces",
    "get_namespace",
    "verify_namespace",
    "get_project",
    "list_projects",
    "list_project_members",
    "get_users",
    "list_commits",
    "get_commit",
    "get_commit_diff",
    "list_group_iterations",
    "download_attachment",
    "list_events",
    "get_project_events",
  ];
}

/**
 * Get all tool definitions from the registry (for backward compatibility)
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
