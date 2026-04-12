---
name: ccg
description: >
  Claude-Codex-Gemini tri-model orchestration for multi-perspective analysis.
  Activate when user says: ccg, tri-model, three models, multi-model,
  cross-validate, get multiple opinions, compare models.
argument-hint: "<task description>"
---

# CCG - Claude-Codex-Gemini Tri-Model Orchestration

Route a task through three AI models in parallel, then synthesize their outputs into one unified answer.

## When to Use
- Backend/analysis + frontend/UI work in one request
- Code review from multiple perspectives
- Cross-validation where models may disagree
- Fast parallel input without full team orchestration

## When NOT to Use
- Simple, straightforward tasks → execute directly
- Already clear on approach → use `/omg-autopilot`
- Need coordinated multi-agent work → use `/team`

## Requirements

- **Codex CLI**: `npm install -g @openai/codex`
- **Gemini CLI**: `npm install -g @google/gemini-cli`
- If either CLI is unavailable, continue with whichever provider works

## Execution Protocol

### 1. Decompose Request

Split the user request into:
- **Codex prompt**: architecture, correctness, backend, risks, test strategy
- **Gemini prompt**: UX/content clarity, alternatives, edge-case usability, docs polish
- **Synthesis plan**: how to reconcile conflicts

### 2. Invoke Advisors

Run both advisors via CLI in parallel:

```bash
# Run in terminal
codex "<codex prompt>"
gemini "<gemini prompt>"
```

Or via VS Code's `selectChatModels()` API if available:
```
Promise.all([
  model_openai.sendRequest(codex_prompt),
  model_google.sendRequest(gemini_prompt)
])
```

### 3. Collect Results

Gather outputs from both advisors.

### 4. Synthesize

Return one unified answer with:
- **Agreed** recommendations
- **Conflicting** recommendations (explicitly called out)
- **Chosen** final direction + rationale
- **Action** checklist

## Fallbacks

| Scenario | Action |
|----------|--------|
| One provider unavailable | Continue with available + Claude synthesis |
| Both unavailable | Fall back to Claude-only answer |

## Example

```
/ccg Review this PR - architecture/security via Codex and UX/readability via Gemini
```

Output:
```
=== CCG Synthesis ===

## Agreed
- Authentication middleware needs rate limiting
- Error messages should be more user-friendly

## Conflicting
- Codex: Use middleware pattern for validation
- Gemini: Use inline validation for simplicity
→ Chosen: Middleware pattern (consistency with existing codebase)

## Action Checklist
- [ ] Add rate limiting middleware
- [ ] Improve error messages in auth flow
- [ ] Extract validation to middleware layer
```
