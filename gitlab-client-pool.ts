import fs from "node:fs";
import http from "node:http";
import type { AgentConnectOpts } from "agent-base";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Agent, Dispatcher, ProxyAgent, buildConnector } from "undici";

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

  let hostname: string;
  let port: string;
  let protocol: string;
  try {
    const parsedUrl = new URL(url);
    hostname = parsedUrl.hostname.toLowerCase();
    protocol = parsedUrl.protocol;
    port = parsedUrl.port || (protocol === "https:" ? "443" : "80");
  } catch {
    return false;
  }

  const patterns = noProxy
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length > 0);

  for (const pattern of patterns) {
    if (pattern === "*") {
      return true;
    }

    const [patternHost, patternPort] = pattern.split(":");

    if (patternPort && port !== patternPort) {
      continue;
    }

    if (patternHost.startsWith(".")) {
      const suffix = patternHost.substring(1);
      if (hostname === suffix || hostname.endsWith("." + suffix)) {
        return true;
      }
    } else if (hostname === patternHost) {
      return true;
    }
  }

  return false;
}

type TlsConnectOptions = {
  rejectUnauthorized?: boolean;
  ca?: Buffer;
};

class ProtocolDispatcher extends Dispatcher {
  constructor(
    private readonly httpDirect: Dispatcher,
    private readonly httpsDirect: Dispatcher,
    private readonly httpProxyDispatcher: Dispatcher,
    private readonly httpsProxyDispatcher: Dispatcher,
    private readonly noProxy: string | undefined
  ) {
    super();
  }

  dispatcherForOrigin(originText: string): Dispatcher {
    const useHttps = originText.startsWith("https:");
    const bypass = shouldBypassProxy(originText, this.noProxy);
    if (bypass) {
      return useHttps ? this.httpsDirect : this.httpDirect;
    }
    return useHttps ? this.httpsProxyDispatcher : this.httpProxyDispatcher;
  }

  override dispatch(
    options: Dispatcher.DispatchOptions,
    handler: Dispatcher.DispatchHandlers
  ): boolean {
    const origin = options.origin;
    const originText = origin instanceof URL ? origin.href : String(origin ?? "");
    return this.dispatcherForOrigin(originText).dispatch(options, handler);
  }
}

function createSocksConnect(proxyUrl: string, tls: TlsConnectOptions): buildConnector.connector {
  const socksAgent = new SocksProxyAgent(proxyUrl);

  return (options, callback) => {
    const port = Number(options.port);
    const host = options.hostname;

    const dummyReq = http.request({
      hostname: "127.0.0.1",
      port: 9,
      path: "/",
      method: "HEAD",
      agent: false,
    });
    dummyReq.on("error", () => undefined);
    dummyReq.destroy();

    const connectThroughSocks = (connectOpts: AgentConnectOpts) => {
      void socksAgent
        .connect(dummyReq, connectOpts)
        .then(socket => {
          callback(null, socket);
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error("SOCKS connect failed");
          callback(err, null);
        });
    };

    if (options.protocol === "https:") {
      connectThroughSocks({
        secureEndpoint: true,
        host,
        port,
        servername: options.servername,
        rejectUnauthorized: tls.rejectUnauthorized,
        ca: tls.ca,
      });
      return;
    }

    connectThroughSocks({
      secureEndpoint: false,
      host,
      port,
    });
  };
}

