/**
 * Test utility functions for unit tests
 */

import { mockEnhancedFetch } from "../__mocks__/enhancedFetch";
import { createMockResponse, createMockErrorResponse } from "../fixtures/mockData";

// Re-export the mock for direct use in tests
export { mockEnhancedFetch };

/**
 * Setup enhanced fetch mock with predefined responses
 */
export function setupMockFetch() {
  jest.doMock("../../src/utils/fetch", () => ({
    enhancedFetch: mockEnhancedFetch,
  }));
}

/**
 * Reset all mocks between tests
 */
export function resetMocks() {
  jest.clearAllMocks();
  mockEnhancedFetch.mockClear();
}

/**
 * Mock a successful API response
 */
export function mockSuccessResponse(data: any, status = 200) {
  mockEnhancedFetch.mockResolvedValueOnce(createMockResponse(data, status));
}

/**
 * Mock an error API response
 */
export function mockErrorResponse(status = 404, message = "Not Found") {
  mockEnhancedFetch.mockResolvedValueOnce(createMockErrorResponse(status, message));
}

/**
 * Mock a rejected promise (network error)
 */
export function mockNetworkError(message = "Network Error") {
  mockEnhancedFetch.mockRejectedValueOnce(new Error(message));
}

/**
 * Mock multiple sequential responses
 */
export function mockSequentialResponses(...responses: any[]) {
  responses.forEach(response => {
    if (response instanceof Error) {
      mockEnhancedFetch.mockRejectedValueOnce(response);
    } else {
      mockEnhancedFetch.mockResolvedValueOnce(response);
    }
  });
}

/**
 * Assert that fetch was called with expected parameters
 */
export function expectFetchCalledWith(url: string, options?: any) {
  expect(mockEnhancedFetch).toHaveBeenCalledWith(url, options);
}

/**
 * Assert that fetch was called with correct HTTP method
 */
export function expectFetchMethod(method: string) {
  const lastCall = mockEnhancedFetch.mock.calls[mockEnhancedFetch.mock.calls.length - 1];
  expect(lastCall[1]?.method).toBe(method);
}

/**
 * Get the body of the last fetch call
 */
export function getLastFetchBody() {
  const lastCall = mockEnhancedFetch.mock.calls[mockEnhancedFetch.mock.calls.length - 1];
  const body = lastCall[1]?.body;

  if (!body) return undefined;

  // Check content type to determine how to parse
  const contentType = lastCall[1]?.headers?.["Content-Type"];

  if (contentType === "application/x-www-form-urlencoded") {
    // Parse URL-encoded data
    const params = new URLSearchParams(body);
    const result: Record<string, any> = {};
    for (const [key, value] of params.entries()) {
      // Try to convert common data types
      if (value === "true") {
        result[key] = true;
      } else if (value === "false") {
        result[key] = false;
      } else if (value.match(/^\d+$/)) {
        result[key] = parseInt(value, 10);
      } else if (value.match(/^\d+\.\d+$/)) {
        result[key] = parseFloat(value);
      } else if (value.startsWith("{") || value.startsWith("[")) {
        // Try to parse as JSON
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  } else {
    // Assume JSON
    try {
      return JSON.parse(body);
    } catch {
      return body; // Return raw string if not valid JSON
    }
  }
}

/**
 * Common test pattern for handler functions
 */
export async function testHandlerSuccess(
  handler: Function,
  params: any,
  mockData: any,
  expectedUrl?: string
) {
  mockSuccessResponse(mockData);
  const result = await handler(params);

  expect(result).toBeDefined();
  expect(mockEnhancedFetch).toHaveBeenCalledTimes(1);

  if (expectedUrl) {
    expect(mockEnhancedFetch).toHaveBeenCalledWith(
      expect.stringContaining(expectedUrl),
      expect.any(Object)
    );
  }

  return result;
}

/**
 * Common test pattern for handler error scenarios
 */
export async function testHandlerError(
  handler: Function,
  params: any,
  errorStatus = 404,
  errorMessage = "Not Found"
) {
  mockErrorResponse(errorStatus, errorMessage);

  await expect(handler(params)).rejects.toThrow();
  expect(mockEnhancedFetch).toHaveBeenCalledTimes(1);
}

/**
 * Test parameter validation
 */
export async function testParameterValidation(
  handler: Function,
  invalidParams: any,
  expectedErrorMessage?: string
) {
  await expect(handler(invalidParams)).rejects.toThrow(expectedErrorMessage);

  // Should not make API call if validation fails
  expect(mockEnhancedFetch).not.toHaveBeenCalled();
}

/**
 * Create mock environment variables
 */
export function mockEnvironment(env: Record<string, string>) {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });
}

/**
 * Create a test suite for a handler function
 */
export function createHandlerTestSuite(
  handlerName: string,
  handler: Function,
  validParams: any,
  mockResponseData: any,
  expectedUrl?: string
) {
  describe(handlerName, () => {
    beforeEach(() => {
      resetMocks();
    });

    it("should return data on successful API call", async () => {
      await testHandlerSuccess(handler, validParams, mockResponseData, expectedUrl);
    });

    it("should handle API errors", async () => {
      await testHandlerError(handler, validParams);
    });

    it("should handle network errors", async () => {
      mockNetworkError();
      await expect(handler(validParams)).rejects.toThrow("Network Error");
    });
  });
}
