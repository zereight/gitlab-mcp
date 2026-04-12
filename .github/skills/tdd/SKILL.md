---
name: tdd
description: >
  Test-Driven Development enforcement skill. Activates full TDD mode.
  Activate when: TDD, test-driven, test first, red-green-refactor, write tests first.
argument-hint: "[feature or function to implement with TDD]"
---

# TDD — Test-Driven Development

**THE IRON LAW: Write the failing test FIRST. Always.**

## The Red-Green-Refactor Cycle

```
RED   → Write a failing test for the NEXT behavior
GREEN → Write ONLY enough code to make it pass (no extras)
REFACTOR → Clean up code quality (tests must stay green after every change)
REPEAT
```

## Step-by-Step Protocol

### 1. RED Phase
1. Identify the smallest next behavior to implement
2. Write a test that describes that behavior as a named `it()` / `test()` / `def test_`
3. **Run the test** — it MUST FAIL. If it passes, the test is wrong.
4. Confirm the failure message is the RIGHT failure (not a syntax error)

```typescript
// Example: RED — test fails because function doesn't exist yet
it('returns an empty array for an empty input', () => {
  const result = parseItems([]);
  expect(result).toEqual([]);  // FAILS: parseItems is not defined
});
```

### 2. GREEN Phase
1. Write the MINIMUM code to make the test pass
2. Do not add extra logic, default parameters, or "nice-to-haves"
3. Run ALL tests — the new test must pass; existing tests must not break

```typescript
// Example: GREEN — just enough to pass
function parseItems(input: string[]): string[] {
  return [];  // only enough for the current test
}
```

### 3. REFACTOR Phase
1. Look at the code — can it be cleaner without changing behavior?
2. Apply simplification patterns (see `/ai-slop-cleaner` and `/coding-standards`)
3. **Run tests after EVERY change.** If tests break, undo immediately.

## TDD Gate — When to Stop

| Situation | Action |
|-----------|--------|
| Code written before test | STOP. Delete production code. Write test first. |
| Test passes on first run (no prior code) | The test is wrong — fix it to fail first. |
| Multiple behaviors in one test | STOP. One test, one behavior. |
| Skipping refactor to go faster | Go back. Clean up before next feature. |

## Naming Tests as Specifications

Tests are executable documentation. Name them as complete sentences:

```typescript
// BAD
it('test1', ...)
it('works with empty', ...)

// GOOD
it('returns empty array when input is empty', ...)
it('throws ValidationError when email is missing @', ...)
it('sends exactly one email when user registers', ...)
```

## Framework Quick Reference

| Framework | Failing assertion | Run single test |
|-----------|-------------------|-----------------|
| Vitest | `expect(x).toBe(y)` | `npx vitest run -t "test name"` |
| Jest | `expect(x).toBe(y)` | `npx jest -t "test name"` |
| pytest | `assert x == y` | `pytest -k "test_name"` |
| cargo test | `assert_eq!(x, y)` | `cargo test test_name` |
| go test | `t.Errorf(...)` | `go test -run TestName` |

## Common TDD Pitfalls

| Pitfall | Fix |
|---------|-----|
| Testing implementation details | Test behavior (outputs), not internals (private methods) |
| One test for 10 behaviors | Split into atomic test cases |
| Mock everything (over-mocking) | Mock at system boundaries only (DB, HTTP, filesystem) |
| No triangulation | Write 2-3 tests that force the correct implementation to emerge |
| Untriangulated constants | `return 42` passes one test — add a second test to force real logic |

## See Also

- `@test-engineer` — test strategy, framework detection, coverage gap analysis
- `/ultraqa` — QA cycling: test, verify, fix, repeat
- `/verify` — evidence-based completion verification
