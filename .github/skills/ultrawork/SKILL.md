---
name: ultrawork
description: >
  Parallel execution engine for high-throughput task completion.
  Activate when user says: ulw, ultrawork, parallel execution,
  run these in parallel.
argument-hint: "<task description with parallel work items>"
---

# Ultrawork

Parallel execution engine that runs multiple agents simultaneously for independent tasks. Component mode -- provides parallelism and smart model routing but not persistence or verification loops.

## When to Use
- Multiple independent tasks can run simultaneously
- Need to delegate work to multiple agents at once

## When NOT to Use
- Need guaranteed completion with verification → use `/ralph` (includes ultrawork)
- Full autonomous pipeline → use `/omg-autopilot` (includes ralph which includes ultrawork)
- Only one sequential task → delegate directly to @executor

## Relationship
```
ralph (persistence wrapper)
 └── includes: ultrawork (this skill)

omg-autopilot (autonomous execution)
 └── includes: ralph
     └── includes: ultrawork (this skill)
```

## Steps
1. Classify tasks by independence: parallel vs dependent
2. Fire independent tasks simultaneously via @executor
3. Run dependent tasks sequentially after prerequisites
4. Background long operations (builds, installs, tests)
5. Verify when all tasks complete (build passes, tests pass)

## Execution Policy
- Fire ALL independent tasks simultaneously
- Run builds/tests in background
- Match task complexity to appropriate model routing
