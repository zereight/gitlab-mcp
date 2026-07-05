import type { Agent } from "node:http";
import type { Express, Request, Response } from "express";
import type nodeFetch from "node-fetch";
import { decryptDownloadToken } from "../utils/download-token.js";

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 120_000;

export interface DownloadProxyDependencies {
  defaultApiUrl: string;
  enableDynamicApiUrl: boolean;
  maxRequestsPerMinute: number;
  resolveTrustedGitLabApiUrl: (url: string) => string;
  encodeGitLabPathSegment: (value: unknown) => string;
  encodeGitLabPath: (value: string) => string;
  getEffectiveProjectId: (projectId: string) => string;
  getAgentFunctionForUrl: (apiUrl: string) => (parsedURL: URL) => Agent;
  fetch: typeof nodeFetch;
  logger: { error: (obj: unknown, message?: string) => void };
  downloadTimeoutMs?: number;
}

function canonicalizeQueryParams(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const normalized: Record<string, string> = {};
  for (const key of sortedKeys) {
    normalized[key] = params[key];
  }
  return JSON.stringify(normalized);
}

/**
 * Register the /downloads/:type proxy endpoint on an Express app.
 * Streams GitLab API responses directly to the client. Auth is read from
 * an encrypted `_token` query param (self-contained URL) or from request headers.
 */
