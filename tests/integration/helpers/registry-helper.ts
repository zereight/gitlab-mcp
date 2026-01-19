import { RegistryManager } from "../../../src/registry-manager";
import { ConnectionManager } from "../../../src/services/ConnectionManager";

/**
 * Integration Test Helper for RegistryManager
 *
 * This helper ensures integration tests use actual handler functions instead of
 * direct API calls, providing true end-to-end testing of the production code path.
 *
 * Usage:
 * ```typescript
 * const helper = new IntegrationTestHelper();
 * await helper.initialize();
 * const projects = await helper.listProjects({ per_page: 20 });
 * ```
 */
export class IntegrationTestHelper {
  private registryManager: RegistryManager;
  private connectionManager: ConnectionManager;
  private initialized = false;

  constructor() {
    this.registryManager = RegistryManager.getInstance();
    this.connectionManager = ConnectionManager.getInstance();
  }

  /**
   * Initialize the helper - ensures GitLab connection is ready
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize connection manager (loads schema, connects to GitLab)
    await this.connectionManager.initialize();

    // Force rebuild the registry cache now that ConnectionManager is initialized
    // This is needed because RegistryManager checks ToolAvailability during cache building
    // which requires ConnectionManager to be initialized first
    this.registryManager.refreshCache();

    this.initialized = true;

    const instanceInfo = this.connectionManager.getInstanceInfo();
    console.log(
      `🔗 Integration test helper connected: ${instanceInfo.version} ${instanceInfo.tier}`
    );
  }

  /**
   * Execute any tool by name using the production handler
   */
  async executeTool(toolName: string, args: unknown): Promise<unknown> {
    if (!this.initialized) {
      throw new Error("IntegrationTestHelper must be initialized before use");
    }

    return await this.registryManager.executeTool(toolName, args);
  }

  /**
   * Check if a tool is available
   */
  hasToolHandler(toolName: string): boolean {
    return this.registryManager.hasToolHandler(toolName);
  }

  // ========================================
  // CORE TOOLS - Project & User Operations
  // ========================================

