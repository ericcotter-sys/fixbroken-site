# Release Card — candidate: proof-risk

- Date: 2026-07-07
- Branch: `post-prod/ai-product-repair-proof-risk` (from `origin/main` @ `02089f7`)
- Page-edit commit: `379b5fe69cace5871d998c967e87b7fb65073f89`
- Theme: reduce skepticism with specificity and honest limits — zero fabricated proof
- Status: **review** (not merged, not deployed; prod untouched)

## What changed (public/ai-product-repair/index.html only)
1. **"What we look for" panel** (end of "what this is" section) — five concrete
   failure patterns that make the seven abstract dimensions tangible. Proof of
   expertise through specificity, not testimonials. All patterns are generic
   AI-product failure modes; none reference any client.
2. **"Honest limits" panel** (end of FAQ section, amber border) — four caveats:
   can't fix the model; can't guarantee a metric moves; wrong-shape breaks get
   turned away at the fit check before money moves; what you leave with is the
   call and the order of operations. Covers "what you leave with" and risk
   caveat language in one block.

## Deliberately NOT added
Testimonials, client quotes, case studies, logos, "as seen in", success
metrics — unavailable without fabrication, and fabricated trust signals on a
trust-repair page would be self-refuting. The good-fit/bad-fit and
what-this-is-not sections already existed on the page and were left as-is.

## Untouched
Pricing numbers, CTAs, hero, all existing claims, all other pages, prod,
main, staging.

## Checks
voice-lint 0 errors · page audit grade A · pre-commit clean

## Screenshots
- `/tmp/ai-product-repair-review/proof-risk-desktop.png`
- `/tmp/ai-product-repair-review/proof-risk-mobile.png`

## Risk
Low-medium. Adds the most net-new copy of the three candidates (two panels),
so it needs the closest read for voice drift. "Before any money moves" is a
soft billing-flow statement — true of the current flow (no payment exists at
intake), but Eric should confirm he's comfortable stating it. Outside read
required (guardrail).
