---
name: review
description: >
  Code review with spec compliance and quality checks.
  Activate when user says: review this, code review, review my changes.
argument-hint: "[--style|--performance|--quality] [files or scope]"
---

# Review

Systematic code review with severity-rated feedback.

## Modes
- **Default**: Full two-stage review (spec compliance + code quality)
- `--style`: Lightweight style-only checks
- `--performance`: Performance analysis and hotspot identification
- `--quality`: Release readiness and quality gate assessment

## Workflow
1. Delegate to @code-reviewer for spec compliance + code quality
2. Delegate to @security-reviewer for vulnerability detection
3. Compile findings with severity ratings

## Output
- Issues rated: CRITICAL / HIGH / MEDIUM / LOW
- Each issue includes file:line, description, and fix suggestion
- Clear verdict: APPROVE / REQUEST CHANGES / COMMENT
