import * as graphqlIndex from "../../../src/graphql/index";

describe("GraphQL index exports", () => {
  it("should export GraphQLClient", () => {
    expect(graphqlIndex.GraphQLClient).toBeDefined();
    expect(typeof graphqlIndex.GraphQLClient).toBe("function");
  });

  it("should export workItems constants", () => {
    expect(graphqlIndex.GET_NAMESPACE_WORK_ITEMS).toBeDefined();
    expect(graphqlIndex.GET_PROJECT_WORK_ITEMS).toBeDefined();
    expect(graphqlIndex.CREATE_WORK_ITEM).toBeDefined();
    expect(graphqlIndex.UPDATE_WORK_ITEM).toBeDefined();
    expect(graphqlIndex.DELETE_WORK_ITEM).toBeDefined();
    expect(graphqlIndex.GET_WORK_ITEM_TYPES).toBeDefined();
    expect(graphqlIndex.GET_WORK_ITEM).toBeDefined();
  });
});
