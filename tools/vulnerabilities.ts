/**
 * Vulnerabilities toolset: list, get, dismiss and confirm project vulnerabilities.
 *
 * These go through GitLab's GraphQL API. The REST Vulnerabilities API is deprecated and
 * silently ignores filter params on list and reason/comment on dismiss, while GraphQL
 * supports all of them.
 *
 * index.ts owns the GraphQL executor, the project path resolver and the
 * ProjectAccessDeniedError factory (the class stays in index.ts for its instanceof checks),
 * and hands them over once with configureVulnerabilityTools(). The allowlist guard reads
 * GITLAB_ALLOWED_PROJECT_IDS through server/gitlab-request-context.
 */
import { z } from "zod";
import {
  ConfirmVulnerabilitySchema,
  DismissVulnerabilitySchema,
  GetVulnerabilitySchema,
  ListProjectVulnerabilitiesSchema,
} from "../schemas.js";
import { getEffectiveAllowedProjectIds } from "../server/gitlab-request-context.js";
import { withRecoveryHint } from "../utils/error-hints.js";
import { ToolInputError } from "../utils/tool-input-error.js";

export interface VulnerabilityToolDeps {
  /** index.ts's GraphQL executor. */
  executeGraphQL: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
  /** index.ts's resolver from a project ID or path to the GraphQL fullPath (shared with merge request conflicts). */
  resolveProjectFullPath: (projectId: string) => Promise<string>;
  /** index.ts's ProjectAccessDeniedError factory. */
  createProjectAccessDeniedError: (message: string) => Error;
  /** index.ts's PROJECT_NOT_FOUND_HINT. */
  projectNotFoundHint: string;
}

let deps: VulnerabilityToolDeps | undefined;

export function configureVulnerabilityTools(next: VulnerabilityToolDeps): void {
  deps = next;
}

function requireDeps(): VulnerabilityToolDeps {
  if (!deps) {
    throw new Error("Vulnerability tools used before configureVulnerabilityTools()");
  }
  return deps;
}

function executeGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return requireDeps().executeGraphQL<T>(query, variables);
}

function resolveProjectFullPath(projectId: string): Promise<string> {
  return requireDeps().resolveProjectFullPath(projectId);
}

const VULNERABILITY_NOT_FOUND_HINT =
  "check vulnerability_id; list_project_vulnerabilities lists the vulnerabilities the token can read.";

/** Convert a numeric vulnerability ID (or an existing Vulnerability GID) to a GraphQL global ID. */
function toVulnerabilityGid(vulnerabilityId: string): string {
  if (/^\d+$/.test(vulnerabilityId)) {
    return `gid://gitlab/Vulnerability/${vulnerabilityId}`;
  }
  if (/^gid:\/\/gitlab\/Vulnerability\/\d+$/.test(vulnerabilityId)) {
    return vulnerabilityId;
  }
  throw new ToolInputError(
    withRecoveryHint(
      `Invalid vulnerability ID "${vulnerabilityId}": expected a numeric ID or a gid://gitlab/Vulnerability/<id> global ID`,
      "copy the id from list_project_vulnerabilities, for example 123 or gid://gitlab/Vulnerability/123."
    )
  );
}

/**
 * Enforce GITLAB_ALLOWED_PROJECT_IDS for vulnerability tools. Vulnerability
 * GIDs are globally unique rather than project-scoped, so the boundary must
 * be checked against the project the vulnerability actually belongs to —
 * mirroring what getEffectiveProjectId does for project-scoped REST calls.
 * Allowlist entries may be numeric IDs or full namespace paths.
 */
function assertVulnerabilityProjectAllowed(
  vulnerabilityId: string,
  project: { id?: string | null; fullPath?: string | null } | null | undefined
): void {
  const allowedProjectIds = getEffectiveAllowedProjectIds();
  if (allowedProjectIds.length === 0) {
    return;
  }
  const fullPath = project?.fullPath ?? undefined;
  const numericId = project?.id?.match(/^gid:\/\/gitlab\/Project\/(\d+)$/)?.[1];
  const allowed =
    (fullPath !== undefined && allowedProjectIds.includes(fullPath)) ||
    (numericId !== undefined && allowedProjectIds.includes(numericId));
  if (!allowed) {
    throw requireDeps().createProjectAccessDeniedError(
      `Access denied: Vulnerability ${vulnerabilityId} belongs to project ${
        fullPath ?? numericId ?? "unknown"
      }, which is not in the allowed project list: ${allowedProjectIds.join(", ")}`
    );
  }
}

