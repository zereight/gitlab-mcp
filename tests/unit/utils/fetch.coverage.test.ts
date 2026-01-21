// Mock fs module - must be before imports that use fs
jest.mock("fs", () => {
  const actualFs = jest.requireActual("fs");
  return {
    ...actualFs,
    readFileSync: jest.fn().mockImplementation((path: string, encoding?: string) => {
      // Allow actual reads for internal node_modules (pino, sonic-boom, etc.)
      if (
        typeof path === "string" &&
        (path.includes("node_modules") || path.includes("pino") || path.includes("sonic-boom"))
      ) {
        return actualFs.readFileSync(path, encoding);
      }
      // Return empty string for mocked paths (test paths)
      return "";
    }),
  };
});

import { createFetchOptions, enhancedFetch, DEFAULT_HEADERS } from "../../../src/utils/fetch";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();

  // Setup default mocks
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({}),
  });
});

describe("Fetch Utils Coverage Tests", () => {
  describe("Basic Functions", () => {
    it("should return fetch options object", () => {
      const options = createFetchOptions();
      expect(typeof options).toBe("object");
    });

    it("should have required default headers", () => {
      expect(DEFAULT_HEADERS["User-Agent"]).toBe("GitLab MCP Server");
      expect(DEFAULT_HEADERS["Content-Type"]).toBe("application/json");
      expect(DEFAULT_HEADERS.Accept).toBe("application/json");
    });
  });

  describe("enhancedFetch", () => {
    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      timeoutError.name = "AbortError";
      mockFetch.mockRejectedValue(timeoutError);

      await expect(enhancedFetch("https://example.com")).rejects.toThrow(
        "GitLab API timeout after 20000ms"
      );
    });

    it("should propagate non-timeout errors", async () => {
      const networkError = new Error("Network error");
      mockFetch.mockRejectedValue(networkError);

      await expect(enhancedFetch("https://example.com")).rejects.toThrow("Network error");
    });

    it("should merge custom headers with defaults", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      await enhancedFetch("https://example.com", {
        headers: { "X-Custom": "custom-value" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "GitLab MCP Server",
            "X-Custom": "custom-value",
          }),
        })
      );
    });

    it("should handle Headers object", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      const headers = new Headers();
      headers.set("X-Custom", "custom-value");

      await enhancedFetch("https://example.com", { headers });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-custom": "custom-value", // Headers normalizes to lowercase
          }),
        })
      );
    });

    it("should handle loadGitLabCookies success case", async () => {
      // Set environment variable to trigger cookie loading
      const originalCookiePath = process.env.GITLAB_AUTH_COOKIE_PATH;
      process.env.GITLAB_AUTH_COOKIE_PATH = "/fake/cookie/path";

      // Reset modules to force re-import with new environment variable
      jest.resetModules();

      // Mock fs to simulate cookie file exists
      const fs = require("fs");
      fs.readFileSync.mockReturnValue(
        "# HTTP Cookie File\n" +
          "gitlab.example.com\tFALSE\t/\tTRUE\t1234567890\t_gitlab_session\tabc123\n" +
          "gitlab.example.com\tFALSE\t/\tTRUE\t1234567890\tremember_token\tdef456\n"
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      // Re-import enhancedFetch after setting environment variable
      const { enhancedFetch: newEnhancedFetch } = require("../../../src/utils/fetch");

      // This should trigger cookie loading logic
      await newEnhancedFetch("https://gitlab.example.com/api/test");

      expect(fs.readFileSync).toHaveBeenCalledWith("/fake/cookie/path", "utf-8");

      // Restore original value
      process.env.GITLAB_AUTH_COOKIE_PATH = originalCookiePath;
    });

    it("should handle loadGitLabCookies error case", async () => {
      // Set environment variable to trigger cookie loading
      const originalCookiePath = process.env.GITLAB_AUTH_COOKIE_PATH;
      process.env.GITLAB_AUTH_COOKIE_PATH = "/fake/cookie/path";

      // Reset modules to force re-import with new environment variable
      jest.resetModules();

      // Mock fs to simulate error reading cookie file
      const fs = require("fs");
      fs.readFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      // Re-import enhancedFetch after setting environment variable
      const { enhancedFetch: newEnhancedFetch } = require("../../../src/utils/fetch");

      // This should handle the cookie loading error gracefully
      await newEnhancedFetch("https://gitlab.example.com/api/test");

      expect(fs.readFileSync).toHaveBeenCalledWith("/fake/cookie/path", "utf-8");

      // Restore original value
      process.env.GITLAB_AUTH_COOKIE_PATH = originalCookiePath;
    });

    it("should handle malformed cookie lines", async () => {
      // Set environment variable to trigger cookie loading
      const originalCookiePath = process.env.GITLAB_AUTH_COOKIE_PATH;
      process.env.GITLAB_AUTH_COOKIE_PATH = "/fake/cookie/path";

      // Reset modules to force re-import with new environment variable
      jest.resetModules();

      // Mock fs to simulate malformed cookie file
      const fs = require("fs");
      fs.readFileSync.mockReturnValue(
        "# HTTP Cookie File\n" +
          "malformed line\n" +
          "gitlab.example.com\tFALSE\t/\tTRUE\t1234567890\t_gitlab_session\tabc123\n" +
          "incomplete\ttab\tseparated\n"
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      // Re-import enhancedFetch after setting environment variable
      const { enhancedFetch: newEnhancedFetch } = require("../../../src/utils/fetch");

      await newEnhancedFetch("https://gitlab.example.com/api/test");

      expect(fs.readFileSync).toHaveBeenCalledWith("/fake/cookie/path", "utf-8");

      // Restore original value
      process.env.GITLAB_AUTH_COOKIE_PATH = originalCookiePath;
    });

    it("should handle empty cookie file", async () => {
      // Set environment variable to trigger cookie loading
      const originalCookiePath = process.env.GITLAB_AUTH_COOKIE_PATH;
      process.env.GITLAB_AUTH_COOKIE_PATH = "/fake/cookie/path";

      // Reset modules to force re-import with new environment variable
      jest.resetModules();

      // Mock fs to simulate empty cookie file
      const fs = require("fs");
      fs.readFileSync.mockReturnValue("# HTTP Cookie File\n\n");

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      // Re-import enhancedFetch after setting environment variable
      const { enhancedFetch: newEnhancedFetch } = require("../../../src/utils/fetch");

      await newEnhancedFetch("https://gitlab.example.com/api/test");

      expect(fs.readFileSync).toHaveBeenCalledWith("/fake/cookie/path", "utf-8");

      // Restore original value
      process.env.GITLAB_AUTH_COOKIE_PATH = originalCookiePath;
    });

    it("should handle cookie file with comments only", async () => {
      // Set environment variable to trigger cookie loading
      const originalCookiePath = process.env.GITLAB_AUTH_COOKIE_PATH;
      process.env.GITLAB_AUTH_COOKIE_PATH = "/fake/cookie/path";

      // Reset modules to force re-import with new environment variable
      jest.resetModules();

      // Mock fs to simulate cookie file with only comments
      const fs = require("fs");
      fs.readFileSync.mockReturnValue(
        "# HTTP Cookie File\n" + "# This is a comment\n" + "# Another comment\n"
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      // Re-import enhancedFetch after setting environment variable
      const { enhancedFetch: newEnhancedFetch } = require("../../../src/utils/fetch");

      await newEnhancedFetch("https://gitlab.example.com/api/test");

      expect(fs.readFileSync).toHaveBeenCalledWith("/fake/cookie/path", "utf-8");

      // Restore original value
      process.env.GITLAB_AUTH_COOKIE_PATH = originalCookiePath;
    });

    it("should handle proxy configuration scenarios", async () => {
      // Test various proxy configurations
      const originalHttpProxy = process.env.HTTP_PROXY;
      const originalHttpsProxy = process.env.HTTPS_PROXY;

      try {
        process.env.HTTP_PROXY = "http://proxy.example.com:8080";
        process.env.HTTPS_PROXY = "https://proxy.example.com:8080";

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({}),
        });

        await enhancedFetch("https://gitlab.example.com/api/test");

        expect(mockFetch).toHaveBeenCalled();
      } finally {
        process.env.HTTP_PROXY = originalHttpProxy;
        process.env.HTTPS_PROXY = originalHttpsProxy;
      }
    });

    it("should handle SOCKS proxy configuration", async () => {
      const originalHttpProxy = process.env.HTTP_PROXY;

      try {
        process.env.HTTP_PROXY = "socks5://proxy.example.com:1080";

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({}),
        });

        await enhancedFetch("https://gitlab.example.com/api/test");

        expect(mockFetch).toHaveBeenCalled();
      } finally {
        process.env.HTTP_PROXY = originalHttpProxy;
      }
    });

    it("should handle TLS configuration scenarios", async () => {
      const originalRejectUnauth = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

      try {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({}),
        });

        await enhancedFetch("https://gitlab.example.com/api/test");

        expect(mockFetch).toHaveBeenCalled();
      } finally {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauth;
      }
    });

    it("should handle CA certificate path configuration", async () => {
      // Set environment variable to trigger CA cert loading
      const originalCACertPath = process.env.GITLAB_CA_CERT_PATH;
      const originalHttpProxy = process.env.HTTP_PROXY;
      const originalHttpsProxy = process.env.HTTPS_PROXY;

      process.env.GITLAB_CA_CERT_PATH = "/fake/ca/cert/path";
      // Clear proxy variables to avoid conflicts
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;

      // Reset modules to force re-import with new environment variable
      jest.resetModules();

      // Mock fs to simulate CA cert file exists
      const fs = require("fs");
      fs.readFileSync.mockReturnValue(
        "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----"
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      // Re-import enhancedFetch after setting environment variable
      const { enhancedFetch: newEnhancedFetch } = require("../../../src/utils/fetch");

      await newEnhancedFetch("https://gitlab.example.com/api/test");

      expect(fs.readFileSync).toHaveBeenCalledWith("/fake/ca/cert/path");

      // Restore original values
      process.env.GITLAB_CA_CERT_PATH = originalCACertPath;
      process.env.HTTP_PROXY = originalHttpProxy;
      process.env.HTTPS_PROXY = originalHttpsProxy;
    });

    it("should handle SOCKS4 proxy", async () => {
      const originalHttpProxy = process.env.HTTP_PROXY;

      try {
        process.env.HTTP_PROXY = "socks4://proxy.example.com:1080";

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({}),
        });

        await enhancedFetch("https://gitlab.example.com/api/test");

        expect(mockFetch).toHaveBeenCalled();
      } finally {
        process.env.HTTP_PROXY = originalHttpProxy;
      }
    });

    it("should handle default HTTP proxy fallback", async () => {
      const originalHttpProxy = process.env.HTTP_PROXY;
      const originalHttpsProxy = process.env.HTTPS_PROXY;

      try {
        delete process.env.HTTPS_PROXY; // Ensure HTTPS_PROXY is not set
        process.env.HTTP_PROXY = "http://proxy.example.com:8080";

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({}),
        });

        await enhancedFetch("https://gitlab.example.com/api/test");

        expect(mockFetch).toHaveBeenCalled();
      } finally {
        process.env.HTTP_PROXY = originalHttpProxy;
        process.env.HTTPS_PROXY = originalHttpsProxy;
      }
    });

    it("should handle abort controller timeout", async () => {
      // Test that the abort controller timeout logic is executed
      // This test covers line 184: controller.abort();

      // Create a timeout spy to verify setTimeout is called with correct timeout
      const setTimeoutSpy = jest
        .spyOn(global, "setTimeout")
        .mockImplementation((callback, delay) => {
          if (delay === 20000) {
            // API_TIMEOUT_MS default value
            // Execute the callback immediately to simulate timeout
            callback();
          }
          return 1234 as any; // Mock timer ID
        });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      await enhancedFetch("https://gitlab.example.com/api/test");

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 20000);

      setTimeoutSpy.mockRestore();
    });

    it("should handle authorization header without token", async () => {
      const originalToken = process.env.GITLAB_TOKEN;

      try {
        delete process.env.GITLAB_TOKEN;

        // Reset modules to test DEFAULT_HEADERS without token
        jest.resetModules();
        const { DEFAULT_HEADERS } = require("../../../src/utils/fetch");

        expect(DEFAULT_HEADERS.Authorization).toBeUndefined();
        expect(DEFAULT_HEADERS["User-Agent"]).toBe("GitLab MCP Server");
      } finally {
        process.env.GITLAB_TOKEN = originalToken;
      }
    });
  });
});
