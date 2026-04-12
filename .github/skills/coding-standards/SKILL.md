---
name: coding-standards
description: >
  Canonical cross-language coding standards reference. Shared rules embedded by reviewer agents.
  Activate when: viewing coding standards, checking naming rules, reviewing style baseline,
  consulting style guide, what are the rules.
argument-hint: "[optional: specific topic — naming | functions | errors | anti-patterns]"
---

# Coding Standards

> **D9 Canonical Reference.** This is the single source of truth for cross-language coding standards.
> Language-specific reviewers (`@typescript-reviewer`, `@python-reviewer`, etc.) embed these rules.
> Agents cite this skill as "See also: /coding-standards."

## Naming Conventions

### Variables & Functions
| Language | Variables | Functions | Constants |
|----------|-----------|-----------|-----------|
| TypeScript / JavaScript | `camelCase` | `camelCase` | `SCREAMING_SNAKE_CASE` |
| Python | `snake_case` | `snake_case` | `SCREAMING_SNAKE_CASE` |
| Go | `camelCase` | `camelCase` | `CamelCase` (exported) |
| Rust | `snake_case` | `snake_case` | `SCREAMING_SNAKE_CASE` |
| Java | `camelCase` | `camelCase` | `SCREAMING_SNAKE_CASE` |
| C# | `camelCase` | `PascalCase` | `PascalCase` |
| Swift | `camelCase` | `camelCase` | `camelCase` |

### Classes / Types / Interfaces
`PascalCase` — all languages, no exceptions.

### Booleans
Prefix with `is`, `has`, `can`, `should`: `isLoading`, `hasError`, `canEdit`, `shouldRefresh`.

### Collections
Plural nouns: `users`, `errors`, `items` — not `userList`, `errorArray`.

### Avoid
- Single-letter variables outside loop counters (`i`, `j`, `k` are OK in loops)
- Abbreviations that save under 3 characters: `usr` → `user`, `mgr` → `manager`
- Redundant type names: `UserInterface`, `UserClass`, `UserObject` → just `User`

---

## Function Design

- **Max length:** 50 lines (firm guideline; > 80 lines is always a split target)
- **Single responsibility:** one function, one job — if "and" appears in the description, split it
- **Max parameters:** 3; beyond that, use an options/config object
- **Cyclomatic complexity:** ≤ 10; > 15 is a mandatory refactor target
- **Nesting depth:** ≤ 3 levels; use early returns to flatten

### Early Return Pattern (preferred)
```typescript
// BEFORE — deep nesting
function handle(input) {
  if (input) {
    if (input.valid) {
      return process(input);
    }
  }
  return null;
}

// AFTER — early returns
function handle(input) {
  if (!input || !input.valid) return null;
  return process(input);
}
```

---

## Error Handling

- **Never swallow errors silently:** `catch (e) {}` is always wrong
- **Error messages must contain context:** `"Failed to fetch user id=42"` not `"Error"`
- **Propagate or handle:** either handle the error at the right level OR re-throw it — never both and never neither
- **Typed errors (TypeScript):** `class NotFoundError extends Error { constructor(id: string) ... }` not generic `new Error`
- **Python exceptions:** catch specific exception types; bare `except:` is forbidden
- **Go errors:** always check returned errors; use `errors.Is()`/`errors.As()` for comparison
- **Rust results:** use `?` for propagation; no `.unwrap()` in library code

---

## Code Structure

### Immutability-First
- `const` over `let` (JS/TS); `val` over `var` (Swift/Kotlin); `final` where appropriate
- Mark fields `readonly` when not reassigned after construction
- Prefer immutable data structures for function arguments

### No Magic Numbers
```typescript
// BAD
if (retries > 3) { ... }
setTimeout(fn, 5000);

// GOOD
const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 5000;
if (retries > MAX_RETRIES) { ... }
setTimeout(fn, POLL_INTERVAL_MS);
```

### No Commented-Out Code
If it is dead → delete it (git history preserves it).
If it is needed soon → it should be in a branch.
If it explains a non-obvious decision → keep it as a comment, not commented-out code.

---

## Anti-Patterns Reference

| Pattern | Severity | Reason |
|---------|----------|--------|
| Mutable global state | HIGH | Unpredictable side effects; hides dependencies |
| Promise not awaited | HIGH | Unhandled async errors silently swallowed |
| `any` in TypeScript | MEDIUM | Bypasses type safety across call boundaries |
| `console.log` in production code | LOW | Log noise; potential data leak in sensitive contexts |
| `TODO` without issue tracker reference | LOW | Becomes permanent tech debt |
| God Object | HIGH | Single class with too many responsibilities |
| Magic numbers inline | MEDIUM | Unclear intent; maintenance hazard |
| Copy-paste logic | MEDIUM | Silent divergence over time |
| Catching and re-throwing without context | MEDIUM | Stack traces lose meaning |
| Nested ternary operators | MEDIUM | Unreadable; use if/else or switch instead |

---

## SOLID Principles Checklist

- **S**ingle Responsibility: does this class/function do exactly one thing?
- **O**pen/Closed: extend via composition/interfaces, not inheritance modification?
- **L**iskov Substitution: can a subtype always replace the base type without breaking callers?
- **I**nterface Segregation: no fat interfaces — clients should not depend on methods they don't use?
- **D**ependency Inversion: depend on abstractions (interfaces), not concretions?

---

## See Also

- `@code-reviewer` — applies these rules during code review
- `@typescript-reviewer`, `@python-reviewer`, etc. — language-specific rules with these as baseline
- `@security-reviewer` — security-specific standards (OWASP, secrets, crypto)