export function registerDownloadProxy(app: Express, deps: DownloadProxyDependencies): void {
  const downloadRateLimits: Record<string, { count: number; resetAt: number }> = {};
  let lastEviction = Date.now();
  const downloadTimeoutMs = deps.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;

  const checkDownloadRateLimit = (token: string): boolean => {
    const now = Date.now();

    // Evict expired entries every 60s to prevent unbounded growth
    if (now - lastEviction > 60000) {
      for (const key of Object.keys(downloadRateLimits)) {
        if (now > downloadRateLimits[key].resetAt) delete downloadRateLimits[key];
      }
      lastEviction = now;
    }

    const entry = downloadRateLimits[token];
    if (!entry || now > entry.resetAt) {
      downloadRateLimits[token] = { count: 1, resetAt: now + 60000 };
      return true;
    }
    if (entry.count >= deps.maxRequestsPerMinute) return false;
    entry.count++;
    return true;
  };

  app.get("/downloads/:type", async (req: Request, res: Response) => {
    const headers: Record<string, string> = { Accept: "application/octet-stream" };
    let rateLimitKey: string;

    // Try embedded encrypted token first (self-contained URL), then headers
    const encryptedToken = req.query._token as string | undefined;
    let tokenApiUrl: string | undefined;
    if (encryptedToken) {
      const decrypted = decryptDownloadToken(encryptedToken);
      if (!decrypted) {
        res.status(401).json({ error: "Invalid or expired download token" });
        return;
      }
      // Verify resource binding — token must match the requested type and params
      if (decrypted.resourceType || decrypted.resourceParams) {
        const { type } = req.params;
        const queryParams: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.query)) {
          if (k !== "_token" && typeof v === "string") queryParams[k] = v;
        }
        if (
          decrypted.resourceType !== type ||
          canonicalizeQueryParams(decrypted.resourceParams ?? {}) !==
            canonicalizeQueryParams(queryParams)
        ) {
          res.status(403).json({ error: "Download token does not match the requested resource" });
          return;
        }
      }
      headers[decrypted.header] = decrypted.token;
      rateLimitKey = decrypted.token;
      tokenApiUrl = decrypted.apiUrl;
    } else {
      const privateToken = req.headers["private-token"] as string | undefined;
      const jobToken = req.headers["job-token"] as string | undefined;
      const authHeader = req.headers["authorization"] as string | undefined;

      if (privateToken) {
        headers["Private-Token"] = privateToken;
        rateLimitKey = privateToken;
      } else if (jobToken) {
        headers["JOB-TOKEN"] = jobToken;
        rateLimitKey = jobToken;
      } else if (authHeader) {
        headers["Authorization"] = authHeader;
        rateLimitKey = authHeader;
      } else {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
    }

    if (!checkDownloadRateLimit(rateLimitKey)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }

    // API URL: prefer token-embedded URL, then X-GitLab-API-URL header, then default
    let apiUrl = deps.defaultApiUrl;
    const requestedApiUrl =
      tokenApiUrl || (req.headers["x-gitlab-api-url"] as string | undefined)?.trim();
    if (deps.enableDynamicApiUrl && requestedApiUrl) {
      try {
        apiUrl = deps.resolveTrustedGitLabApiUrl(requestedApiUrl);
      } catch {
        res.status(400).json({ error: "Invalid X-GitLab-API-URL" });
        return;
      }
    }

    const { type } = req.params;
    let gitlabUrl: string;

    try {
      switch (type) {
        case "job-artifacts": {
          const { project_id, job_id } = req.query as Record<string, string>;
          if (!project_id || !job_id) {
            res.status(400).json({ error: "project_id and job_id are required" });
            return;
          }
          const effectiveProjectId = deps.getEffectiveProjectId(decodeURIComponent(project_id));
          gitlabUrl = `${apiUrl}/projects/${encodeURIComponent(effectiveProjectId)}/jobs/${deps.encodeGitLabPathSegment(job_id)}/artifacts`;
          break;
        }
        case "attachment": {
          const { project_id, secret, filename } = req.query as Record<string, string>;
          if (!project_id || !secret || !filename) {
            res.status(400).json({ error: "project_id, secret, and filename are required" });
            return;
          }
          const effectiveProjectId = deps.getEffectiveProjectId(decodeURIComponent(project_id));
          gitlabUrl = `${apiUrl}/projects/${encodeURIComponent(effectiveProjectId)}/uploads/${deps.encodeGitLabPathSegment(secret)}/${deps.encodeGitLabPath(filename)}`;
          break;
        }
        case "release-asset": {
          const { project_id, tag_name, direct_asset_path } = req.query as Record<string, string>;
          if (!project_id || !tag_name || !direct_asset_path) {
            res
              .status(400)
              .json({ error: "project_id, tag_name, and direct_asset_path are required" });
            return;
          }
          const effectiveProjectId = deps.getEffectiveProjectId(decodeURIComponent(project_id));
          gitlabUrl = `${apiUrl}/projects/${encodeURIComponent(effectiveProjectId)}/releases/${encodeURIComponent(tag_name)}/downloads/${deps.encodeGitLabPath(direct_asset_path)}`;
          break;
        }
        default:
          res.status(400).json({ error: `Unknown download type: ${type}` });
          return;
      }
    } catch (e) {
      // getEffectiveProjectId throws on access-denied
      const message = e instanceof Error ? e.message : "Invalid parameters";
      res.status(403).json({ error: message });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), downloadTimeoutMs);

    try {
      const agent = deps.getAgentFunctionForUrl(apiUrl);
      const gitlabResponse = await deps.fetch(gitlabUrl, {
        headers,
        agent,
        signal: controller.signal,
      });

      if (!gitlabResponse.ok) {
        res.status(gitlabResponse.status).json({
          error: `GitLab API error: ${gitlabResponse.status} ${gitlabResponse.statusText}`,
        });
        return;
      }

      const contentType = gitlabResponse.headers.get("content-type");
      const contentDisposition = gitlabResponse.headers.get("content-disposition");
      const contentLength = gitlabResponse.headers.get("content-length");

      if (contentType) res.setHeader("Content-Type", contentType);
      if (contentDisposition) res.setHeader("Content-Disposition", contentDisposition);
      if (contentLength) res.setHeader("Content-Length", contentLength);

      if (gitlabResponse.body) {
        gitlabResponse.body.pipe(res);
      } else {
        res.status(502).json({ error: "No response body from GitLab" });
      }
    } catch (error) {
      deps.logger.error({ err: error }, "Download proxy error");
      if (!res.headersSent) {
        const message = error instanceof Error && error.name === "AbortError"
          ? "GitLab download timed out"
          : "Failed to proxy download from GitLab";
        res.status(502).json({ error: message });
      }
    } finally {
      clearTimeout(timeout);
    }
  });
}
