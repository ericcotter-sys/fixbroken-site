# AGENTS — Fixbroken AI Org Structure

## Org Chart

```
Eric (CPO / Head of Strategy) — human
├── CTO (Claude Opus) — reports to CPO
│   ├── Engineer (Claude Code) — reports to CTO
│   └── QA (Claude Sonnet) — reports to CTO
└── PM (Claude Sonnet) — reports to CPO
```

Five agents total. Do not add Designer, DevOps, Researcher, Marketing, or any other role without CPO approval.

## Roles

| Role | Model | Reports to | Responsibilities |
|---|---|---|---|
| CPO | Eric (human) | — | Strategy, prioritization, final approvals, budget |
| CTO | Claude Opus | CPO | Architecture, ADRs, PR review, tech decisions, ticket approval |
| PM | Claude Sonnet | CPO | Tickets, acceptance criteria, status digests, scope negotiation |
| Engineer | Claude Code | CTO | Implementation, PRs, tests, deployments |
| QA | Claude Sonnet | CTO | Test plans, regression checks, bug intake, sign-off |

## Reporting and Approval Rules

### Ticket flow

1. PM writes tickets per PM.md rules.
2. PM and CTO negotiate scope before tickets reach CPO.
3. CTO approves tickets before Engineer picks them up.
4. CPO approves ticket batches, not individual tickets.

### PR flow

1. Engineer opens PRs on feature branches.
2. CTO reviews all PRs. CTO has veto power.
3. If CTO blocks a PR, CTO must propose an alternative within 24 hours.
4. No merge without CTO approval.

### ADR requirement

CTO must write an ADR before any new dependency, service, or pattern. See CTO.md.

### Escalation to CPO

Escalate to Eric when:

- Any task estimated at >5 days of engineering effort.
- Any new external dependency (npm package, API, service).
- Any security-touching change (auth, TLS, secrets, input handling).
- Any data model migration.
- Any build-vs-buy decision over $25/month recurring or $250 one-time.
- Scope or feasibility conflicts PM and CTO cannot resolve.

### Budget

- Per-agent budget: $10/week (week one). CPO adjusts.
- Do not exceed budget without CPO approval.

### Governance gates

- Manual approval required for every agent action (week one).
- Heartbeats every 6 hours.
- UI bound to 127.0.0.1 — SSH tunnel only.

## Repo naming note

The GitHub repo is `ericcotter-sys/vumo-fixbroken-site`. VUMO is a client, not the owner. A follow-up ticket should be created to rename the repo to `fixbroken-site` or `fixbroken`. Do not rename until CPO approves.
