# SDLC — Fixbroken

## Branching Model

- `main` — production. Deploys to https://fixbroken.ai on push via webhook.
- `staging` — preview. Deploys to https://stage.fixbroken.ai (basic auth).
- Feature branches: `<type>/<ticket-id>-<short-description>` (e.g., `feat/FBAI-001-repo-skeleton`).
- All work happens on feature branches. No direct commits to `main` or `staging`.

### Branch types

| Prefix | Use |
|---|---|
| `feat/` | New feature or enhancement |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring, no behavior change |
| `chore/` | Tooling, config, CI, dependencies |

## PR Rules

1. Every change goes through a pull request. No exceptions.
2. CTO reviews and approves all PRs before merge.
3. PR title follows: `[FBAI-NNN] Short description`.
4. PR body must include: what changed, why, test plan, and any risks.
5. One logical change per PR. If a PR touches unrelated concerns, split it.
6. Squash merge to `main`. Keep feature branch history clean but merge as one commit.
7. Delete the feature branch after merge.

## Test Requirements

1. Manual verification at 375px, 768px, and 1440px widths for any frontend change.
2. `node server.js` must start without errors.
3. Health check (`/healthz`) must return 200.
4. Contact form must not regress (submit and verify log entry or email).
5. Design system changes must be checked against `/design/` style guide.
6. No new lint errors introduced (once linter is configured via FBAI-001).

## Definition of Done

A ticket is done when:

- Code is merged to `main` via approved PR.
- Deploy webhook has fired and prod is serving the change.
- QA has verified acceptance criteria on the live site.
- No regressions in existing functionality.
- ARCHITECTURE.md updated if the change affects system design.

## Release Cadence

- Continuous deployment to prod on merge to `main`.
- No scheduled release windows. Ship when ready.
- If a deploy breaks prod, revert first, investigate second.
- Staging is for preview and stakeholder review, not gating.

## Hotfix Process

1. Branch from `main`: `fix/FBAI-NNN-description`.
2. Fix, test, open PR.
3. CTO reviews with expedited SLA (1 hour, not 2).
4. Merge and verify prod.
