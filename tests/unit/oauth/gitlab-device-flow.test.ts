/**
 * GitLab Device Flow Client Tests
 *
 * Tests for OAuth 2.0 Device Authorization Grant implementation.
 */

import {
  initiateDeviceFlow,
  pollDeviceFlowOnce,
  pollForToken,
  refreshGitLabToken,
  getGitLabUser,
  validateGitLabToken,
  exchangeGitLabAuthCode,
  buildGitLabAuthUrl,
} from "../../../src/oauth/gitlab-device-flow";
import { OAuthConfig } from "../../../src/oauth/config";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock the config module
jest.mock("../../../src/config", () => ({
  GITLAB_BASE_URL: "https://gitlab.example.com",
}));

// Mock logger to avoid console output
jest.mock("../../../src/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("GitLab Device Flow Client", () => {
  const mockConfig: OAuthConfig = {
    enabled: true,
    gitlabClientId: "test-client-id",
    gitlabClientSecret: "test-client-secret",
    gitlabScopes: "api,read_user",
    sessionSecret: "test-session-secret-min-32-chars!!",
    tokenTtl: 3600,
    refreshTokenTtl: 604800,
    devicePollInterval: 5,
    deviceTimeout: 300,
  };

  const mockConfigWithoutSecret: OAuthConfig = {
    ...mockConfig,
    gitlabClientSecret: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("initiateDeviceFlow", () => {
    it("should initiate device flow successfully", async () => {
      const mockResponse = {
        device_code: "device-code-123",
        user_code: "USER-CODE",
        verification_uri: "https://gitlab.example.com/oauth/device",
        verification_uri_complete: "https://gitlab.example.com/oauth/device?user_code=USER-CODE",
        expires_in: 900,
        interval: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await initiateDeviceFlow(mockConfig);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/oauth/authorize_device",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        })
      );

      // Verify request body contains correct parameters
      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;
      expect(body.get("client_id")).toBe("test-client-id");
      expect(body.get("scope")).toBe("api read_user"); // Comma converted to space
    });

    it("should throw error on failed device flow initiation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Invalid client_id"),
      });

      await expect(initiateDeviceFlow(mockConfig)).rejects.toThrow(
        "Failed to initiate device flow: 400 Invalid client_id"
      );
    });
  });

  describe("pollDeviceFlowOnce", () => {
    it("should return token response on successful authorization", async () => {
      const mockTokenResponse = {
        access_token: "access-token-123",
        token_type: "Bearer",
        expires_in: 7200,
        refresh_token: "refresh-token-123",
        scope: "api read_user",
        created_at: 1234567890,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      });

      const result = await pollDeviceFlowOnce("device-code-123", mockConfig);

      expect(result).toEqual(mockTokenResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/oauth/token",
        expect.objectContaining({
          method: "POST",
        })
      );

      // Verify request body
      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;
      expect(body.get("client_id")).toBe("test-client-id");
      expect(body.get("client_secret")).toBe("test-client-secret");
      expect(body.get("device_code")).toBe("device-code-123");
      expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
    });

    it("should not include client_secret if not configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: "token" }),
      });

      await pollDeviceFlowOnce("device-code-123", mockConfigWithoutSecret);

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;
      expect(body.has("client_secret")).toBe(false);
    });

    it("should return null on authorization_pending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: "authorization_pending",
          error_description: "User has not yet completed authorization",
        }),
      });

      const result = await pollDeviceFlowOnce("device-code-123", mockConfig);

      expect(result).toBeNull();
    });

    it("should return null on slow_down", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: "slow_down",
          error_description: "Please slow down polling",
        }),
      });

      const result = await pollDeviceFlowOnce("device-code-123", mockConfig);

      expect(result).toBeNull();
    });

    it("should throw error on expired_token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: "expired_token",
          error_description: "Device code has expired",
        }),
      });

      await expect(pollDeviceFlowOnce("device-code-123", mockConfig)).rejects.toThrow(
        "Device code expired. Please start a new authorization."
      );
    });

    it("should throw error on access_denied", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: "access_denied",
          error_description: "User denied authorization",
        }),
      });

      await expect(pollDeviceFlowOnce("device-code-123", mockConfig)).rejects.toThrow(
        "User denied the authorization request."
      );
    });

    it("should throw error on invalid_grant", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: "invalid_grant",
          error_description: "Invalid device code",
        }),
      });

      await expect(pollDeviceFlowOnce("device-code-123", mockConfig)).rejects.toThrow(
        "Invalid device code or grant."
      );
    });

    it("should throw generic error for unknown error types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: "unknown_error",
          error_description: "Something went wrong",
        }),
      });

      await expect(pollDeviceFlowOnce("device-code-123", mockConfig)).rejects.toThrow(
        "Device flow error: Something went wrong"
      );
    });

    it("should use error code when no description provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: "server_error",
        }),
      });

      await expect(pollDeviceFlowOnce("device-code-123", mockConfig)).rejects.toThrow(
        "Device flow error: server_error"
      );
    });
  });

  describe("pollForToken", () => {
    // Note: pollForToken is an async function with internal sleep/polling loop.
    // The core polling logic is tested via pollDeviceFlowOnce tests.
    // These tests verify the function signature and basic behavior.

    it("should return token when authorization completes immediately", async () => {
      const mockTokenResponse = {
        access_token: "access-token-123",
        token_type: "Bearer",
        expires_in: 7200,
        refresh_token: "refresh-token-123",
      };

      // Mock immediate success (no pending)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      });

      // Use a very short config to minimize test time
      const quickConfig = { ...mockConfig, devicePollInterval: 0.01, deviceTimeout: 1 };
      const result = await pollForToken("device-code-123", quickConfig);

      expect(result).toEqual(mockTokenResponse);
    });

    it("should throw on terminal errors during polling", async () => {
      // Mock terminal error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: "access_denied" }),
      });

      const quickConfig = { ...mockConfig, devicePollInterval: 0.01, deviceTimeout: 1 };

      await expect(pollForToken("device-code-123", quickConfig)).rejects.toThrow(
        "User denied the authorization request."
      );
    });

    it("should accept onPending callback parameter", async () => {
      const mockTokenResponse = { access_token: "token" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      });

      const onPending = jest.fn();
      const quickConfig = { ...mockConfig, devicePollInterval: 0.01, deviceTimeout: 1 };

      const result = await pollForToken("device-code-123", quickConfig, onPending);
      expect(result).toBeDefined();
      // onPending may or may not be called depending on timing
    });

    it("should timeout when authorization never completes", async () => {
      // Always return pending
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: "authorization_pending" }),
      });

      // Very short timeout to trigger timeout quickly
      const shortTimeoutConfig = {
        ...mockConfig,
        devicePollInterval: 0.01,
        deviceTimeout: 0.05,
      };

      await expect(pollForToken("device-code-123", shortTimeoutConfig)).rejects.toThrow(
        /Device flow timeout after/
      );
    });
  });

  describe("refreshGitLabToken", () => {
    it("should refresh token successfully", async () => {
      const mockTokenResponse = {
        access_token: "new-access-token",
        token_type: "Bearer",
        expires_in: 7200,
        refresh_token: "new-refresh-token",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      });

      const result = await refreshGitLabToken("old-refresh-token", mockConfig);

      expect(result).toEqual(mockTokenResponse);

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;
      expect(body.get("client_id")).toBe("test-client-id");
      expect(body.get("client_secret")).toBe("test-client-secret");
      expect(body.get("refresh_token")).toBe("old-refresh-token");
      expect(body.get("grant_type")).toBe("refresh_token");
    });

    it("should not include client_secret if not configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: "token" }),
      });

      await refreshGitLabToken("refresh-token", mockConfigWithoutSecret);

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;
      expect(body.has("client_secret")).toBe(false);
    });

    it("should throw error on failed refresh", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue("Invalid refresh token"),
      });

      await expect(refreshGitLabToken("invalid-token", mockConfig)).rejects.toThrow(
        "Failed to refresh token: 401 Invalid refresh token"
      );
    });
  });

  describe("getGitLabUser", () => {
    it("should get user info successfully", async () => {
      const mockUserInfo = {
        id: 12345,
        username: "testuser",
        name: "Test User",
        email: "test@example.com",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserInfo),
      });

      const result = await getGitLabUser("access-token-123");

      expect(result).toEqual(mockUserInfo);
      expect(mockFetch).toHaveBeenCalledWith("https://gitlab.example.com/api/v4/user", {
        headers: {
          Authorization: "Bearer access-token-123",
          Accept: "application/json",
        },
      });
    });

    it("should throw error on failed user info fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue("Unauthorized"),
      });

      await expect(getGitLabUser("invalid-token")).rejects.toThrow(
        "Failed to get GitLab user info: 401"
      );
    });
  });

  describe("validateGitLabToken", () => {
    it("should return true for valid token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await validateGitLabToken("valid-token");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("https://gitlab.example.com/api/v4/user", {
        method: "HEAD",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });
    });

    it("should return false for invalid token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await validateGitLabToken("invalid-token");

      expect(result).toBe(false);
    });

    it("should return false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await validateGitLabToken("any-token");

      expect(result).toBe(false);
    });
  });

  describe("exchangeGitLabAuthCode", () => {
    it("should exchange auth code successfully", async () => {
      const mockTokenResponse = {
        access_token: "access-token-123",
        token_type: "Bearer",
        expires_in: 7200,
        refresh_token: "refresh-token-123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      });

      const result = await exchangeGitLabAuthCode(
        "auth-code-123",
        "https://app.example.com/callback",
        mockConfig
      );

      expect(result).toEqual(mockTokenResponse);

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;
      expect(body.get("client_id")).toBe("test-client-id");
      expect(body.get("client_secret")).toBe("test-client-secret");
      expect(body.get("code")).toBe("auth-code-123");
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("redirect_uri")).toBe("https://app.example.com/callback");
    });

    it("should not include client_secret if not configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: "token" }),
      });

      await exchangeGitLabAuthCode(
        "code",
        "https://app.example.com/callback",
        mockConfigWithoutSecret
      );

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;
      expect(body.has("client_secret")).toBe(false);
    });

    it("should throw error on failed exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Invalid authorization code"),
      });

      await expect(
        exchangeGitLabAuthCode("invalid-code", "https://app.example.com/callback", mockConfig)
      ).rejects.toThrow("Failed to exchange authorization code: 400 Invalid authorization code");
    });
  });

  describe("buildGitLabAuthUrl", () => {
    it("should build correct authorization URL", () => {
      const url = buildGitLabAuthUrl(mockConfig, "https://app.example.com/callback", "state-123");

      expect(url).toContain("https://gitlab.example.com/oauth/authorize?");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback");
      expect(url).toContain("response_type=code");
      expect(url).toContain("state=state-123");
      expect(url).toContain("scope=api+read_user"); // Comma converted to space, then URL-encoded
    });

    it("should convert comma-separated scopes to space-separated", () => {
      const configWithMultipleScopes: OAuthConfig = {
        ...mockConfig,
        gitlabScopes: "api,read_user,write_repository",
      };

      const url = buildGitLabAuthUrl(
        configWithMultipleScopes,
        "https://app.example.com/callback",
        "state-123"
      );

      // Scopes should be space-separated (URL-encoded as +)
      expect(url).toContain("scope=api+read_user+write_repository");
    });
  });
});
