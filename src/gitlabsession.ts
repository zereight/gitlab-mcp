import { Request, Response, RequestInit } from "node-fetch";
import { config } from "./config.js";

import nodeFetch from "node-fetch";

import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { HttpProxyAgent } from "http-proxy-agent";
import { Agent } from "http";
import { Agent as HttpsAgent } from "https";
import { readFileSync } from "fs";
import { CookieJar } from "tough-cookie";
import fetchCookie from "fetch-cookie";

export class GitlabSession {

  private defaultConfig: RequestInit
  private defaultHeaders: Record<string, string>

  constructor(private readonly cookieJar?: CookieJar) {
    // Configure proxy agents if proxies are set
    let httpAgent: Agent | undefined = undefined;
    let httpsAgent: Agent | undefined = undefined;

    let sslOptions = undefined;
    if (config.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
      sslOptions = { rejectUnauthorized: false };
    } else if (config.GITLAB_CA_CERT_PATH) {
      const ca = readFileSync(config.GITLAB_CA_CERT_PATH);
      sslOptions = { ca };
    }

    if (config.HTTP_PROXY) {
      if (config.HTTP_PROXY.startsWith("socks")) {
        httpAgent = new SocksProxyAgent(config.HTTP_PROXY);
      } else {
        httpAgent = new HttpProxyAgent(config.HTTP_PROXY);
      }
    }
    if (config.HTTPS_PROXY) {
      if (config.HTTPS_PROXY.startsWith("socks")) {
        httpsAgent = new SocksProxyAgent(config.HTTPS_PROXY);
      } else {
        httpsAgent = new HttpsProxyAgent(config.HTTPS_PROXY, sslOptions);
      }
    }
    httpsAgent = httpsAgent || new HttpsAgent(sslOptions);
    httpAgent = httpAgent || new Agent();
    this.defaultHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (config.IS_OLD) {
      this.defaultHeaders["Private-Token"] = `${config.GITLAB_PERSONAL_ACCESS_TOKEN}`;
    } else {
      this.defaultHeaders["Authorization"] = `Bearer ${config.GITLAB_PERSONAL_ACCESS_TOKEN}`;
    }

    this.defaultConfig = {
      headers: this.defaultHeaders,
      agent: (parsedUrl: URL) => {
        if (parsedUrl.protocol === "https:") {
          return httpsAgent;
        }
        return httpAgent;
      },
    }

  }

  async ensureSessionForCookieJar(): Promise<void> {
    if (!this.cookieJar || !config.GITLAB_AUTH_COOKIE_PATH) return;

    // Extract the base URL from GITLAB_API_URL
    const apiUrl = new URL(config.GITLAB_API_URL);
    const baseUrl = `${apiUrl.protocol}//${apiUrl.hostname}`;

    // Check if we already have GitLab session cookies
    const gitlabCookies = this.cookieJar.getCookiesSync(baseUrl);
    const hasSessionCookie = gitlabCookies.some(cookie =>
      cookie.key === '_gitlab_session' || cookie.key === 'remember_user_token'
    );

    if (!hasSessionCookie) {
      try {
        // Establish session with a lightweight request
        await fetch(`${config.GITLAB_API_URL}/user`, {
          redirect: 'follow'
        }).catch(() => {
          // Ignore errors - the important thing is that cookies get set during redirects
        });

        // Small delay to ensure cookies are fully processed
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore session establishment errors
      }
    }
  }


  async fetch(url: URL | string | Request, init?: RequestInit): Promise<Response> {
    const fullInit = {...this.defaultConfig, ...init, headers: {
      ...this.defaultHeaders,
      ...init?.headers
    }}
    let fetcher = nodeFetch;
    if(this.cookieJar) {
      fetcher = fetchCookie(fetcher, this.cookieJar);
    }
    return fetcher(url, fullInit);
  }

}
