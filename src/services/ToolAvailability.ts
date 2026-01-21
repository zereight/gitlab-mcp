import { ConnectionManager } from "./ConnectionManager";
import { GitLabTier } from "./GitLabVersionDetector";
import { logger } from "../logger";

interface ToolRequirement {
  minVersion: number;
  requiredTier: "free" | "premium" | "ultimate";
  notes?: string;
}

/**
 * Action-level tier requirement
 */
interface ActionRequirement {
  tier: "free" | "premium" | "ultimate";
  minVersion: number;
  notes?: string;
}

/**
 * Tool with action-level requirements (for consolidated tools)
 */
interface ToolActionRequirements {
  /** Default requirement when action is not specified */
  default: ActionRequirement;
  /** Action-specific requirements (override default) */
  actions?: Record<string, ActionRequirement>;
}

export class ToolAvailability {
  /** Tier hierarchy for comparison: free < premium < ultimate */
  private static readonly TIER_ORDER: Record<string, number> = {
    free: 0,
    premium: 1,
    ultimate: 2,
  };

  // Comprehensive tool requirements based on GitLab documentation
  private static toolRequirements: Record<string, ToolRequirement> = {
    // Core Tools - Available in Free Tier
    list_projects: { minVersion: 8.0, requiredTier: "free" },
    get_project: { minVersion: 8.0, requiredTier: "free" },
    create_project: { minVersion: 8.0, requiredTier: "free" },
    update_project: { minVersion: 8.0, requiredTier: "free" },
    delete_project: { minVersion: 8.0, requiredTier: "free" },
    fork_project: { minVersion: 8.0, requiredTier: "free" },
    archive_project: { minVersion: 8.0, requiredTier: "free" },
    unarchive_project: { minVersion: 8.0, requiredTier: "free" },

    // Branches - Available in Free Tier
    list_branches: { minVersion: 8.0, requiredTier: "free" },
    get_branch: { minVersion: 8.0, requiredTier: "free" },
    create_branch: { minVersion: 8.0, requiredTier: "free" },
    delete_branch: { minVersion: 8.0, requiredTier: "free" },
    protect_branch: { minVersion: 8.0, requiredTier: "free" },
    unprotect_branch: { minVersion: 8.0, requiredTier: "free" },

    // Commits - Available in Free Tier
    list_commits: { minVersion: 8.0, requiredTier: "free" },
    get_commit: { minVersion: 8.0, requiredTier: "free" },
    get_commit_diff: { minVersion: 8.0, requiredTier: "free" },
    get_branch_diffs: { minVersion: 8.0, requiredTier: "free" },
    cherry_pick_commit: { minVersion: 8.15, requiredTier: "free" },
    revert_commit: { minVersion: 8.15, requiredTier: "free" },

    // Files - Available in Free Tier
    get_file_contents: { minVersion: 8.0, requiredTier: "free" },
    create_or_update_file: { minVersion: 8.0, requiredTier: "free" },
    delete_file: { minVersion: 8.0, requiredTier: "free" },
    get_raw_file: { minVersion: 8.0, requiredTier: "free" },
    get_file_blame: { minVersion: 8.0, requiredTier: "free" },
    get_repository_tree: { minVersion: 8.0, requiredTier: "free" },

    // Search - Available in Free Tier
    search_repositories: { minVersion: 8.0, requiredTier: "free" },

    // Namespaces - Available in Free Tier
    list_namespaces: { minVersion: 9.0, requiredTier: "free" },
    get_namespace: { minVersion: 9.0, requiredTier: "free" },

    // Wiki - Available in Free Tier
    upload_markdown: { minVersion: 8.0, requiredTier: "free" },

    // Merge Requests - Basic features in Free Tier
    list_merge_requests: { minVersion: 8.0, requiredTier: "free" },
    get_merge_request: { minVersion: 8.0, requiredTier: "free" },
    create_merge_request: { minVersion: 8.0, requiredTier: "free" },
    update_merge_request: { minVersion: 8.0, requiredTier: "free" },
    delete_merge_request: { minVersion: 8.0, requiredTier: "free" },
    merge_merge_request: { minVersion: 8.0, requiredTier: "free" },
    rebase_merge_request: { minVersion: 11.6, requiredTier: "free" },
    get_merge_request_diffs: { minVersion: 8.0, requiredTier: "free" },
    list_merge_request_diffs: { minVersion: 8.0, requiredTier: "free" },
    mr_discussions: { minVersion: 8.0, requiredTier: "free" },

    // Draft Notes - Available in Free Tier
    get_draft_note: { minVersion: 13.2, requiredTier: "free" },
    list_draft_notes: { minVersion: 13.2, requiredTier: "free" },
    create_draft_note: { minVersion: 13.2, requiredTier: "free" },
    update_draft_note: { minVersion: 13.2, requiredTier: "free" },
    delete_draft_note: { minVersion: 13.2, requiredTier: "free" },
    publish_draft_note: { minVersion: 13.2, requiredTier: "free" },
    bulk_publish_draft_notes: { minVersion: 13.2, requiredTier: "free" },

    // Additional MR tools
    cancel_merge_when_pipeline_succeeds: { minVersion: 9.0, requiredTier: "free" },
    list_merge_request_commits: { minVersion: 8.0, requiredTier: "free" },
    list_merge_request_notes: { minVersion: 8.0, requiredTier: "free" },
    create_merge_request_note: { minVersion: 8.0, requiredTier: "free" },
    update_merge_request_note: { minVersion: 8.0, requiredTier: "free" },
    delete_merge_request_note: { minVersion: 8.0, requiredTier: "free" },

    // Merge Request Approvals - Premium/Ultimate only
    get_merge_request_approvals: {
      minVersion: 10.6,
      requiredTier: "premium",
      notes: "MR approval rules",
    },
    approve_merge_request: { minVersion: 10.6, requiredTier: "premium", notes: "MR approvals" },
    unapprove_merge_request: { minVersion: 10.6, requiredTier: "premium", notes: "MR approvals" },
    get_approval_rules: { minVersion: 12.3, requiredTier: "premium", notes: "MR approval rules" },
    create_approval_rule: { minVersion: 12.3, requiredTier: "premium", notes: "MR approval rules" },
    update_approval_rule: { minVersion: 12.3, requiredTier: "premium", notes: "MR approval rules" },
    delete_approval_rule: { minVersion: 12.3, requiredTier: "premium", notes: "MR approval rules" },

    // Merge Trains - Premium only
    add_to_merge_train: { minVersion: 12.0, requiredTier: "premium", notes: "Merge trains" },
    remove_from_merge_train: { minVersion: 12.0, requiredTier: "premium", notes: "Merge trains" },
    get_merge_trains: { minVersion: 12.0, requiredTier: "premium", notes: "Merge trains" },

    // Labels - Available in Free Tier
    list_labels: { minVersion: 8.0, requiredTier: "free" },
    get_label: { minVersion: 8.0, requiredTier: "free" },
    create_label: { minVersion: 8.0, requiredTier: "free" },
    update_label: { minVersion: 8.0, requiredTier: "free" },
    delete_label: { minVersion: 8.0, requiredTier: "free" },
    promote_label: { minVersion: 12.4, requiredTier: "free" },

    // Milestones - Available in Free Tier
    list_milestones: { minVersion: 8.0, requiredTier: "free" },
    get_milestone: { minVersion: 8.0, requiredTier: "free" },
    create_milestone: { minVersion: 8.0, requiredTier: "free" },
    update_milestone: { minVersion: 8.0, requiredTier: "free" },
    delete_milestone: { minVersion: 8.0, requiredTier: "free" },
    promote_milestone: { minVersion: 11.9, requiredTier: "free" },

    // Wiki - Available in Free Tier
    list_wiki_pages: { minVersion: 9.0, requiredTier: "free" },
    get_wiki_page: { minVersion: 9.0, requiredTier: "free" },
    create_wiki_page: { minVersion: 9.0, requiredTier: "free" },
    update_wiki_page: { minVersion: 9.0, requiredTier: "free" },
    delete_wiki_page: { minVersion: 9.0, requiredTier: "free" },

    // Pipelines & CI/CD - Basic features in Free Tier
    list_pipelines: { minVersion: 9.0, requiredTier: "free" },
    get_pipeline: { minVersion: 9.0, requiredTier: "free" },
    create_pipeline: { minVersion: 9.0, requiredTier: "free" },
    run_pipeline: { minVersion: 9.0, requiredTier: "free" },
    retry_pipeline: { minVersion: 9.0, requiredTier: "free" },
    cancel_pipeline: { minVersion: 9.0, requiredTier: "free" },
    delete_pipeline: { minVersion: 11.6, requiredTier: "free" },

    // Pipeline Jobs - Available in Free Tier
    list_pipeline_jobs: { minVersion: 9.0, requiredTier: "free" },
    list_pipeline_trigger_jobs: { minVersion: 12.0, requiredTier: "free", notes: "Bridge jobs" },
    get_pipeline_job: { minVersion: 9.0, requiredTier: "free" },
    get_pipeline_job_output: { minVersion: 9.0, requiredTier: "free", notes: "Job trace/logs" },
    play_pipeline_job: { minVersion: 9.0, requiredTier: "free", notes: "Manual jobs" },
    retry_pipeline_job: { minVersion: 9.0, requiredTier: "free" },
    cancel_pipeline_job: { minVersion: 9.0, requiredTier: "free" },
    get_job: { minVersion: 9.0, requiredTier: "free" },
    get_job_trace: { minVersion: 9.0, requiredTier: "free" },
    get_job_artifacts: { minVersion: 9.0, requiredTier: "free" },
    download_job_artifacts: { minVersion: 9.0, requiredTier: "free" },
    retry_job: { minVersion: 9.0, requiredTier: "free" },
    cancel_job: { minVersion: 9.0, requiredTier: "free" },
    play_job: { minVersion: 9.0, requiredTier: "free" },
    erase_job: { minVersion: 9.0, requiredTier: "free" },

    // Advanced CI/CD features - Premium/Ultimate
    list_pipeline_schedules: { minVersion: 9.2, requiredTier: "free" },
    get_pipeline_schedule: { minVersion: 9.2, requiredTier: "free" },
    create_pipeline_schedule: { minVersion: 9.2, requiredTier: "free" },
    update_pipeline_schedule: { minVersion: 9.2, requiredTier: "free" },
    delete_pipeline_schedule: { minVersion: 9.2, requiredTier: "free" },
    play_pipeline_schedule: { minVersion: 12.8, requiredTier: "free" },
    pipeline_test_report: { minVersion: 11.5, requiredTier: "free" },
    pipeline_test_report_summary: { minVersion: 14.0, requiredTier: "free" },

    // Protected Environments - Premium only
    list_protected_environments: { minVersion: 12.8, requiredTier: "premium" },
    get_protected_environment: { minVersion: 12.8, requiredTier: "premium" },
    protect_environment: { minVersion: 12.8, requiredTier: "premium" },
    unprotect_environment: { minVersion: 12.8, requiredTier: "premium" },

    // Work Items (GraphQL) - Available in Free Tier (15.0+)
    list_work_items: { minVersion: 15.0, requiredTier: "free" },
    get_work_item: { minVersion: 15.0, requiredTier: "free" },
    get_work_item_types: { minVersion: 15.0, requiredTier: "free" },
    create_work_item: { minVersion: 15.0, requiredTier: "free" },
    update_work_item: { minVersion: 15.0, requiredTier: "free" },
    delete_work_item: { minVersion: 15.0, requiredTier: "free" },

    // Epics - Premium/Ultimate only
    list_epics: { minVersion: 10.2, requiredTier: "premium", notes: "Epic management" },
    get_epic: { minVersion: 10.2, requiredTier: "premium" },
    create_epic: { minVersion: 10.2, requiredTier: "premium" },
    update_epic: { minVersion: 10.2, requiredTier: "premium" },
    delete_epic: { minVersion: 10.2, requiredTier: "premium" },
    list_epic_issues: { minVersion: 10.2, requiredTier: "premium" },
    assign_epic_issue: { minVersion: 10.2, requiredTier: "premium" },
    remove_epic_issue: { minVersion: 10.2, requiredTier: "premium" },
    list_child_epics: { minVersion: 11.7, requiredTier: "ultimate", notes: "Multi-level epics" },
    create_child_epic: { minVersion: 11.7, requiredTier: "ultimate", notes: "Multi-level epics" },

    // Iterations/Sprints - Premium only
    list_iterations: { minVersion: 13.1, requiredTier: "premium", notes: "Sprint management" },
    get_iteration: { minVersion: 13.1, requiredTier: "premium" },
    create_iteration: { minVersion: 13.2, requiredTier: "premium" },
    update_iteration: { minVersion: 13.2, requiredTier: "premium" },
    delete_iteration: { minVersion: 14.0, requiredTier: "premium" },

    // Boards - Scoped labels in Premium
    list_boards: { minVersion: 8.13, requiredTier: "free" },
    get_board: { minVersion: 8.13, requiredTier: "free" },
    create_board: { minVersion: 10.4, requiredTier: "free" },
    update_board: { minVersion: 11.0, requiredTier: "free" },
    delete_board: { minVersion: 10.4, requiredTier: "free" },
    list_board_lists: { minVersion: 8.13, requiredTier: "free" },
    get_board_list: { minVersion: 8.13, requiredTier: "free" },
    create_board_list: { minVersion: 8.13, requiredTier: "free" },
    update_board_list: { minVersion: 11.0, requiredTier: "free" },
    delete_board_list: { minVersion: 8.13, requiredTier: "free" },

    // Security Features - Ultimate only
    security_dashboard: { minVersion: 11.1, requiredTier: "ultimate", notes: "Security scanning" },
    list_vulnerabilities: {
      minVersion: 12.5,
      requiredTier: "ultimate",
      notes: "Vulnerability management",
    },
    get_vulnerability: { minVersion: 12.5, requiredTier: "ultimate" },
    create_vulnerability: { minVersion: 13.0, requiredTier: "ultimate" },
    resolve_vulnerability: { minVersion: 12.5, requiredTier: "ultimate" },
    dismiss_vulnerability: { minVersion: 12.5, requiredTier: "ultimate" },
    revert_vulnerability_dismissal: { minVersion: 12.5, requiredTier: "ultimate" },
    list_vulnerability_findings: { minVersion: 12.5, requiredTier: "ultimate" },
    create_vulnerability_finding: { minVersion: 13.7, requiredTier: "ultimate" },

    // SAST/DAST - Ultimate only
    run_sast_scan: { minVersion: 10.3, requiredTier: "ultimate", notes: "Static security testing" },
    run_dast_scan: {
      minVersion: 10.4,
      requiredTier: "ultimate",
      notes: "Dynamic security testing",
    },
    run_dependency_scan: {
      minVersion: 10.7,
      requiredTier: "ultimate",
      notes: "Dependency scanning",
    },
    run_container_scan: { minVersion: 10.8, requiredTier: "ultimate", notes: "Container scanning" },
    run_secret_detection: { minVersion: 13.1, requiredTier: "ultimate", notes: "Secret detection" },

    // Compliance - Ultimate only
    compliance_framework: {
      minVersion: 13.0,
      requiredTier: "ultimate",
      notes: "Compliance management",
    },
    list_compliance_frameworks: { minVersion: 13.0, requiredTier: "ultimate" },
    get_compliance_framework: { minVersion: 13.0, requiredTier: "ultimate" },
    create_compliance_framework: { minVersion: 13.0, requiredTier: "ultimate" },
    update_compliance_framework: { minVersion: 13.0, requiredTier: "ultimate" },
    delete_compliance_framework: { minVersion: 13.0, requiredTier: "ultimate" },
    audit_events: { minVersion: 12.0, requiredTier: "ultimate", notes: "Audit logging" },
    list_audit_events: { minVersion: 12.0, requiredTier: "ultimate" },

    // Requirements Management - Ultimate only
    list_requirements: {
      minVersion: 13.1,
      requiredTier: "ultimate",
      notes: "Requirements tracking",
    },
    get_requirement: { minVersion: 13.1, requiredTier: "ultimate" },
    create_requirement: { minVersion: 13.1, requiredTier: "ultimate" },
    update_requirement: { minVersion: 13.1, requiredTier: "ultimate" },
    delete_requirement: { minVersion: 13.1, requiredTier: "ultimate" },

    // Test Case Management - Ultimate only
    list_test_cases: { minVersion: 13.6, requiredTier: "ultimate", notes: "Test cases" },
    get_test_case: { minVersion: 13.6, requiredTier: "ultimate" },
    create_test_case: { minVersion: 13.6, requiredTier: "ultimate" },
    update_test_case: { minVersion: 13.6, requiredTier: "ultimate" },
    delete_test_case: { minVersion: 13.6, requiredTier: "ultimate" },
    run_test_case: { minVersion: 13.6, requiredTier: "ultimate" },

    // Quality Management - Ultimate only
    quality_management: { minVersion: 13.0, requiredTier: "ultimate", notes: "Quality tracking" },
    list_test_reports: { minVersion: 13.0, requiredTier: "ultimate" },
    get_test_report: { minVersion: 13.0, requiredTier: "ultimate" },

    // Analytics - Limited in Premium, full in Ultimate
    value_stream_analytics: {
      minVersion: 12.3,
      requiredTier: "premium",
      notes: "Limited in Premium",
    },
    cycle_analytics: { minVersion: 12.3, requiredTier: "premium" },
    code_review_analytics: { minVersion: 12.7, requiredTier: "premium" },
    productivity_analytics: { minVersion: 12.3, requiredTier: "ultimate" },
    merge_request_analytics: { minVersion: 13.3, requiredTier: "premium" },
    repository_analytics: { minVersion: 13.0, requiredTier: "free" },
    insights: { minVersion: 12.0, requiredTier: "ultimate" },

    // Group-level features
    list_group_milestones: { minVersion: 9.0, requiredTier: "free" },
    list_group_members: { minVersion: 8.0, requiredTier: "free" },
    list_group_projects: { minVersion: 8.0, requiredTier: "free" },
    list_group_subgroups: { minVersion: 10.3, requiredTier: "free" },
    list_group_labels: { minVersion: 11.8, requiredTier: "free" },
    list_group_variables: { minVersion: 9.5, requiredTier: "free" },
    list_group_runners: { minVersion: 10.1, requiredTier: "free" },

    // Package Registry - Available in Free Tier with limitations
    list_packages: { minVersion: 11.8, requiredTier: "free" },
    get_package: { minVersion: 11.8, requiredTier: "free" },
    publish_package: { minVersion: 11.8, requiredTier: "free" },
    delete_package: { minVersion: 11.8, requiredTier: "free" },

    // Container Registry - Available in Free Tier
    list_registry_repositories: { minVersion: 8.8, requiredTier: "free" },
    get_registry_repository: { minVersion: 8.8, requiredTier: "free" },
    delete_registry_repository: { minVersion: 8.8, requiredTier: "free" },
    list_registry_tags: { minVersion: 8.8, requiredTier: "free" },
    get_registry_tag: { minVersion: 8.8, requiredTier: "free" },
    delete_registry_tag: { minVersion: 8.8, requiredTier: "free" },

    // Terraform State - Available in Free Tier (13.0+)
    list_terraform_states: { minVersion: 13.0, requiredTier: "free" },
    get_terraform_state: { minVersion: 13.0, requiredTier: "free" },
    lock_terraform_state: { minVersion: 13.0, requiredTier: "free" },
    unlock_terraform_state: { minVersion: 13.0, requiredTier: "free" },
    delete_terraform_state: { minVersion: 13.0, requiredTier: "free" },

    // Feature Flags - Premium only
    list_feature_flags: { minVersion: 12.5, requiredTier: "premium" },
    get_feature_flag: { minVersion: 12.5, requiredTier: "premium" },
    create_feature_flag: { minVersion: 12.5, requiredTier: "premium" },
    update_feature_flag: { minVersion: 12.5, requiredTier: "premium" },
    delete_feature_flag: { minVersion: 12.5, requiredTier: "premium" },

    // Additional Core tools
    get_users: { minVersion: 8.0, requiredTier: "free" },
    verify_namespace: { minVersion: 9.0, requiredTier: "free" },
    list_project_members: { minVersion: 8.0, requiredTier: "free" },
    list_group_iterations: {
      minVersion: 13.1,
      requiredTier: "premium",
      notes: "Iterations/Sprints",
    },
    download_attachment: { minVersion: 10.0, requiredTier: "free" },
    list_events: { minVersion: 9.0, requiredTier: "free" },
    get_project_events: { minVersion: 9.0, requiredTier: "free" },
    create_repository: { minVersion: 8.0, requiredTier: "free" },
    fork_repository: { minVersion: 8.0, requiredTier: "free" },

    // Additional MR tools
    create_note: { minVersion: 8.0, requiredTier: "free" },
    create_merge_request_thread: { minVersion: 11.0, requiredTier: "free" },

    // Additional Files tools
    push_files: { minVersion: 13.0, requiredTier: "free", notes: "Multi-file commit API" },

    // Additional Milestone tools
    get_milestone_issue: { minVersion: 9.0, requiredTier: "free" },
    get_milestone_merge_requests: { minVersion: 9.0, requiredTier: "free" },
    get_milestone_burndown_events: {
      minVersion: 12.0,
      requiredTier: "premium",
      notes: "Burndown charts",
    },
    edit_milestone: { minVersion: 8.0, requiredTier: "free" },

    // CI/CD Variables
    list_variables: { minVersion: 9.0, requiredTier: "free" },
    get_variable: { minVersion: 9.0, requiredTier: "free" },
    create_variable: { minVersion: 9.0, requiredTier: "free" },
    update_variable: { minVersion: 9.0, requiredTier: "free" },
    delete_variable: { minVersion: 9.0, requiredTier: "free" },

    // Webhooks - Project hooks in Free, Group hooks in Premium
    list_webhooks: { minVersion: 8.0, requiredTier: "free", notes: "Project webhooks" },
    manage_webhook: {
      minVersion: 8.0,
      requiredTier: "free",
      notes: "Project webhooks; group webhooks require Premium",
    },

    // Code Quality - Available in Free Tier
    get_code_quality_report: { minVersion: 11.4, requiredTier: "free" },

    // Operations/Monitoring
    list_environments: { minVersion: 8.11, requiredTier: "free" },
    get_environment: { minVersion: 8.11, requiredTier: "free" },
    create_environment: { minVersion: 8.11, requiredTier: "free" },
    update_environment: { minVersion: 8.11, requiredTier: "free" },
    delete_environment: { minVersion: 8.11, requiredTier: "free" },
    stop_environment: { minVersion: 8.11, requiredTier: "free" },

    // Deploy Tokens
    list_deploy_tokens: { minVersion: 12.9, requiredTier: "free" },
    get_deploy_token: { minVersion: 12.9, requiredTier: "free" },
    create_deploy_token: { minVersion: 12.9, requiredTier: "free" },
    delete_deploy_token: { minVersion: 12.9, requiredTier: "free" },
    revoke_deploy_token: { minVersion: 12.9, requiredTier: "free" },

    // Deployments
    list_deployments: { minVersion: 8.11, requiredTier: "free" },
    get_deployment: { minVersion: 8.11, requiredTier: "free" },
    create_deployment: { minVersion: 12.4, requiredTier: "free" },
    update_deployment: { minVersion: 12.4, requiredTier: "free" },

    // Releases
    list_releases: { minVersion: 11.7, requiredTier: "free" },
    get_release: { minVersion: 11.7, requiredTier: "free" },
    create_release: { minVersion: 11.7, requiredTier: "free" },
    update_release: { minVersion: 11.7, requiredTier: "free" },
    delete_release: { minVersion: 11.7, requiredTier: "free" },

    // Protected Tags/Branches
    list_protected_branches: { minVersion: 9.5, requiredTier: "free" },
    get_protected_branch: { minVersion: 9.5, requiredTier: "free" },
    protect_repository_branch: { minVersion: 9.5, requiredTier: "free" },
    unprotect_repository_branch: { minVersion: 9.5, requiredTier: "free" },
    list_protected_tags: { minVersion: 11.3, requiredTier: "free" },
    get_protected_tag: { minVersion: 11.3, requiredTier: "free" },
    protect_repository_tag: { minVersion: 11.3, requiredTier: "free" },
    unprotect_repository_tag: { minVersion: 11.3, requiredTier: "free" },
  };

