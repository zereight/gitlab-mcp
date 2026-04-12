---
name: skill-stocktake
description: >
  Audit the skill inventory for quality, coverage, and staleness. Detect overlapping,
  incomplete, or outdated skills and produce a health report.
  Activate when: skill audit, stocktake, skill inventory, check skills, which skills exist,
  audit skills, skill quality, skill coverage.
argument-hint: "[optional: focus area — coverage | quality | staleness | all]"
---

# Skill Stocktake

Audit the `.github/skills/` and `vscode-omg/resources/templates/skills/` directories to produce a quality and coverage report.

## When to Use
- Before adding new skills (to avoid duplication)
- After a large change batch (to verify templates are in sync)
- Periodically to prune stale or incomplete skills

## Audit Protocol

### Step 1: Inventory
```bash
# List all skill directories
ls -1d .github/skills/*/

# Count total
ls -1d .github/skills/*/ | wc -l

# Check each has a SKILL.md
for dir in .github/skills/*/; do
  [ -f "${dir}SKILL.md" ] || echo "MISSING SKILL.md: $dir"
done
```

### Step 2: Frontmatter Validation (v1.0.5+)

Each SKILL.md MUST have valid frontmatter:
```yaml
---
name: skill-name           # required, kebab-case, matches directory name
description: >             # required, multi-line description with trigger keywords
  ...
argument-hint: "..."       # optional, describes argument
---
```

**v1.0.5 breaking changes to check:**
- ❌ `hint:` field → ✅ `argument-hint:` 
- ❌ `allowed-tools:` field → ✅ remove (not supported)
- Skill name `autopilot` → must be `omg-autopilot` (naming collision)

Validate with:
```bash
# Find skills using old 'hint:' field
grep -rn "^hint:" .github/skills/

# Find skills using unsupported 'allowed-tools:'
grep -rn "^allowed-tools:" .github/skills/

# Check for old 'autopilot' directory
ls .github/skills/ | grep "^autopilot$"
```

### Step 3: Template Sync Check
```bash
# Skills in .github but not in templates
diff <(ls .github/skills/) <(ls vscode-omg/resources/templates/skills/)

# Skills in templates but not in .github (orphan templates)
diff <(ls vscode-omg/resources/templates/skills/) <(ls .github/skills/)
```

### Step 4: Quality Checks

For each skill, check:
- [ ] `name:` matches directory name exactly
- [ ] `description:` includes trigger keywords ("Activate when: X, Y, Z")
- [ ] Has a clear "When to Use" or "Steps" section
- [ ] Has an "Output Format" or "See Also" section
- [ ] No broken cross-references to renamed skills (`/autopilot` → `/omg-autopilot`)
- [ ] File is not empty stub (< 20 lines = likely incomplete)

### Step 5: Coverage Analysis

Check against the skill catalog in `copilot-instructions.md`:
```bash
# Extract skill names from instructions
grep -o '/[a-z-]*' .github/copilot-instructions.md | sort | uniq

# Compare to actual skill directories
ls -1d .github/skills/*/ | xargs -I{} basename {}
```

Identify gaps: skills mentioned in instructions but missing from disk, or vice versa.

---

## Output Format

```
## Skill Stocktake Report

**Date:** [timestamp]
**Total Skills:** X

### Inventory
| Skill | Has SKILL.md | Lines | Frontmatter OK | In Instructions |
|-------|-------------|-------|----------------|-----------------|
| omg-autopilot | ✅ | 120 | ✅ | ✅ |
| [skill] | ❌ missing | — | — | ✅ |

### Issues Found
| Type | Skill | Issue | Severity |
|------|-------|-------|----------|
| Frontmatter | old-skill | Uses `hint:` not `argument-hint:` | MEDIUM |
| Sync | new-skill | In .github but missing from templates | LOW |
| Coverage | planning | Mentioned in instructions but no directory | HIGH |
| Stale | autopilot | Old name — should be omg-autopilot | HIGH |

### Summary
- Skills passing all checks: X/Y
- Issues requiring action: Z
  - HIGH: A
  - MEDIUM: B
  - LOW: C

### Recommended Actions
1. [Action with file path]
2. [Action with file path]
```

## See Also

- `@omg-coordinator` — orchestrates multi-skill workflows
- `/verify` — verifies specific task completion
- `/status` — shows current active workflow state
- `/remember` — stores quality insights to memory