function createDispatcher(proxyUrl: string | undefined, tls: TlsConnectOptions): Dispatcher {
  const hasTls = tls.rejectUnauthorized === false || tls.ca !== undefined;

  if (proxyUrl?.startsWith("socks")) {
    return new Agent({ connect: createSocksConnect(proxyUrl, tls) });
  }

  if (proxyUrl) {
    if (hasTls) {
      return new ProxyAgent({ uri: proxyUrl, requestTls: tls });
    }
    return new ProxyAgent(proxyUrl);
  }

  if (hasTls) {
    return new Agent({ connect: tls });
  }

  return new Agent();
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

export interface ClientDispatchers {
  httpDispatcher: Dispatcher;
  httpsDispatcher: Dispatcher;
  dispatcher: Dispatcher;
}

/**
 * Manages a pool of undici dispatchers for different GitLab API URLs.
 * This allows the server to efficiently handle requests to multiple GitLab instances
 * by reusing dispatchers and their underlying TCP connections.
 */
export class GitLabClientPool {
  private clients: Map<string, ClientDispatchers> = new Map();
  private options: GitLabClientPoolOptions;

  constructor(options: GitLabClientPoolOptions) {
    this.options = options;
  }

  private createDispatchersForUrl(apiUrl: string): ClientDispatchers {
    const { httpProxy, httpsProxy, noProxy, rejectUnauthorized, caCertPath } = this.options;

    const tls: TlsConnectOptions = {};
    if (rejectUnauthorized === false) {
      tls.rejectUnauthorized = false;
    } else if (caCertPath) {
      try {
        tls.ca = fs.readFileSync(caCertPath);
      } catch (error) {
        console.error(`Failed to read CA certificate from ${caCertPath}:`, error);
        throw new Error(`Failed to read CA certificate: ${caCertPath}`);
      }
    }

    const httpDirect = createDispatcher(undefined, tls);
    const httpsDirect = createDispatcher(undefined, tls);
    const httpProxyDispatcher = createDispatcher(httpProxy, tls);
    const httpsProxyDispatcher = createDispatcher(httpsProxy, tls);
    const bypassProxy = shouldBypassProxy(apiUrl, noProxy);

    return {
      httpDispatcher: bypassProxy ? httpDirect : httpProxyDispatcher,
      httpsDispatcher: bypassProxy ? httpsDirect : httpsProxyDispatcher,
      dispatcher: new ProtocolDispatcher(
        httpDirect,
        httpsDirect,
        httpProxyDispatcher,
        httpsProxyDispatcher,
        noProxy
      ),
    };
  }

  /**
   * Retrieves the protocol-specific dispatcher for a given API URL.
   * Used by NO_PROXY tests to distinguish Agent vs ProxyAgent.
   */
  public getOrCreateAgentForUrl(apiUrl: string): Dispatcher {
    const dispatchers = this.getOrCreateDispatchersForUrl(apiUrl);
    const url = new URL(apiUrl);
    return url.protocol === "https:" ? dispatchers.httpsDispatcher : dispatchers.httpDispatcher;
  }

  /**
   * Returns a dispatcher that picks HTTP vs HTTPS based on the request origin.
   * Needed when a self-hosted GitLab redirects between HTTP and HTTPS.
   */
  public getDispatcherForUrl(apiUrl: string): Dispatcher {
    return this.getOrCreateDispatchersForUrl(apiUrl).dispatcher;
  }

  /**
   * Which inner dispatcher would handle `originUrl` after following a redirect
   * from `apiUrl`. Used to verify NO_PROXY is re-evaluated per origin.
   */
  public getDispatcherForOrigin(apiUrl: string, originUrl: string): Dispatcher {
    const dispatcher = this.getOrCreateDispatchersForUrl(apiUrl).dispatcher;
    if (dispatcher instanceof ProtocolDispatcher) {
      return dispatcher.dispatcherForOrigin(originUrl);
    }
    return dispatcher;
  }

  private getOrCreateDispatchersForUrl(apiUrl: string): ClientDispatchers {
    const url = new URL(apiUrl);
    const apiIndex = url.pathname.lastIndexOf("/api/v4");
    const basePath =
      apiIndex === -1 ? url.pathname : url.pathname.substring(0, apiIndex + "/api/v4".length);
    const baseUrl = `${url.protocol}//${url.host}${basePath}`;

    if (!this.clients.has(baseUrl)) {
      if (this.options.poolMaxSize !== undefined && this.clients.size >= this.options.poolMaxSize) {
        throw new Error(
          `Server capacity reached: Connection pool is full (max ${this.options.poolMaxSize} instances). Please try again later.`
        );
      }
      this.clients.set(baseUrl, this.createDispatchersForUrl(baseUrl));
    }

    const dispatchers = this.clients.get(baseUrl);
    if (!dispatchers) {
      throw new Error(`Failed to create or get client for URL: ${baseUrl}`);
    }

    return dispatchers;
  }

  public getClient(apiUrl: string): ClientDispatchers | undefined {
    return this.clients.get(apiUrl);
  }

  public getDefaultClient(): ClientDispatchers {
    const defaultUrl = this.options.apiUrls?.[0];
    if (!defaultUrl) {
      throw new Error("No default API URL configured.");
    }
    if (!this.clients.has(defaultUrl)) {
      this.clients.set(defaultUrl, this.createDispatchersForUrl(defaultUrl));
    }
    const client = this.clients.get(defaultUrl);
    if (!client) {
      throw new Error("No default API URL configured.");
    }
    return client;
  }

  public closeAll(): void {
    for (const [, dispatchers] of this.clients) {
      void dispatchers.httpDispatcher.destroy();
      void dispatchers.httpsDispatcher.destroy();
    }
    this.clients.clear();
  }

  public getStats(): { size: number; maxSize: number } {
    return {
      size: this.clients.size,
      maxSize: this.options.poolMaxSize ?? 0,
    };
  }
}
