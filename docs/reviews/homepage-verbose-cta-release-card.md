# Release Card — candidate: homepage verbose secondary CTA

- Date: 2026-07-07
- Branch: `post-prod/homepage-verbose-cta` (from `origin/main` @ `02089f7`)
- Page-edit commit: `42cc56788c22772ff18a456dc7306d0a8ef3befd`
- Requested by Eric: verbose toggle is too hidden — make it a secondary CTA,
  "not HEY DO THIS, but also not an easter egg"
- Status: **review** (not merged, not deployed; prod untouched)

## What changed (public/index.html only)
1. New "Go verbose" `.fb-cta--ghost` button next to "Let's Chat" in the hero
   CTA row — standard design-system secondary treatment, visually quiet next
   to the pink-solid primary.
2. `.hp-hero-cta-wrap` becomes a wrapping inline-flex row (was single-button
   inline-block). Entrance animation unchanged, both buttons rise together.
3. The button drives the exact same `apply()` state as the pill. On flip-on
   it smooth-scrolls to the verbose layer so the click visibly pays off;
   label swaps to "Back to quiet"; `aria-pressed` synced on both controls.
4. The original pill stays where it was — it remains the on/off state
   indicator and the nudge system's anchor. No nudge logic touched.

## Locked-surface compliance
- Hero copy: untouched (HOMEPAGE_REQUIRED voice-lint green, 0 errors).
- Pre-CTA gating: unchanged — operations/OS terminal/tokenz/ladder still
  render only after the toggle flips; verbose still resets every load.

## QA (from a branch serve, both viewports)
- off-state: button reads "Go verbose", `aria-pressed=false`
- click → verbose layer visible, label "Back to quiet", `aria-pressed=true`
- mobile 390px: both CTAs fit side by side, no overflow
- voice-lint 0 errors · page audit grade A

## Screenshots
`/tmp/ai-product-repair-review/verbose-cta-42cc567-{off,on}-{desktop,mobile}.png`

## Recommendation
Ship after Eric eyeballs the off-state screenshot (label wording "Go
verbose" / "Back to quiet" is a taste call) — plus the standing outside-read
guardrail for public copy.
