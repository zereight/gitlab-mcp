/**
 * Unit tests for ConnectionManager service
 * Tests singleton pattern and error handling without external dependencies
 */

import { ConnectionManager } from "../../../src/services/ConnectionManager";

describe("ConnectionManager Unit", () => {
  beforeEach(() => {
    // Reset singleton instance for each test
    (ConnectionManager as any).instance = null;
  });

  describe("singleton pattern", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = ConnectionManager.getInstance();
      const instance2 = ConnectionManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should maintain singleton across different call patterns", () => {
      const instances: ConnectionManager[] = [];
      for (let i = 0; i < 5; i++) {
        instances.push(ConnectionManager.getInstance());
      }

      // All instances should be the same object
      instances.forEach(instance => {
        expect(instance).toBe(instances[0]);
      });
    });
  });

  describe("error handling before initialization", () => {
    let manager: ConnectionManager;

    beforeEach(() => {
      manager = ConnectionManager.getInstance();
    });

    const errorMessage = "Connection not initialized. Call initialize() first.";

    it("should throw error when getting client before initialization", () => {
      expect(() => manager.getClient()).toThrow(errorMessage);
    });

    it("should throw error when getting version detector before initialization", () => {
      expect(() => manager.getVersionDetector()).toThrow(errorMessage);
    });

    it("should throw error when getting schema introspector before initialization", () => {
      expect(() => manager.getSchemaIntrospector()).toThrow(errorMessage);
    });

    it("should throw error when getting instance info before initialization", () => {
      expect(() => manager.getInstanceInfo()).toThrow(errorMessage);
    });

    it("should throw error when getting schema info before initialization", () => {
      expect(() => manager.getSchemaInfo()).toThrow(errorMessage);
    });
  });
});
