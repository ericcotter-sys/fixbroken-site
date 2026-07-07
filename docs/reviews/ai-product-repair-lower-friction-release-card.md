# Release Card — candidate: lower-friction

- Date: 2026-07-07
- Branch: `post-prod/ai-product-repair-lower-friction` (from `origin/main` @ `02089f7`)
- Page-edit commit: `092ebd4e619d2cdc821259bdb048a117605e9d83`
- Theme: make the first step feel easy without touching the price
- Status: **review** (not merged, not deployed; prod untouched)

## What changed (public/ai-product-repair/index.html only)
1. **Hero + mid-page CTA**: "Request a repair plan" → "Start with a private
   scan" — "start" is smaller than "request", "private" answers the
   confidentiality worry at the moment of click.
2. **Pricing-card CTAs**: "Request a Rapid Scan / Deep Plan" → "Start the
   Rapid Scan / Deep Plan intake" — the object of the click is now the
   five-minute intake, not the $20k/$40k purchase. `data-tier` attributes
   unchanged (preselect JS intact, deep-link `?tier=` unaffected).
3. **Saves-money line** in "what this is": "one wrong sprint it stops costs
   more than the plan that stopped it" — extends the page's existing
   sprint-cost argument to the price; no numbers stated.
4. **Qualification softener** in intake lede: sending commits you to nothing;
   "not a fit" is a free answer.
5. **Form submit**: "Request a repair plan" → "Send the intake" (JS
   error-path label resets updated to match).
6. Mid-page mono note: "Private, read by one human."

## Untouched
Pricing numbers and cards' scope copy, all claims, hero headline, all other
pages, prod, main, staging.

## Checks
voice-lint 0 errors · page audit grade A · pre-commit clean · data-tier
preselect behavior preserved (attributes untouched, labels only)

## Screenshots
- `/tmp/ai-product-repair-review/lower-friction-desktop.png`
- `/tmp/ai-product-repair-review/lower-friction-mobile.png`

## Risk
Medium-low. Most opinionated candidate: CTA verbs change sitewide-visible
behavior language ("private scan" is a new *name* for the same intake, though
not a new claim — the privacy promise already exists in "who reviews this").
Eric should confirm he likes "Start with a private scan" as the page's
primary verb before this ships. Outside read required (guardrail).
