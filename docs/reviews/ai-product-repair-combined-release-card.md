# Release Card — candidate: combined (hardening + copy-tighten)

- Date: 2026-07-07
- Branch: `post-prod/ai-product-repair-combined` (from hardening tip `cc1c93f`; page delta vs `origin/main` @ `02089f7`: +20/−2, one file)
- Page-edit commit: `e7b4d4ff5568d3c11253f7d5481ee1fe36a4acc5`
- Theme: the comparison doc's ship recommendation as a single reviewable branch
- Status: **review** (not merged to main, prod untouched)

## Contents (public/ai-product-repair/index.html)
From `hardening` (16ce46a):
1. Intake lede + pricing note: requesting a plan is a fit check, not a
   purchase; nothing billed until scope is agreed.
2. Pricing anchor line: plans priced against sprints spent on wrong fixes.

From `copy-tighten` (98c3960):
3. "What happens next" three-step block above the intake form.
4. Plan-vs-engagement boundary line at the pricing note.

No pricing numbers changed. No new promises. All four edits restate flow
facts already present elsewhere on the page (success box, FAQ).

## QA
- voice-lint 0 errors · page audit grade A · pre-commit clean
- Served from branch; greps confirm all 4 edits render; $20,000/$40,000
  counts unchanged (4 each)
- Screenshots: `/tmp/ai-product-repair-review/combined-e7b4d4f-{desktop,mobile}.png`

## UAT
See board/status for staging state. Staging deploy = push this branch to
`staging` (fast-forward, webhook auto-deploys behind basic auth). Captain or
Eric call.

## Recommendation
**Ship this branch after one outside review** (single-source guardrail:
public copy, no external input yet). It supersedes shipping `hardening` and
`copy-tighten` separately; `lower-friction` and `proof-risk` remain
independent follow-ups needing Eric decisions.
