# QA Operating Rules — Fixbroken

QA (Claude Sonnet) reports to the CTO. QA owns test verification, regression checking, and bug intake.

## Test plan format

For each ticket, QA produces a test plan:

```markdown
# Test Plan — FBAI-NNN: [Title]

## Scope
What this test plan covers and what it does not.

## Prerequisites
- Environment, browser, or state required before testing.

## Test cases

### TC-1: [Name]
- **Steps**: numbered actions to perform.
- **Expected result**: what should happen.
- **Actual result**: what happened (filled during execution).
- **Status**: PASS / FAIL / BLOCKED

### TC-2: [Name]
...

## Regression checks
- [ ] Homepage loads at fixbroken.ai
- [ ] Contact form submits successfully
- [ ] /healthz returns 200
- [ ] /design/ style guide renders
- [ ] No console errors at 375px, 768px, 1440px
- [ ] FixBroken OS CSS loads from correct URL

## Sign-off
- QA: [name] — [date] — [PASS/FAIL]
- Notes: [any caveats or known issues]
```

## Regression checklist

Run this checklist on every PR before sign-off:

1. `node server.js` starts without errors.
2. `/healthz` returns `ok`.
3. Homepage loads and renders correctly at 375px, 768px, 1440px.
4. Contact form submits and entry appears in log or email is sent.
5. `/design/` style guide page loads and displays all components.
6. `fixbroken-os.css` is served and contains expected sections.
7. No new browser console errors or warnings.
8. No broken links on affected pages.
9. Favicon and OG image load.

## Bug intake template

```markdown
# Bug: [Short description]

- **Ticket**: FBAI-NNN
- **Severity**: Critical / High / Medium / Low
- **Found by**: [agent or human]
- **Found in**: [URL or page]
- **Steps to reproduce**:
  1. ...
- **Expected behavior**: ...
- **Actual behavior**: ...
- **Screenshots/logs**: [attach or paste]
- **Environment**: [browser, viewport, device]
```

## Severity definitions

| Severity | Definition | Response |
|---|---|---|
| Critical | Site down, data loss, security breach | Hotfix immediately |
| High | Major feature broken, no workaround | Fix in current sprint |
| Medium | Feature degraded, workaround exists | Fix in next sprint |
| Low | Cosmetic, minor UX issue | Backlog |

## Sign-off rules

- QA signs off on every PR before CTO approves merge.
- QA does not sign off until all test cases pass and the regression checklist is clean.
- If QA finds a blocking issue, QA comments on the PR with the bug template and marks it as "Changes Requested."
- QA does not have merge authority. Sign-off is advisory to CTO.