  // ============================================================================
  // Consolidated Tools with Action-Level Requirements
  // ============================================================================

  private static actionRequirements: Record<string, ToolActionRequirements> = {
    // Core tools
    browse_projects: {
      default: { tier: "free", minVersion: 8.0 },
    },
    browse_namespaces: {
      default: { tier: "free", minVersion: 9.0 },
    },
    browse_commits: {
      default: { tier: "free", minVersion: 8.0 },
    },
    browse_events: {
      default: { tier: "free", minVersion: 9.0 },
    },
    create_branch: {
      default: { tier: "free", minVersion: 8.0 },
    },
    create_group: {
      default: { tier: "free", minVersion: 8.0 },
    },
    manage_repository: {
      default: { tier: "free", minVersion: 8.0 },
    },
    get_users: {
      default: { tier: "free", minVersion: 8.0 },
    },

    // Merge Requests
    browse_merge_requests: {
      default: { tier: "free", minVersion: 8.0 },
      actions: {
        approvals: { tier: "premium", minVersion: 10.6, notes: "MR approvals" },
      },
    },
    browse_mr_discussions: {
      default: { tier: "free", minVersion: 8.0 },
    },
    manage_merge_request: {
      default: { tier: "free", minVersion: 8.0 },
      actions: {
        create: { tier: "free", minVersion: 8.0 },
        update: { tier: "free", minVersion: 8.0 },
        merge: { tier: "free", minVersion: 8.0 },
        approve: { tier: "premium", minVersion: 10.6, notes: "MR approvals" },
        unapprove: { tier: "premium", minVersion: 10.6, notes: "MR approvals" },
        get_approval_state: { tier: "premium", minVersion: 13.8, notes: "MR approval state" },
      },
    },
    manage_mr_discussion: {
      default: { tier: "free", minVersion: 8.0 },
      actions: {
        comment: { tier: "free", minVersion: 8.0 },
        thread: { tier: "free", minVersion: 11.0 },
        reply: { tier: "free", minVersion: 11.0 },
        update: { tier: "free", minVersion: 8.0 },
        apply_suggestion: { tier: "free", minVersion: 13.0 },
        apply_suggestions: { tier: "free", minVersion: 13.0 },
        resolve: { tier: "free", minVersion: 10.0, notes: "Resolve discussion threads" },
        suggest: { tier: "free", minVersion: 10.5, notes: "Code suggestions" },
      },
    },
    manage_draft_notes: {
      default: { tier: "free", minVersion: 13.2 },
    },

    // Work Items
    browse_work_items: {
      default: { tier: "free", minVersion: 15.0 },
    },
    manage_work_item: {
      default: { tier: "free", minVersion: 15.0 },
    },

    // Labels
    browse_labels: {
      default: { tier: "free", minVersion: 8.0 },
    },
    manage_label: {
      default: { tier: "free", minVersion: 8.0 },
    },

    // Wiki
    browse_wiki: {
      default: { tier: "free", minVersion: 9.0 },
    },
    manage_wiki: {
      default: { tier: "free", minVersion: 9.0 },
    },

    // Pipelines
    browse_pipelines: {
      default: { tier: "free", minVersion: 9.0 },
    },
    manage_pipeline: {
      default: { tier: "free", minVersion: 9.0 },
    },
    manage_pipeline_job: {
      default: { tier: "free", minVersion: 9.0 },
    },

    // Variables
    browse_variables: {
      default: { tier: "free", minVersion: 9.0 },
    },
    manage_variable: {
      default: { tier: "free", minVersion: 9.0 },
    },

    // Milestones
    browse_milestones: {
      default: { tier: "free", minVersion: 8.0 },
      actions: {
        burndown: { tier: "premium", minVersion: 12.0, notes: "Burndown charts" },
      },
    },
    manage_milestone: {
      default: { tier: "free", minVersion: 8.0 },
    },

    // Files
    browse_files: {
      default: { tier: "free", minVersion: 8.0 },
    },
    manage_files: {
      default: { tier: "free", minVersion: 8.0 },
    },

    // Snippets
    browse_snippets: {
      default: { tier: "free", minVersion: 8.15 },
    },
    manage_snippet: {
      default: { tier: "free", minVersion: 8.15 },
    },

    // Webhooks
    list_webhooks: {
      default: { tier: "free", minVersion: 8.0, notes: "Project webhooks" },
    },
    manage_webhook: {
      default: { tier: "free", minVersion: 8.0, notes: "Project webhooks" },
      actions: {
        create_group: { tier: "premium", minVersion: 10.4, notes: "Group webhooks" },
        update_group: { tier: "premium", minVersion: 10.4, notes: "Group webhooks" },
        delete_group: { tier: "premium", minVersion: 10.4, notes: "Group webhooks" },
      },
    },

    // Integrations
    list_integrations: {
      default: { tier: "free", minVersion: 8.0 },
    },
    manage_integration: {
      default: { tier: "free", minVersion: 8.0 },
    },

    // Todos
    list_todos: {
      default: { tier: "free", minVersion: 8.0 },
    },
    manage_todos: {
      default: { tier: "free", minVersion: 8.0 },
    },

    // Additional tools
    list_project_members: {
      default: { tier: "free", minVersion: 8.0 },
    },
    list_group_iterations: {
      default: { tier: "premium", minVersion: 13.1, notes: "Iterations/Sprints" },
    },
    download_attachment: {
      default: { tier: "free", minVersion: 10.0 },
    },

    // Releases
    browse_releases: {
      default: { tier: "free", minVersion: 11.7 },
    },
    manage_release: {
      default: { tier: "free", minVersion: 11.7 },
    },

    // Refs (branches and tags)
    browse_refs: {
      default: { tier: "free", minVersion: 8.0 },
      actions: {
        list_branches: { tier: "free", minVersion: 8.0 },
        get_branch: { tier: "free", minVersion: 8.0 },
        list_tags: { tier: "free", minVersion: 8.0 },
        get_tag: { tier: "free", minVersion: 8.0 },
        list_protected_branches: { tier: "free", minVersion: 8.11 },
        get_protected_branch: { tier: "free", minVersion: 8.11 },
        list_protected_tags: { tier: "premium", minVersion: 11.3, notes: "Protected tags" },
      },
    },
    manage_ref: {
      default: { tier: "free", minVersion: 8.0 },
      actions: {
        create_branch: { tier: "free", minVersion: 8.0 },
        delete_branch: { tier: "free", minVersion: 8.0 },
        protect_branch: { tier: "free", minVersion: 8.11 },
        unprotect_branch: { tier: "free", minVersion: 8.11 },
        update_branch_protection: {
          tier: "free",
          minVersion: 11.9,
          notes: "PATCH endpoint; code owners require Premium",
        },
        create_tag: { tier: "free", minVersion: 8.0 },
        delete_tag: { tier: "free", minVersion: 8.0 },
        protect_tag: { tier: "premium", minVersion: 11.3, notes: "Protected tags" },
        unprotect_tag: { tier: "premium", minVersion: 11.3, notes: "Protected tags" },
      },
    },
  };

