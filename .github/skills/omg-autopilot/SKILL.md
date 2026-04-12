---
name: omg-autopilot
description: >
  Full autonomous execution from idea to working code.
  Activate when user says: autopilot, auto-pilot, autonomous,
  build me, create me, make me, full auto, handle it all,
  or "I want a/an..."
argument-hint: "<product idea or task description>"
---

# OMG Autopilot

OMG Autopilot takes a brief product idea and autonomously handles the full lifecycle: requirements analysis, technical design, planning, parallel implementation, QA cycling, and multi-perspective validation.

## When to Use
- User wants end-to-end autonomous execution from an idea to working code
- Task requires multiple phases: planning, coding, testing, and validation
- User wants hands-off execution

## When NOT to Use
- User wants to explore options → use `/plan`
- Single focused code change → use `/ralph` or delegate to @executor
- Quick fix or small bug → delegate directly to @executor

## Execution Pipeline

### Phase 0 - Expansion
Turn the user's idea into a detailed spec.
- If ralplan consensus plan exists (`.omc/plans/ralplan-*.md`): Skip Phase 0 AND Phase 1 → jump to Phase 2
- If deep-interview spec exists (`.omc/specs/deep-interview-*.md`): Use pre-validated spec, skip to Phase 1
- If input is vague: Offer redirect to `/deep-interview` for clarification
- Otherwise: @analyst extracts requirements, @architect creates technical specification
- Output: `.omc/autopilot/spec.md`
- Track phase: `omg_write_state(phase="expansion_done")`

### Phase 1 - Planning
Create an implementation plan from the spec.
- @architect creates plan (direct mode)
- @critic validates plan
- Output: `.omc/plans/autopilot-impl.md`
- Track: `omg_write_state(phase="planning_done")`

### Phase 2 - Execution
Implement the plan using parallel execution.
- Route tasks by complexity to @executor
- Run independent tasks in parallel
- Track: `omg_write_state(phase="execution_done")`

### Phase 3 - QA
Cycle until all tests pass (max 5 cycles).
- Build, lint, test, fix failures
- Stop early if the same error repeats 3 times (fundamental issue)
- Track: `omg_write_state(phase="qa_done")`

### Phase 4 - Validation
Multi-perspective review in parallel.
- @architect: Functional completeness
- @security-reviewer: Vulnerability check
- @code-reviewer: Quality review
- All must approve; fix and re-validate on rejection
- Track: `omg_write_state(phase="validation_done")`

### Phase 5 - Cleanup
Delete all state files on successful completion.
- Run `/cancel` for clean exit

## Stop Conditions
- Same QA error persists across 3 cycles → report fundamental issue
- Validation keeps failing after 3 rounds → report issues
- User says "stop", "cancel", or "abort"

## Checklist
- [ ] All 5 phases completed
- [ ] All validators approved in Phase 4
- [ ] Tests pass (verified with fresh output)
- [ ] Build succeeds
- [ ] State files cleaned up
