---
name: remember
description: >
  Promote reusable project knowledge to the right memory surface.
  Activate when user says: remember this, save this, store this,
  remember, memorize, keep this for later.
argument-hint: "[what to remember]"
---

# Remember

Promote durable, reusable knowledge into the right memory surface instead of leaving it buried in chat history.

## When to Use
- User wants to preserve knowledge discovered during a session
- Organizing scattered findings into structured memory
- Cleaning up duplicate or conflicting stored information

## When NOT to Use
- Ephemeral task notes → just keep in conversation
- Already documented in code or docs → reference directly

## Memory Surfaces

| Surface | Use For | Durability |
|---------|---------|------------|
| **Project memory** | Durable team/project knowledge | Permanent |
| **Session context** | Short-lived working notes | Session only |
| **Docs / Instructions** | Conventions, instructions | Permanent |

## Workflow

1. Gather the relevant session findings
2. Classify each item:
   - Durable project fact
   - Temporary working note
   - Operator preference or instruction
   - Duplicate / stale / conflicting information
3. Propose the best destination for each item
4. Write or update only the appropriate memory surface
5. Call out duplicates or conflicts that should be cleaned up

## Rules

- Do not dump everything into one store
- Prefer project memory for durable team knowledge
- Keep entries concise and actionable
- If something is uncertain, mark it as uncertain rather than storing it as fact

## Output

- What was stored
- Where it was stored
- Any duplicates/conflicts found

---

## Quality Gate (Before Storing)

Before committing anything to memory, apply this 3-question filter. Skip storage if the answer to any question is "No":

| Question | Rationale |
|----------|-----------|
| **Is it actionable?** "Does this tell someone what to DO in a future situation?" | Observations are not memory entries; decisions are. |
| **Is it durable?** "Will this still be true in 3 months, or is it tied to a temporary workaround?" | Ephemeral findings belong in session notes, not project memory. |
| **Is it unique?** "Does something close already exist in memory that covers this?" | Duplicate entries create confusion; prefer updating existing entries. |

### Examples

| Item | Actionable? | Durable? | Unique? | Store? |
|------|-------------|----------|---------|--------|
| "Use `bcrypt` cost=12 for passwords in this project" | ✅ | ✅ | ✅ | **YES** |
| "API was slow today because server was rebooting" | ❌ | ❌ | ✅ | **NO** — ephemeral |
| "Always run `npm run build` before pushing" | ✅ | ✅ | Check existing | **YES if not already stored** |
| "The login page has a bug in dark mode" | ❌ | ❌ | ✅ | **NO** — file a bug, not a memory entry |
| "We prefer `interface` over `type` for object shapes" | ✅ | ✅ | Check existing | **YES if not in coding-standards** |

### When to Update vs Create

- **UPDATE** an existing entry if the new information refines, corrects, or supersedes it
- **CREATE** a new entry only if no existing entry covers the topic
- **DELETE** entries that are provably outdated (check with user first)

## See Also

- `/coding-standards` — canonical rules reference (no need to duplicate into memory)
- `/skill-stocktake` — audit memory surfaces for quality

