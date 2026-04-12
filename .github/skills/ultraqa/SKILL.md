---
name: ultraqa
description: >
  QA cycling workflow - test, verify, fix, repeat until goal met.
  Activate when user says: ultraqa, qa cycle, fix all tests, make tests pass.
argument-hint: "[--tests|--build|--lint|--typecheck] [--interactive]"
---

# UltraQA

Autonomous QA cycling workflow that runs until your quality goal is met.

**Cycle**: run checks → diagnose failures → fix → repeat

## Goal Types

| Flag | What to Check |
|------|---------------|
| `--tests` | All test suites pass |
| `--build` | Build succeeds with exit 0 |
| `--lint` | No lint errors |
| `--typecheck` | No TypeScript errors |
| `--interactive` | Interactive CLI/service testing via @qa-tester |

## Cycle Workflow (Max 5)

1. **RUN QA**: Execute verification based on goal type
2. **CHECK RESULT**: Pass → exit success. Fail → continue
3. **DIAGNOSE**: @architect analyzes failure, provides root cause
4. **FIX**: @executor applies architect's recommendations
5. **REPEAT**: Go back to step 1

## Exit Conditions
- **Goal Met**: "ULTRAQA COMPLETE: Goal met after N cycles"
- **Cycle 5 Reached**: Exit with diagnosis
- **Same Failure 3x**: Exit early with root cause
- **Environment Error**: Exit with error details

## State Tracking
Track in `.omc/ultraqa-state.json`. Clean up state files on completion.

## Output
```
[ULTRAQA Cycle 1/5] Running tests...
[ULTRAQA Cycle 1/5] FAILED - 3 tests failing
[ULTRAQA Cycle 1/5] Diagnosing...
[ULTRAQA Cycle 2/5] PASSED - All 47 tests pass
[ULTRAQA COMPLETE] Goal met after 2 cycles
```
