# Vulnerabilities

AI-assisted vulnerability triage — list findings, inspect details, dismiss with reason, or confirm for remediation.

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

List vulnerabilities for a project with optional state, severity, and scanner filters

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `state` | enum (`detected` \| `confirmed` \| `resolved` \| `dismissed`) |  | Filter by vulnerability state |
| `severity` | enum (`critical` \| `high` \| `medium` \| `low` \| `info` \| `unknown`) |  | Filter by severity level |
| `scanner` | string |  | Filter by scanner type (e.g. SECRET_DETECTION, SAST, DAST) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_vulnerability`

*📖 Read-only*

Get full details of a specific vulnerability

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The ID of the vulnerability |

### `dismiss_vulnerability`

*✏️ Writes*

Dismiss a vulnerability with a reason (acceptable_risk, false_positive, used_in_tests, no_longer_relevant)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The ID of the vulnerability to dismiss |
| `reason` | enum (`acceptable_risk` \| `false_positive` \| `used_in_tests` \| `no_longer_relevant`) | ✓ | Reason for dismissal |
| `comment` | string |  | Optional comment explaining the dismissal |

### `confirm_vulnerability`

*✏️ Writes*

Confirm a vulnerability as a real finding requiring remediation

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `vulnerability_id` | string | ✓ | The ID of the vulnerability to confirm |
| `comment` | string |  | Optional comment explaining the confirmation |
