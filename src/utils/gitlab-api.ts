/**
 * GitLab REST API Client
 *
 * Unified client for GitLab API calls that handles:
 * - URL building with base URL from config
 * - Query parameters serialization
 * - Request body encoding (JSON or form-urlencoded)
 * - Response error handling
 * - GID cleanup from responses
 * - Authentication via enhancedFetch
 */

import { enhancedFetch } from "./fetch";
import { cleanGidsFromObject } from "./idConversion";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions {
  /** Query parameters - undefined values are filtered out */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Request body for POST/PUT/PATCH */
  body?: Record<string, unknown> | URLSearchParams | FormData;
  /** Content type: 'json' or 'form' for x-www-form-urlencoded (default: 'form') */
  contentType?: "json" | "form";
  /** Skip GID cleanup from response */
  rawResponse?: boolean;
}

/**
 * Build query string from params object, filtering out undefined/null values
 */
function buildQueryString(
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }

  const str = searchParams.toString();
  return str ? `?${str}` : "";
}

/**
 * Encode request body based on content type
 */
function encodeBody(
  body: Record<string, unknown> | URLSearchParams | FormData | undefined,
  contentType: "json" | "form"
): { body?: string | FormData; headers: Record<string, string> } {
  if (!body) {
    return { headers: {} };
  }

  // Already encoded
  if (body instanceof URLSearchParams) {
    return {
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    };
  }

  if (body instanceof FormData) {
    return {
      body,
      headers: {}, // Let fetch set Content-Type with boundary
    };
  }

  // Encode as JSON or form
  if (contentType === "json") {
    return {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    };
  }

  // Form-urlencoded
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  return {
    body: params.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };
}

/**
 * Make a GitLab API request
 */
async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = process.env.GITLAB_API_URL ?? "https://gitlab.com";
  const queryString = buildQueryString(options.query);
  const url = `${baseUrl}/api/v4/${path}${queryString}`;

  const { body, headers } = encodeBody(options.body, options.contentType ?? "form");

  // For GET requests with no body/headers, don't pass options (matches existing behavior)
  const hasBody = !!body;
  const hasHeaders = Object.keys(headers).length > 0;

  let response: Response;
  if (method === "GET" && !hasBody && !hasHeaders) {
    response = await enhancedFetch(url);
  } else {
    const fetchOptions: RequestInit = {
      method,
      ...(hasBody && { body }),
      ...(hasHeaders && { headers }),
    };
    response = await enhancedFetch(url, fetchOptions);
  }

  if (!response.ok) {
    let errorDetails = "";
    try {
      if (typeof response.text === "function") {
        const text = await response.text();
        if (text.trim()) {
          // Try to parse as JSON and extract meaningful error info
          const errorResponse = JSON.parse(text) as {
            message?: string | { value?: string[] } | Record<string, unknown>;
            error?: string;
          };
          const parts: string[] = [];
          if (errorResponse.message) {
            if (typeof errorResponse.message === "string") {
              parts.push(errorResponse.message);
            } else if (
              typeof errorResponse.message === "object" &&
              "value" in errorResponse.message &&
              Array.isArray(errorResponse.message.value)
            ) {
              parts.push(errorResponse.message.value.join(", "));
            } else {
              parts.push(JSON.stringify(errorResponse.message));
            }
          }
          if (errorResponse.error) {
            parts.push(errorResponse.error);
          }
          errorDetails = parts.join(" - ");
        }
      }
    } catch {
      // If error response can't be parsed, leave errorDetails empty
    }
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ""}`
    );
  }

  // Handle 204 No Content responses (common for DELETE, some PUT/POST operations)
  // Callers expecting void/undefined should use appropriate generic type: gitlab.delete<void>()
  // Type assertion is intentional to allow typed handlers to work with void responses
  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T;
  return options.rawResponse ? data : cleanGidsFromObject(data);
}

/**
 * GitLab API client with typed methods
 */
export const gitlab = {
  /**
   * GET request
   * @example gitlab.get('projects/123/labels', { query: { per_page: 20 } })
   */
  get: <T = unknown>(path: string, options?: Omit<RequestOptions, "body" | "contentType">) =>
    request<T>("GET", path, options),

  /**
   * POST request
   * @example gitlab.post('projects/123/labels', { body: { name: 'bug', color: '#ff0000' } })
   */
  post: <T = unknown>(path: string, options?: RequestOptions) => request<T>("POST", path, options),

  /**
   * PUT request
   * @example gitlab.put('projects/123/labels/1', { body: { color: '#00ff00' } })
   */
  put: <T = unknown>(path: string, options?: RequestOptions) => request<T>("PUT", path, options),

  /**
   * DELETE request
   * @example gitlab.delete('projects/123/labels/1')
   */
  delete: <T = unknown>(path: string, options?: Omit<RequestOptions, "body" | "contentType">) =>
    request<T>("DELETE", path, options),

  /**
   * PATCH request
   * @example gitlab.patch('projects/123', { body: { description: 'New desc' } })
   */
  patch: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>("PATCH", path, options),
};

/**
 * Helper to build entity paths
 */
export const paths = {
  /** Encode path for URL */
  encode: (path: string) => encodeURIComponent(path),

  /** Projects path */
  project: (id: string | number) =>
    `projects/${typeof id === "number" ? id : encodeURIComponent(id)}`,

  /** Groups path */
  group: (id: string | number) => `groups/${typeof id === "number" ? id : encodeURIComponent(id)}`,

  /** Namespace (project or group) path based on detection */
  namespace: (path: string, entityType: "projects" | "groups") =>
    `${entityType}/${encodeURIComponent(path)}`,
};

/**
 * Helper to filter options for query params, excluding specified keys
 */
export function toQuery<T extends Record<string, unknown>>(
  options: T,
  exclude: (keyof T)[] = []
): Record<string, string | number | boolean | undefined> {
  const result: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(options)) {
    if (!exclude.includes(key as keyof T) && value !== undefined) {
      result[key] = value as string | number | boolean | undefined;
    }
  }
  return result;
}

export default gitlab;
