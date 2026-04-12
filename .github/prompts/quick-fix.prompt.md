---
name: quick-fix
description: Diagnose and fix a bug or error with minimal disruption
---

Fix the reported issue using the smallest possible change. Follow this process:

1. **Reproduce**: Understand the error. Read the relevant code and error output.
2. **Diagnose**: Identify the root cause. Don't fix symptoms.
3. **Fix**: Apply the minimal change that resolves the issue.
4. **Verify**: Run relevant tests or build to confirm the fix works.
5. **Report**: State what was wrong and what you changed (1-2 sentences).

Rules:
- Do NOT refactor surrounding code
- Do NOT add features
- Do NOT change unrelated files
- Prefer fixing the actual bug over adding defensive checks
- If existing tests don't cover this case, add ONE focused test
