# Release Card — AI Product Repair post-prod hardening

Date: 2026-07-07 · Author: Claude (autonomous hardening pass)

## Production (untouched this pass)
- URL: https://fixbroken.ai/ai-product-repair/
- HTTP status: **200 OK** (curl, 2026-07-07 ~05:50 UTC)
- Prod commit: `02089f7741c066850f75b6414e8e11acd8d61134` (== origin/main == prod checkout)
- Verified unchanged: candidate copy ("fit check") greps **0** on prod, **2** on candidate
- Prod archive screenshots: `/tmp/ai-product-repair-review/prod-02089f7-{desktop,mobile}.png`

## Candidate
- Branch: `post-prod/ai-product-repair-hardening` (pushed to origin; NOT merged)
- Commit: `16ce46a97bff39e83b280fbd9e593fd34b30f68f`
- Changed files vs main:
  - `public/ai-product-repair/index.html` (+9/−2) — two copy edits, no pricing numbers touched
  - `docs/reviews/ai-product-repair-post-prod-audit.md` (new) — full 9-point audit
  - `docs/reviews/ai-product-repair-release-card.md` (new) — this file
- Candidate screenshots: `/tmp/ai-product-repair-review/candidate-16ce46a-{desktop,mobile}.png`
  (served locally from the branch on port 3055, since torn down)

## What changed in candidate
1. Pricing note now says requesting a plan is a fit check, not a purchase —
   nothing billed until scope is agreed. (Audit finding #3/#8: every CTA read
   as a $20k commitment.)
2. New one-line pricing anchor: plans priced against sprints spent on wrong
   fixes. (Audit finding #1: naked prices with no cost rationale.)
3. Intake lede: "Sending it doesn't commit you to anything — it starts a fit
   check, not an invoice."

## What stayed untouched
- Prod page, homepage, pricing numbers ($20,000 / $40,000), all other pages,
  staging, main branch. No merges, no deploys.

## Checks
- voice-lint: 0 errors (6 pre-existing warnings in other files)
- page audit: `public/ai-product-repair/index.html` grade **A**
- pre-commit voice-lint on staged files: clean

## Recommendation: **review, then ship**
The edits are small, in-voice, and state only what is already true of the
intake flow. Per the single-source guardrail: this is public-shipping copy
with no outside input yet — get one external read (see audit doc for the
open questions) before merging to staging → main.

## Remaining risks
1. No outside review of the copy or the $20k/$40k framing has happened yet.
2. Delivery-time promise is still absent (deliberately — needs Eric's call
   on turnaround per tier before anyone writes it).
3. `.fb-terminal__body` lacks `overflow-x:auto` — fine today, fragile if the
   rubric grows longer field names (design-system fix, parked).
4. Untracked dirs served from prod checkout (`public/ericmike/`,
   `public/free/audit/tduaufvpck/`) — unrelated to this page, needs cleanup.
5. Staging checkout still one commit behind prod (manifest regen only).

## How to review
1. Look at candidate screenshots vs prod screenshots (paths above).
2. Read the diff: `git diff main...post-prod/ai-product-repair-hardening -- public/`
3. Read `docs/reviews/ai-product-repair-post-prod-audit.md` (5 min).
4. To ship: merge branch → `staging`, eyeball https://stage.fixbroken.ai/ai-product-repair/,
   then merge → `main` (auto-deploys in ~10s).