  // browse_projects: Consolidated CQRS tool (Issue #16)
  async listProjects(
    args: {
      group_id?: string;
      membership?: boolean;
      owned?: boolean;
      starred?: boolean;
      archived?: boolean;
      visibility?: "public" | "internal" | "private";
      order_by?:
        | "id"
        | "name"
        | "path"
        | "created_at"
        | "updated_at"
        | "last_activity_at"
        | "similarity";
      sort?: "asc" | "desc";
      search?: string;
      simple?: boolean;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<unknown> {
    return this.executeTool("browse_projects", { action: "list", ...args });
  }

  async searchProjects(
    args: {
      q?: string;
      with_programming_language?: string;
      visibility?: "public" | "internal" | "private";
      order_by?:
        | "id"
        | "name"
        | "path"
        | "created_at"
        | "updated_at"
        | "last_activity_at"
        | "similarity";
      sort?: "asc" | "desc";
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<unknown> {
    return this.executeTool("browse_projects", { action: "search", ...args });
  }

  async getProject(args: {
    project_id: string;
    statistics?: boolean;
    license?: boolean;
  }): Promise<unknown> {
    return this.executeTool("browse_projects", { action: "get", ...args });
  }

  async getUsers(
    args: {
      username?: string;
      search?: string;
      active?: boolean;
      blocked?: boolean;
      external?: boolean;
      exclude_internal?: boolean;
      exclude_external?: boolean;
      without_project_bots?: boolean;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<unknown> {
    return this.executeTool("get_users", args);
  }

  // browse_namespaces: Consolidated CQRS tool (Issue #16)
  async listNamespaces(
    args: {
      search?: string;
      owned_only?: boolean;
      top_level_only?: boolean;
      with_statistics?: boolean;
      min_access_level?: number;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<unknown> {
    return this.executeTool("browse_namespaces", { action: "list", ...args });
  }

  async getNamespace(args: { namespace_id: string }): Promise<unknown> {
    return this.executeTool("browse_namespaces", { action: "get", ...args });
  }

  async verifyNamespace(args: { namespace_id: string }): Promise<unknown> {
    return this.executeTool("browse_namespaces", { action: "verify", ...args });
  }

  // ========================================
  // WORK ITEMS - GraphQL Operations
  // ========================================

  async createWorkItem(args: {
    namespace: string;
    title: string;
    workItemType: string;
    description?: string;
    assigneeIds?: string[];
    labelIds?: string[];
    milestoneId?: string;
  }): Promise<unknown> {
    return this.executeTool("create_work_item", args);
  }

  async updateWorkItem(args: {
    id: string;
    title?: string;
    description?: string;
    state?: "OPEN" | "CLOSE" | "REOPEN";
    assigneeIds?: string[];
    labelIds?: string[];
    milestoneId?: string;
  }): Promise<unknown> {
    return this.executeTool("update_work_item", args);
  }

  async deleteWorkItem(args: { id: string }): Promise<unknown> {
    return this.executeTool("delete_work_item", args);
  }

  async getWorkItem(args: { id: string }): Promise<unknown> {
    return this.executeTool("get_work_item", args);
  }

  async listWorkItems(args: {
    namespace: string;
    types?: string[];
    state?: ("OPEN" | "CLOSED")[];
    first?: number;
    after?: string;
    simple?: boolean;
    active?: boolean;
  }): Promise<unknown> {
    return this.executeTool("list_work_items", args);
  }

  // ========================================
  // LABELS - Project & Group Operations
  // ========================================

  async listLabels(args: {
    project_id?: string;
    group_id?: string;
    with_counts?: boolean;
    include_ancestor_groups?: boolean;
    search?: string;
    per_page?: number;
    page?: number;
  }): Promise<unknown> {
    return this.executeTool("list_labels", args);
  }

  async getLabel(args: {
    project_id?: string;
    group_id?: string;
    label_id: string;
  }): Promise<unknown> {
    return this.executeTool("get_label", args);
  }

  async createLabel(args: {
    project_id?: string;
    group_id?: string;
    name: string;
    color: string;
    description?: string;
    priority?: number;
  }): Promise<unknown> {
    return this.executeTool("create_label", args);
  }

  async updateLabel(args: {
    project_id?: string;
    group_id?: string;
    label_id: string;
    new_name?: string;
    color?: string;
    description?: string;
    priority?: number;
  }): Promise<unknown> {
    return this.executeTool("update_label", args);
  }

  async deleteLabel(args: {
    project_id?: string;
    group_id?: string;
    label_id: string;
  }): Promise<unknown> {
    return this.executeTool("delete_label", args);
  }

  // ========================================
  // MERGE REQUESTS - Full Lifecycle
  // ========================================

  async listMergeRequests(args: {
    project_id?: string;
    group_id?: string;
    state?: "opened" | "closed" | "locked" | "merged";
    order_by?:
      | "created_at"
      | "updated_at"
      | "priority"
      | "label_priority"
      | "milestone_due"
      | "popularity"
      | "weight";
    sort?: "asc" | "desc";
    milestone?: string;
    view?: "simple" | "minimal";
    labels?: string;
    with_labels_details?: boolean;
    with_merge_status_recheck?: boolean;
    created_after?: string;
    created_before?: string;
    updated_after?: string;
    updated_before?: string;
    scope?: "created_by_me" | "assigned_to_me" | "all";
    author_id?: number;
    author_username?: string;
    assignee_id?: number;
    assignee_username?: string;
    my_reaction_emoji?: string;
    source_branch?: string;
    target_branch?: string;
    search?: string;
    in?: string;
    draft?: boolean;
    wip?: "yes" | "no";
    not?: string;
    environment?: string;
    deployed_before?: string;
    deployed_after?: string;
    per_page?: number;
    page?: number;
  }): Promise<unknown> {
    return this.executeTool("list_merge_requests", args);
  }

  async getMergeRequest(args: {
    project_id: string;
    merge_request_iid: number;
    render_html?: boolean;
    include_diverged_commits_count?: boolean;
    include_rebase_in_progress?: boolean;
  }): Promise<unknown> {
    return this.executeTool("get_merge_request", args);
  }

  async createMergeRequest(args: {
    project_id: string;
    source_branch: string;
    target_branch: string;
    title: string;
    assignee_id?: number;
    assignee_ids?: number[];
    reviewer_ids?: number[];
    description?: string;
    target_project_id?: number;
    labels?: string;
    milestone_id?: number;
    remove_source_branch?: boolean;
    allow_collaboration?: boolean;
    allow_maintainer_to_push?: boolean;
    squash?: boolean;
  }): Promise<unknown> {
    return this.executeTool("create_merge_request", args);
  }

  // ========================================
  // MILESTONES - Project & Group Operations
  // ========================================

  async listMilestones(args: {
    project_id?: string;
    group_id?: string;
    state?: "active" | "closed";
    search?: string;
    include_parent_milestones?: boolean;
    per_page?: number;
    page?: number;
  }): Promise<unknown> {
    return this.executeTool("list_milestones", args);
  }

  async getMilestone(args: {
    project_id?: string;
    group_id?: string;
    milestone_id: string;
  }): Promise<unknown> {
    return this.executeTool("get_milestone", args);
  }

  // ========================================
  // PIPELINES - CI/CD Operations
  // ========================================

  async listPipelines(args: {
    project_id: string;
    scope?: "running" | "pending" | "finished" | "branches" | "tags";
    status?:
      | "created"
      | "waiting_for_resource"
      | "preparing"
      | "pending"
      | "running"
      | "success"
      | "failed"
      | "canceled"
      | "skipped"
      | "manual"
      | "scheduled";
    source?:
      | "push"
      | "web"
      | "trigger"
      | "schedule"
      | "api"
      | "external"
      | "pipeline"
      | "chat"
      | "webide"
      | "merge_request_event"
      | "external_pull_request_event"
      | "parent_pipeline"
      | "ondemand_dast_scan"
      | "ondemand_dast_validation";
    ref?: string;
    sha?: string;
    yaml_errors?: boolean;
    username?: string;
    updated_after?: string;
    updated_before?: string;
    order_by?: "id" | "status" | "ref" | "updated_at" | "user_id";
    sort?: "asc" | "desc";
    per_page?: number;
    page?: number;
  }): Promise<unknown> {
    return this.executeTool("list_pipelines", args);
  }

  async getPipeline(args: { project_id: string; pipeline_id: number }): Promise<unknown> {
    return this.executeTool("get_pipeline", args);
  }

  // ========================================
  // WIKI - Documentation Operations
  // ========================================

  async listWikiPages(args: {
    project_id: string;
    with_content?: boolean;
    per_page?: number;
    page?: number;
  }): Promise<unknown> {
    return this.executeTool("list_wiki_pages", args);
  }

  async getWikiPage(args: {
    project_id: string;
    slug: string;
    version?: string;
    render_html?: boolean;
  }): Promise<unknown> {
    return this.executeTool("get_wiki_page", args);
  }

  async createWikiPage(args: {
    project_id: string;
    title: string;
    content: string;
    encoding?: "text" | "base64";
    format?: "markdown" | "rdoc" | "asciidoc" | "org";
  }): Promise<unknown> {
    return this.executeTool("create_wiki_page", args);
  }

  // ========================================
  // TODOS - Task Queue Operations
  // ========================================

  async listTodos(args: {
    action?:
      | "assigned"
      | "mentioned"
      | "build_failed"
      | "marked"
      | "approval_required"
      | "unmergeable"
      | "directly_addressed"
      | "review_requested";
    state?: "pending" | "done";
    type?:
      | "Issue"
      | "MergeRequest"
      | "Epic"
      | "DesignManagement::Design"
      | "AlertManagement::Alert";
    project_id?: number;
    group_id?: number;
    author_id?: number;
    per_page?: number;
    page?: number;
  }): Promise<unknown> {
    return this.executeTool("list_todos", args);
  }

  async markTodoDone(id: number): Promise<unknown> {
    return this.executeTool("manage_todos", { action: "mark_done", id });
  }

  async markAllTodosDone(): Promise<unknown> {
    return this.executeTool("manage_todos", { action: "mark_all_done" });
  }

  async restoreTodo(id: number): Promise<unknown> {
    return this.executeTool("manage_todos", { action: "restore", id });
  }
}
