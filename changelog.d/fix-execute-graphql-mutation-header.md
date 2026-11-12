### Security

- Harden `execute_graphql` mutation detection in modify mode against comma-separated and decorated operation headers. GraphQL documents that cannot be parsed are now rejected by the read-only and modify-mode guards.
