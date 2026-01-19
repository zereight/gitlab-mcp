/**
 * OAuth Authentication Middleware Unit Tests
 */

import { Request, Response, NextFunction } from "express";

// Mock the dependencies before importing the module
const mockLoadOAuthConfig = jest.fn();
const mockVerifyMCPToken = jest.fn();
const mockIsTokenExpiringSoon = jest.fn();
const mockCalculateTokenExpiry = jest.fn();
const mockRefreshGitLabToken = jest.fn();
const mockGetBaseUrl = jest.fn();

// Mock sessionStore as an object with methods
const mockSessionStore = {
  getSession: jest.fn(),
  updateSession: jest.fn(),
};

jest.mock("../../../src/oauth/config", () => ({
  loadOAuthConfig: mockLoadOAuthConfig,
}));

jest.mock("../../../src/oauth/session-store", () => ({
  sessionStore: mockSessionStore,
}));

jest.mock("../../../src/oauth/token-utils", () => ({
  verifyMCPToken: mockVerifyMCPToken,
  isTokenExpiringSoon: mockIsTokenExpiringSoon,
  calculateTokenExpiry: mockCalculateTokenExpiry,
}));

jest.mock("../../../src/oauth/gitlab-device-flow", () => ({
  refreshGitLabToken: mockRefreshGitLabToken,
}));

jest.mock("../../../src/oauth/endpoints/metadata", () => ({
  getBaseUrl: mockGetBaseUrl,
}));

