import { SERVER_VERSION } from "../server/version.js";

export interface DoctorCredentials {
  readonly hasPersonalAccessToken: boolean;
  readonly hasJobToken: boolean;
  readonly hasCookie: boolean;
  readonly useOAuth: boolean;
}

export interface DoctorInput {
  readonly credentials: DoctorCredentials;
  readonly apiUrl: string;
  readonly permissionMode: string;
  readonly toolsetsRaw: string | undefined;
  readonly version: string;
  readonly probe?: (apiUrl: string) => Promise<DoctorProbeResult>;
}

export interface DoctorProbeResult {
  readonly ok: boolean;
  readonly status?: number;
  readonly detail: string;
}

export interface DoctorCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface DoctorReport {
  readonly checks: readonly DoctorCheck[];
  readonly ok: boolean;
  readonly text: string;
}

export function doctorHelpText(): string {
  return `zereight-mcp-gitlab doctor

Check token presence, API URL, permission mode, toolsets, and package version.
Does not print secret values.

Usage:
  zereight-mcp-gitlab doctor [--probe]
  zereight-mcp-gitlab doctor --help

Flags:
  --probe    GET {apiUrl}/user with the configured credentials (network)
`;
}

export function packageVersion(): string {
  return SERVER_VERSION;
}

export function runDoctor(input: DoctorInput): DoctorReport {
  const checks = [
    credentialCheck(input.credentials),
    apiUrlCheck(input.apiUrl),
    permissionModeCheck(input.permissionMode),
    toolsetCheck(input.toolsetsRaw),
    versionCheck(input.version),
  ];
  return formatDoctorReport(checks);
}

export async function runDoctorWithOptionalProbe(input: DoctorInput): Promise<DoctorReport> {
  const report = runDoctor(input);
  if (input.probe === undefined) {
    return report;
  }
  const probe = await input.probe(input.apiUrl);
  return formatDoctorReport([
    ...report.checks,
    { name: "gitlab_user", ok: probe.ok, detail: probe.detail },
  ]);
}

export function formatDoctorReport(checks: readonly DoctorCheck[]): DoctorReport {
  const ok = checks.every(check => check.ok);
  const lines = checks.map(check => `${check.ok ? "ok" : "fail"}  ${check.name}: ${check.detail}`);
  return {
    checks,
    ok,
    text: `${lines.join("\n")}\n`,
  };
}

function credentialCheck(credentials: DoctorCredentials): DoctorCheck {
  const hasAny =
    credentials.hasPersonalAccessToken ||
    credentials.hasJobToken ||
    credentials.hasCookie ||
    credentials.useOAuth;
  return {
    name: "credentials",
    ok: hasAny,
    detail: hasAny
      ? "a token, job token, cookie, or OAuth is configured (value hidden)"
      : "set GITLAB_PERSONAL_ACCESS_TOKEN or run `zereight-mcp-gitlab auth`",
  };
}

function apiUrlCheck(apiUrl: string): DoctorCheck {
  try {
    const parsed = new URL(apiUrl);
    const hasApi = parsed.pathname.includes("/api/");
    return {
      name: "api_url",
      ok: hasApi,
      detail: hasApi
        ? `${parsed.origin}${parsed.pathname}`
        : `${apiUrl} is missing /api/v4 (use the API URL, not the web root)`,
    };
  } catch {
    return {
      name: "api_url",
      ok: false,
      detail: `${apiUrl} is not a valid URL`,
    };
  }
}

function permissionModeCheck(mode: string): DoctorCheck {
  const ok = mode === "readonly" || mode === "modify" || mode === "full";
  return {
    name: "permission_mode",
    ok,
    detail: ok ? mode : `${mode} is not readonly, modify, or full`,
  };
}

function toolsetCheck(raw: string | undefined): DoctorCheck {
  const value = raw === undefined || raw.trim() === "" ? "core (default)" : raw.trim();
  return {
    name: "toolsets",
    ok: true,
    detail: value,
  };
}

function versionCheck(version: string): DoctorCheck {
  return {
    name: "version",
    ok: version !== "unknown",
    detail: version,
  };
}
