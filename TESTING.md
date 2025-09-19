# GitLab MCP Integration Testing Architecture

## Overview

The GitLab MCP integration tests follow a **dependency chain pattern** to ensure efficient testing with real GitLab data while minimizing API spam and resource usage.

## 🔗 Test Dependency Chain

```
📁 data-lifecycle.test.ts
  ↓ Creates complete test infrastructure
  │
  ├── 📁 schemas-dependent/merge-requests.test.ts
  ├── 📁 schemas-dependent/repository.test.ts
  ├── 📁 workitems.test.ts
  └── ... (other schema tests)
    ↓ All use the shared infrastructure
    │
    🧹 Cleanup (only at the very end)
```

## 🚨 Critical Rules

1. **Tests CANNOT run standalone** - They depend on lifecycle data
2. **Must use `--runInBand`** - Tests must run serially to maintain dependencies
3. **Single infrastructure creation** - Only data-lifecycle.test.ts creates data
4. **No individual cleanup** - Only final cleanup in data-lifecycle.test.ts
5. **Real data only** - No mocks, all tests use actual GitLab entities

## 📂 File Structure

```
tests/
├── integration/
│   ├── data-lifecycle.test.ts          # 🔄 Creates ALL test infrastructure
│   ├── schemas-dependent/              # 📊 Tests using lifecycle data
│   │   ├── merge-requests.test.ts      # 🔀 MR schema tests with real MRs
│   │   ├── repository.test.ts          # 🌳 Repo schema tests with real files
│   │   └── ...                         # 📝 Other schema tests
│   └── schemas/workitems.test.ts        # 📋 GraphQL tests with real work items
├── setup/
│   ├── testConfig.ts                   # 🔧 Shared configuration
│   ├── sequencer.js                    # 📋 Test execution order
│   ├── globalSetup.js                  # 🚀 Pre-test validation
│   └── globalTeardown.js               # 🧹 Post-test summary
└── jest.config.js                       # ⚙️  Jest configuration for all tests
```

## 🚀 How to Run Tests

### Complete Integration Test Suite (Recommended)
```bash
yarn test
```

This command:
- ✅ Uses all feature flags (WORKITEMS, MILESTONE, PIPELINE, GITLAB_WIKI)
- ✅ Runs tests in dependency order with `--runInBand`
- ✅ Creates complete infrastructure once
- ✅ Tests all schemas with real data
- ✅ Cleans up everything at the end

### Individual Test Files (NOT RECOMMENDED)
```bash
# ❌ DON'T DO THIS - Will fail due to missing dependencies
yarn test tests/integration/schemas-dependent/merge-requests.test.ts

# ✅ If you must, run the full chain:
yarn test
```

## 📊 Data Lifecycle Stages

### Stage 1: Foundation (data-lifecycle.test.ts)
```typescript
// Creates in dependency order:
1. Test Group (contains everything)
2. Test Project (in the group)
3. Repository Files (README, src/, docs/, .gitignore)
4. Feature Branches (feature/*, hotfix/*)
5. Repository Tags (v1.0.0, v1.1.0)
6. Labels (bug, feature, enhancement)
7. Milestones (Sprint 1, Release 1.0)
8. Work Items (Issue, Epic, Task)
9. Merge Requests (from feature branches)
```

### Stage 2: Schema Validation (schemas-dependent/*.test.ts)
```typescript
// Uses the created infrastructure to test:
- 🔀 ListMergeRequestsSchema with real MRs
- 🌳 GetRepositoryTreeSchema with real files
- 📝 All other schemas with their respective real data
- 🔍 Real data validation without soft-fail patterns
```

### Stage 3: GraphQL Testing (schemas/workitems.test.ts)
```typescript
// Tests GraphQL operations with:
- 📋 Real work items from lifecycle
- 🔄 Schema introspection
- 🧩 Dynamic query building with real widgets
```

### Stage 4: Cleanup (data-lifecycle.test.ts afterAll)
```typescript
// Single cleanup operation:
- 🗑️  Delete test group (cascades to all projects, MRs, work items)
- ✅ Complete infrastructure removal
```

