# PR #358 Review Summary

- **PR**: [#358](https://github.com/zereight/gitlab-mcp/pull/358)
- **Title**: `feat: add code search tools (search_code, search_project_code, search_group_code)`
- **Status**: Open
- **Date**: 2026-03-14

## Final Verdict

- **Verdict**: **REQUEST CHANGES**
- **Confidence**: **HIGH**

## Code Review Findings

| Priority | Issue | Location |
|---|---|---|
| P1 | URL-encoded `group_id` can be double-encoded in group search path | `index.ts` `searchBlobs()` |
| P2 | Missing regression test for URL-encoded group path case | `test/test-search-code.ts` |

### P1 Detail — `group_id` normalization

`SearchGroupCodeSchema` documents `group_id` as "Group ID or URL-encoded path".  
In runtime, `searchBlobs()` currently does:

- `const groupId = encodeURIComponent(params.group_id)`

If the caller already provides encoded input (e.g. `mygroup%2Fsubgroup`), this can become `%252F` and fail lookup.

**Recommended fix**

Normalize before encoding:

- decode first, then encode once (same pattern used in other ID/path handlers)
- add test coverage for encoded path input

## PR Comment Thread Summary

### 1) Author opening summary (`@pacifical`)

- Adds 3 tools via GitLab Search API `scope=blobs`
  - `search_code` (global)
  - `search_project_code` (project)
  - `search_group_code` (group)
- Adds optional filters and pagination
- Introduces opt-in `search` toolset (`isDefault: false`)

### 2) Community feedback (`@DarkByteZero`)

Main feedback points:

1. **REST vs GraphQL search path**
   - REST `search?scope=blobs` vs GraphQL `blobSearch`
   - Suggestion: optionally support strategy/config selection (`rest|graphql`) depending on instance capability (e.g. Zoekt)

2. **Zoekt syntax documentation**
   - Suggest documenting exact-code-search inline syntax (`file:`, `lang:`, `sym:`, `case:` etc.) in tool descriptions

### 3) Author response (`@pacifical`)

- Accepted/added docs enhancement for Zoekt syntax context
- Mentioned GraphQL route was explored but not pursued in this PR scope

### 4) Thread status

- Reviewer discussion is constructive
- No strong blocking objection from participants in thread
- Copilot review was requested

## Merge Recommendation

### Current recommendation

- **Do not merge immediately** until P1 is fixed.

### Merge-ready conditions

- [ ] Fix `group_id` normalization in `searchBlobs()`
- [ ] Add regression test for URL-encoded group path (`search_group_code`)
- [ ] Re-run build and test suite

## Notes

- This review focuses on correctness and compatibility risk for current implementation.
- Non-blocking enhancement ideas (REST/GraphQL strategy toggling) can be handled in a follow-up PR.
