# AI Product Repair — Candidate Comparison & Recommendation

- Date: 2026-07-07
- Baseline: prod `main` @ `02089f7` — https://fixbroken.ai/ai-product-repair/ (200 OK, verified)
- Nothing below is merged or deployed. Prod is untouched.

## The four candidates

All branch from `origin/main` @ `02089f7`. Each changes only
`public/ai-product-repair/index.html` plus its own docs. Screenshots are
full-page desktop (1440) + mobile (390) in `/tmp/ai-product-repair-review/`.

| Branch | Tip | Page edit | Theme | Screenshots |
|---|---|---|---|---|
| `post-prod/ai-product-repair-hardening` | `7f9e0d3` | `16ce46a` | fit-check framing + pricing anchor | `candidate-16ce46a-*` |
| `post-prod/ai-product-repair-copy-tighten` | `c370d68` | `98c3960` | what-happens-next + plan-vs-engagement boundary | `copy-tighten-*` |
| `post-prod/ai-product-repair-lower-friction` | `f513370` | `092ebd4` | softer CTAs, private-scan framing, saves-money line | `lower-friction-*` |
| `post-prod/ai-product-repair-proof-risk` | `293d21d` | `379b5fe` | what-we-look-for + honest-limits panels | `proof-risk-*` |

All four: voice-lint 0 errors, page audit grade A, pushed to origin.
The hardening branch also carries all review docs (prod archive, both audits,
release cards for itself; each other branch carries its own release card).

## Best candidate: `hardening`, with `copy-tighten` folded in

**Why hardening wins:** the offer audit ranked the page's two costliest
problems as (1) unanchored $20k pricing and (2) every CTA reading as a $20k
commitment. Hardening fixes exactly those two, in 9 lines, restating only
what is already true. Smallest diff per unit of objection killed.

**Why fold in copy-tighten:** its two edits (what-happens-next steps,
plan-vs-engagement boundary at pricing) are non-overlapping, equally
conservative, and answer the #3-ranked objection ("what actually happens
after I click?"). The two branches merge cleanly in concept — combined diff
is still ~20 lines of copy.

**Why it's safer than the alternatives:**
- `lower-friction` renames the primary action ("Start with a private scan")
  — probably right, but it's a naming/taste call that belongs to Eric, and
  the same friction problem is 80% solved by hardening's fit-check line.
- `proof-risk` adds the most net-new prose (two panels). Good material, but
  most voice-drift surface and one soft billing statement ("before any money
  moves") that needs Eric's sign-off. Second wave, not first.

## What still needs Eric's approval (blocking, in order)

1. **Outside review** — single-source guardrail: all of this is
   public-shipping copy with no external input yet. Hand any release card +
   the offer audit to one outside reviewer before merging anything.
2. **CTA verb** — keep "Request a repair plan" or adopt lower-friction's
   "Start with a private scan"? Taste call, Eric only.
3. **"Before any money moves" / "nothing billed until scope is agreed"** —
   true of the current flow, but they're billing-adjacent statements; confirm
   comfort.
4. **Delivery-time promise** — still absent everywhere (deliberately). Only
   Eric can commit to a turnaround per tier.

## Ship path (when approved)

Merge chosen branch → `staging`, eyeball https://stage.fixbroken.ai/ai-product-repair/
(basic auth), then → `main` (webhook deploys in ~10s). Recapture prod
screenshots after.

## Recommendation summary

| Candidate | Verdict |
|---|---|
| hardening (+copy-tighten) | **ship after outside review** |
| lower-friction | **revise** — hold for Eric's CTA-verb decision, then cherry-pick |
| proof-risk | **park** — good second wave once the first merge settles |
