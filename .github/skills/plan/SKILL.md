---
name: plan
description: >
  Strategic planning with optional interview workflow.
  Activate when user says: plan this, plan the, let's plan,
  make a plan, how should we approach.
argument-hint: "[--direct|--consensus|--review] <task description>"
---

# Plan

Creates comprehensive, actionable work plans through intelligent interaction. Auto-detects whether to interview (broad requests) or plan directly (detailed requests).

## Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| Interview | Default for broad requests | Interactive requirements gathering |
| Direct | `--direct`, or detailed request | Skip interview, generate plan directly |
| Consensus | `--consensus`, "ralplan" | Planner → Architect → Critic loop |
| Review | `--review` | Critic evaluation of existing plan |

## Interview Mode (broad/vague requests)
1. Classify request: broad triggers interview
2. Ask ONE focused question at a time for preferences, scope, constraints
3. Gather codebase facts via @explore BEFORE asking user
4. Consult @analyst for hidden requirements
5. Create plan when user signals readiness

## Direct Mode (detailed requests)
1. Optional brief @analyst consultation
2. Generate comprehensive work plan immediately

## Consensus Mode (`--consensus` / "ralplan")
1. @planner creates initial plan with RALPLAN-DR summary (Principles, Decision Drivers, Options)
2. @architect reviews for architectural soundness (sequential, NOT parallel with critic)
3. @critic evaluates quality criteria (after architect completes)
4. Re-review loop (max 5 iterations) if critic rejects
5. Apply improvements on approval
6. Final plan includes ADR (Decision, Drivers, Alternatives, Why chosen, Consequences)

## Review Mode (`--review`)
1. Read plan from `.omc/plans/`
2. @critic evaluates
3. Return verdict: APPROVED / REVISE / REJECT

## Output
Plans saved to `.omc/plans/`. Include:
- Requirements Summary
- Testable Acceptance Criteria
- Implementation Steps (with file references)
- Risks and Mitigations
- Verification Steps
