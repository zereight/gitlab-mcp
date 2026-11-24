/**
 * Dependency proxy toolset: the group's dependency proxy settings, the cached blob list,
 * and the cache purge, plus the helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch, GitLab
 * error handling, the GraphQL helper, the project-scoped deployment guard) and hands it
 * over once with configureDependencyProxyTools(). The fetch is read at call time, since
 * index.ts replaces it when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  GetDependencyProxySettingsSchema,
  GitLabDependencyProxyBlobSchema,
  GitLabDependencyProxySchema,
  ListDependencyProxyBlobsSchema,
  PurgeDependencyProxyCacheSchema,
  UpdateDependencyProxySettingsSchema,
  type GitLabDependencyProxy,
  type GitLabDependencyProxyBlob,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { withRecoveryHint } from "../utils/error-hints.js";
import { ToolInputError } from "../utils/tool-input-error.js";
import { encodeGitLabPathSegment } from "../utils/url.js";

export interface DependencyProxyToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  rejectIfProjectScopedDeployment: (toolName: string) => void;
  /** index.ts's GraphQL helper: auth headers and GraphQL error mapping. */
  executeGraphQL: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
  /** Next-step hint for a missing group; the same text index.ts uses for other group lookups. */
  groupNotFoundHint: string;
}

let deps: DependencyProxyToolDeps | undefined;

export function configureDependencyProxyTools(next: DependencyProxyToolDeps): void {
  deps = next;
}

function requireDeps(): DependencyProxyToolDeps {
  if (!deps) {
    throw new Error("Dependency proxy tools used before configureDependencyProxyTools()");
  }
  return deps;
}

const fetch: FetchFn = (input, init) => requireDeps().getFetch()(input, init);

function handleGitLabError(response: UndiciResponse): Promise<void> {
  return requireDeps().handleGitLabError(response);
}

function executeGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return requireDeps().executeGraphQL<T>(query, variables);
}

function rejectIfProjectScopedDeployment(toolName: string): void {
  requireDeps().rejectIfProjectScopedDeployment(toolName);
}

function groupNotFoundHint(): string {
  return requireDeps().groupNotFoundHint;
}

async function resolveGroupFullPath(groupId: string): Promise<string> {
  const decoded = decodeURIComponent(groupId);
  if (/^\d+$/.test(decoded)) {
    const response = await fetch(`${getEffectiveApiUrl()}/groups/${decoded}`, getFetchConfig());
    await handleGitLabError(response);
    const data = z.object({ full_path: z.string() }).parse(await response.json());
    return data.full_path;
  }
  return decoded;
}

async function getDependencyProxySettings(groupPath: string): Promise<GitLabDependencyProxy> {
  const fullPath = await resolveGroupFullPath(groupPath);
  const data = await executeGraphQL<{
    group: {
      dependencyProxySetting: { enabled: boolean } | null;
      dependencyProxyBlobCount: number | null;
      dependencyProxyTotalSize: string | null;
      dependencyProxyImagePrefix: string | null;
      dependencyProxyImageTtlPolicy: { enabled: boolean; ttl: number | null } | null;
    } | null;
  }>(
    `query($fullPath: ID!) {
      group(fullPath: $fullPath) {
        dependencyProxySetting { enabled }
        dependencyProxyBlobCount
        dependencyProxyTotalSize
        dependencyProxyImagePrefix
        dependencyProxyImageTtlPolicy { enabled ttl }
      }
    }`,
    { fullPath }
  );
  const g = data.group;
  if (!g) {
    throw new ToolInputError(withRecoveryHint(`Group not found: ${fullPath}`, groupNotFoundHint()));
  }
  return GitLabDependencyProxySchema.parse({
    enabled: g.dependencyProxySetting?.enabled ?? false,
    blob_count: g.dependencyProxyBlobCount,
    total_size: g.dependencyProxyTotalSize,
    image_prefix: g.dependencyProxyImagePrefix,
    ttl_policy: g.dependencyProxyImageTtlPolicy,
  });
}

