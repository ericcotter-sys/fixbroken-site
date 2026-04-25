# ADR 0001: Record Architecture Decisions

## Status

Accepted

## Date

2026-04-25

## Context

We need to record the architectural decisions made on this project. These decisions affect the structure, dependencies, patterns, and non-functional characteristics of the system.

Without a record of decisions, team members (human and AI agents) must either re-derive the reasoning behind past choices or risk reversing them without understanding the consequences. This is especially important in an AI-agent org where multiple autonomous agents make and execute technical decisions.

## Decision

We will use Architecture Decision Records (ADRs) as described by Michael Nygard in his blog post "Documenting Architecture Decisions."

Each ADR describes a single decision. Each is a short markdown file in the `ADRs/` directory at the repo root.

### Format

Every ADR follows this template:

```markdown
# ADR NNNN: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-NNNN]

## Date

YYYY-MM-DD

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?
```

### Rules

- ADR numbers are sequential and never reused.
- ADRs are immutable once accepted. If a decision is reversed, write a new ADR that supersedes it and update the original's status.
- The CTO owns all ADRs. No ADR is accepted without CTO review.
- An ADR is required before: adding a new dependency, introducing a new service or endpoint, or adopting a new pattern. See CTO.md.
- ADRs that involve cost above the build-vs-buy threshold ($25/month recurring or $250 one-time) require CPO approval.

## Consequences

- Every significant technical decision will have a discoverable, permanent record.
- New team members (human or AI) can read the ADR log to understand why things are the way they are.
- The overhead is small: one short markdown file per decision.
- Decisions are harder to silently reverse, which is the point.
