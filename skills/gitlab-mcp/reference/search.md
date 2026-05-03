# Code Search

> **Opt-in toolset**: Enable with `GITLAB_TOOLSETS=search`

Search requires GitLab advanced search or exact code search/Zoekt support on the target instance.

## Scope

```
search_code          -> search code across all accessible projects
search_project_code  -> search within one project
search_group_code    -> search within one group
```

## Pattern

Use the narrowest scope that can answer the question. Prefer `search_project_code` when the project is known, then broaden to group or instance-wide search only when needed.
