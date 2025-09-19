/**
 * Unit tests for types.ts
 * Tests type definitions, constants, and interfaces
 */

describe('Types Module', () => {
  it('should export TransportMode constants', () => {
    const types = require('../../src/types');

    expect(types.TransportMode).toBeDefined();
    expect(types.TransportMode.STDIO).toBe('stdio');
    expect(types.TransportMode.SSE).toBe('sse');
    expect(types.TransportMode.STREAMABLE_HTTP).toBe('streamable-http');
  });

  it('should have correct TransportMode constant values', () => {
    const types = require('../../src/types');

    // Test that the constants match expected transport mode strings
    expect(typeof types.TransportMode.STDIO).toBe('string');
    expect(typeof types.TransportMode.SSE).toBe('string');
    expect(typeof types.TransportMode.STREAMABLE_HTTP).toBe('string');

    // Test that they are unique values
    const values = Object.values(types.TransportMode);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should have TransportMode as a readonly object', () => {
    const types = require('../../src/types');

    // Test that the TransportMode object exists and has expected properties
    expect(types.TransportMode).toBeDefined();
    expect(typeof types.TransportMode).toBe('object');

    // In TypeScript, const assertions make objects readonly at compile time
    // At runtime, we can still test that the values are what we expect
    expect(types.TransportMode.STDIO).toBe('stdio');
    expect(types.TransportMode.SSE).toBe('sse');
    expect(types.TransportMode.STREAMABLE_HTTP).toBe('streamable-http');
  });

  it('should export all required type interfaces', () => {
    // This test verifies the module loads without TypeScript errors
    // The interfaces are compile-time only, but we can test the module structure
    const types = require('../../src/types');

    expect(types).toBeDefined();
    expect(typeof types).toBe('object');
  });

  it('should have accessible TransportMode keys', () => {
    const types = require('../../src/types');

    const keys = Object.keys(types.TransportMode);
    expect(keys).toContain('STDIO');
    expect(keys).toContain('SSE');
    expect(keys).toContain('STREAMABLE_HTTP');
    expect(keys).toContain('DUAL');
    expect(keys.length).toBe(4);
  });

  it('should support runtime type checking of transport modes', () => {
    const types = require('../../src/types');

    const validModes = Object.values(types.TransportMode);

    expect(validModes).toContain('stdio');
    expect(validModes).toContain('sse');
    expect(validModes).toContain('streamable-http');
    expect(validModes).toContain('dual');
    expect(validModes).not.toContain('invalid-mode');
    expect(validModes).not.toContain('');
  });
});