jest.mock("../../../src/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Now import the module under test
import {
  oauthAuthMiddleware,
  createOAuthMiddleware,
  optionalOAuthMiddleware,
} from "../../../src/middleware/oauth-auth";

// Helper to create mock request
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: "/mcp/message",
    method: "POST",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

// Helper to create mock response
function createMockRes(): Response {
  const res = {
    locals: {},
    setHeader: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe("OAuth Authentication Middleware", () => {
  let mockNext: NextFunction;

  const mockConfig = {
    sessionSecret: "test-session-secret-12345678901234567890",
    clientId: "test-client-id",
    apiUrl: "https://gitlab.example.com",
  };

  const mockPayload = {
    iss: "https://mcp.example.com",
    sub: "12345",
    aud: "test-client-id",
    sid: "session-123",
    scope: "api read_user",
    gitlab_user: "testuser",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const mockSession = {
    id: "session-123",
    mcpAccessToken: "valid-mcp-token",
    mcpRefreshToken: "mcp-refresh-token",
    mcpTokenExpiry: Date.now() + 3600000,
    gitlabAccessToken: "gitlab-access-token",
    gitlabRefreshToken: "gitlab-refresh-token",
    gitlabTokenExpiry: Date.now() + 7200000,
    gitlabUserId: 12345,
    gitlabUsername: "testuser",
    clientId: "test-client-id",
    scopes: ["api", "read_user"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext = jest.fn();
    mockLoadOAuthConfig.mockReturnValue(mockConfig);
    mockGetBaseUrl.mockReturnValue("https://mcp.example.com");
    mockVerifyMCPToken.mockReturnValue(mockPayload);
    mockSessionStore.getSession.mockReturnValue(mockSession);
    mockIsTokenExpiringSoon.mockReturnValue(false);
  });

  describe("oauthAuthMiddleware", () => {
    describe("when OAuth is not configured", () => {
      it("should return 401 when OAuth config is not available", async () => {
        mockLoadOAuthConfig.mockReturnValue(null);
        const req = createMockReq({ headers: { authorization: "Bearer token" } });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "server_error",
          error_description: "OAuth not configured",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe("when Authorization header is missing or invalid", () => {
      it("should return 401 when Authorization header is missing", async () => {
        const req = createMockReq({ headers: {} });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "unauthorized",
          error_description: "Missing Authorization header",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("should return 401 when Authorization header does not start with Bearer", async () => {
        const req = createMockReq({
          headers: { authorization: "Basic dXNlcjpwYXNz" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "unauthorized",
          error_description: "Invalid Authorization header format. Expected: Bearer <token>",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("should return 401 when Bearer token is empty", async () => {
        const req = createMockReq({
          headers: { authorization: "Bearer " },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "unauthorized",
          error_description: "Empty Bearer token",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe("when token validation fails", () => {
      it("should return 401 when token is invalid", async () => {
        mockVerifyMCPToken.mockReturnValue(null);
        const req = createMockReq({
          headers: { authorization: "Bearer invalid-token" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "invalid_token",
          error_description: "Token is invalid or expired",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("should return 401 when session is not found", async () => {
        mockSessionStore.getSession.mockReturnValue(undefined);
        const req = createMockReq({
          headers: { authorization: "Bearer valid-mcp-token" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "invalid_token",
          error_description: "Session not found or expired",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("should return 401 when token does not match session", async () => {
        mockSessionStore.getSession.mockReturnValue({
          ...mockSession,
          mcpAccessToken: "different-token",
        });
        const req = createMockReq({
          headers: { authorization: "Bearer valid-mcp-token" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "invalid_token",
          error_description: "Token has been superseded",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe("when token is valid", () => {
      it("should call next() and set res.locals for valid token", async () => {
        const req = createMockReq({
          headers: { authorization: "Bearer valid-mcp-token" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBe("session-123");
        expect(res.locals.gitlabToken).toBe("gitlab-access-token");
        expect(res.locals.gitlabUserId).toBe(12345);
        expect(res.locals.gitlabUsername).toBe("testuser");
      });

      it("should set WWW-Authenticate header on unauthorized responses", async () => {
        mockLoadOAuthConfig.mockReturnValue(null);
        const req = createMockReq({
          headers: { authorization: "Bearer token" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.setHeader).toHaveBeenCalledWith(
          "WWW-Authenticate",
          expect.stringContaining('Bearer realm="gitlab-mcp"')
        );
        expect(res.setHeader).toHaveBeenCalledWith(
          "WWW-Authenticate",
          expect.stringContaining("resource_metadata=")
        );
      });
    });

    describe("when GitLab token needs refresh", () => {
      it("should refresh GitLab token when expiring soon", async () => {
        mockIsTokenExpiringSoon.mockReturnValue(true);
        mockRefreshGitLabToken.mockResolvedValue({
          access_token: "new-gitlab-token",
          refresh_token: "new-gitlab-refresh",
          expires_in: 7200,
        });
        mockCalculateTokenExpiry.mockReturnValue(Date.now() + 7200000);

        const req = createMockReq({
          headers: { authorization: "Bearer valid-mcp-token" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(mockRefreshGitLabToken).toHaveBeenCalledWith("gitlab-refresh-token", mockConfig);
        expect(mockSessionStore.updateSession).toHaveBeenCalledWith(
          "session-123",
          expect.objectContaining({
            gitlabAccessToken: "new-gitlab-token",
            gitlabRefreshToken: "new-gitlab-refresh",
          })
        );
        expect(mockNext).toHaveBeenCalled();
      });

      it("should return 401 when GitLab token refresh fails", async () => {
        mockIsTokenExpiringSoon.mockReturnValue(true);
        mockRefreshGitLabToken.mockRejectedValue(new Error("Refresh failed"));

        const req = createMockReq({
          headers: { authorization: "Bearer valid-mcp-token" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "invalid_token",
          error_description: "GitLab token refresh failed. Please re-authenticate.",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("should return 401 when session is lost during token refresh", async () => {
        mockIsTokenExpiringSoon.mockReturnValue(true);
        mockRefreshGitLabToken.mockResolvedValue({
          access_token: "new-token",
          refresh_token: "new-refresh",
          expires_in: 7200,
        });

        // First call returns session, second call (after refresh) returns undefined
        mockSessionStore.getSession.mockReturnValueOnce(mockSession).mockReturnValueOnce(undefined);

        const req = createMockReq({
          headers: { authorization: "Bearer valid-mcp-token" },
        });
        const res = createMockRes();

        await oauthAuthMiddleware(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: "invalid_token",
          error_description: "Session lost during token refresh",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe("createOAuthMiddleware", () => {
    it("should return the oauthAuthMiddleware function", () => {
      const middleware = createOAuthMiddleware();
      expect(middleware).toBe(oauthAuthMiddleware);
    });
  });

  describe("optionalOAuthMiddleware", () => {
    describe("when OAuth is not configured", () => {
      it("should call next() when OAuth is not configured", async () => {
        mockLoadOAuthConfig.mockReturnValue(null);
        const req = createMockReq();
        const res = createMockRes();

        await optionalOAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBeUndefined();
      });
    });

    describe("when no Authorization header is provided", () => {
      it("should call next() without setting locals", async () => {
        const req = createMockReq({ headers: {} });
        const res = createMockRes();

        await optionalOAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBeUndefined();
      });

      it("should call next() when Authorization header is not Bearer", async () => {
        const req = createMockReq({ headers: { authorization: "Basic xxx" } });
        const res = createMockRes();

        await optionalOAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBeUndefined();
      });

      it("should call next() when Bearer token is empty", async () => {
        const req = createMockReq({ headers: { authorization: "Bearer " } });
        const res = createMockRes();

        await optionalOAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBeUndefined();
      });
    });

    describe("when token validation fails", () => {
      it("should call next() when token is invalid", async () => {
        mockVerifyMCPToken.mockReturnValue(null);
        const req = createMockReq({
          headers: { authorization: "Bearer invalid-token" },
        });
        const res = createMockRes();

        await optionalOAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBeUndefined();
      });

      it("should call next() when session is not found", async () => {
        mockSessionStore.getSession.mockReturnValue(undefined);
        const req = createMockReq({
          headers: { authorization: "Bearer valid-token" },
        });
        const res = createMockRes();

        await optionalOAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBeUndefined();
      });

      it("should call next() when token does not match session", async () => {
        mockSessionStore.getSession.mockReturnValue({
          ...mockSession,
          mcpAccessToken: "different-token",
        });
        const req = createMockReq({
          headers: { authorization: "Bearer valid-token" },
        });
        const res = createMockRes();

        await optionalOAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBeUndefined();
      });
    });

    describe("when token is valid", () => {
      it("should call next() and set res.locals for valid token", async () => {
        const req = createMockReq({
          headers: { authorization: "Bearer valid-mcp-token" },
        });
        const res = createMockRes();

        await optionalOAuthMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.locals.oauthSessionId).toBe("session-123");
        expect(res.locals.gitlabToken).toBe("gitlab-access-token");
        expect(res.locals.gitlabUserId).toBe(12345);
        expect(res.locals.gitlabUsername).toBe("testuser");
      });
    });
  });
});
