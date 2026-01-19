import * as coreIndex from "../../../../src/entities/core/index";

describe("Core Entity Index", () => {
  it("should export shared schemas", () => {
    expect(coreIndex).toBeDefined();

    // Check that shared exports exist
    expect(coreIndex.PaginationOptionsSchema).toBeDefined();
  });

  it("should export read-only schemas", () => {
    // Consolidated CQRS schemas (Issue #16)
    expect(coreIndex.BrowseProjectsSchema).toBeDefined();
    expect(coreIndex.BrowseNamespacesSchema).toBeDefined();
    expect(coreIndex.BrowseCommitsSchema).toBeDefined();
    expect(coreIndex.BrowseEventsSchema).toBeDefined();
    // Keep as-is schemas
    expect(coreIndex.GetUsersSchema).toBeDefined();
    expect(coreIndex.ListProjectMembersSchema).toBeDefined();
  });

  it("should export write schemas", () => {
    expect(coreIndex.CreateBranchSchema).toBeDefined();
  });

  it("should export registry functions", () => {
    expect(coreIndex.getCoreToolDefinitions).toBeDefined();
    expect(coreIndex.getFilteredCoreTools).toBeDefined();
    expect(coreIndex.getCoreReadOnlyToolNames).toBeDefined();
  });

  it("should export the tool registry", () => {
    expect(coreIndex.coreToolRegistry).toBeDefined();
    expect(coreIndex.coreToolRegistry instanceof Map).toBe(true);
  });
});
