---
name: deep-interview
description: >
  Socratic deep interview with mathematical ambiguity gating.
  Activate when user says: deep interview, interview me, ask me everything,
  don't assume, make sure you understand, ouroboros, socratic,
  I have a vague idea, not sure exactly what I want.
argument-hint: "[--quick|--standard|--deep] <idea or vague description>"
---

# Deep Interview

Ouroboros-inspired Socratic questioning with mathematical ambiguity scoring. Replaces vague ideas with crystal-clear specifications by asking targeted questions that expose hidden assumptions.

## Pipeline
`deep-interview` → `ralplan` (consensus refinement) → `omg-autopilot` (execution)

## When to Use
- User has a vague idea and wants thorough requirements gathering
- Task is complex enough that jumping to code would waste cycles
- User wants mathematically-validated clarity before execution

## When NOT to Use
- Detailed specific request with file paths → execute directly
- Quick fix → delegate to @executor or `/ralph`
- User says "just do it" → respect their intent

## Phases

### Phase 1: Initialize
1. Parse the user's idea
2. Detect brownfield vs greenfield (use @explore to check codebase)
3. For brownfield: map relevant codebase areas
4. Initialize ambiguity score at 100%

### Phase 2: Interview Loop
Repeat until ambiguity <= 20% or user exits early:

1. **Generate question** targeting the WEAKEST clarity dimension
2. **Ask ONE question at a time** with current ambiguity context
3. **Score ambiguity** across dimensions:
   - Goal Clarity (40% weight for greenfield, 35% brownfield)
   - Constraint Clarity (30% / 25%)
   - Success Criteria (30% / 25%)
   - Context Clarity (N/A / 15% for brownfield)
4. **Report progress** with dimension scores and gaps
5. **Track ontology** (key entities, stability ratio)

### Phase 3: Challenge Agents
- Round 4+: **Contrarian** - challenge core assumptions
- Round 6+: **Simplifier** - probe for complexity removal
- Round 8+: **Ontologist** - find the essence (if ambiguity > 30%)

### Phase 4: Crystallize Spec
When ambiguity <= threshold, generate spec to `.omc/specs/deep-interview-{slug}.md`:
- Goal, Constraints, Non-Goals, Acceptance Criteria
- Assumptions Exposed & Resolved
- Ontology (Key Entities) with convergence tracking
- Interview Transcript

### Phase 5: Execution Bridge
Present options:
1. **Ralplan → OMG Autopilot** (Recommended): consensus-refine then execute
2. **Execute with omg-autopilot** (skip ralplan)
3. **Execute with ralph**: persistence loop
4. **Execute with team**: parallel agents
5. **Refine further**: continue interviewing

## Rules
- Ask ONE question at a time
- Target the WEAKEST clarity dimension each round
- Gather codebase facts via @explore BEFORE asking user
- Score ambiguity after every answer
- Do not proceed until ambiguity <= threshold (default 20%)
- Hard cap at 20 rounds, soft warning at 10
