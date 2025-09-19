/**
 * Integration tests for ConnectionManager service
 * Tests real environment integration and initialization with GitLab
 */

import { ConnectionManager } from '../../../src/services/ConnectionManager';

describe('ConnectionManager Integration', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ConnectionManager as any).instance = null;
    manager = ConnectionManager.getInstance();
  });

  it('should initialize successfully with real environment', async () => {
    // This test uses real environment variables from .env.test
    await expect(manager.initialize()).resolves.not.toThrow();

    // Verify services are available
    expect(manager.getClient()).toBeDefined();
    expect(manager.getVersionDetector()).toBeDefined();
    expect(manager.getSchemaIntrospector()).toBeDefined();
    expect(manager.getInstanceInfo()).toBeDefined();
    expect(manager.getSchemaInfo()).toBeDefined();
  });

  it('should detect real GitLab instance information', async () => {
    await manager.initialize();

    const instanceInfo = manager.getInstanceInfo();
    expect(instanceInfo.version).toMatch(/^\d+\.\d+\.\d+/); // Valid version format
    expect(['free', 'premium', 'ultimate']).toContain(instanceInfo.tier);
    expect(instanceInfo.features).toBeDefined();
    expect(instanceInfo.detectedAt).toBeInstanceOf(Date);
  });

  it('should introspect real GitLab schema', async () => {
    await manager.initialize();

    const schemaInfo = manager.getSchemaInfo();
    expect(Array.isArray(schemaInfo.workItemWidgetTypes)).toBe(true);
    expect(schemaInfo.workItemWidgetTypes.length).toBeGreaterThan(0);
    expect(schemaInfo.typeDefinitions).toBeInstanceOf(Map);
    expect(schemaInfo.availableFeatures).toBeInstanceOf(Set);
  });
});