  /**
   * Get requirement for a tool, optionally with action
   */
  public static getActionRequirement(
    toolName: string,
    action?: string
  ): ActionRequirement | undefined {
    const toolReq = this.actionRequirements[toolName];
    if (!toolReq) return undefined;

    // If action specified, check action-specific requirement first
    if (action && toolReq.actions?.[action]) {
      return toolReq.actions[action];
    }

    return toolReq.default;
  }

  /**
   * Get the highest tier required by any action of a tool
   */
  public static getHighestTier(toolName: string): "free" | "premium" | "ultimate" {
    const toolReq = this.actionRequirements[toolName];
    if (!toolReq) {
      // Fallback to legacy requirements
      const legacy = this.toolRequirements[toolName];
      return legacy?.requiredTier ?? "free";
    }

    let highest = toolReq.default.tier;

    if (toolReq.actions) {
      for (const actionReq of Object.values(toolReq.actions)) {
        if (this.TIER_ORDER[actionReq.tier] > this.TIER_ORDER[highest]) {
          highest = actionReq.tier;
        }
      }
    }

    return highest;
  }

  /**
   * Get all actions that require a specific tier or higher
   */
  public static getTierRestrictedActions(toolName: string, tier: "premium" | "ultimate"): string[] {
    const toolReq = this.actionRequirements[toolName];
    if (!toolReq?.actions) return [];

    const minLevel = this.TIER_ORDER[tier];

    return Object.entries(toolReq.actions)
      .filter(([, req]) => this.TIER_ORDER[req.tier] >= minLevel)
      .map(([action]) => action);
  }

