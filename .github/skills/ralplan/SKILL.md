---
name: ralplan
description: >
  Consensus planning with Planner/Architect/Critic iterative loop.
  Activate when user says: ralplan, consensus plan, consensus planning.
argument-hint: "[--deliberate] <task description>"
---

# Ralplan (Consensus Planning)

Shorthand for `/plan --consensus`. Triggers iterative planning with Planner, Architect, and Critic agents until consensus is reached.

## Flags
- `--deliberate`: Forces deliberate mode for high-risk work. Adds pre-mortem (3 scenarios) and expanded test planning.

## Workflow
1. **@planner** creates initial plan with RALPLAN-DR summary:
   - Principles (3-5)
   - Decision Drivers (top 3)
   - Viable Options (>=2) with pros/cons
2. **@architect** reviews for architectural soundness
3. **@critic** validates quality and testability
4. **Loop** until critic approves (max 5 iterations)
5. Final plan includes ADR (Decision, Drivers, Alternatives, Why chosen, Consequences)

## Pre-Execution Gate
Vague execution requests (e.g., "ralph improve the app") are redirected through ralplan first to ensure explicit scope, testable criteria, and multi-agent consensus.

**Passes gate** (specific enough): prompts with file paths, function names, issue numbers, numbered steps, or acceptance criteria.

**Gated** (needs scoping): prompts with only vague descriptions and no concrete anchors.

## After Approval
- Execute via `/team` (parallel agents, recommended) or `/ralph` (sequential with verification)
