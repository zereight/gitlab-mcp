/**
 * Unit tests for OAuth metadata endpoint
 * Tests the /.well-known/oauth-authorization-server endpoint
 */

import { Request, Response } from 'express';
import { metadataHandler, healthHandler, getBaseUrl } from '../../../../src/oauth/endpoints/metadata';

// Mock config
jest.mock('../../../../src/config', () => ({
  HOST: 'localhost',
  PORT: 3333,
}));

describe('OAuth Metadata Endpoint', () => {
  // Helper to create mock request
  const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
    protocol: 'http',
    get: jest.fn((header: string): string | undefined => {
      if (header === 'host') return 'localhost:3333';
      return undefined;
    }) as Request['get'],
    ...overrides,
  });

  // Helper to create mock response
  const createMockResponse = (): Partial<Response> => {
    const res: Partial<Response> = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    return res;
  };

  describe('getBaseUrl', () => {
    it('should return base URL from request', () => {
      const req = createMockRequest() as Request;
      const baseUrl = getBaseUrl(req);
      expect(baseUrl).toBe('http://localhost:3333');
    });

    it('should use X-Forwarded-Proto header when present', () => {
      const req = createMockRequest({
        get: jest.fn((header: string): string | undefined => {
          if (header === 'x-forwarded-proto') return 'https';
          if (header === 'host') return 'localhost:3333';
          return undefined;
        }) as Request['get'],
      }) as Request;

      const baseUrl = getBaseUrl(req);
      expect(baseUrl).toBe('https://localhost:3333');
    });

    it('should use X-Forwarded-Host header when present', () => {
      const req = createMockRequest({
        get: jest.fn((header: string): string | undefined => {
          if (header === 'x-forwarded-proto') return 'https';
          if (header === 'x-forwarded-host') return 'example.com';
          if (header === 'host') return 'localhost:3333';
          return undefined;
        }) as Request['get'],
      }) as Request;

      const baseUrl = getBaseUrl(req);
      expect(baseUrl).toBe('https://example.com');
    });

    it('should use config defaults when headers are missing', () => {
      const req = createMockRequest({
        protocol: 'http',
        get: jest.fn(() => undefined),
      }) as Request;

      const baseUrl = getBaseUrl(req);
      expect(baseUrl).toBe('http://localhost:3333');
    });

    it('should handle reverse proxy scenario', () => {
      const req = createMockRequest({
        protocol: 'http', // Original is HTTP
        get: jest.fn((header: string): string | undefined => {
          if (header === 'x-forwarded-proto') return 'https'; // But proxy says HTTPS
          if (header === 'x-forwarded-host') return 'api.example.com';
          return undefined;
        }) as Request['get'],
      }) as Request;

      const baseUrl = getBaseUrl(req);
      expect(baseUrl).toBe('https://api.example.com');
    });
  });

  describe('metadataHandler', () => {
    it('should return OAuth metadata JSON', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      expect(res.json).toHaveBeenCalledTimes(1);
      const metadata = (res.json as jest.Mock).mock.calls[0][0];

      expect(metadata.issuer).toBe('http://localhost:3333');
      expect(metadata.authorization_endpoint).toBe('http://localhost:3333/authorize');
      expect(metadata.token_endpoint).toBe('http://localhost:3333/token');
    });

    it('should include required OAuth 2.0 fields', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      const metadata = (res.json as jest.Mock).mock.calls[0][0];

      // Required fields per RFC 8414
      expect(metadata.issuer).toBeDefined();
      expect(metadata.authorization_endpoint).toBeDefined();
      expect(metadata.token_endpoint).toBeDefined();
    });

    it('should include supported response types', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      const metadata = (res.json as jest.Mock).mock.calls[0][0];
      expect(metadata.response_types_supported).toEqual(['code']);
    });

    it('should include supported grant types', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      const metadata = (res.json as jest.Mock).mock.calls[0][0];
      expect(metadata.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    });

    it('should include PKCE code challenge methods', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      const metadata = (res.json as jest.Mock).mock.calls[0][0];
      expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    });

    it('should include token endpoint auth methods', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      const metadata = (res.json as jest.Mock).mock.calls[0][0];
      expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none']);
    });

    it('should include supported scopes', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      const metadata = (res.json as jest.Mock).mock.calls[0][0];
      expect(metadata.scopes_supported).toEqual(['mcp:tools', 'mcp:resources']);
    });

    it('should include MCP version', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      const metadata = (res.json as jest.Mock).mock.calls[0][0];
      expect(metadata.mcp_version).toBe('2025-03-26');
    });

    it('should adapt to forwarded headers', () => {
      const req = createMockRequest({
        get: jest.fn((header: string): string | undefined => {
          if (header === 'x-forwarded-proto') return 'https';
          if (header === 'x-forwarded-host') return 'mcp.example.com';
          return undefined;
        }) as Request['get'],
      }) as Request;
      const res = createMockResponse() as Response;

      metadataHandler(req, res);

      const metadata = (res.json as jest.Mock).mock.calls[0][0];
      expect(metadata.issuer).toBe('https://mcp.example.com');
      expect(metadata.authorization_endpoint).toBe('https://mcp.example.com/authorize');
      expect(metadata.token_endpoint).toBe('https://mcp.example.com/token');
    });
  });

  describe('healthHandler', () => {
    it('should return health status JSON', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      healthHandler(req, res);

      expect(res.json).toHaveBeenCalledTimes(1);
      const health = (res.json as jest.Mock).mock.calls[0][0];

      expect(health.status).toBe('ok');
      expect(health.mode).toBe('oauth');
      expect(health.timestamp).toBeDefined();
    });

    it('should return valid ISO timestamp', () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      const beforeCall = new Date().toISOString();
      healthHandler(req, res);
      const afterCall = new Date().toISOString();

      const health = (res.json as jest.Mock).mock.calls[0][0];
      expect(health.timestamp >= beforeCall).toBe(true);
      expect(health.timestamp <= afterCall).toBe(true);
    });
  });
});
