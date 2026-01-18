/**
 * Unit tests for OAuth authorization endpoint
 * Tests the /authorize endpoint and device flow polling
 */

import { Request, Response } from "express";
import { authorizeHandler, pollHandler } from "../../../../src/oauth/endpoints/authorize";

// Mock dependencies
jest.mock("../../../../src/oauth/config", () => ({
  loadOAuthConfig: jest.fn(),
}));

jest.mock("../../../../src/oauth/session-store", () => ({
  sessionStore: {
    storeDeviceFlow: jest.fn(),
    storeAuthCodeFlow: jest.fn(),
    getDeviceFlow: jest.fn(),
    deleteDeviceFlow: jest.fn(),
    storeAuthCode: jest.fn(),
    createSession: jest.fn(),
  },
}));

jest.mock("../../../../src/oauth/gitlab-device-flow", () => ({
  initiateDeviceFlow: jest.fn(),
  pollDeviceFlowOnce: jest.fn(),
  getGitLabUser: jest.fn(),
  buildGitLabAuthUrl: jest.fn(() => "https://gitlab.example.com/oauth/authorize?state=test"),
}));

jest.mock("../../../../src/oauth/token-utils", () => ({
  generateRandomString: jest.fn(() => "random-string-32-chars-long-here"),
  generateSessionId: jest.fn(() => "session-id-123"),
  generateAuthorizationCode: jest.fn(() => "auth-code-abc"),
  calculateTokenExpiry: jest.fn((seconds: number) => Date.now() + seconds * 1000),
}));

jest.mock("../../../../src/oauth/endpoints/metadata", () => ({
  getBaseUrl: jest.fn(() => "http://localhost:3333"),
}));

jest.mock("../../../../src/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../../../src/config", () => ({
  HOST: "localhost",
  PORT: 3333,
}));

import { loadOAuthConfig } from "../../../../src/oauth/config";
import { sessionStore } from "../../../../src/oauth/session-store";
import {
  initiateDeviceFlow,
  pollDeviceFlowOnce,
  getGitLabUser,
} from "../../../../src/oauth/gitlab-device-flow";

const mockLoadOAuthConfig = loadOAuthConfig as jest.MockedFunction<typeof loadOAuthConfig>;
const mockInitiateDeviceFlow = initiateDeviceFlow as jest.MockedFunction<typeof initiateDeviceFlow>;
const mockPollDeviceFlowOnce = pollDeviceFlowOnce as jest.MockedFunction<typeof pollDeviceFlowOnce>;
const mockGetGitLabUser = getGitLabUser as jest.MockedFunction<typeof getGitLabUser>;
const mockSessionStore = sessionStore as jest.Mocked<typeof sessionStore>;

