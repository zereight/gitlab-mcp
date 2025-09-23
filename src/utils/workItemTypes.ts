import { ConnectionManager } from "../services/ConnectionManager";
import { GET_WORK_ITEM_TYPES } from "../graphql/workItems";

// Define interface for work item type objects
interface WorkItemType {
  id: string;
  name: string;
}

/**
 * Internal utility function to get work item types for a namespace
 * This is NOT exposed as a tool - it's for internal use only
 */
export async function getWorkItemTypes(namespace: string): Promise<WorkItemType[]> {
  // Get GraphQL client from ConnectionManager
  const connectionManager = ConnectionManager.getInstance();
  const client = connectionManager.getClient();

  // Use GraphQL query for getting work item types
  const response = await client.request(GET_WORK_ITEM_TYPES, {
    namespacePath: namespace,
  });

  // Return the work item types in the expected format
  return response.namespace?.workItemTypes?.nodes ?? [];
}
