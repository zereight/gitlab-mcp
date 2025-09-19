/**
 * Custom Jest Test Sequencer
 *
 * Ensures integration tests run in dependency order:
 * 1. data-lifecycle.test.ts (creates all infrastructure)
 * 2. schemas-dependent tests (use the infrastructure)
 * 3. workitems.test.ts (GraphQL tests with infrastructure)
 */

const Sequencer = require('@jest/test-sequencer').default;

class DependencySequencer extends Sequencer {
  sort(tests) {
    // Define test execution order based on dependencies
    const testOrder = [
      'data-lifecycle.test.ts',                    // MUST be first - creates all data
      'schemas-dependent/merge-requests.test.ts',  // Uses MR data from lifecycle
      'schemas-dependent/repository.test.ts',     // Uses repository data from lifecycle
      'workitems.test.ts',                        // Uses work items from lifecycle
    ];

    // Sort tests according to dependency order
    return tests.sort((testA, testB) => {
      const getOrder = (testPath) => {
        for (let i = 0; i < testOrder.length; i++) {
          if (testPath.includes(testOrder[i])) {
            return i;
          }
        }
        return testOrder.length; // Unknown tests go last
      };

      const orderA = getOrder(testA.path);
      const orderB = getOrder(testB.path);

      return orderA - orderB;
    });
  }
}

module.exports = DependencySequencer;