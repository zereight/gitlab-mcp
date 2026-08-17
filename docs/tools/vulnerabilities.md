# Vulnerabilities

AI-assisted vulnerability triage — list findings, inspect details, dismiss with reason, or confirm for remediation. Backed by the GitLab GraphQL API; requires GitLab Ultimate.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=vulnerabilities` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`list_project_vulnerabilities`](#list_project_vulnerabilities) — 📖 Read-only
- [`get_vulnerability`](#get_vulnerability) — 📖 Read-only
- [`dismiss_vulnerability`](#dismiss_vulnerability) — ✏️ Writes
- [`confirm_vulnerability`](#confirm_vulnerability) — ✏️ Writes

---

### `list_project_vulnerabilities`

*📖 Read-only*

List vulnerabilities for a project with optional state, severity, and report type filters (GraphQL-backed, cursor pagination). Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `state` | enum (`detected` \| `confirmed` \| `resolved` \| `dismissed`) |  | Filter by vulnerability state |
| `severity` | enum (`critical` \| `high` \| `medium` \| `low` \| `info` \| `unknown`) |  | Filter by severity level |
| `report_type` | enum (`sast` \| `dast` \| `dependency_scanning` \| `container_scanning` \| `secret_detection` \| `coverage_fuzzing` \| `api_fuzzing` \| `cluster_image_scanning` \| `generic`) |  | Filter by scan/report type (e.g. secret_detection, sast, dast) |
| `first` | integer |  | Number of vulnerabilities to return (max: 100, default: 20) |
| `after` | string |  | Cursor for pagination; use the endCursor from a previous response |

### `get_vulnerability`

*📖 Read-only*

Get full details of a specific vulnerability. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The vulnerability ID (numeric or GraphQL global ID) |

### `dismiss_vulnerability`

*✏️ Writes*

Dismiss a vulnerability with a reason (acceptable_risk, false_positive, used_in_tests, mitigating_control, not_applicable) and optional comment. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The ID of the vulnerability to dismiss (numeric or GraphQL global ID) |
| `reason` | enum (`acceptable_risk` \| `false_positive` \| `used_in_tests` \| `mitigating_control` \| `not_applicable`) | ✓ | Reason for dismissal |
| `comment` | string |  | Optional comment explaining the dismissal |

### `confirm_vulnerability`

*✏️ Writes*

Confirm a vulnerability as a real finding requiring remediation. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The ID of the vulnerability to confirm (numeric or GraphQL global ID) |
| `comment` | string |  | Optional comment explaining the confirmation |
