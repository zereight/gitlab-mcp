import { describe, test } from "node:test";
import assert from "node:assert";
import { escapePrometheusLabel, formatPrometheusMetrics } from "../../server/metrics.js";

describe("Prometheus metrics formatting", () => {
  test("escapes label values", () => {
    assert.strictEqual(escapePrometheusLabel('a"b\\c\nd'), 'a\\"b\\\\c\\nd');
  });

  test("formats current MCP metrics", () => {
    const body = formatPrometheusMetrics({
      requestsProcessed: 2,
      rejectedByRateLimit: 1,
      rejectedByCapacity: 0,
      authFailures: 3,
      totalSessions: 4,
      expiredSessions: 5,
      activeSessions: 6,
      authenticatedSessions: 7,
      gitlabClientPool: { size: 8, maxSize: 100 },
      uptime: 9,
      memoryUsage: {
        rss: 10,
        heapTotal: 11,
        heapUsed: 12,
        external: 13,
        arrayBuffers: 14,
      },
      statelessRequests: 15,
      statelessAuthFromHeader: 16,
      statelessAuthFromSealedSid: 17,
      statelessAuthFailures: 18,
      statelessSidRotated: 19,
      config: {
        maxSessions: 1000,
        maxRequestsPerMinute: 60,
        sessionTimeoutSeconds: 3600,
        remoteAuthEnabled: true,
        mcpOAuthEnabled: false,
        statelessModeEnabled: false,
        statelessRotationKey: false,
      },
    });

    assert.match(body, /# HELP gitlab_mcp_requests_processed_total/);
    assert.match(body, /gitlab_mcp_requests_processed_total 2/);
    assert.match(body, /gitlab_mcp_requests_rejected_total\{reason="rate_limit"\} 1/);
    assert.match(body, /gitlab_mcp_config_info\{[^}]*remote_auth_enabled="true"/);
  });
});
