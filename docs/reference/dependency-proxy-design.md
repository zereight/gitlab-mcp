# Dependency Proxy Toolset — Design Spec

**Date:** 2026-05-13  
**Status:** Implemented  
**Approach:** A — Dedicated opt-in toolset following existing patterns

---

## Overview

Add four MCP tools that expose GitLab's group-level Dependency Proxy API. The dependency proxy caches Docker Hub images at the group level to reduce rate-limit exposure and improve CI pull times. All tools are group-scoped, consistent with other group tools in the codebase.

Three tools (get settings, update settings, list blobs) use the GitLab GraphQL API. One tool (purge cache) uses the REST API, which is the only documented REST endpoint for the dependency proxy (`DELETE /groups/:id/dependency_proxy/cache`).

---

## Tool Inventory

| Tool name | API | GitLab endpoint | Read-only | Destructive |
|---|---|---|---|---|
| `get_dependency_proxy_settings` | GraphQL | `group { dependencyProxySetting ... }` | yes | no |
| `update_dependency_proxy_settings` | GraphQL | `mutation updateDependencyProxySettings` | no | no |
| `list_dependency_proxy_blobs` | GraphQL | `group { dependencyProxyBlobs ... }` | yes | no |
| `purge_dependency_proxy_cache` | REST | `DELETE /groups/:id/dependency_proxy/cache` | no | yes |

Toolset ID: `dependency_proxy`, `isDefault: false` (opt-in via `GITLAB_TOOLSETS=dependency_proxy` or `discover_tools`).

---

## Schemas (`schemas.ts`)

### Response types

```ts
export const GitLabDependencyProxySchema = z.object({
  enabled: z.boolean(),
  blob_count: z.number().nullable().optional(),
  total_size: z.string().nullable().optional(), // human-readable string from GraphQL
  image_prefix: z.string().nullable().optional(),
  ttl_policy: z.object({
    enabled: z.boolean(),
    ttl: z.number().nullable().optional(),
  }).nullable().optional(),
});

export const GitLabDependencyProxyBlobSchema = z.object({
  file_name: z.string(),
  size: z.string(), // human-readable string (e.g. "5 MiB")
  created_at: z.string().nullable().optional(),
});
```

### Input schemas

```ts
export const GetDependencyProxySettingsSchema = z.object({
  group_id: z.coerce.string().describe("Group ID or URL-encoded path"),
});

export const UpdateDependencyProxySettingsSchema = z.object({
  group_id: z.coerce.string().describe("Group ID or URL-encoded path"),
  enabled: z.boolean().optional(),
  identity: z.string().optional(),
  secret: z.string().optional(),
});

export const ListDependencyProxyBlobsSchema = z.object({
  group_id: z.coerce.string().describe("Group ID or URL-encoded path"),
  first: z.number().int().optional(),
  after: z.string().optional(), // cursor-based pagination
});

export const PurgeDependencyProxyCacheSchema = z.object({
  group_id: z.coerce.string().describe("Group ID or URL-encoded path"),
});
```

---

## API Functions (`index.ts`)

- `getDependencyProxySettings(groupPath)` — GraphQL query, returns `GitLabDependencyProxy`
- `updateDependencyProxySettings(groupPath, options)` — GraphQL mutation, checks payload errors, re-fetches settings
- `listDependencyProxyBlobs(groupPath, options)` — GraphQL query, returns `{ blobs, pageInfo }`
- `purgeDependencyProxyCache(groupId)` — REST DELETE, returns void; handler emits `{ status: "success", message: "...scheduled" }`

---

## Registry Changes (`tools/registry.ts`)

- 4 tool entries in `allTools`
- `readOnlyTools`: `get_dependency_proxy_settings`, `list_dependency_proxy_blobs`
- `destructiveTools`: `purge_dependency_proxy_cache`
- `ToolsetId` union gains `"dependency_proxy"`
- New toolset definition, `isDefault: false`

---

## Error Handling

- GraphQL errors surfaced via `executeGraphQL` throwing on top-level errors array
- `updateDependencyProxySettings` additionally checks the mutation payload `errors` field
- Guard throws if no update fields provided (enabled/identity/secret all undefined)
- REST purge uses `handleGitLabError` for HTTP errors

---

## Testing

- `test/test-dependency-proxy.ts`: integration tests covering all 4 tools, toolset activation, and read-only mode
- `test/schema-tests.ts`: Zod parse tests for `GitLabDependencyProxySchema` and `GitLabDependencyProxyBlobSchema`
- `test/test-toolset-filtering.ts`: `dependency_proxy: 4` in counts
