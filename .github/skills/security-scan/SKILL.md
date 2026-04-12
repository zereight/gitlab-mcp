---
name: security-scan
description: >
  Rapid security scanning workflow for code changes. Activates a focused security sweep.
  Activate when: security scan, scan for vulnerabilities, check for secrets,
  security check, run security audit, check deps.
argument-hint: "[path or scope to scan — defaults to recent git changes]"
---

# Security Scan

Rapid security sweep for code changes. Faster than a full `/review` — focused on security only.

## When to Use
- Before committing code that touches auth, user input, data storage, or external APIs
- After adding new dependencies
- Quick pre-PR security gate

## Scan Protocol

### Step 1: Determine Scope
```bash
# Default: scan recent changes
git diff --name-only HEAD~1

# Or use provided path
```

### Step 2: Secrets Scan
```bash
# Scan for common secret patterns
grep -rn --include="*.{ts,js,py,go,rs,java,cs,yaml,json,env,sh,toml}" \
  -e "sk-[A-Za-z0-9]\{32,\}" \
  -e "ghp_[A-Za-z0-9]\{36\}" \
  -e "AKIA[0-9A-Z]\{16\}" \
  -e "api.key\s*=\s*['\"][^'\"]\{8,\}" \
  -e "password\s*=\s*['\"][^'\"]\{4,\}" \
  -e "secret\s*=\s*['\"][^'\"]\{8,\}" \
  .

# Check .env is in .gitignore
cat .gitignore | grep -E "\.env$|\.env\."
```

**CRITICAL:** Any match in committed code = immediate blocker.

### Step 3: Dependency Audit
Run language-appropriate audit:
```bash
# Node.js
npm audit --audit-level=high

# Python
pip-audit  # or: safety check

# Rust
cargo audit

# Go
govulncheck ./...

# Java/Maven
mvn dependency-check:check
```

**Report:** Count of critical/high severity CVEs and their package names.

### Step 4: Input Validation Spot-Check
For changed files that handle user input (API endpoints, form handlers, CLI args):
- Is input validated/sanitized before use?
- Are SQL queries parameterized (no string concatenation)?
- Is HTML output escaped before rendering?
- Are file paths sanitized (no `../` traversal)?

### Step 5: Auth/Authz Quick Check
For changed files touching auth:
- Is authentication checked BEFORE authorization?
- Are authorization checks on EVERY relevant endpoint?
- Are JWT tokens validated (algorithm + signature + expiry)?
- Are session cookies `HttpOnly; Secure; SameSite=Strict`?

---

## Output Format

```
## Security Scan Report

**Scope:** [files scanned]
**Date:** [timestamp]

### Secrets
- [ ] No hardcoded secrets found
- ⚠ Found: [file:line — description]

### Dependencies
- Critical CVEs: X
- High CVEs: Y
- Packages: [list if any]

### Input Validation
- [ ] User inputs sanitized in changed files
- ⚠ Risk: [file:line — description]

### Auth
- [ ] Auth/authz checks present on relevant routes
- ⚠ Risk: [file:line — description]

### Verdict
CLEAN / NEEDS ATTENTION / BLOCKER

### Next Steps
- [Action items with file:line references]
```

## Severity Quick Reference

| Finding | Severity | Action |
|---------|----------|--------|
| Hardcoded secret in committed file | CRITICAL | Rotate key + remove from history |
| Critical CVE in direct dependency | HIGH | Update package immediately |
| SQL injection risk | CRITICAL | Parameterize query before PR |
| Missing auth check on endpoint | HIGH | Add before PR |
| High CVE in transitive dependency | MEDIUM | Track in backlog |
| HTTP instead of HTTPS | MEDIUM | Enforce HTTPS redirect |

## See Also

- `@security-reviewer` — comprehensive OWASP Top 10 security review
- `/review` — full code review including security
- `/coding-standards` — baseline code quality rules
