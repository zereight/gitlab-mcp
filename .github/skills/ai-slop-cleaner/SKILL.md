---
name: ai-slop-cleaner
description: >
  Clean AI-generated code slop with regression-safe workflow.
  Activate when user says: deslop, anti-slop, AI slop, cleanup slop,
  clean up this code, remove bloat.
argument-hint: "[--review] [files or scope]"
---

# AI Slop Cleaner

Clean AI-generated code slop without changing behavior. Deletion-first workflow with regression safety.

## When to Use
- Code that works but feels bloated, repetitive, or over-abstracted
- Duplicate logic, dead code, wrapper layers, boundary leaks
- `--review` for reviewer-only mode (no changes, just findings)

## When NOT to Use
- New feature build or product change
- Broad redesign
- Behavior is unclear and untestable

## Principles
- Preserve behavior unless explicitly asked for changes
- Delete before refactoring — removal is safest
- Scope-bounded: only clean what was specified
- Regression-safe: verify tests pass after every change

## Slop Signals
- Unnecessary wrapper functions
- Duplicated logic across files
- Over-abstracted single-use helpers
- Dead code / unreachable branches
- Excessive comments restating obvious code
- Premature abstractions (used only once)

## Workflow
1. Identify target files/scope
2. Run existing tests (baseline)
3. Apply deletions first (dead code, unused imports)
4. Simplify remaining code (reduce nesting, merge duplicates)
5. Re-run tests after each change
6. Report what was cleaned and verification results
