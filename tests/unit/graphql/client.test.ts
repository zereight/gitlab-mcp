/**
 * Unit tests for GraphQLClient
 * Tests GraphQL request handling, error management, and authentication
 */

// Mock the utils/fetch module
jest.mock("../../../src/utils/fetch");

// Mock the http-client module
jest.mock("../../../src/http-client", () => ({
  DEFAULT_HEADERS: {
    "User-Agent": "GitLab MCP Server",
    Accept: "application/json",
  },
}));

import { GraphQLClient } from "../../../src/graphql/client";
import { gql } from "graphql-tag";
import { enhancedFetch } from "../../../src/utils/fetch";

const mockEnhancedFetch = enhancedFetch as jest.MockedFunction<typeof enhancedFetch>;

describe("GraphQLClient", () => {
  let client: GraphQLClient;

  const testQuery = gql`
    query TestQuery($id: ID!) {
      project(fullPath: $id) {
        id
        name
      }
    }
  `;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnhancedFetch.mockClear();
    client = new GraphQLClient("https://gitlab.example.com/api/graphql", {
      headers: { Authorization: "Bearer test-token" },
    });
  });

  describe("constructor", () => {
    it("should initialize with endpoint and default headers", () => {
      expect(client.endpoint).toBe("https://gitlab.example.com/api/graphql");
    });

    it("should initialize with empty headers when none provided", () => {
      const plainClient = new GraphQLClient("https://gitlab.example.com/api/graphql");
      expect(plainClient.endpoint).toBe("https://gitlab.example.com/api/graphql");
    });
  });

  describe("request method", () => {
    it("should make successful GraphQL request", async () => {
      const mockData = {
        project: {
          id: "gid://gitlab/Project/1",
          name: "test-project",
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: mockData }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.request(testQuery, { id: "test-project" });

      expect(result).toEqual(mockData);
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/api/graphql",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "User-Agent": "GitLab MCP Server",
            Accept: "application/json",
            Authorization: "Bearer test-token",
          }),
          body: expect.stringMatching(/"query".*TestQuery/),
        })
      );
    });

    it("should handle request without variables", async () => {
      const simpleQuery = gql`
        query SimpleQuery {
          currentUser {
            id
          }
        }
      `;

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: { currentUser: { id: "1" } } }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(simpleQuery);

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringMatching(/"query".*SimpleQuery/),
        })
      );
    });

    it("should merge request headers with default headers", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: {} }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(
        testQuery,
        { id: "test" },
        {
          "X-Custom-Header": "custom-value",
        }
      );

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "User-Agent": "GitLab MCP Server",
            Accept: "application/json",
            Authorization: "Bearer test-token",
            "X-Custom-Header": "custom-value",
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("should throw error when response is not ok", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.request(testQuery, { id: "test" })).rejects.toThrow(
        "GraphQL request failed: 401 Unauthorized"
      );
    });

    it("should throw error when GraphQL errors are present", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: null,
          errors: [{ message: "Field not found" }, { message: "Invalid argument" }],
        }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.request(testQuery, { id: "test" })).rejects.toThrow(
        "GraphQL errors: Field not found, Invalid argument"
      );
    });

    it("should throw error when no data is returned", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.request(testQuery, { id: "test" })).rejects.toThrow(
        "GraphQL request returned no data"
      );
    });

    it("should handle network errors", async () => {
      mockEnhancedFetch.mockRejectedValue(new Error("Network error"));

      await expect(client.request(testQuery, { id: "test" })).rejects.toThrow("Network error");
    });

    it("should handle JSON parsing errors", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.request(testQuery, { id: "test" })).rejects.toThrow("Invalid JSON");
    });
  });

  describe("header management", () => {
    it("should set headers correctly", async () => {
      client.setHeaders({ "X-Custom": "value", "X-Another": "another" });

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: {} }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(testQuery, { id: "test" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "X-Custom": "value",
            "X-Another": "another",
          }),
        })
      );
    });

    it("should merge new headers with existing ones", async () => {
      client.setHeaders({ "X-First": "first" });
      client.setHeaders({ "X-Second": "second" });

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: {} }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(testQuery, { id: "test" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-First": "first",
            "X-Second": "second",
          }),
        })
      );
    });

    it("should set auth token correctly", async () => {
      client.setAuthToken("new-token");

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: {} }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(testQuery, { id: "test" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer new-token",
          }),
        })
      );
    });

    it("should override auth token when setting new one", async () => {
      client.setAuthToken("token1");
      client.setAuthToken("token2");

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: {} }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(testQuery, { id: "test" });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token2",
          }),
        })
      );
    });
  });

  describe("query serialization", () => {
    it("should serialize GraphQL query correctly", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: {} }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(testQuery, { id: "test-id" });

      const callArgs = mockEnhancedFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]!.body as string);

      expect(requestBody.query).toContain("query TestQuery");
      expect(requestBody.query).toContain("$id: ID!");
      expect(requestBody.query).toContain("project(fullPath: $id)");
      expect(requestBody.variables).toEqual({ id: "test-id" });
    });

    it("should handle complex variables", async () => {
      const complexQuery = gql`
        mutation CreateProject($input: ProjectInput!) {
          projectCreate(input: $input) {
            project {
              id
              name
            }
          }
        }
      `;

      const complexVariables = {
        input: {
          name: "test-project",
          path: "test-project",
          visibility: "private",
          initializeWithReadme: true,
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: {} }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(complexQuery, complexVariables);

      const callArgs = mockEnhancedFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]!.body as string);

      expect(requestBody.variables).toEqual(complexVariables);
    });
  });

  describe("response handling", () => {
    it("should return data from successful response", async () => {
      const expectedData = {
        project: {
          id: "gid://gitlab/Project/123",
          name: "My Project",
          description: "A test project",
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: expectedData }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.request(testQuery, { id: "my-project" });

      expect(result).toEqual(expectedData);
    });

    it("should handle partial data with warnings", async () => {
      const partialData = {
        project: {
          id: "gid://gitlab/Project/123",
          name: "My Project",
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: partialData,
          extensions: {
            warnings: ["Field description is deprecated"],
          },
        }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.request(testQuery, { id: "my-project" });

      expect(result).toEqual(partialData);
    });

    it("should prioritize errors over data", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: { project: { id: "1" } },
          errors: [{ message: "Access denied" }],
        }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.request(testQuery, { id: "test" })).rejects.toThrow(
        "GraphQL errors: Access denied"
      );
    });
  });

  describe("integration with enhanced fetch", () => {
    it("should use enhanced fetch for requests", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: {} }),
      };

      mockEnhancedFetch.mockResolvedValue(mockResponse as any);

      await client.request(testQuery, { id: "test" });

      expect(mockEnhancedFetch).toHaveBeenCalledTimes(1);
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/api/graphql",
        expect.objectContaining({
          method: "POST",
          headers: expect.any(Object),
          body: expect.any(String),
        })
      );
    });
  });
});