## 🔧 Configuration

### Environment Variables
```bash
# Required for all tests
GITLAB_TOKEN=glpat-xxx...
GITLAB_API_URL=https://gitlab.com

# Optional for specific project testing (can be blank)
GITLAB_PROJECT_ID=

# Feature flags (automatically set by test:integration:lifecycle)
USE_WORKITEMS=true
USE_MILESTONE=true
USE_PIPELINE=true
USE_GITLAB_WIKI=true
```

### Test Data Access
```typescript
// In any dependent test file:
import { requireTestData, getTestProject } from '../../setup/testConfig';

describe('My Schema Tests', () => {
  let testData: any;
  let testProject: any;

  beforeAll(async () => {
    // This will throw if lifecycle tests haven't run
    testData = requireTestData();
    testProject = getTestProject();
  });

  it('should test with real data', async () => {
    // Use testProject.id, testData.mergeRequests, etc.
    const response = await fetch(`${GITLAB_API_URL}/api/v4/projects/${testProject.id}/...`);
    // Test with real GitLab data
  });
});
```

## ⚠️ Common Issues

### "Test data not available"
```
Error: Test data not available. Make sure to run data-lifecycle.test.ts first with --runInBand
```
**Solution:** Use `yarn test` instead of individual test files.

### Tests running in parallel
```
Tests create multiple conflicting infrastructures
```
**Solution:** Always use `--runInBand` flag for integration tests.

### Missing dependencies
```
Test expects MRs but none found
```
**Solution:** Ensure data-lifecycle.test.ts completed successfully and shared the data.

## 📈 Benefits

1. **Efficient**: Single infrastructure creation vs. per-test creation
2. **Fast**: No repeated setup/teardown cycles
3. **Realistic**: Tests use actual GitLab entities with real relationships
4. **Reliable**: Dependency chain ensures data consistency
5. **Clean**: Single cleanup operation at the end
6. **Maintainable**: Clear separation between data creation and testing

## ✅ Current Status (2025-01-15)

**🎉 ALL CRITICAL ISSUES RESOLVED**:
- ✅ **Complete test suite passing** - 27/27 test suites, 369/372 tests passing (99.2%)
- ✅ **Unit tests completely rewritten** - Proper mock infrastructure using enhancedFetch
- ✅ **Integration tests fully working** - Real GitLab API testing with data lifecycle
- ✅ **Node-fetch migration complete** - All tests now use native fetch API
- ✅ **Test dependency chain FIXED** - Persistent file storage enables data sharing between test files
- ✅ **Soft-fail patterns eliminated** - All tests use real data or fail properly
- ✅ **Jest configuration enhanced** - Proper serial execution with `--runInBand`

**Test Results Summary**:
- **Total Test Suites**: 27 passed, 0 failed
- **Total Tests**: 369 passed, 3 skipped, 0 failed (372 total)
- **Integration Tests**: 16 suites passing (200+ tests)
- **Unit Tests**: 11 suites passing (169+ tests)
- **Coverage**: 54.92% statements, 37.39% branches, 53.28% functions

**Key Test Categories**:
- ✅ **Data Lifecycle**: 12/12 tests passing - Complete infrastructure setup/teardown
- ✅ **Schema Validation**: 150+ tests passing - All GitLab API schemas validated
- ✅ **Unit Tests**: 169+ tests passing - Full mock-based handler testing
- ✅ **Work Items GraphQL**: 20+ tests passing - Full CRUD with real GitLab instance
- ✅ **Integration API**: 30+ tests passing - Real GitLab API validation

## 🎯 Adding New Tests

To add a new schema test:

1. Create file in `schemas-dependent/your-schema.test.ts`
2. Import shared config: `import { requireTestData } from '../../setup/testConfig'`
3. Use lifecycle data: `const testData = requireTestData()`
4. Test with real entities from lifecycle
5. Add to sequencer.js if order matters
6. No individual cleanup needed

The dependency chain pattern ensures your test will have real data to work with while maintaining efficiency and preventing API spam.