/**
 * Pre-flight allowlist check for vulnerability mutations: resolves the
 * vulnerability's project and verifies it against GITLAB_ALLOWED_PROJECT_IDS
 * before any write is issued. No-op (no extra request) when the allowlist
 * is not configured.
 */
async function ensureVulnerabilityProjectAllowed(vulnerabilityId: string): Promise<void> {
  if (getEffectiveAllowedProjectIds().length === 0) {
    return;
  }
  const data = await executeGraphQL<{
    vulnerability: { project: { id: string; fullPath: string } | null } | null;
  }>(
    `query getVulnerabilityProject($id: VulnerabilityID!) {
      vulnerability(id: $id) {
        project {
          id
          fullPath
        }
      }
    }`,
    { id: toVulnerabilityGid(vulnerabilityId) }
  );
  if (!data.vulnerability) {
    throw new ToolInputError(
      withRecoveryHint(`Vulnerability not found: ${vulnerabilityId}`, VULNERABILITY_NOT_FOUND_HINT)
    );
  }
  assertVulnerabilityProjectAllowed(vulnerabilityId, data.vulnerability.project);
}

/** Shared GraphQL selection set for vulnerability objects. */
const VULNERABILITY_FIELDS = `
  id
  title
  description
  state
  severity
  reportType
  detectedAt
  confirmedAt
  resolvedAt
  dismissedAt
  dismissalReason
  webUrl
  scanner {
    name
    externalId
    vendor
  }
  identifiers {
    externalType
    externalId
    name
    url
  }
  links {
    name
    url
  }
  location {
    ... on VulnerabilityLocationSast {
      file
      startLine
      endLine
    }
    ... on VulnerabilityLocationSecretDetection {
      file
      startLine
      endLine
    }
    ... on VulnerabilityLocationDependencyScanning {
      file
      dependency {
        package {
          name
        }
        version
      }
    }
    ... on VulnerabilityLocationContainerScanning {
      image
      operatingSystem
      dependency {
        package {
          name
        }
        version
      }
    }
    ... on VulnerabilityLocationDast {
      path
      hostname
    }
  }
`;

async function listProjectVulnerabilities(
  projectId: string,
  options: Omit<z.infer<typeof ListProjectVulnerabilitiesSchema>, "project_id"> = {}
): Promise<unknown> {
  const fullPath = await resolveProjectFullPath(projectId);
  const variables: Record<string, unknown> = {
    fullPath,
    first: Math.min(options.first ?? 20, 100),
  };
  if (options.state) variables.state = [options.state.toUpperCase()];
  if (options.severity) variables.severity = [options.severity.toUpperCase()];
  if (options.report_type) variables.reportType = [options.report_type.toUpperCase()];
  if (options.after) variables.after = options.after;

  const data = await executeGraphQL<{
    project: {
      vulnerabilities: {
        nodes: unknown[];
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
      };
    } | null;
  }>(
    `query listProjectVulnerabilities(
      $fullPath: ID!
      $state: [VulnerabilityState!]
      $severity: [VulnerabilitySeverity!]
      $reportType: [VulnerabilityReportType!]
      $first: Int
      $after: String
    ) {
      project(fullPath: $fullPath) {
        vulnerabilities(
          state: $state
          severity: $severity
          reportType: $reportType
          first: $first
          after: $after
        ) {
          nodes {
            ${VULNERABILITY_FIELDS}
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }`,
    variables
  );

  if (!data.project) {
    throw new ToolInputError(
      withRecoveryHint(
        `Project not found or not accessible: ${fullPath}`,
        requireDeps().projectNotFoundHint
      )
    );
  }
  return {
    vulnerabilities: data.project.vulnerabilities.nodes,
    pageInfo: data.project.vulnerabilities.pageInfo,
  };
}

