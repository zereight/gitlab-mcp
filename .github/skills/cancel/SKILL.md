---
name: cancel
description: >
  Cancel any active OMG mode and clean up state.
  Activate when user says: cancel, stop, cancelomg, stopomg,
  abort, kill it, stop everything.
argument-hint: "[--force|--all]"
---

# Cancel

Intelligent cancellation that detects and cancels the active OMG mode.

## What It Does

Automatically detects which mode is active and cancels it:
- **OMG Autopilot**: Stops workflow, preserves progress for resume
- **Ralph**: Stops persistence loop
- **Ultrawork**: Stops parallel execution
- **UltraQA**: Stops QA cycling workflow
- **Team**: Sends shutdown to all teammates, cleans up
- **Self-Improve**: Stops loop, preserves iteration state for resume

## Usage

```
/cancel
/cancel --force
/cancel --all
```

## Auto-Detection

Reads `.omc/state/` to discover which mode is active. Cancels in dependency order:

1. OMG Autopilot (includes linked ralph/ultraqa cleanup)
2. Ralph (cleans linked ultrawork)
3. Ultrawork (standalone)
4. UltraQA (standalone)
5. Team (graceful shutdown + cleanup)
6. Self-Improve (preserve iteration state)

## Workflow

### 1. Parse Arguments
Check for `--force` or `--all` flags.

### 2. Detect Active Modes
Use `omg_read_state` to check each mode's state file.

### 3A. Force Mode (--force or --all)
Clear ALL state files in `.omc/state/`. Nuclear option.

### 3B. Smart Cancellation (default)

#### If OMG Autopilot Active
1. Check for linked ralph → clear ultrawork if linked → clear ralph
2. Check for linked ultraqa → clear it
3. Mark omg-autopilot inactive (preserve state for resume)

#### If Ralph Active (not OMG Autopilot)
1. Check for linked ultrawork → clear if linked
2. Clear ralph state

#### If Team Active
1. Signal shutdown to all teammates
2. Wait for responses (15s timeout per member)
3. Clean up team resources
4. Clear linked ralph if present

#### If UltraQA / Ultrawork / Self-Improve Active
Clear state directly.

#### No Active Modes
Report: "No active OMG modes detected. Use --force to clear all state."

## What Gets Preserved

| Mode | State Preserved | Resume Command |
|------|-----------------|----------------|
| OMG Autopilot | Yes (phase, files, spec) | `/omg-autopilot` |
| Self-Improve | Yes (iteration state) | `/self-improve --resume` |
| Ralph | No | N/A |
| Others | No | N/A |

## Messages

| Mode | Success Message |
|------|-----------------|
| OMG Autopilot | "OMG Autopilot cancelled at phase: {phase}. Progress preserved." |
| Ralph | "Ralph cancelled. Persistent mode deactivated." |
| Ultrawork | "Ultrawork cancelled." |
| UltraQA | "UltraQA cancelled." |
| Team | "Team cancelled. Teammates shut down." |
| Self-Improve | "Self-improve stopped at iteration {N}." |
| Force | "All OMG modes cleared." |
| None | "No active OMG modes detected." |
