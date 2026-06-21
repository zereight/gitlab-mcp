export interface MetricsSnapshot {
  requestsProcessed: number;
  rejectedByRateLimit: number;
  rejectedByCapacity: number;
  authFailures: number;
  totalSessions: number;
  expiredSessions: number;
  activeSessions: number;
  authenticatedSessions: number;
  gitlabClientPool: { size: number; maxSize: number };
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  statelessRequests: number;
  statelessAuthFromHeader: number;
  statelessAuthFromSealedSid: number;
  statelessAuthFailures: number;
  statelessSidRotated: number;
  config: {
    maxSessions: number;
    maxRequestsPerMinute: number;
    sessionTimeoutSeconds: number;
    remoteAuthEnabled: boolean;
    mcpOAuthEnabled: boolean;
    statelessModeEnabled: boolean;
    statelessRotationKey: boolean;
  };
}

export function escapePrometheusLabel(value: unknown): string {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

export function formatPrometheusMetrics(snapshot: MetricsSnapshot): string {
  const configLabels = Object.entries({
    max_sessions: snapshot.config.maxSessions,
    max_requests_per_minute: snapshot.config.maxRequestsPerMinute,
    session_timeout_seconds: snapshot.config.sessionTimeoutSeconds,
    remote_auth_enabled: snapshot.config.remoteAuthEnabled,
    mcp_oauth_enabled: snapshot.config.mcpOAuthEnabled,
    stateless_mode_enabled: snapshot.config.statelessModeEnabled,
    stateless_rotation_key: snapshot.config.statelessRotationKey,
  })
    .map(([key, value]) => `${key}="${escapePrometheusLabel(value)}"`)
    .join(",");

  return [
    "# HELP gitlab_mcp_requests_processed_total Total MCP requests processed",
    "# TYPE gitlab_mcp_requests_processed_total counter",
    `gitlab_mcp_requests_processed_total ${snapshot.requestsProcessed}`,
    "",
    "# HELP gitlab_mcp_requests_rejected_total Requests rejected, by reason",
    "# TYPE gitlab_mcp_requests_rejected_total counter",
    `gitlab_mcp_requests_rejected_total{reason="rate_limit"} ${snapshot.rejectedByRateLimit}`,
    `gitlab_mcp_requests_rejected_total{reason="capacity"} ${snapshot.rejectedByCapacity}`,
    "",
    "# HELP gitlab_mcp_auth_failures_total Authentication failures",
    "# TYPE gitlab_mcp_auth_failures_total counter",
    `gitlab_mcp_auth_failures_total ${snapshot.authFailures}`,
    "",
    "# HELP gitlab_mcp_sessions_total Total sessions created",
    "# TYPE gitlab_mcp_sessions_total counter",
    `gitlab_mcp_sessions_total ${snapshot.totalSessions}`,
    "",
    "# HELP gitlab_mcp_sessions_expired_total Sessions expired due to inactivity",
    "# TYPE gitlab_mcp_sessions_expired_total counter",
    `gitlab_mcp_sessions_expired_total ${snapshot.expiredSessions}`,
    "",
    "# HELP gitlab_mcp_active_sessions Currently active sessions",
    "# TYPE gitlab_mcp_active_sessions gauge",
    `gitlab_mcp_active_sessions ${snapshot.activeSessions}`,
    "",
    "# HELP gitlab_mcp_authenticated_sessions Currently authenticated sessions",
    "# TYPE gitlab_mcp_authenticated_sessions gauge",
    `gitlab_mcp_authenticated_sessions ${snapshot.authenticatedSessions}`,
    "",
    "# HELP gitlab_mcp_client_pool_size Current GitLab client pool size",
    "# TYPE gitlab_mcp_client_pool_size gauge",
    `gitlab_mcp_client_pool_size ${snapshot.gitlabClientPool.size}`,
    "",
    "# HELP gitlab_mcp_client_pool_max_size Maximum GitLab client pool size",
    "# TYPE gitlab_mcp_client_pool_max_size gauge",
    `gitlab_mcp_client_pool_max_size ${snapshot.gitlabClientPool.maxSize}`,
    "",
    "# HELP gitlab_mcp_uptime_seconds Process uptime in seconds",
    "# TYPE gitlab_mcp_uptime_seconds gauge",
    `gitlab_mcp_uptime_seconds ${snapshot.uptime}`,
    "",
    "# HELP gitlab_mcp_memory_usage_bytes Node.js memory usage by type",
    "# TYPE gitlab_mcp_memory_usage_bytes gauge",
    ...Object.entries(snapshot.memoryUsage).map(
      ([key, value]) => `gitlab_mcp_memory_usage_bytes{type="${escapePrometheusLabel(key)}"} ${value}`
    ),
    "",
    "# HELP gitlab_mcp_stateless_requests_total Stateless MCP requests processed",
    "# TYPE gitlab_mcp_stateless_requests_total counter",
    `gitlab_mcp_stateless_requests_total ${snapshot.statelessRequests}`,
    "",
    "# HELP gitlab_mcp_stateless_auth_total Stateless auth successes, by source",
    "# TYPE gitlab_mcp_stateless_auth_total counter",
    `gitlab_mcp_stateless_auth_total{source="header"} ${snapshot.statelessAuthFromHeader}`,
    `gitlab_mcp_stateless_auth_total{source="sealed_session_id"} ${snapshot.statelessAuthFromSealedSid}`,
    "",
    "# HELP gitlab_mcp_stateless_auth_failures_total Stateless auth failures",
    "# TYPE gitlab_mcp_stateless_auth_failures_total counter",
    `gitlab_mcp_stateless_auth_failures_total ${snapshot.statelessAuthFailures}`,
    "",
    "# HELP gitlab_mcp_stateless_session_id_rotations_total Stateless session id rotations",
    "# TYPE gitlab_mcp_stateless_session_id_rotations_total counter",
    `gitlab_mcp_stateless_session_id_rotations_total ${snapshot.statelessSidRotated}`,
    "",
    "# HELP gitlab_mcp_config_info Static configuration (value is always 1)",
    "# TYPE gitlab_mcp_config_info gauge",
    `gitlab_mcp_config_info{${configLabels}} 1`,
    "",
  ].join("\n");
}
