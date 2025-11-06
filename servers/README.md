# GitLab MCP Code Execution API

This directory contains a code-first interface to GitLab MCP tools, implementing the [code execution with MCP pattern](https://www.anthropic.com/engineering/code-execution-with-mcp) from Anthropic.

## Why Code Execution with MCP?

Traditional MCP implementations load all tool definitions into the model's context window, creating inefficiency:

1. **Tool definition overhead**: Loading 95+ tools can consume ~150k tokens
2. **Intermediate result duplication**: Data passes through model context unnecessarily

This implementation solves both problems by:

- **Progressive tool loading**: Load only the tools you need
- **In-environment data processing**: Filter and transform data before returning to model
- **Native control flow**: Use TypeScript loops, conditionals, and error handling
- **Privacy preservation**: Keep sensitive data in execution environment
- **98.7% token savings**: Reduce from 150k to 2k tokens

## Quick Start

```typescript
import { setupGitLab, gitlab, closeMCPClient } from './servers/gitlab';

// Initialize MCP client
await setupGitLab();

// Create an issue
const issue = await gitlab.issues.createIssue({
  projectId: '123',
  title: 'Bug: Application crashes on startup',
  description: 'Steps to reproduce...',
  labels: ['bug', 'priority::high']
});

console.log(`Created issue: ${issue.web_url}`);

// Clean up
await closeMCPClient();
```

## Progressive Tool Discovery

Instead of loading all 95+ tools upfront, discover tools as needed:

```typescript
import { searchTools } from './servers/gitlab';

// Find relevant tools
const pipelineTools = await searchTools('pipeline');
console.log('Pipeline tools:', pipelineTools);
// ['list_pipelines', 'get_pipeline', 'create_pipeline', ...]

// Load only what you need
import { listPipelines, getPipeline } from './servers/gitlab/tools/pipelines';
```

## Data Filtering in Execution Environment

Process large datasets locally without passing through model context:

```typescript
import { gitlab } from './servers/gitlab';

// Get all issues (potentially large dataset)
const allIssues = await gitlab.issues.listIssues({
  projectId: '123',
  state: 'opened'
});

// Filter in execution environment - doesn't pass all data through model
const criticalBugs = allIssues.filter(issue =>
  issue.labels?.includes('bug') &&
  issue.labels?.includes('priority::critical')
);

// Only return summary
console.log(`Found ${criticalBugs.length} critical bugs`);
console.log(criticalBugs.map(b => `- ${b.title} (${b.web_url})`).join('\n'));
```

## Native Control Flow

Use TypeScript's native control structures instead of chaining tool calls:

```typescript
import { gitlab } from './servers/gitlab';

// Get all open MRs
const mrs = await gitlab.mergeRequests.listMergeRequests({
  projectId: '123',
  state: 'opened'
});

// Process with loops and conditionals
for (const mr of mrs) {
  // Check if MR is ready to merge
  if (mr.merge_status === 'can_be_merged' && mr.approved) {
    console.log(`Auto-merging: ${mr.title}`);

    try {
      await gitlab.mergeRequests.mergeMergeRequest({
        projectId: '123',
        mergeRequestIid: mr.iid,
        squash: true,
        removeSourceBranch: true
      });
      console.log('✓ Merged successfully');
    } catch (error) {
      console.error('✗ Failed to merge:', error);
    }
  }
}
```

## Privacy Preservation

Keep sensitive data in execution environment:

```typescript
import { gitlab } from './servers/gitlab';

// Get file contents
const file = await gitlab.files.getFile('123', 'config/secrets.json', 'main');

// Parse and process locally - sensitive data never enters model context
const config = JSON.parse(file);

// Extract only non-sensitive info
const summary = {
  apiEndpoint: config.api_endpoint,
  environment: config.environment,
  hasApiKey: !!config.api_key,  // Boolean flag, not the actual key
  hasSecrets: !!config.secrets
};

console.log('Config summary:', summary);
```

## State Persistence

Build reusable workflows by saving state:

```typescript
import { gitlab } from './servers/gitlab';
import fs from 'fs/promises';

// Fetch data once
const issues = await gitlab.issues.listIssues({
  projectId: '123',
  state: 'opened'
});

// Save state for later use
await fs.writeFile('issues-cache.json', JSON.stringify(issues, null, 2));

// Load and reuse later
const cachedIssues = JSON.parse(await fs.readFile('issues-cache.json', 'utf-8'));
console.log(`Loaded ${cachedIssues.length} cached issues`);
```

## Complex Workflows

Combine tools with full programming capabilities:

```typescript
import { gitlab } from './servers/gitlab';

async function createReleaseWorkflow(projectId: string, version: string) {
  // 1. Create release branch
  console.log('Creating release branch...');
  const branch = await gitlab.branches.createBranch({
    projectId,
    branchName: `release/${version}`,
    ref: 'main'
  });

  // 2. Update version in files
  console.log('Updating version files...');
  await gitlab.files.updateFile(
    projectId,
    'package.json',
    JSON.stringify({ version }, null, 2),
    branch.name,
    `chore: bump version to ${version}`
  );

  // 3. Create merge request
  console.log('Creating merge request...');
  const mr = await gitlab.mergeRequests.createMergeRequest({
    projectId,
    sourceBranch: branch.name,
    targetBranch: 'main',
    title: `Release ${version}`,
    description: `Automated release for version ${version}`,
    labels: ['release'],
    removeSourceBranch: true
  });

  // 4. Create milestone
  console.log('Creating milestone...');
  const milestone = await callMCPTool('create_milestone', {
    projectId,
    title: `v${version}`,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  return {
    branch: branch.web_url,
    mergeRequest: mr.web_url,
    milestone: milestone.web_url
  };
}

// Execute workflow
const result = await createReleaseWorkflow('123', '2.0.0');
console.log('Release workflow completed:', result);
```

## Available Tool Categories

Explore tools by category in the `tools/` directory:

- **issues.ts** - Issue management (create, list, update, delete, comment)
- **mergeRequests.ts** - MR operations (create, merge, discussions, diffs)
- **files.ts** - File operations (read, write, multi-file commits)
- **branches.ts** - Branch management (create, compare, commits)
- **projects.ts** - Repository operations (search, create, fork)

## Environment Setup

Set these environment variables:

```bash
export GITLAB_PERSONAL_ACCESS_TOKEN="glpat-xxxxxxxxxxxx"
export GITLAB_API_URL="https://gitlab.com/api/v4"  # Optional
export GITLAB_PROJECT_ID="123"  # Optional default project
```

## TypeScript Configuration

Ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

## Implementation Details

### Core Architecture

```
servers/gitlab/
├── callMCPTool.ts       # Core MCP client orchestration
├── types.ts             # TypeScript type definitions
├── index.ts             # Main exports
└── tools/               # Tool wrappers
    ├── issues.ts
    ├── mergeRequests.ts
    ├── files.ts
    ├── branches.ts
    └── projects.ts
```

### How It Works

1. **callMCPTool()** initializes an MCP client connection to the GitLab MCP server
2. Tool wrapper functions provide type-safe, documented interfaces
3. Agents write TypeScript code using these functions
4. Data processing happens in the execution environment
5. Only final results/summaries return to the model

### Benefits vs Traditional MCP

| Aspect | Traditional MCP | Code Execution MCP |
|--------|----------------|-------------------|
| Context usage | ~150k tokens (all tools) | ~2k tokens (only used tools) |
| Data handling | Through model context | In execution environment |
| Control flow | Chain tool calls | Native TypeScript |
| Privacy | All data in context | Local processing |
| Token savings | - | **98.7%** |

## Next Steps

1. Explore the tool modules in `tools/`
2. Try the examples above
3. Build custom workflows combining multiple tools
4. Add your own helper functions for common patterns

For more information, see:
- [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) (Anthropic blog post)
- [Main GitLab MCP README](../README.md)
- [MCP Documentation](https://modelcontextprotocol.io/)
