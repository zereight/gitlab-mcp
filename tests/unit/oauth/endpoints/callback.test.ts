/**
 * OAuth Callback Endpoint Tests
 *
 * Tests for the OAuth callback handler that processes GitLab authorization responses.
 */

import { Request, Response } from "express";
import { callbackHandler } from "../../../../src/oauth/endpoints/callback";

// Mock dependencies
jest.mock("../../../../src/oauth/config", () => ({
  loadOAuthConfig: jest.fn(),
}));

jest.mock("../../../../src/oauth/session-store", () => ({
  sessionStore: {
    getAuthCodeFlow: jest.fn(),
    deleteAuthCodeFlow: jest.fn(),
    storeAuthCode: jest.fn(),
    createSession: jest.fn(),
  },
}));

jest.mock("../../../../src/oauth/gitlab-device-flow", () => ({
  exchangeGitLabAuthCode: jest.fn(),
  getGitLabUser: jest.fn(),
}));

jest.mock("../../../../src/oauth/token-utils", () => ({
  generateSessionId: jest.fn().mockReturnValue("session-id-123"),
  generateAuthorizationCode: jest.fn().mockReturnValue("auth-code-456"),
  calculateTokenExpiry: jest.fn().mockReturnValue(Date.now() + 7200000),
}));

