import * as coreIndex from '../../../../src/entities/core/index';

describe('Core Entity Index', () => {
  it('should export shared schemas', () => {
    expect(coreIndex).toBeDefined();

    // Check that shared exports exist
    expect(coreIndex.PaginationOptionsSchema).toBeDefined();
  });

  it('should export read-only schemas', () => {
    expect(coreIndex.ListProjectsSchema).toBeDefined();
    expect(coreIndex.GetProjectSchema).toBeDefined();
  });

  it('should export write schemas', () => {
    expect(coreIndex.CreateBranchSchema).toBeDefined();
  });

  it('should export registry functions', () => {
    expect(coreIndex.getCoreToolDefinitions).toBeDefined();
    expect(coreIndex.getFilteredCoreTools).toBeDefined();
    expect(coreIndex.getCoreReadOnlyToolNames).toBeDefined();
  });

  it('should export the tool registry', () => {
    expect(coreIndex.coreToolRegistry).toBeDefined();
    expect(coreIndex.coreToolRegistry instanceof Map).toBe(true);
  });
});