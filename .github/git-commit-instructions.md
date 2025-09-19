# Git Commit Instructions for GitHub Copilot

## Conventional Commits Format

Use the Conventional Commits specification for all commit messages:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types

- **feat**: A new feature for the user
- **fix**: A bug fix for the user
- **docs**: Changes to documentation only
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries
- **ci**: Changes to CI configuration files and scripts
- **build**: Changes that affect the build system or external dependencies
- **revert**: Reverts a previous commit

## Commit Message Guidelines

### Subject Line Rules

- Use imperative mood: "Add feature" not "Added feature" or "Adds feature"
- Keep subject line under 50 characters
- Do not end with a period
- Capitalize the first letter of the description
- Use present tense

### Examples of Good Commit Messages

```
feat: add work item synchronization across providers
fix: resolve null pointer exception in provider manager
docs: update README with new configuration options
refactor: extract common validation logic to utility class
test: add unit tests for GitLab provider integration
chore: update dependencies to latest versions
ci: add semantic-release workflow for automated publishing
```

### Examples with Scope

```
feat(providers): add Azure DevOps provider integration
fix(server): handle connection errors gracefully
docs(api): document new work item endpoints
test(integration): add end-to-end provider tests
```

### Breaking Changes

For breaking changes, use either:

- Add `!` after the type: `feat!: remove deprecated API endpoints`
- Add `BREAKING CHANGE:` in the footer with explanation

### Body and Footer

- Use the body to explain **what** and **why** vs. **how**
- Wrap body at 72 characters
- Separate body from subject with a blank line
- Use footer for referencing issues: `Fixes #123` or `Closes #456`

### Full Example

```
feat(auth): add OAuth2 authentication support

Implement OAuth2 flow for GitHub and GitLab providers to improve
security and eliminate the need for personal access tokens in
some scenarios.

- Add OAuth2 client configuration
- Implement token refresh mechanism
- Update provider initialization to support OAuth2

Closes #45
Fixes #67
```

## Semantic Versioning Impact

- `feat:` → Minor version bump (0.1.0 → 0.2.0)
- `fix:` → Patch version bump (0.1.0 → 0.1.1)
- `feat!:` or `BREAKING CHANGE:` → Major version bump (0.1.0 → 1.0.0)
- Other types → No version bump (chore, docs, style, etc.)

## Additional Guidelines

- One logical change per commit
- Test your changes before committing
- Keep commits atomic and focused
- Write commit messages for future developers (including yourself)
