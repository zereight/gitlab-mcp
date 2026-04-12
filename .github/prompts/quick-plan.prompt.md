---
name: quick-plan
description: Generate a rapid implementation plan for a task
---

Create a concise implementation plan for the requested task. Follow this structure:

## Analysis
- What exists today (scan relevant files)
- What needs to change

## Plan
Number each step. For each step:
- **What**: specific action
- **Where**: file path(s)
- **How**: brief approach

## Risks
- What could go wrong
- Dependencies or blockers

## Verification
- How to confirm the plan worked (tests, manual checks)

Keep the plan actionable and specific to this codebase. Reference actual file paths and function names. Do not over-engineer — prefer the simplest approach that solves the problem.
