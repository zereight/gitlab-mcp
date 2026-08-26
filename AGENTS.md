# Repository guidance

This repository has optional Graphify support for low-token codebase navigation.

- For architecture or codebase questions, run `graphify query "<question>"` when `graphify-out/graph.json` exists.
- Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused context.
- After code changes, run `graphify update .` when Graphify is available; semantic extraction requires a configured LLM key.
- Do not treat incomplete `graphify-out/` cache files as source code.
