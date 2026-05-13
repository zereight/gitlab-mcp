# Dependency Proxy Toolset — Design Spec

**Date:** 2026-05-13  
**Status:** Approved  
**Approach:** A — Dedicated opt-in toolset following existing patterns

---

## Overview

Add five MCP tools that expose GitLab's group-level Dependency Proxy REST API. The dependency proxy caches Docker Hub images at the group level to reduce rate-limit exposure and improve CI pull times. All tools are group-scoped (not project-scoped), consistent with other group tools in the codebase.

No open PRs or issues exist for this feature.

---

## Tool Inventory

| Tool name | HTTP method | GitLab endpoint | Read-only | Destructive |
|---|---|---|---|---|
| `get_dependency_proxy_settings` | GET | `/groups/:id/dependency_proxy` | yes | no |
| `update_dependency_proxy_settings` | PATCH | `/groups/:id/dependency_proxy` | no | no |
| `list_dependency_proxy_blobs` | GET | `/groups/:id/dependency_proxy/blobs` | yes | no |
| `delete_dependency_proxy_blob` | DELETE | `/groups/:id/dependency_proxy/blobs/:sha` | no | yes |
| `purge_dependency_proxy_cache` | DELETE | `/groups/:id/dependency_proxy/cache` | no | yes |

Toolset ID: `dependency_proxy`, `isDefault: false` (opt-in via `GITLAB_TOOLSETS=dependency_proxy` or `discover_tools`).

---

## Schemas (`schemas.ts`)

### Response types

```ts
export const GitLabDependencyProxySchema = z.object({
  enabled: z.boolean(),
  blob_count: z.number(),
  total_size: z.number(),
  total_size_human_size: z.string().optional(),
  dependency_proxy_image_prefix: z.string().optional(),
  dependency_proxy_image_ttl_policy: z.object({
    enabled: z.boolean(),
    ttl: z.number(),
  }).optional(),
});
export type GitLabDependencyProxy = z.infer<typeof GitLabDependencyProxySchema>;

export const GitLabDependencyProxyBlobSchema = z.object({
  size: z.number(),
  file_name: z.string(),
  created_at: z.string(),
  blob_path: z.string().optional(),
});
export type GitLabDependencyProxyBlob = z.infer<typeof GitLabDependencyProxyBlobSchema>;
```

### Input schemas

```ts
export const GetDependencyProxySettingsSchema = z.object({
  group_id: z.string().describe("The ID or URL-encoded path of the group"),
});

export const UpdateDependencyProxySettingsSchema = z.object({
  group_id: z.string().describe("The ID or URL-encoded path of the group"),
  enabled: z.boolean().optional().describe("Enable or disable the dependency proxy"),
  identity: z.string().optional().describe("Proxy username (for authenticated pulls)"),
  secret: z.string().optional().describe("Proxy password / access token"),
  ttl: z.number().int().optional().describe("TTL in seconds for cached blobs (0 = indefinite)"),
});

export const ListDependencyProxyBlobsSchema = z.object({
  group_id: z.string().describe("The ID or URL-encoded path of the group"),
  page: z.number().int().optional().describe("Page number (default: 1)"),
  per_page: z.number().int().optional().describe("Items per page (default: 20, max: 100)"),
});

export const DeleteDependencyProxyBlobSchema = z.object({
  group_id: z.string().describe("The ID or URL-encoded path of the group"),
  sha: z.string().describe("SHA of the blob to delete"),
});

export const PurgeDependencyProxyCacheSchema = z.object({
  group_id: z.string().describe("The ID or URL-encoded path of the group"),
});
```

---

## API Functions (`index.ts`)

Five async functions following the `listReleases` / `deleteRelease` pattern:

### `getDependencyProxySettings(groupId: string): Promise<GitLabDependencyProxy>`
- `GET ${getEffectiveApiUrl()}/groups/${encodeURIComponent(groupId)}/dependency_proxy`
- Uses `getFetchConfig()`, `handleGitLabError()`, parses with `GitLabDependencyProxySchema`

### `updateDependencyProxySettings(groupId, options): Promise<GitLabDependencyProxy>`
- `PATCH` with `method: "PATCH"`, `Content-Type: application/json`, JSON body of non-undefined options fields
- Parses response with `GitLabDependencyProxySchema`

### `listDependencyProxyBlobs(groupId, options): Promise<GitLabDependencyProxyBlob[]>`
- `GET` with `page` / `per_page` appended as query params if provided
- Parses with `GitLabDependencyProxyBlobSchema.array()`

### `deleteDependencyProxyBlob(groupId, sha): Promise<void>`
- `DELETE ${...}/groups/${encodeURIComponent(groupId)}/dependency_proxy/blobs/${encodeURIComponent(sha)}`
- Returns `void`; handler emits `{ status: "success", message: "Blob deleted successfully" }`

### `purgeDependencyProxyCache(groupId): Promise<void>`
- `DELETE ${...}/groups/${encodeURIComponent(groupId)}/dependency_proxy/cache`
- Returns `void`; handler emits `{ status: "success", message: "Dependency proxy cache purged successfully" }`

Switch cases in the `call_tool` handler use the standard one-liner parse + call + return JSON pattern.

---

## Registry Changes (`tools/registry.ts`)

1. **Import** all five input schemas at the top
2. **Five entries** appended to `allTools` with clear descriptions
3. **`readOnlyTools`** set gains: `get_dependency_proxy_settings`, `list_dependency_proxy_blobs`
4. **`destructiveTools`** set gains: `delete_dependency_proxy_blob`, `purge_dependency_proxy_cache`
5. **`ToolsetId`** union type gains `"dependency_proxy"`
6. **New entry** at the bottom of `TOOLSET_DEFINITIONS`:
   ```ts
   {
     id: "dependency_proxy",
     isDefault: false,
     tools: new Set([
       "get_dependency_proxy_settings",
       "update_dependency_proxy_settings",
       "list_dependency_proxy_blobs",
       "delete_dependency_proxy_blob",
       "purge_dependency_proxy_cache",
     ]),
   }
   ```

---

## Error Handling

No special error handling beyond the existing `handleGitLabError()` utility, which covers 4xx/5xx responses. The dependency proxy API may return 403 if the feature is disabled at the instance level or the group is not on a paid tier — this surfaces naturally through the existing error handler.

---

## Testing

Follow the pattern of `test/test-tags.ts` or `test/test-deployment-tools.ts`:
- Schema validation tests using `test/schema-tests.ts` pattern
- Live integration tests gated behind the existing live-test flag
- No mocking of the GitLab client (consistent with the project's testing philosophy)

---

## Out of Scope

- Container registry tools (separate API under `/projects/:id/registry/repositories`)
- Group-level package registry tools
- Enabling/disabling the dependency proxy at the instance admin level
