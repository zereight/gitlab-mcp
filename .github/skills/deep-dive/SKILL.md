---
name: deep-dive
description: >
  2-stage pipeline: trace (causal investigation) then deep-interview (requirements).
  Activate when user says: deep dive, deep-dive, investigate deeply, trace and interview.
argument-hint: "<problem or exploration target>"
---

# Deep Dive

Orchestrates a 2-stage pipeline: first investigate WHY something happened (trace), then define WHAT to do about it (deep-interview). Trace findings feed into the interview via 3-point injection.

## Pipeline
`deep-dive` → `ralplan` (consensus refinement) → `omg-autopilot` (execution)

## When to Use
- User has a problem but doesn't know the root cause
- Bug investigation: "Something broke and I need to figure out why"
- Feature exploration: "I want to improve X but first need to understand it"

## When NOT to Use
- Already know the root cause → use `/deep-interview`
- Clear specific request → execute directly
- Investigation only, no requirements → use `/trace`

## Phases

### Phase 1: Initialize
1. Parse problem, detect brownfield/greenfield
2. Generate 3 trace lane hypotheses (code-path, config/env, measurement/artifact)

### Phase 2: Lane Confirmation
Present hypotheses to user for confirmation (1 round).

### Phase 3: Trace Execution
Run 3 parallel tracer lanes using @tracer agents:
- Each lane: evidence for, evidence against, critical unknown, discriminating probe
- Rebuttal round between top hypotheses
- Convergence detection
- Save to `.omc/specs/deep-dive-trace-{slug}.md`

### Phase 4: Interview with Trace Injection
Follow deep-interview protocol with 3 overrides:
1. **initial_idea enrichment**: Include trace's most likely explanation
2. **codebase_context replacement**: Use trace synthesis (skip re-exploration)
3. **question queue injection**: Per-lane critical unknowns become first questions

Low-confidence trace: don't inject uncertain conclusion, use ALL unknowns as questions.

### Phase 5: Execution Bridge
Same options as deep-interview: ralplan → omg-autopilot (recommended), omg-autopilot, ralph, team, or refine further.

## Output
Spec saved to `.omc/specs/deep-dive-{slug}.md` with additional "Trace Findings" section.
