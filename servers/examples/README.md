# GitLab MCP Code Execution Examples

These examples demonstrate the code execution pattern for GitLab MCP, achieving **98.7% token savings** compared to traditional MCP usage.

## Running Examples

First, set up your environment:

```bash
export GITLAB_PERSONAL_ACCESS_TOKEN="glpat-xxxxxxxxxxxx"
export GITLAB_API_URL="https://gitlab.com/api/v4"  # Optional
export GITLAB_PROJECT_ID="123"  # Your project ID
```

Then run any example:

```bash
# Using npm scripts
npm run example:basic
npm run example:data-filtering
npm run example:control-flow
npm run example:workflow

# Or directly with tsx
npx tsx servers/examples/basic-usage.ts
npx tsx servers/examples/data-filtering.ts
npx tsx servers/examples/control-flow.ts
npx tsx servers/examples/complex-workflow.ts
```

## Examples

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates the fundamental pattern:
- Initialize MCP client
- Create issue, branch, file
- Create merge request
- Clean up connection

**Key concepts**: Progressive tool loading, basic API usage

```bash
npm run example:basic
```

### 2. Data Filtering (`data-filtering.ts`)

Shows how to process large datasets in the execution environment:
- Fetch all issues (potentially 100+ items)
- Filter and analyze locally
- Return only summaries/statistics

**Key concepts**: Token efficiency, in-environment processing

**Token savings**: Instead of passing ~150k tokens of issue data through the model, only return a summary (~500 tokens) = **99.7% savings**

```bash
npm run example:data-filtering
```

### 3. Control Flow (`control-flow.ts`)

Demonstrates native TypeScript control structures:
- Loops over merge requests
- Conditional logic for auto-merge decisions
- Error handling and recovery
- Batch processing

**Key concepts**: Native loops/conditionals instead of chaining tool calls

```bash
npm run example:control-flow
```

### 4. Complex Workflow (`complex-workflow.ts`)

Build sophisticated automation workflows:
- **Release workflow**: Create branch, update versions, generate changelog, create MR and milestone
- **Cleanup workflow**: Find and process stale issues
- **State persistence**: Save data locally for reuse

**Key concepts**: Compose multiple tools, state management, reusable functions

```bash
npm run example:workflow
```

## Key Benefits Demonstrated

| Example | Primary Benefit |
|---------|----------------|
| basic-usage.ts | Progressive tool loading |
| data-filtering.ts | 99.7% token savings through local processing |
| control-flow.ts | Native TypeScript control structures |
| complex-workflow.ts | State persistence and composition |

## Pattern Summary

All examples follow this pattern:

```typescript
import { setupGitLab, gitlab, closeMCPClient } from '../gitlab/index.js';

async function main() {
  // 1. Initialize
  await setupGitLab();

  try {
    // 2. Use GitLab tools
    const result = await gitlab.issues.createIssue({...});

    // 3. Process data locally (doesn't go through model)
    const filtered = result.filter(...);

  } finally {
    // 4. Clean up
    await closeMCPClient();
  }
}

main();
```

## Learn More

- [Code Execution Documentation](../README.md)
- [Anthropic's Blog Post](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [GitLab MCP Tools](../../README.md#tools-)