  public static isToolAvailable(toolName: string, action?: string): boolean {
    const connectionManager = ConnectionManager.getInstance();

    // Add null check as extra safety
    if (!connectionManager) {
      logger.debug(`Tool availability check for '${toolName}': ConnectionManager instance is null`);
      return false;
    }

    try {
      const instanceInfo = connectionManager.getInstanceInfo();

      // Check action requirements first (consolidated tools)
      const actionReq = this.getActionRequirement(toolName, action);
      if (actionReq) {
        const version = this.parseVersion(instanceInfo.version);
        if (version < actionReq.minVersion) {
          return false;
        }
        return this.isTierSufficient(instanceInfo.tier, actionReq.tier);
      }

      // Fallback to legacy requirements
      const requirement = this.toolRequirements[toolName];

      if (!requirement) {
        // Unknown tool, check if it exists in the codebase but not in our requirements
        logger.debug(`Tool '${toolName}' not found in requirements database`);
        // Default to allowing it if version is recent enough
        return this.parseVersion(instanceInfo.version) >= 15.0;
      }

      // Check version requirement
      const version = this.parseVersion(instanceInfo.version);
      if (version < requirement.minVersion) {
        return false;
      }

      // Check tier requirement
      return this.isTierSufficient(instanceInfo.tier, requirement.requiredTier);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // In OAuth mode, introspection is deferred until first authenticated request.
      // Allow all tools initially - they'll be properly filtered on actual use.
      if (errorMessage.includes("Connection not initialized")) {
        logger.debug(
          `Tool availability check for '${toolName}': instance info not available yet, allowing`
        );
        return true;
      }

      logger.warn(`Failed to check tool availability for '${toolName}': ${errorMessage}`);
      return false;
    }
  }