async function getVulnerability(vulnerabilityId: string): Promise<unknown> {
  const data = await executeGraphQL<{
    vulnerability:
      ({ project?: { id?: string; fullPath?: string } | null } & Record<string, unknown>) | null;
  }>(
    `query getVulnerability($id: VulnerabilityID!) {
      vulnerability(id: $id) {
        ${VULNERABILITY_FIELDS}
        project {
          id
          name
          fullPath
        }
      }
    }`,
    { id: toVulnerabilityGid(vulnerabilityId) }
  );
  if (!data.vulnerability) {
    throw new ToolInputError(
      withRecoveryHint(`Vulnerability not found: ${vulnerabilityId}`, VULNERABILITY_NOT_FOUND_HINT)
    );
  }
  assertVulnerabilityProjectAllowed(vulnerabilityId, data.vulnerability.project);
  return data.vulnerability;
}

async function dismissVulnerability(
  vulnerabilityId: string,
  reason: string,
  comment?: string
): Promise<unknown> {
  await ensureVulnerabilityProjectAllowed(vulnerabilityId);
  const input: Record<string, string> = {
    id: toVulnerabilityGid(vulnerabilityId),
    dismissalReason: reason.toUpperCase(),
  };
  if (comment) input.comment = comment;

  const data = await executeGraphQL<{
    vulnerabilityDismiss: {
      vulnerability: unknown | null;
      errors: string[];
    };
  }>(
    `mutation dismissVulnerability($input: VulnerabilityDismissInput!) {
      vulnerabilityDismiss(input: $input) {
        vulnerability {
          id
          state
          dismissedAt
          dismissalReason
        }
        errors
      }
    }`,
    { input }
  );

  if (data.vulnerabilityDismiss.errors?.length) {
    throw new Error(
      `Failed to dismiss vulnerability: ${data.vulnerabilityDismiss.errors.join(", ")}`
    );
  }
  if (!data.vulnerabilityDismiss.vulnerability) {
    throw new Error(`Vulnerability not returned after dismissal (id: ${vulnerabilityId})`);
  }
  return data.vulnerabilityDismiss.vulnerability;
}

async function confirmVulnerability(vulnerabilityId: string, comment?: string): Promise<unknown> {
  await ensureVulnerabilityProjectAllowed(vulnerabilityId);
  const input: Record<string, string> = { id: toVulnerabilityGid(vulnerabilityId) };
  if (comment) input.comment = comment;

  const data = await executeGraphQL<{
    vulnerabilityConfirm: {
      vulnerability: unknown | null;
      errors: string[];
    };
  }>(
    `mutation confirmVulnerability($input: VulnerabilityConfirmInput!) {
      vulnerabilityConfirm(input: $input) {
        vulnerability {
          id
          state
          confirmedAt
        }
        errors
      }
    }`,
    { input }
  );

  if (data.vulnerabilityConfirm.errors?.length) {
    throw new Error(
      `Failed to confirm vulnerability: ${data.vulnerabilityConfirm.errors.join(", ")}`
    );
  }
  if (!data.vulnerabilityConfirm.vulnerability) {
    throw new Error(`Vulnerability not returned after confirmation (id: ${vulnerabilityId})`);
  }
  return data.vulnerabilityConfirm.vulnerability;
}

export interface VulnerabilityToolCallParams {
  name: string;
  arguments: unknown;
}

export interface VulnerabilityToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export async function handleVulnerabilityToolCall(
  params: VulnerabilityToolCallParams
): Promise<VulnerabilityToolResult> {
  switch (params.name) {
    case "list_project_vulnerabilities": {
      const args = ListProjectVulnerabilitiesSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const result = await listProjectVulnerabilities(project_id, options);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "get_vulnerability": {
      const args = GetVulnerabilitySchema.parse(params.arguments);
      const result = await getVulnerability(args.vulnerability_id);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "dismiss_vulnerability": {
      const args = DismissVulnerabilitySchema.parse(params.arguments);
      const result = await dismissVulnerability(args.vulnerability_id, args.reason, args.comment);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "confirm_vulnerability": {
      const args = ConfirmVulnerabilitySchema.parse(params.arguments);
      const result = await confirmVulnerability(args.vulnerability_id, args.comment);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
