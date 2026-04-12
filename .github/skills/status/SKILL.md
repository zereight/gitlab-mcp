---
name: status
description: >
  Show current OMG mode status, active agents, and progress.
  Activate when user says: status, what's running, show progress,
  current state, active modes, where are we.
argument-hint: "[--verbose]"
---

# Status

Show the current state of all OMG modes, active agents, and progress.

## When to Use
- Check what mode is currently active
- See progress of omg-autopilot, ralph, or team execution
- Verify state after a cancel or resume

## Workflow

### 1. Scan State Files
Read `.omc/state/` directory for active mode state files:
- `omg-autopilot-state.json`
- `ralph-state.json`
- `ultrawork-state.json`
- `ultraqa-state.json`
- `team-state.json`
- `self-improve/state/agent-settings.json`

### 2. Report Active Modes

For each active mode, show:

**OMG Autopilot:**
- Current phase (0-5)
- Phase name and progress
- Files modified so far

**Ralph:**
- Current story (N of M)
- Stories passing / total
- Linked ultrawork status

**Team:**
- Team name and member count
- Current pipeline stage
- Task completion (N/M tasks done)

**UltraQA:**
- Current cycle (N of 5)
- Last failure summary

**Self-Improve:**
- Current iteration
- Best score vs baseline
- Improvement percentage
- Stop condition proximity

### 3. Report No Active Modes
If nothing is active: "No active OMG modes. Start with `/omg-autopilot`, `/ralph`, or `/team`."

## Output Format

```
=== OMG Status ===

Mode: OMG Autopilot
Phase: 2/5 (Execution)
Started: 2 minutes ago
Files modified: 12

Mode: Team (linked)
Team: fix-ts-errors
Stage: team-exec
Workers: 3/3 active
Tasks: 2/5 completed
```

## Verbose Mode (--verbose)

With `--verbose`, also show:
- Full state JSON for each active mode
- Recent git log (last 5 commits)
- `.omc/` directory listing