  public static getAvailableTools(): string[] {
    // Combine tools from both legacy toolRequirements and new actionRequirements
    const allTools = new Set([
      ...Object.keys(this.toolRequirements),
      ...Object.keys(this.actionRequirements),
    ]);
    return Array.from(allTools).filter(tool => this.isToolAvailable(tool));
  }

  public static getToolRequirement(toolName: string, action?: string): ToolRequirement | undefined {
    // Check action requirements first (consolidated tools)
    const actionReq = this.getActionRequirement(toolName, action);
    if (actionReq) {
      return {
        minVersion: actionReq.minVersion,
        requiredTier: actionReq.tier,
        notes: actionReq.notes,
      };
    }

    // Fallback to legacy requirements
    return this.toolRequirements[toolName];
  }

  public static getUnavailableReason(toolName: string): string | null {
    const connectionManager = ConnectionManager.getInstance();

    try {
      const instanceInfo = connectionManager.getInstanceInfo();
      const requirement = this.toolRequirements[toolName];

      if (!requirement) {
        return `Tool '${toolName}' is not recognized`;
      }

      const version = this.parseVersion(instanceInfo.version);
      if (version < requirement.minVersion) {
        return `Requires GitLab ${requirement.minVersion}+, current version is ${instanceInfo.version}`;
      }

      if (!this.isTierSufficient(instanceInfo.tier, requirement.requiredTier)) {
        return `Requires GitLab ${requirement.requiredTier} tier or higher, current tier is ${instanceInfo.tier}`;
      }

      return null; // Tool is available
    } catch {
      return "GitLab connection not initialized";
    }
  }

