---
name: ralph
description: >
  PRD-driven persistence loop until task completion with verification.
  Activate when user says: ralph, don't stop, must complete, finish this,
  keep going until done.
argument-hint: "[--no-prd] [--no-deslop] <task description>"
---

# Ralph

Ralph is a PRD-driven persistence loop that keeps working on a task until ALL user stories have `passes: true` and are reviewer-verified.

## When to Use
- Task requires guaranteed completion with verification
- Work may span multiple iterations and needs persistence
- Task benefits from structured PRD-driven execution

## When NOT to Use
- Full autonomous pipeline → use `/omg-autopilot`
- Explore or plan before committing → use `/plan`
- Quick one-shot fix → delegate to @executor

## Flags
- `--no-prd`: Skip PRD generation, work in legacy mode (for trivial fixes)
- `--no-deslop`: Skip the mandatory post-review cleanup pass

## Steps

### 1. PRD Setup (first iteration)
- Check if `.omc/prd.json` exists via `omg_read_prd`
- If none exists, generate a PRD scaffold with task-specific acceptance criteria
- **CRITICAL**: Replace generic criteria with specific, testable ones
- Initialize progress tracking

### 2. Pick Next Story
- Read PRD via `omg_read_prd`
- Select highest-priority story with `passes: false`

### 3. Implement Current Story
- Delegate to @executor at appropriate complexity level
- If sub-tasks are discovered, add as new stories to PRD

### 4. Verify Acceptance Criteria
- For EACH criterion, verify with fresh evidence
- Run relevant checks (test, build, lint, typecheck)
- If any criterion NOT met, continue working

### 5. Mark Story Complete
- Set `passes: true` via `omg_update_story`
- Record progress in `progress.txt`

### 6. Check PRD Completion
- Call `omg_check_completion`
- If NOT all complete, loop to Step 2
- If ALL complete, proceed to verification

### 7. Reviewer Verification
- @verifier checks against specific acceptance criteria from PRD
- @architect reviews for architectural soundness

### 7.5 Mandatory Cleanup Pass
- Unless `--no-deslop`, run `/ai-slop-cleaner` on changed files only

### 7.6 Regression Re-verification
- Re-run all tests after cleanup pass
- Only proceed after regression tests pass

### 8. Completion
- On approval: run `/cancel` for clean exit
- On rejection: fix issues, re-verify, loop back

## Execution Policy
- Fire independent tasks simultaneously
- Run builds/tests in background
- Deliver full implementation: no scope reduction, no partial completion

## Checklist
- [ ] All PRD stories have `passes: true`
- [ ] Acceptance criteria are task-specific (not generic)
- [ ] All requirements met (no scope reduction)
- [ ] Fresh test output shows all tests pass
- [ ] Reviewer verification passed
- [ ] Cleanup pass completed (or `--no-deslop`)
- [ ] Post-cleanup regression tests pass
