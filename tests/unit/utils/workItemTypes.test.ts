import { getWorkItemTypes } from '../../../src/utils/workItemTypes';
import { ConnectionManager } from '../../../src/services/ConnectionManager';
import { GET_WORK_ITEM_TYPES } from '../../../src/graphql/workItems';

// Mock ConnectionManager and GraphQL client
jest.mock('../../../src/services/ConnectionManager');
jest.mock('../../../src/graphql/workItems', () => ({
  GET_WORK_ITEM_TYPES: 'GET_WORK_ITEM_TYPES_QUERY'
}));

const mockClient = {
  request: jest.fn()
};

// Mock ConnectionManager.getInstance directly
const mockGetInstance = jest.fn();
ConnectionManager.getInstance = mockGetInstance;

describe('workItemTypes utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock ConnectionManager.getInstance()
    mockGetInstance.mockReturnValue({
      getClient: () => mockClient
    });
  });

  describe('getWorkItemTypes', () => {
    it('should return work item types from GraphQL response', async () => {
      const mockWorkItemTypes = [
        { id: 'gid://gitlab/WorkItems::Type/1', name: 'Epic' },
        { id: 'gid://gitlab/WorkItems::Type/2', name: 'Issue' },
        { id: 'gid://gitlab/WorkItems::Type/3', name: 'Task' }
      ];

      mockClient.request.mockResolvedValue({
        namespace: {
          workItemTypes: {
            nodes: mockWorkItemTypes
          }
        }
      });

      const result = await getWorkItemTypes('test-namespace');

      expect(mockClient.request).toHaveBeenCalledWith(
        'GET_WORK_ITEM_TYPES_QUERY',
        { namespacePath: 'test-namespace' }
      );
      expect(result).toEqual(mockWorkItemTypes);
    });

    it('should return empty array when namespace is null', async () => {
      mockClient.request.mockResolvedValue({
        namespace: null
      });

      const result = await getWorkItemTypes('non-existent-namespace');

      expect(result).toEqual([]);
    });

    it('should return empty array when workItemTypes is null', async () => {
      mockClient.request.mockResolvedValue({
        namespace: {
          workItemTypes: null
        }
      });

      const result = await getWorkItemTypes('test-namespace');

      expect(result).toEqual([]);
    });

    it('should return empty array when nodes is null', async () => {
      mockClient.request.mockResolvedValue({
        namespace: {
          workItemTypes: {
            nodes: null
          }
        }
      });

      const result = await getWorkItemTypes('test-namespace');

      expect(result).toEqual([]);
    });

    it('should handle GraphQL client errors', async () => {
      const error = new Error('GraphQL request failed');
      mockClient.request.mockRejectedValue(error);

      await expect(getWorkItemTypes('test-namespace')).rejects.toThrow('GraphQL request failed');
    });
  });
});