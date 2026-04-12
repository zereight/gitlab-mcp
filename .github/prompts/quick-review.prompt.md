---
name: quick-review
description: Fast code review of recent changes with severity-rated feedback
---

Review the recent changes in this repository. Focus on:

1. **Logic defects** — bugs, off-by-one errors, null/undefined risks
2. **Security issues** — injection, auth bypass, secrets exposure
3. **Performance** — N+1 queries, unnecessary re-renders, memory leaks
4. **Style** — naming, consistency with existing codebase patterns

Rate each finding by severity: 🔴 Critical, 🟡 Warning, 🔵 Info.

Use `git diff HEAD~1` to identify changes. If no recent commits, review staged changes with `git diff --cached`.

Keep feedback concise. Skip praise — focus on actionable improvements only.
