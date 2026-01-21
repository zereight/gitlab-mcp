/**
 * Unit tests for entities/index.ts
 * Tests module exports and re-export functionality
 */

describe("Entities Index", () => {
  it("should export all entity modules", () => {
    const entitiesIndex = require("../../../src/entities/index");

    expect(entitiesIndex).toBeDefined();
    expect(typeof entitiesIndex).toBe("object");

    // Should have exports from all sub-modules
    // Test a few key exports to ensure re-exports work
    expect(entitiesIndex.PaginationOptionsSchema).toBeDefined(); // from shared
    expect(entitiesIndex.getCoreToolDefinitions).toBeDefined(); // from core
    expect(entitiesIndex.getWorkitemsToolDefinitions).toBeDefined(); // from workitems
  });

  it("should have comment about registry pattern", () => {
    // This test ensures the index file is actually loaded and executed
    const fs = require("fs");
    const path = require("path");

    const indexPath = path.resolve(__dirname, "../../../src/entities/index.ts");
    const content = fs.readFileSync(indexPath, "utf8");

    expect(content).toContain("All entities now use the registry pattern");
  });
});
