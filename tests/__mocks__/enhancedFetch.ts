/**
 * Mock implementation of enhancedFetch for unit tests only
 * This file is ONLY used by unit tests and should NOT affect integration tests
 */

export const mockEnhancedFetch = jest.fn();

// Default implementation that can be overridden in tests
// Note: Tests will typically override this with mockResolvedValue() or mockImplementation()
mockEnhancedFetch.mockImplementation(async (_url: string, _options?: any) => {
  // Default successful response
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: jest.fn().mockResolvedValue({ data: {} }),
    text: jest.fn().mockResolvedValue('{"data":{}}'),
    headers: new Map([["content-type", "application/json"]]),
  };
});

export { mockEnhancedFetch as enhancedFetch };