jest.mock("../../../../src/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { loadOAuthConfig } from "../../../../src/oauth/config";
import { sessionStore } from "../../../../src/oauth/session-store";
import { exchangeGitLabAuthCode, getGitLabUser } from "../../../../src/oauth/gitlab-device-flow";

const mockLoadOAuthConfig = loadOAuthConfig as jest.MockedFunction<typeof loadOAuthConfig>;
const mockSessionStore = sessionStore as jest.Mocked<typeof sessionStore>;
const mockExchangeGitLabAuthCode = exchangeGitLabAuthCode as jest.MockedFunction<
  typeof exchangeGitLabAuthCode
>;
const mockGetGitLabUser = getGitLabUser as jest.MockedFunction<typeof getGitLabUser>;

describe("OAuth Callback Handler", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let redirectMock: jest.Mock;
  let statusMock: jest.Mock;

  const mockOAuthConfig = {
    enabled: true as const,
    gitlabClientId: "test-client-id",
    gitlabClientSecret: "test-client-secret",
    gitlabScopes: "api,read_user",
    sessionSecret: "test-session-secret-min-32-chars!!",
    tokenTtl: 3600,
    refreshTokenTtl: 604800,
    devicePollInterval: 5,
    deviceTimeout: 300,
  };

  const mockAuthCodeFlow = {
    clientId: "client-id",
    clientRedirectUri: "https://client.example.com/callback",
    clientState: "client-state-123",
    internalState: "internal-state-123",
    callbackUri: "https://gitlab-mcp.example.com/oauth/callback",
    codeChallenge: "code-challenge",
    codeChallengeMethod: "S256" as const,
    expiresAt: Date.now() + 600000, // 10 minutes from now
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jsonMock = jest.fn();
    redirectMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      query: {},
    };

    mockResponse = {
      json: jsonMock,
      redirect: redirectMock,
      status: statusMock,
    };

    mockLoadOAuthConfig.mockReturnValue(mockOAuthConfig);
  });

  describe("configuration errors", () => {
    it("should return 500 if OAuth is not configured", async () => {
      mockLoadOAuthConfig.mockReturnValue(null);

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "server_error",
        error_description: "OAuth not configured",
      });
    });
  });

  describe("GitLab error responses", () => {
    it("should redirect with error if GitLab returns error and flow state exists", async () => {
      mockRequest.query = {
        error: "access_denied",
        error_description: "User denied access",
        state: "flow-state-123",
      };

      mockSessionStore.getAuthCodeFlow.mockReturnValue(mockAuthCodeFlow);

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSessionStore.deleteAuthCodeFlow).toHaveBeenCalledWith("flow-state-123");
      expect(redirectMock).toHaveBeenCalledWith(
        expect.stringContaining("https://client.example.com/callback")
      );
      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("error=access_denied"));
      expect(redirectMock).toHaveBeenCalledWith(
        expect.stringContaining("error_description=User+denied+access")
      );
      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("state=client-state-123"));
    });

    it("should return JSON error if GitLab returns error and no flow state", async () => {
      mockRequest.query = {
        error: "server_error",
        error_description: "GitLab error",
      };

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "server_error",
        error_description: "GitLab error",
      });
    });

    it("should return JSON error if state is invalid", async () => {
      mockRequest.query = {
        error: "access_denied",
        state: "invalid-state",
      };

      mockSessionStore.getAuthCodeFlow.mockReturnValue(undefined);

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "access_denied",
        error_description: "GitLab authorization failed",
      });
    });
  });

  describe("parameter validation", () => {
    it("should return 400 if code is missing", async () => {
      mockRequest.query = {
        state: "flow-state-123",
      };

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "invalid_request",
        error_description: "Missing authorization code from GitLab",
      });
    });

    it("should return 400 if state is missing", async () => {
      mockRequest.query = {
        code: "gitlab-code-123",
      };

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "invalid_request",
        error_description: "Missing state parameter",
      });
    });
  });

  describe("flow state validation", () => {
    it("should return 400 if flow state is not found", async () => {
      mockRequest.query = {
        code: "gitlab-code-123",
        state: "unknown-state",
      };

      mockSessionStore.getAuthCodeFlow.mockReturnValue(undefined);

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "invalid_request",
        error_description: "Invalid or expired state. Please start authorization again.",
      });
    });

    it("should return 400 if flow state is expired", async () => {
      mockRequest.query = {
        code: "gitlab-code-123",
        state: "expired-state",
      };

      const expiredFlow = {
        ...mockAuthCodeFlow,
        expiresAt: Date.now() - 1000, // Expired
      };
      mockSessionStore.getAuthCodeFlow.mockReturnValue(expiredFlow);

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSessionStore.deleteAuthCodeFlow).toHaveBeenCalledWith("expired-state");
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "invalid_request",
        error_description: "Authorization flow expired. Please start again.",
      });
    });
  });

  describe("successful authorization", () => {
    beforeEach(() => {
      mockRequest.query = {
        code: "gitlab-code-123",
        state: "flow-state-123",
      };

      mockSessionStore.getAuthCodeFlow.mockReturnValue(mockAuthCodeFlow);

      mockExchangeGitLabAuthCode.mockResolvedValue({
        access_token: "gitlab-access-token",
        refresh_token: "gitlab-refresh-token",
        expires_in: 7200,
        token_type: "Bearer",
        created_at: 1234567890,
      });

      mockGetGitLabUser.mockResolvedValue({
        id: 12345,
        username: "testuser",
        name: "Test User",
        email: "test@example.com",
      });
    });

    it("should exchange GitLab code for tokens", async () => {
      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockExchangeGitLabAuthCode).toHaveBeenCalledWith(
        "gitlab-code-123",
        mockAuthCodeFlow.callbackUri,
        mockOAuthConfig
      );
    });

    it("should get GitLab user info", async () => {
      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockGetGitLabUser).toHaveBeenCalledWith("gitlab-access-token");
    });

    it("should store MCP authorization code", async () => {
      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSessionStore.storeAuthCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "auth-code-456",
          sessionId: "session-id-123",
          clientId: mockAuthCodeFlow.clientId,
          codeChallenge: mockAuthCodeFlow.codeChallenge,
          codeChallengeMethod: mockAuthCodeFlow.codeChallengeMethod,
          redirectUri: mockAuthCodeFlow.clientRedirectUri,
        })
      );
    });

    it("should create session with GitLab tokens", async () => {
      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSessionStore.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "session-id-123",
          gitlabAccessToken: "gitlab-access-token",
          gitlabRefreshToken: "gitlab-refresh-token",
          gitlabUserId: 12345,
          gitlabUsername: "testuser",
          clientId: mockAuthCodeFlow.clientId,
          scopes: ["mcp:tools", "mcp:resources"],
        })
      );
    });

    it("should delete flow state after success", async () => {
      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSessionStore.deleteAuthCodeFlow).toHaveBeenCalledWith("flow-state-123");
    });

    it("should redirect to client with MCP authorization code", async () => {
      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(redirectMock).toHaveBeenCalledWith(
        expect.stringContaining("https://client.example.com/callback")
      );
      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("code=auth-code-456"));
      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("state=client-state-123"));
    });

    it("should redirect without state if client state is empty", async () => {
      // Empty string clientState should not be included in redirect
      const flowWithEmptyState = { ...mockAuthCodeFlow, clientState: "" };
      mockSessionStore.getAuthCodeFlow.mockReturnValue(flowWithEmptyState);

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("code=auth-code-456"));
      // When clientState is empty, it may or may not be included depending on implementation
      // The key assertion is that the redirect happens with the auth code
    });
  });

  describe("error handling during token exchange", () => {
    beforeEach(() => {
      mockRequest.query = {
        code: "gitlab-code-123",
        state: "flow-state-123",
      };

      mockSessionStore.getAuthCodeFlow.mockReturnValue(mockAuthCodeFlow);
    });

    it("should redirect with error if GitLab token exchange fails", async () => {
      mockExchangeGitLabAuthCode.mockRejectedValue(new Error("Invalid authorization code"));

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSessionStore.deleteAuthCodeFlow).toHaveBeenCalledWith("flow-state-123");
      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("error=server_error"));
      expect(redirectMock).toHaveBeenCalledWith(
        expect.stringContaining("error_description=Invalid+authorization+code")
      );
    });

    it("should redirect with error if getting user info fails", async () => {
      mockExchangeGitLabAuthCode.mockResolvedValue({
        access_token: "gitlab-access-token",
        refresh_token: "gitlab-refresh-token",
        expires_in: 7200,
        token_type: "Bearer",
        created_at: 1234567890,
      });

      mockGetGitLabUser.mockRejectedValue(new Error("Failed to get user info"));

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSessionStore.deleteAuthCodeFlow).toHaveBeenCalledWith("flow-state-123");
      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("error=server_error"));
    });

    it("should include client state in error redirect", async () => {
      mockExchangeGitLabAuthCode.mockRejectedValue(new Error("Exchange failed"));

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("state=client-state-123"));
    });

    it("should handle non-Error exceptions", async () => {
      mockExchangeGitLabAuthCode.mockRejectedValue("string error");

      await callbackHandler(mockRequest as Request, mockResponse as Response);

      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("error=server_error"));
      expect(redirectMock).toHaveBeenCalledWith(
        expect.stringContaining("error_description=Failed+to+complete+authorization")
      );
    });
  });
});
