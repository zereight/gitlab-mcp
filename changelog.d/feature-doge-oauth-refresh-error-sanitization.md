### Security

- OAuth refresh failures no longer log GitLab response bodies or propagate raw
  transport and response-read diagnostics. Rejected grants retain their existing
  OAuth error classification.
