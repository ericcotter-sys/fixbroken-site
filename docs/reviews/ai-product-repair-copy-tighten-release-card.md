# Release Card — candidate: copy-tighten

- Date: 2026-07-07
- Branch: `post-prod/ai-product-repair-copy-tighten` (from `origin/main` @ `02089f7`)
- Page-edit commit: `98c396038059942f5232ba0b87d0a54b9dc3e29b`
- Theme: conservative clarity — make the existing flow explicit, add nothing new
- Status: **review** (not merged, not deployed; prod untouched)

## What changed (public/ai-product-repair/index.html only)
1. **"What happens next" block** above the intake form — three mono steps:
   human reads intake (48h) → straight fit answer → scope agreed, plan arrives.
   The success box already described this flow; now the buyer sees it *before*
   submitting.
2. **Plan-vs-engagement boundary at the pricing note** — "Both are diagnostic
   plans your team runs itself. Hands-on repair work is a separate engagement —
   and it only starts after a plan." Previously this boundary only existed in
   the FAQ, below the price cards. Restates existing FAQ copy; no new claim.

## Untouched
Pricing numbers, hero, all claims, all other pages, prod, main, staging.

## Checks
voice-lint 0 errors · page audit grade A · pre-commit clean

## Screenshots
- `/tmp/ai-product-repair-review/copy-tighten-desktop.png`
- `/tmp/ai-product-repair-review/copy-tighten-mobile.png`

## Risk
Lowest-risk candidate. Both edits restate copy already on the page in a more
visible position. Still needs one outside read before shipping (guardrail).
