import { Agent } from "http";
import { Agent as HttpsAgent } from "https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import fs from "fs";

/**
 * Checks if a URL should bypass the proxy based on NO_PROXY patterns.
 * Supports:
 * - Exact hostname matches (e.g., "localhost", "gitlab.example.com")
 * - Domain suffix matches (e.g., ".example.com" matches "gitlab.example.com")
 * - IP addresses (e.g., "127.0.0.1", "192.168.1.1")
 * - Wildcard "*" to bypass all proxies
 * - Port-specific matches (e.g., "example.com:8080")
 * 
 * @param url The URL to check
 * @param noProxy Comma-separated list of patterns from NO_PROXY
 * @returns true if the URL should bypass the proxy, false otherwise
 */
function shouldBypassProxy(url: string, noProxy: string | undefined): boolean {
  if (!noProxy) {
    return false;
  }

  // Parse URL to get hostname and port
  let hostname: string;
  let port: string;
  let protocol: string;
  try {
    const parsedUrl = new URL(url);
    hostname = parsedUrl.hostname.toLowerCase();
    protocol = parsedUrl.protocol;
    // Use explicit port if provided, otherwise use default port based on protocol
    port = parsedUrl.port || (protocol === 'https:' ? '443' : '80');
  } catch {
    return false;
  }

  // Split NO_PROXY into patterns and trim whitespace
  const patterns = noProxy.split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);

  for (const pattern of patterns) {
    // Wildcard matches everything
    if (pattern === '*') {
      return true;
    }

    // Handle port-specific patterns (e.g., "example.com:8080")
    const [patternHost, patternPort] = pattern.split(':');
    
    // If pattern specifies a port, check if it matches
    if (patternPort && port !== patternPort) {
      continue;
    }

    // Check for domain suffix match (e.g., ".example.com")
    if (patternHost.startsWith('.')) {
      const suffix = patternHost.substring(1);
      if (hostname === suffix || hostname.endsWith('.' + suffix)) {
        return true;
      }
    }
    // Check for exact hostname match
    else if (hostname === patternHost) {
      return true;
    }
  }

  return false;
}

export interface GitLabClientPoolOptions {
  apiUrls?: string[];
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
  rejectUnauthorized?: boolean;
  caCertPath?: string;
  poolMaxSize?: number;
}

export interface ClientAgents {
  httpAgent: Agent;
  httpsAgent: HttpsAgent;
}

/**
 * Manages a pool of HTTP/HTTPS agents for different GitLab API URLs.
 * This allows the server to efficiently handle requests to multiple GitLab instances
 * by reusing agents and their underlying TCP connections.
 */
export class GitLabClientPool {
  private clients: Map<string, ClientAgents> = new Map();
  private options: GitLabClientPoolOptions;

  constructor(options: GitLabClientPoolOptions) {
    this.options = options;
    // Initialization is now done on-demand
  }

  /**
   * Creates a pair of HTTP and HTTPS agents for a specific API URL,
   * considering proxy and SSL/TLS settings.
   * @param apiUrl The base URL for which to create the agents.
   * @returns A `ClientAgents` object containing the configured agents.
   */
  private createAgentsForUrl(apiUrl: string): ClientAgents {
    const { httpProxy, httpsProxy, noProxy, rejectUnauthorized, caCertPath } = this.options;
    const url = new URL(apiUrl);

    let sslOptions: { rejectUnauthorized?: boolean; ca?: Buffer } = {};
    if (rejectUnauthorized === false) {
      sslOptions.rejectUnauthorized = false;
    } else if (caCertPath) {
      try {
        sslOptions.ca = fs.readFileSync(caCertPath);
      } catch (error) {
        console.error(`Failed to read CA certificate from ${caCertPath}:`, error);
        throw new Error(`Failed to read CA certificate: ${caCertPath}`);
      }
    }

    // Check if this URL should bypass the proxy
    const bypassProxy = shouldBypassProxy(apiUrl, noProxy);

    let httpAgent: Agent;
    let httpsAgent: HttpsAgent;

    // Configure HTTP agent with proxy if specified and not bypassed
    if (httpProxy && !bypassProxy) {
      httpAgent = httpProxy.startsWith("socks")
        ? new SocksProxyAgent(httpProxy)
        : new HttpProxyAgent(httpProxy);
    } else {
      httpAgent = new Agent({ keepAlive: true });
    }

    // Configure HTTPS agent with proxy and SSL options if specified and not bypassed
    if (httpsProxy && !bypassProxy) {
      httpsAgent = httpsProxy.startsWith("socks")
        // The `as any` cast is used here to bypass a TypeScript type mismatch error.
        // The `socks-proxy-agent` documentation indicates that TLS options like
        // `rejectUnauthorized` and `ca` are valid in the constructor's options
        // object, but the type definitions in this environment seem to disagree.
        // This cast ensures the options are passed through at runtime.
        ? new SocksProxyAgent(httpsProxy, sslOptions as any)
        : new HttpsProxyAgent(httpsProxy, { ...sslOptions });
    } else {
      httpsAgent = new HttpsAgent({ ...sslOptions, keepAlive: true });
    }

    return { httpAgent, httpsAgent };
  }

  /**
   * Retrieves the appropriate agent (HTTP or HTTPS) for a given API URL.
   * If an agent for the URL does not exist, it creates and caches one.
   * @param apiUrl The full URL of the request.
   * @returns The corresponding `Agent` for the URL's protocol.
   */
  public getOrCreateAgentForUrl(apiUrl: string): Agent {
    const url = new URL(apiUrl);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname.substring(0, url.pathname.lastIndexOf('/api/v4') + '/api/v4'.length)}`;

    if (!this.clients.has(baseUrl)) {
      // Check pool size limit
      if (this.options.poolMaxSize !== undefined && this.clients.size >= this.options.poolMaxSize) {
        throw new Error(`Server capacity reached: Connection pool is full (max ${this.options.poolMaxSize} instances). Please try again later.`);
      }
      this.clients.set(baseUrl, this.createAgentsForUrl(baseUrl));
    }

    const agents = this.clients.get(baseUrl);
    if (!agents) {
      // This should not happen given the logic above, but it satisfies TypeScript
      throw new Error(`Failed to create or get client for URL: ${baseUrl}`);
    }

    return url.protocol === "https:" ? agents.httpsAgent : agents.httpAgent;
  }

  /**
   * Retrieves the client agents for a specific base API URL.
   * @param apiUrl The base API URL (e.g., "https://gitlab.com/api/v4").
   * @returns The `ClientAgents` object or undefined if not found.
   */
  public getClient(apiUrl: string): ClientAgents | undefined {
    return this.clients.get(apiUrl);
  }

  /**
   * Returns the default client agents, which corresponds to the first URL in the list.
   * @returns The default `ClientAgents`.
   */
  public getDefaultClient(): ClientAgents {
    const defaultUrl = this.options.apiUrls?.[0];
    if (!defaultUrl) {
      throw new Error("No default API URL configured.");
    }
    if (!this.clients.has(defaultUrl)) {
      this.clients.set(defaultUrl, this.createAgentsForUrl(defaultUrl));
    }
    return this.clients.get(defaultUrl)!;
  }
}