async function updateDependencyProxySettings(
  groupPath: string,
  options: Omit<z.infer<typeof UpdateDependencyProxySettingsSchema>, "group_id">
): Promise<GitLabDependencyProxy> {
  if (
    options.enabled === undefined &&
    options.identity === undefined &&
    options.secret === undefined
  ) {
    throw new ToolInputError(
      withRecoveryHint(
        "At least one of enabled, identity, or secret must be provided",
        "pass enabled (true or false), identity, or secret; get_dependency_proxy_settings shows the current settings."
      )
    );
  }
  const fullPath = await resolveGroupFullPath(groupPath);
  const input: Record<string, unknown> = { groupPath: fullPath };
  if (options.enabled !== undefined) input["enabled"] = options.enabled;
  if (options.identity !== undefined) input["identity"] = options.identity;
  if (options.secret !== undefined) input["secret"] = options.secret;
  const mutationResult = await executeGraphQL<{
    updateDependencyProxySettings: { errors: string[] };
  }>(
    `mutation($input: UpdateDependencyProxySettingsInput!) {
      updateDependencyProxySettings(input: $input) { errors }
    }`,
    { input }
  );
  const errors = mutationResult.updateDependencyProxySettings?.errors;
  if (errors && errors.length > 0) {
    throw new Error(`Failed to update dependency proxy settings: ${errors.join(", ")}`);
  }
  return getDependencyProxySettings(fullPath);
}

async function listDependencyProxyBlobs(
  groupPath: string,
  options: Omit<z.infer<typeof ListDependencyProxyBlobsSchema>, "group_id"> = {}
): Promise<{
  blobs: GitLabDependencyProxyBlob[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const fullPath = await resolveGroupFullPath(groupPath);
  const data = await executeGraphQL<{
    group: {
      dependencyProxyBlobs: {
        nodes: { fileName: string; size: string; createdAt: string | null }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      } | null;
    } | null;
  }>(
    `query($fullPath: ID!, $first: Int, $after: String) {
      group(fullPath: $fullPath) {
        dependencyProxyBlobs(first: $first, after: $after) {
          nodes { fileName size createdAt }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
    { fullPath, first: options.first ?? 20, after: options.after }
  );
  const conn = data.group?.dependencyProxyBlobs;
  if (!conn) {
    throw new ToolInputError(
      withRecoveryHint(
        `Group not found or dependency proxy not enabled: ${fullPath}`,
        "check group_id, then run get_dependency_proxy_settings to see whether the dependency proxy is enabled."
      )
    );
  }
  return {
    blobs: conn.nodes.map(n =>
      GitLabDependencyProxyBlobSchema.parse({
        file_name: n.fileName,
        size: n.size,
        created_at: n.createdAt,
      })
    ),
    pageInfo: conn.pageInfo,
  };
}

async function purgeDependencyProxyCache(groupId: string): Promise<void> {
  const encoded = encodeGitLabPathSegment(groupId);
  const url = new URL(`${getEffectiveApiUrl()}/groups/${encoded}/dependency_proxy/cache`);
  const response = await fetch(url.toString(), { ...getFetchConfig(), method: "DELETE" });
  await handleGitLabError(response);
}

export interface DependencyProxyToolCallParams {
  name: string;
  arguments: unknown;
}

export interface DependencyProxyToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export async function handleDependencyProxyToolCall(
  params: DependencyProxyToolCallParams
): Promise<DependencyProxyToolResult> {
  switch (params.name) {
    case "get_dependency_proxy_settings": {
      rejectIfProjectScopedDeployment("get_dependency_proxy_settings");
      const args = GetDependencyProxySettingsSchema.parse(params.arguments);
      const settings = await getDependencyProxySettings(args.group_id);
      return {
        content: [{ type: "text", text: JSON.stringify(settings) }],
      };
    }

    case "update_dependency_proxy_settings": {
      rejectIfProjectScopedDeployment("update_dependency_proxy_settings");
      const args = UpdateDependencyProxySettingsSchema.parse(params.arguments);
      const { group_id, ...options } = args;
      const settings = await updateDependencyProxySettings(group_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(settings) }],
      };
    }

    case "list_dependency_proxy_blobs": {
      rejectIfProjectScopedDeployment("list_dependency_proxy_blobs");
      const args = ListDependencyProxyBlobsSchema.parse(params.arguments);
      const { group_id, ...options } = args;
      const result = await listDependencyProxyBlobs(group_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }

    case "purge_dependency_proxy_cache": {
      rejectIfProjectScopedDeployment("purge_dependency_proxy_cache");
      const args = PurgeDependencyProxyCacheSchema.parse(params.arguments);
      await purgeDependencyProxyCache(args.group_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "Dependency proxy cache purge scheduled",
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
