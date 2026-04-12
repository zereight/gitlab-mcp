---
name: trace
description: >
  Evidence-driven tracing with competing hypotheses in parallel.
  Activate when user says: trace this, trace, why did this happen,
  root cause analysis, investigate why.
argument-hint: "<observation to trace>"
---

# Trace

Evidence-driven causal tracing using competing hypotheses. Use for ambiguous, causal, evidence-heavy questions where the goal is to explain WHY something happened.

## Good Entry Cases
- Runtime bugs and regressions
- Performance / latency behavior
- Architecture / premortem / postmortem analysis
- Config / routing / orchestration behavior
- "Given this output, trace back the likely causes"

## Core Contract
Always preserve: Observation → Hypotheses → Evidence For → Evidence Against → Best Explanation → Critical Unknown → Discriminating Probe

## Workflow
1. Restate the observed result precisely
2. Generate 3 deliberately different hypotheses:
   - Code-path / implementation cause
   - Config / environment / orchestration cause
   - Measurement / artifact / assumption mismatch
3. Assign @tracer to each hypothesis lane
4. Each lane: evidence for, evidence against, critical unknown, discriminating probe
5. Apply lenses: Systems, Premortem, Science
6. Rebuttal round between top two hypotheses
7. Rank, detect convergence, synthesize

## Output
```
### Observed Result
[What happened]

### Ranked Hypotheses
| Rank | Hypothesis | Confidence | Evidence Strength |
|------|------------|------------|-------------------|

### Most Likely Explanation
[Current best explanation]

### Critical Unknown
[Single missing fact]

### Recommended Discriminating Probe
[Single next probe]
```
