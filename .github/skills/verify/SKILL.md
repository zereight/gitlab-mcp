---
name: verify
description: >
  Verify that a change really works before claiming completion.
  Activate when user says: verify this, check if it works, prove it works.
argument-hint: "<what to verify>"
---

# Verify

Turn vague "it should work" claims into concrete evidence.

## Workflow
1. Identify the exact behavior that must be proven
2. Prefer existing tests first
3. If coverage is missing, run narrowest direct verification commands
4. If direct automation not enough, describe manual validation steps
5. Report only what was actually verified

## Verification Order
1. Existing tests
2. Typecheck / build
3. Narrow direct command checks
4. Manual or interactive validation

## Rules
- Do not say a change is complete without evidence
- If a check fails, include the failure clearly
- If no realistic verification path exists, say so explicitly
- Prefer concise evidence summaries over noisy logs

## Output
- What was verified
- Which commands/tests were run
- What passed
- What failed or remains unverified
