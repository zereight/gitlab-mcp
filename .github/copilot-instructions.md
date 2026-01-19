# GitHub Copilot Instructions for gitlab-mcp

## Project Overview

This is a GitLab MCP (Model Context Protocol) server that provides GitLab API access through standardized MCP tools. The project uses TypeScript, Yarn 4, and follows strict coding standards.

## Commit Message Rules (CRITICAL)

**ALL commits MUST follow Conventional Commits format:**

```
<type>(scope): <description>
```

### Required Commit Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | New feature or capability | Minor |
| `fix` | Bug fix | Patch |
| `docs` | Documentation only | None |
| `style` | Code style/formatting | None |
| `refactor` | Code restructuring | Patch |
| `perf` | Performance improvement | Patch |
| `test` | Adding/fixing tests | None |
| `chore` | Maintenance tasks | None |
| `ci` | CI/CD changes | None |
| `build` | Build system changes | None |
| `revert` | Revert previous commit | Patch |

### Commit Message Guidelines

1. **Type is REQUIRED** - Never omit the type prefix
2. **Use imperative mood** - "Add feature" not "Added feature"
3. **Keep subject under 72 characters**
4. **Do NOT end with period**
5. **Scope is optional but recommended** - e.g., `feat(webhooks):`, `fix(mrs):`

### FORBIDDEN Commit Messages

These patterns will FAIL CI validation:

- `Initial plan` - Missing type
- `Update file.ts` - Missing type
- `WIP` - Use `wip:` type instead
- `Fix stuff` - Too vague, needs scope
- Any message starting with emoji without type

### Good Examples

```
feat(webhooks): add webhook management tools
fix(labels): resolve null pointer in label handler
test(integration): add CRUD lifecycle tests for webhooks
refactor(schemas): extract validation to shared utility
docs(readme): document webhook event types
chore(deps): update dependencies
ci(workflows): add conventional commits validation
```

### Multi-line Commit Messages

For complex changes, use body to explain what and why:

```
feat(webhooks): add webhook management entity

- Add list_webhooks and manage_webhook tools
- Support project and group scopes
- Include all GitLab webhook event types
- Add comprehensive unit tests

Closes #5
```

## Code Standards

- **TypeScript strict mode** - No `any` types
- **ESM imports** - Use `.js` extensions
- **Zod schemas** - All external data validated
- **CQRS pattern** - `browse_*` for queries, `manage_*` for commands
- **Jest tests** - All features must have tests

## Build and Test Commands

```bash
yarn build      # Compile TypeScript
yarn lint       # Run ESLint
yarn test       # Run all tests
yarn test:cov   # Run tests with coverage
```

## File Organization

- `src/entities/` - Entity modules (labels, webhooks, etc.)
- `src/entities/*/schema.ts` - Zod schemas for write operations
- `src/entities/*/schema-readonly.ts` - Zod schemas for read operations
- `src/entities/*/registry.ts` - Tool handlers
- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests with real GitLab

## Pull Request Guidelines

1. All commits must pass conventional commits validation
2. All tests must pass
3. Coverage must not decrease
4. Lint must pass with 0 errors
