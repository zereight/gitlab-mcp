/**
 * Unit tests for OAuth token utilities
 * Tests JWT creation/verification, PKCE, and random string generation
 */

import {
  createJWT,
  verifyJWT,
  verifyMCPToken,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  generateRandomString,
  generateUUID,
  generateAuthorizationCode,
  generateSessionId,
  generateRefreshToken,
  isTokenExpiringSoon,
  calculateTokenExpiry,
} from "../../../src/oauth/token-utils";

describe("OAuth Token Utilities", () => {
  const testSecret = "test-secret-key-minimum-32-chars!!";

  describe("JWT Functions", () => {
    describe("createJWT", () => {
      it("should create a valid JWT string", () => {
        const payload = { sub: "user-123", name: "Test User" };
        const token = createJWT(payload, testSecret, 3600);

        expect(token).toBeDefined();
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3); // header.payload.signature
      });

      it("should include iat and exp claims", () => {
        const payload = { sub: "user-123" };
        const token = createJWT(payload, testSecret, 3600);

        const verified = verifyJWT(token, testSecret);
        expect(verified).not.toBeNull();
        expect(verified?.iat).toBeDefined();
        expect(verified?.exp).toBeDefined();
        expect(typeof verified?.iat).toBe("number");
        expect(typeof verified?.exp).toBe("number");
      });

      it("should set correct expiration time", () => {
        const payload = { sub: "user-123" };
        const expiresIn = 3600;
        const beforeCreate = Math.floor(Date.now() / 1000);

        const token = createJWT(payload, testSecret, expiresIn);
        const verified = verifyJWT(token, testSecret);

        const afterCreate = Math.floor(Date.now() / 1000);

        expect(verified?.exp).toBeGreaterThanOrEqual(beforeCreate + expiresIn);
        expect(verified?.exp).toBeLessThanOrEqual(afterCreate + expiresIn + 1);
      });

      it("should preserve custom payload fields", () => {
        const payload = {
          sub: "user-123",
          sid: "session-456",
          scope: "api read_user",
          custom_field: "custom_value",
        };

        const token = createJWT(payload, testSecret, 3600);
        const verified = verifyJWT(token, testSecret);

        expect(verified?.sub).toBe("user-123");
        expect(verified?.sid).toBe("session-456");
        expect(verified?.scope).toBe("api read_user");
        expect(verified?.custom_field).toBe("custom_value");
      });
    });

    describe("verifyJWT", () => {
      it("should verify a valid token", () => {
        const payload = { sub: "user-123" };
        const token = createJWT(payload, testSecret, 3600);

        const verified = verifyJWT(token, testSecret);
        expect(verified).not.toBeNull();
        expect(verified?.sub).toBe("user-123");
      });

      it("should return null for invalid signature", () => {
        const payload = { sub: "user-123" };
        const token = createJWT(payload, testSecret, 3600);

        const verified = verifyJWT(token, "wrong-secret-key-minimum-32-chars!!");
        expect(verified).toBeNull();
      });

      it("should return null for malformed token", () => {
        expect(verifyJWT("not-a-valid-jwt", testSecret)).toBeNull();
        expect(verifyJWT("only.two.parts.here.extra", testSecret)).toBeNull();
        expect(verifyJWT("", testSecret)).toBeNull();
      });

      it("should return null for expired token", () => {
        const payload = { sub: "user-123" };
        // Create token that expired 1 second ago
        const token = createJWT(payload, testSecret, -1);

        const verified = verifyJWT(token, testSecret);
        expect(verified).toBeNull();
      });
    });

    describe("verifyMCPToken", () => {
      it("should verify valid MCP token and return payload with all fields", () => {
        const payload = {
          iss: "http://localhost:3333",
          sub: "user-123",
          aud: "test-client",
          sid: "session-456",
          scope: "mcp:tools mcp:resources",
          gitlab_user: "testuser",
        };
        const token = createJWT(payload, testSecret, 3600);

        const result = verifyMCPToken(token, testSecret);
        expect(result).not.toBeNull();
        expect(result?.sid).toBe("session-456");
        expect(result?.sub).toBe("user-123");
        expect(result?.gitlab_user).toBe("testuser");
      });

      it("should return null for token without sid", () => {
        const payload = {
          iss: "http://localhost:3333",
          sub: "user-123",
          aud: "test-client",
          // sid missing
          scope: "mcp:tools",
          gitlab_user: "testuser",
        };
        const token = createJWT(payload, testSecret, 3600);

        const result = verifyMCPToken(token, testSecret);
        expect(result).toBeNull();
      });

      it("should return null for token without required fields", () => {
        const payload = { sub: "user-123" }; // Missing most required fields
        const token = createJWT(payload, testSecret, 3600);

        const result = verifyMCPToken(token, testSecret);
        expect(result).toBeNull();
      });

      it("should return null for invalid token", () => {
        const result = verifyMCPToken("invalid-token", testSecret);
        expect(result).toBeNull();
      });
    });
  });

  describe("PKCE Functions", () => {
    describe("generateCodeVerifier", () => {
      it("should generate a random code verifier", () => {
        const verifier = generateCodeVerifier();

        expect(verifier).toBeDefined();
        expect(typeof verifier).toBe("string");
        expect(verifier.length).toBeGreaterThan(0);
      });

      it("should generate unique verifiers", () => {
        const verifier1 = generateCodeVerifier();
        const verifier2 = generateCodeVerifier();

        expect(verifier1).not.toBe(verifier2);
      });

      it("should be URL-safe (base64url encoded)", () => {
        const verifier = generateCodeVerifier();

        // base64url should not contain + or /
        expect(verifier).not.toMatch(/[+/]/);
      });
    });

    describe("generateCodeChallenge", () => {
      it("should generate a code challenge from verifier", () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);

        expect(challenge).toBeDefined();
        expect(typeof challenge).toBe("string");
        expect(challenge.length).toBeGreaterThan(0);
      });

      it("should generate consistent challenge for same verifier", () => {
        const verifier = "test-verifier-string";
        const challenge1 = generateCodeChallenge(verifier);
        const challenge2 = generateCodeChallenge(verifier);

        expect(challenge1).toBe(challenge2);
      });

      it("should generate different challenges for different verifiers", () => {
        const challenge1 = generateCodeChallenge("verifier-1");
        const challenge2 = generateCodeChallenge("verifier-2");

        expect(challenge1).not.toBe(challenge2);
      });
    });

    describe("verifyCodeChallenge", () => {
      it("should verify matching verifier and challenge with S256", () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);

        const result = verifyCodeChallenge(verifier, challenge, "S256");
        expect(result).toBe(true);
      });

      it("should reject non-matching verifier", () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);

        const result = verifyCodeChallenge("wrong-verifier", challenge, "S256");
        expect(result).toBe(false);
      });

      it("should reject non-S256 method", () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);

        const result = verifyCodeChallenge(verifier, challenge, "plain");
        expect(result).toBe(false);
      });
    });
  });

  describe("Random String Generation", () => {
    describe("generateRandomString", () => {
      it("should generate string of specified length", () => {
        const str16 = generateRandomString(16);
        const str32 = generateRandomString(32);
        const str64 = generateRandomString(64);

        expect(str16.length).toBe(16);
        expect(str32.length).toBe(32);
        expect(str64.length).toBe(64);
      });

      it("should generate unique strings", () => {
        const str1 = generateRandomString(32);
        const str2 = generateRandomString(32);

        expect(str1).not.toBe(str2);
      });

      it("should default to 32 characters", () => {
        const str = generateRandomString();
        expect(str.length).toBe(32);
      });
    });

    describe("generateUUID", () => {
      it("should generate a valid UUID format", () => {
        const uuid = generateUUID();

        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it("should generate unique UUIDs", () => {
        const uuid1 = generateUUID();
        const uuid2 = generateUUID();

        expect(uuid1).not.toBe(uuid2);
      });
    });

    describe("generateAuthorizationCode", () => {
      it("should generate a 32-character code", () => {
        const code = generateAuthorizationCode();

        expect(code).toBeDefined();
        expect(code.length).toBe(32);
      });

      it("should generate unique codes", () => {
        const code1 = generateAuthorizationCode();
        const code2 = generateAuthorizationCode();

        expect(code1).not.toBe(code2);
      });
    });

    describe("generateSessionId", () => {
      it("should generate a valid UUID", () => {
        const sessionId = generateSessionId();

        expect(sessionId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      });
    });

    describe("generateRefreshToken", () => {
      it("should generate a 64-character token", () => {
        const token = generateRefreshToken();

        expect(token).toBeDefined();
        expect(token.length).toBe(64);
      });
    });
  });

  describe("Token Expiration Utilities", () => {
    describe("isTokenExpiringSoon", () => {
      it("should return true for token expiring within 5 minutes", () => {
        const now = Date.now();
        const expiresIn4Minutes = now + 4 * 60 * 1000;

        expect(isTokenExpiringSoon(expiresIn4Minutes)).toBe(true);
      });

      it("should return false for token not expiring soon", () => {
        const now = Date.now();
        const expiresIn10Minutes = now + 10 * 60 * 1000;

        expect(isTokenExpiringSoon(expiresIn10Minutes)).toBe(false);
      });

      it("should return true for already expired token", () => {
        const now = Date.now();
        const expiredToken = now - 1000;

        expect(isTokenExpiringSoon(expiredToken)).toBe(true);
      });
    });

    describe("calculateTokenExpiry", () => {
      it("should calculate expiry timestamp from seconds", () => {
        const now = Date.now();
        const expiresInSeconds = 3600;

        const expiry = calculateTokenExpiry(expiresInSeconds);

        // Should be approximately now + 3600 * 1000 (within 1 second tolerance)
        expect(expiry).toBeGreaterThanOrEqual(now + expiresInSeconds * 1000 - 1000);
        expect(expiry).toBeLessThanOrEqual(now + expiresInSeconds * 1000 + 1000);
      });
    });
  });
});
