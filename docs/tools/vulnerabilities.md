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

List vulnerabilities for a project with optional state, severity, and report type filters (GraphQL-backed, cursor pagination)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `state` | enum (`detected` \| `confirmed` \| `resolved` \| `dismissed`) |  | Filter by vulnerability state |
| `severity` | enum (`critical` \| `high` \| `medium` \| `low` \| `info` \| `unknown`) |  | Filter by severity level |
| `report_type` | enum (`sast` \| `dast` \| `dependency_scanning` \| `container_scanning` \| `secret_detection` \| `coverage_fuzzing` \| `api_fuzzing` \| `cluster_image_scanning` \| `generic`) |  | Filter by scan/report type (e.g. secret_detection, sast, dast) |
| `first` | number |  | Number of vulnerabilities to return (max: 100, default: 20) |
| `after` | string |  | Cursor for pagination; use the endCursor from a previous response |

### `get_vulnerability`

*📖 Read-only*

Get full details of a specific vulnerability

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The vulnerability ID (numeric or GraphQL global ID) |

### `dismiss_vulnerability`

*✏️ Writes*

Dismiss a vulnerability with a reason (acceptable_risk, false_positive, used_in_tests, mitigating_control, not_applicable) and optional comment

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The ID of the vulnerability to dismiss (numeric or GraphQL global ID) |
| `reason` | enum (`acceptable_risk` \| `false_positive` \| `used_in_tests` \| `mitigating_control` \| `not_applicable`) | ✓ | Reason for dismissal |
| `comment` | string |  | Optional comment explaining the dismissal |

### `confirm_vulnerability`

*✏️ Writes*

Confirm a vulnerability as a real finding requiring remediation

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The ID of the vulnerability to confirm (numeric or GraphQL global ID) |
| `comment` | string |  | Optional comment explaining the confirmation |