describe("OAuth Authorization Endpoint", () => {
  const mockConfig = {
    enabled: true as const,
    sessionSecret: "a".repeat(32),
    gitlabClientId: "test-client-id",
    gitlabScopes: "api,read_user",
    tokenTtl: 3600,
    refreshTokenTtl: 604800,
    devicePollInterval: 5,
    deviceTimeout: 300,
  };

  // Helper to create mock request
  const createMockRequest = (query: Record<string, string | undefined> = {}): Partial<Request> => ({
    query,
    protocol: "http",
    get: jest.fn((header: string): string | undefined => {
      if (header === "host") return "localhost:3333";
      return undefined;
    }) as Request["get"],
  });

  // Helper to create mock response
  const createMockResponse = (): Partial<Response> => {
    const res: Partial<Response> = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadOAuthConfig.mockReturnValue(mockConfig);
  });

  describe("authorizeHandler", () => {
    it("should return 500 when OAuth is not configured", async () => {
      mockLoadOAuthConfig.mockReturnValue(null);

      const req = createMockRequest({
        response_type: "code",
        client_id: "test-client",
        code_challenge: "challenge",
        code_challenge_method: "S256",
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "server_error",
        error_description: "OAuth not configured",
      });
    });

    it("should return error for invalid response_type", async () => {
      const req = createMockRequest({
        response_type: "token", // Invalid - only "code" is supported
        client_id: "test-client",
        code_challenge: "challenge",
        code_challenge_method: "S256",
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "unsupported_response_type",
        error_description: 'Only "code" response type is supported',
      });
    });

    it("should return error when client_id is missing", async () => {
      const req = createMockRequest({
        response_type: "code",
        // client_id missing
        code_challenge: "challenge",
        code_challenge_method: "S256",
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "invalid_request",
        error_description: "client_id is required",
      });
    });

    it("should return error when code_challenge is missing", async () => {
      const req = createMockRequest({
        response_type: "code",
        client_id: "test-client",
        // code_challenge missing
        code_challenge_method: "S256",
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "invalid_request",
        error_description: "code_challenge is required (PKCE)",
      });
    });

    it("should return error when code_challenge_method is not S256", async () => {
      const req = createMockRequest({
        response_type: "code",
        client_id: "test-client",
        code_challenge: "challenge",
        code_challenge_method: "plain", // Invalid - only S256 is supported
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "invalid_request",
        error_description: 'code_challenge_method must be "S256"',
      });
    });

    it("should initiate device flow and return HTML when no redirect_uri", async () => {
      mockInitiateDeviceFlow.mockResolvedValue({
        device_code: "device-code-123",
        user_code: "ABCD-1234",
        verification_uri: "https://gitlab.example.com/oauth/authorize",
        verification_uri_complete: "https://gitlab.example.com/oauth/authorize?user_code=ABCD-1234",
        expires_in: 600,
        interval: 5,
      });

      const req = createMockRequest({
        response_type: "code",
        client_id: "test-client",
        code_challenge: "challenge-abc",
        code_challenge_method: "S256",
        // No redirect_uri - triggers Device Flow
        state: "csrf-state-123",
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      expect(mockInitiateDeviceFlow).toHaveBeenCalledWith(mockConfig);
      expect(mockSessionStore.storeDeviceFlow).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/html");
      expect(res.send).toHaveBeenCalled();

      // Verify HTML contains user code
      const htmlContent = (res.send as jest.Mock).mock.calls[0][0];
      expect(htmlContent).toContain("ABCD-1234");
    });

    it("should redirect to GitLab when redirect_uri is present (Authorization Code Flow)", async () => {
      const req = createMockRequest({
        response_type: "code",
        client_id: "test-client",
        code_challenge: "challenge-abc",
        code_challenge_method: "S256",
        redirect_uri: "https://callback.example.com",
        state: "csrf-state-123",
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      // Should NOT initiate device flow
      expect(mockInitiateDeviceFlow).not.toHaveBeenCalled();
      // Should store auth code flow state
      expect(mockSessionStore.storeAuthCodeFlow).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          clientId: "test-client",
          codeChallenge: "challenge-abc",
          codeChallengeMethod: "S256",
          clientState: "csrf-state-123",
          clientRedirectUri: "https://callback.example.com",
        })
      );
      // Should redirect to GitLab
      expect(res.redirect).toHaveBeenCalledWith(
        "https://gitlab.example.com/oauth/authorize?state=test"
      );
    });

    it("should store device flow state correctly when no redirect_uri", async () => {
      mockInitiateDeviceFlow.mockResolvedValue({
        device_code: "device-code-456",
        user_code: "EFGH-5678",
        verification_uri: "https://gitlab.example.com/oauth/authorize",
        expires_in: 600,
        interval: 5,
      });

      const req = createMockRequest({
        response_type: "code",
        client_id: "my-client-id",
        code_challenge: "my-challenge",
        code_challenge_method: "S256",
        // No redirect_uri - triggers Device Flow
        state: "my-state",
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      expect(mockSessionStore.storeDeviceFlow).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          deviceCode: "device-code-456",
          userCode: "EFGH-5678",
          clientId: "my-client-id",
          codeChallenge: "my-challenge",
          codeChallengeMethod: "S256",
          state: "my-state",
          redirectUri: undefined,
        })
      );
    });

    it("should handle device flow initiation failure", async () => {
      mockInitiateDeviceFlow.mockRejectedValue(new Error("GitLab unavailable"));

      const req = createMockRequest({
        response_type: "code",
        client_id: "test-client",
        code_challenge: "challenge",
        code_challenge_method: "S256",
      }) as Request;
      const res = createMockResponse() as Response;

      await authorizeHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "server_error",
        error_description: "Failed to initiate authentication",
      });
    });
  });

  describe("pollHandler", () => {
    it("should return 500 when OAuth is not configured", async () => {
      mockLoadOAuthConfig.mockReturnValue(null);

      const req = createMockRequest({ flow_state: "test-state" }) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "server_error" });
    });

    it("should return error when flow_state is missing", async () => {
      const req = createMockRequest({}) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: "failed",
        error: "Missing flow_state",
      });
    });

    it("should return expired when flow not found", async () => {
      mockSessionStore.getDeviceFlow.mockReturnValue(undefined);

      const req = createMockRequest({ flow_state: "unknown-state" }) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: "expired",
        error: "Flow not found",
      });
    });

    it("should return expired when device flow has expired", async () => {
      mockSessionStore.getDeviceFlow.mockReturnValue({
        deviceCode: "device-code",
        userCode: "USER-CODE",
        verificationUri: "https://gitlab.example.com/oauth/authorize",
        expiresAt: Date.now() - 1000, // Expired
        interval: 5,
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        state: "state",
      });

      const req = createMockRequest({ flow_state: "expired-flow" }) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      expect(mockSessionStore.deleteDeviceFlow).toHaveBeenCalledWith("expired-flow");
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: "expired",
        error: "Device code expired",
      });
    });

    it("should return pending when authorization not complete", async () => {
      mockSessionStore.getDeviceFlow.mockReturnValue({
        deviceCode: "device-code",
        userCode: "USER-CODE",
        verificationUri: "https://gitlab.example.com/oauth/authorize",
        expiresAt: Date.now() + 600000, // Not expired
        interval: 5,
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        state: "state",
      });
      mockPollDeviceFlowOnce.mockResolvedValue(null); // Still pending

      const req = createMockRequest({ flow_state: "pending-flow" }) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      expect(res.json).toHaveBeenCalledWith({ status: "pending" });
    });

    it("should return complete with auth code when authorization succeeds", async () => {
      mockSessionStore.getDeviceFlow.mockReturnValue({
        deviceCode: "device-code",
        userCode: "USER-CODE",
        verificationUri: "https://gitlab.example.com/oauth/authorize",
        expiresAt: Date.now() + 600000,
        interval: 5,
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        state: "csrf-state",
        redirectUri: "https://callback.example.com",
      });

      mockPollDeviceFlowOnce.mockResolvedValue({
        access_token: "gitlab-access-token",
        refresh_token: "gitlab-refresh-token",
        token_type: "Bearer",
        expires_in: 7200,
        created_at: Date.now(),
      });

      mockGetGitLabUser.mockResolvedValue({
        id: 12345,
        username: "testuser",
        name: "Test User",
        email: "test@example.com",
      });

      const req = createMockRequest({ flow_state: "success-flow" }) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      expect(mockGetGitLabUser).toHaveBeenCalledWith("gitlab-access-token");
      expect(mockSessionStore.storeAuthCode).toHaveBeenCalled();
      expect(mockSessionStore.createSession).toHaveBeenCalled();
      expect(mockSessionStore.deleteDeviceFlow).toHaveBeenCalledWith("success-flow");

      expect(res.json).toHaveBeenCalledWith({
        status: "complete",
        redirect_uri: "https://callback.example.com",
        code: "auth-code-abc",
        state: "csrf-state",
      });
    });

    it("should handle terminal errors from GitLab", async () => {
      mockSessionStore.getDeviceFlow.mockReturnValue({
        deviceCode: "device-code",
        userCode: "USER-CODE",
        verificationUri: "https://gitlab.example.com/oauth/authorize",
        expiresAt: Date.now() + 600000,
        interval: 5,
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        state: "state",
      });

      mockPollDeviceFlowOnce.mockRejectedValue(new Error("Authorization denied by user"));

      const req = createMockRequest({ flow_state: "denied-flow" }) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      expect(mockSessionStore.deleteDeviceFlow).toHaveBeenCalledWith("denied-flow");
      expect(res.json).toHaveBeenCalledWith({
        status: "failed",
        error: "Authorization denied by user",
      });
    });

    it("should treat transient errors as pending", async () => {
      mockSessionStore.getDeviceFlow.mockReturnValue({
        deviceCode: "device-code",
        userCode: "USER-CODE",
        verificationUri: "https://gitlab.example.com/oauth/authorize",
        expiresAt: Date.now() + 600000,
        interval: 5,
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        state: "state",
      });

      mockPollDeviceFlowOnce.mockRejectedValue(new Error("Network timeout"));

      const req = createMockRequest({ flow_state: "transient-error-flow" }) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      // Should NOT delete flow for transient errors
      expect(mockSessionStore.deleteDeviceFlow).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ status: "pending" });
    });

    it("should omit state from response when not provided", async () => {
      mockSessionStore.getDeviceFlow.mockReturnValue({
        deviceCode: "device-code",
        userCode: "USER-CODE",
        verificationUri: "https://gitlab.example.com/oauth/authorize",
        expiresAt: Date.now() + 600000,
        interval: 5,
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        state: "", // Empty state
        redirectUri: "https://callback.example.com",
      });

      mockPollDeviceFlowOnce.mockResolvedValue({
        access_token: "gitlab-access-token",
        refresh_token: "gitlab-refresh-token",
        token_type: "Bearer",
        expires_in: 7200,
        created_at: Date.now(),
      });

      mockGetGitLabUser.mockResolvedValue({
        id: 12345,
        username: "testuser",
        name: "Test User",
        email: "test@example.com",
      });

      const req = createMockRequest({ flow_state: "no-state-flow" }) as Request;
      const res = createMockResponse() as Response;

      await pollHandler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        status: "complete",
        redirect_uri: "https://callback.example.com",
        code: "auth-code-abc",
        state: undefined, // State should be undefined when empty
      });
    });
  });
});
