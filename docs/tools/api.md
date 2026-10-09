# Raw API

Explicit opt-in escape hatch for one GitLab REST call under /api/v4. Not part of core, not enabled by GITLAB_TOOLSETS=all, and not activatable with discover_tools.

!!! danger "Raw API escape hatch"
    `gitlab_api_request` bypasses `GITLAB_ALLOWED_GROUPS` and other group restrictions, project allowlists, tool-level restrictions (`GITLAB_TOOLS`, `GITLAB_DENIED_TOOLS_REGEX` on other tools), and individual tool safety checks. The full token permission scope is exposed. Prompt injection in GitLab content can drive this tool. Operators who rely on these restrictions must NOT enable it.
    
    `GITLAB_ALLOWED_PROJECT_IDS` and a session project scope are checked only for `/projects/:id` and `/projects/:id/...`. Endpoints such as `/search`, `/users`, `/groups/:id`, `/runners`, and the `/projects` collection are not constrained. `GITLAB_PROJECT_ID` and OAuth group allowlists are not enforced.

!!! note "Feature toggle"
    Explicit opt-in only. Enable by listing `api` in `GITLAB_TOOLSETS` (for example `GITLAB_TOOLSETS=api` or `GITLAB_TOOLSETS=core,api`). `GITLAB_TOOLSETS=all`, `discover_tools`, `GITLAB_TOOLS`, legacy `USE_*` flags, and `GITLAB_TOOL_PROFILE` do not enable it.

## Tools in this group

- [`gitlab_api_request`](#gitlab_api_request) — 📖✏️ Reads and writes

---

### `gitlab_api_request`

*📖✏️ Reads and writes*

DANGER: bypasses group and project restrictions, tool allowlists (GITLAB_TOOLS and GITLAB_DENIED_TOOLS_REGEX on other tools), and individual tool safety checks. The full token scope is exposed. Send one GitLab REST call under /api/v4. Readonly mode allows GET only, and modify mode rejects DELETE. Enable it only by listing api in GITLAB_TOOLSETS; all, discover_tools, and GITLAB_TOOLS do not. Prompt injection can drive this tool, so operators who rely on group, project, or tool restrictions must not enable it. GITLAB_ALLOWED_PROJECT_IDS is enforced only for /projects/:id paths; other endpoints are not constrained.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `method` | enum (`GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE`) |  | HTTP method. Defaults to GET. Non-GET requires a permission mode that allows writes. DELETE is rejected in modify mode. |
| `path` | string | ✓ | Path relative to /api/v4, such as projects/1 or /projects/1/issues. Absolute URLs are rejected. |
| `query` | object |  | Query string parameters. Arrays are repeated as separate keys. |
| `body` | any |  | JSON request body for POST, PUT, PATCH, and DELETE. Rejected on GET. |
