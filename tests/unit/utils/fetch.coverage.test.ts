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
  });
});