  private static parseVersion(version: string): number {
    if (version === "unknown") return 0;

    const match = version.match(/^(\d+)\.(\d+)/);
    if (!match) return 0;

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);

    return major + minor / 100; // Use /100 for more precise version comparison
  }

  private static isTierSufficient(
    actualTier: GitLabTier,
    requiredTier: "free" | "premium" | "ultimate"
  ): boolean {
    const tierHierarchy: Record<string, number> = {
      free: 0,
      premium: 1,
      ultimate: 2,
    };

    const actualLevel = tierHierarchy[actualTier] ?? 0;
    const requiredLevel = tierHierarchy[requiredTier] ?? 0;

    return actualLevel >= requiredLevel;
  }

  public static filterToolsByAvailability(tools: string[]): string[] {
    return tools.filter(tool => this.isToolAvailable(tool));
  }

  public static getToolsByTier(tier: "free" | "premium" | "ultimate"): string[] {
    return Object.entries(this.toolRequirements)
      .filter(([, requirement]) => requirement.requiredTier === tier)
      .map(([toolName]) => toolName);
  }

  public static getToolsByMinVersion(minVersion: number): string[] {
    return Object.entries(this.toolRequirements)
      .filter(([, requirement]) => requirement.minVersion >= minVersion)
      .map(([toolName]) => toolName);
  }
}
