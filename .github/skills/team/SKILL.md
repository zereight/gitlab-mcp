---
name: team
description: >
  N coordinated agents on shared task list with staged pipeline.
  Activate when user says: team, spawn agents, parallel agents,
  coordinate agents, multi-agent, swarm, work together.
argument-hint: "[N:agent-type] [ralph] <task description>"
---

# Team

Spawn N coordinated agents working on a shared task list. Uses VS Code's native subagent system for team management, inter-agent messaging, and task dependencies.

## When to Use
- Task is decomposable into independent subtasks
- Multiple files/modules need parallel work
- Large-scale refactoring, migration, or multi-service work

## When NOT to Use
- Single-file changes → use `/omg-autopilot` or direct editing
- Sequential pipeline → use `/omg-autopilot`
- Just need a plan → use `/plan` or `/ralplan`

## Usage

```
/team 3:executor "fix all TypeScript errors"
/team 4:designer "implement responsive layouts"
/team "refactor the auth module"
/team ralph "build a complete REST API"
```

### Parameters

- **N** — Number of agents (1-20). Defaults to auto-sizing.
- **agent-type** — Agent for `team-exec` stage (executor, debugger, designer, etc.). Defaults to stage-aware routing.
- **ralph** — Wraps team in Ralph's persistence loop (retry on failure, verification before completion).
- **task** — High-level task to decompose and distribute.

## Architecture

```
User: "/team 3:executor fix all TypeScript errors"
              |
              v
      [omg-coordinator (Lead)]
              |
              +-- Analyze & decompose → subtask list
              |
              +-- Create tasks with dependencies
              |
              +-- Spawn N worker agents (subagents)
              |
              +-- Monitor loop (messages + task polling)
              |
              +-- Completion → shutdown workers → cleanup
```

## Staged Pipeline

`team-plan → team-prd → team-exec → team-verify → team-fix (loop)`

### Stage Agent Routing

Each stage uses specialized agents — not just executors:

| Stage | Required Agents | Optional Agents |
|-------|----------------|-----------------|
| **team-plan** | @explore, @planner | @analyst, @architect |
| **team-prd** | @analyst | @critic |
| **team-exec** | @executor | @debugger, @designer, @writer, @test-engineer |
| **team-verify** | @verifier | @test-engineer, @security-reviewer, @code-reviewer |
| **team-fix** | @executor | @debugger |

**Routing rules:**
1. Lead picks agents per stage, not the user. User's `N:agent-type` only overrides `team-exec` workers.
2. Specialist agents complement executors. Route analysis to @architect, UI to @designer.
3. Security-sensitive or >20 file changes must include @security-reviewer + @code-reviewer in `team-verify`.

### Stage Entry/Exit Criteria

- **team-plan**: Entry = invocation. Exit = task graph ready.
- **team-prd**: Entry = scope ambiguous. Exit = acceptance criteria explicit.
- **team-exec**: Entry = tasks created + workers spawned. Exit = tasks reach terminal state.
- **team-verify**: Entry = execution pass done. Exit (pass) = gates pass. Exit (fail) = fix tasks generated.
- **team-fix**: Entry = defects found. Exit = fixes done, return to team-verify.

### Verify/Fix Loop

Continue `team-exec → team-verify → team-fix` until:
1. Verification passes with no required fixes, or
2. Max fix attempts exceeded (default: 3) → terminal `failed`

## Workflow

### Phase 1: Parse Input
- Extract N (agent count, validate 1-20)
- Extract agent-type
- Extract task description
- Check for `ralph` modifier

### Phase 2: Analyze & Decompose
Use @explore or @architect to analyze the codebase and break the task into N subtasks:
- Each subtask should be file-scoped or module-scoped
- Subtasks must be independent or have clear dependencies
- Each needs a concise subject and detailed description

### Phase 3: Create Team
Write team state via `omg_write_state`:
```json
{
  "mode": "team",
  "active": true,
  "team_name": "fix-ts-errors",
  "agent_count": 3,
  "current_phase": "team-plan",
  "task": "fix all TypeScript errors"
}
```

### Phase 4: Create Tasks
Create subtasks with dependencies. Pre-assign owners to avoid race conditions.

### Phase 5: Spawn Workers
Spawn N subagents in parallel using the `agents` field references:
- Each worker gets team preamble + assigned tasks
- Workers execute independently and report back

### Phase 6: Monitor
Monitor via two channels:
1. **Inbound messages** — workers report completion or need help
2. **Task polling** — check overall progress periodically

**Coordination actions:**
- Unblock a worker with guidance
- Reassign work if a worker finishes early
- Handle failures — reassign or spawn replacement

**Watchdog policy:**
- Task stuck >5 min without messages → send status check
- No messages >10 min → reassign task
- Worker fails 2+ tasks → stop assigning to it

### Phase 7: Stage Transitions
Update state on every stage transition via `omg_write_state`.

### Phase 8: Completion
1. Signal shutdown to all workers
2. Wait for responses (15s timeout)
3. Clean up team resources and state
4. Report summary

## Stage Handoff Convention

Each stage produces a handoff document before transitioning:

```markdown
## Handoff: <current-stage> → <next-stage>
- **Decided**: [key decisions]
- **Rejected**: [alternatives and why]
- **Risks**: [identified risks]
- **Files**: [key files modified]
- **Remaining**: [items for next stage]
```

Handoffs saved to `.omc/handoffs/<stage-name>.md`. Survive cancellation for resume.

## Team + Ralph Composition

When `ralph` modifier is present:
1. Ralph creates PRD with stories
2. Each story executed as a team pipeline
3. Team verify/fix loop satisfies story acceptance criteria
4. Ralph verifies story completion
5. Next story begins

## State Tracking

Track in `.omc/state/team-state.json` via `omg_write_state`/`omg_read_state`.

## Resume and Cancel

- **Resume**: Restart from last non-terminal stage using state + handoffs
- **Cancel**: `/cancel` → graceful shutdown → cleanup → state preserved/cleared per policy
