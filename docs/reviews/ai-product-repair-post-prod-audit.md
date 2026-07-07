# AI Product Repair — Post-Prod Copy & Offer Audit

- Date: 2026-07-07
- Auditor: Claude (post-prod hardening pass)
- Page audited: https://fixbroken.ai/ai-product-repair/ at prod commit `02089f7`
- Branch for candidate fixes: `post-prod/ai-product-repair-hardening`
- Prod screenshots (archive): `/tmp/ai-product-repair-review/prod-02089f7-{desktop,mobile}.png`

Scope rule for this audit: findings only. Candidate edits happen in a separate
commit on this branch. Pricing numbers are not changed anywhere; alternate
pricing thinking lives only in the clearly-labeled section at the bottom.

---

## Verdict in one line

The page is honest and structurally strong — its weakest points are that the
$20k/$40k numbers stand naked with no cost anchor, the intake reads like a
purchase commitment when it's actually a fit check, and the buyer is never
told when the plan actually arrives.

---

## The nine questions

### 1. Is the $20k floor clear without sounding arbitrary?

**Finding: weakest point of the page.** The prices appear with scope
descriptions but zero cost rationale. Nothing anchors $20,000 against
anything the buyer already spends. The page itself hands over the anchor in
the "what this is" section — "they're four plausible fixes deep, and each one
costs a sprint" — but never connects that math to the price. A stuck team
burning engineer-sprints on wrong fixes loses more than $20k in weeks; the
page never says so.

- Severity: high (this is the #1 objection at this price point)
- Candidate fix: one clarifying line near the pricing note that connects
  price to the cost of a wasted sprint, using logic already on the page.
  No numbers changed.

### 2. Does the page explain what the buyer gets?

**Finding: yes — strongest part of the page.** "What you get" panel, the
ten-field plan structure, and a fully worked sample break (clearly labeled
invented). A buyer knows exactly what document arrives. No change needed.

### 3. Does it make the first step feel low-friction enough?

**Finding: partial.** The mechanical friction is low (5-minute form, no
discovery calls, 48-hour reply). But the psychological friction is high:
every CTA says "Request a repair plan" next to a $20,000 price, and nothing
before the form says that submitting is **not** a purchase commitment. The
success box reveals the real flow ("if it's the right shape of problem,
you'll hear back... with next steps") — but only *after* submission. A buyer
on the fence assumes clicking = committing to $20k.

- Severity: high (directly suppresses intake volume)
- Candidate fix: one line near the form stating the intake starts a fit
  check, not an invoice. This is clarifying existing behavior, not a new
  promise — the success box already says exactly this.

### 4. Does it avoid overpromising?

**Finding: yes.** Deliverable claims are process claims (ranked plan, one top
call, do-not-fix list, 7-day plan) — all inherent to the document format. The
sample is labeled "invented" twice. No outcome guarantees, no metrics
promised. Keep it this way.

### 5. Does it distinguish Rapid Scan from deeper repair work?

**Finding: mostly.** One surface vs. full diagnostic is a clean split, and
the "not sure? pick the Rapid Scan" note kills decision paralysis well. Two
soft spots: (a) the Deep card lists deliverables while the Rapid card mostly
doesn't, implying Rapid might not include them; (b) neither card distinguishes
the *plan* from the *repair engagement* that follows — the FAQ does this, but
it's below pricing.

- Severity: medium
- Candidate fix: none this pass for (a)/(b) beyond what #1/#3 add — flagging
  for Eric. Both cards use the same ten-field structure per the "what this is"
  section; making the Rapid card say so is a 5-word edit if wanted.

### 6. Is "48-hour review" still believable?

**Finding: yes, and consistent.** Stated three times, identically scoped
(intake *reviewed/replied to* within 48 hours — not plan delivered). One
operator replying to intakes within two days is credible. No change.

### 7. Are there claims that need proof?

**Finding: one, and it's structural, not textual.** "The same person who does
the client work on the work page" leans on /work/ as the only proof surface —
and /work/ is fully redacted by design. That's honest but means the page has
*zero* external verification (no client names, no testimonials, no numbers).
Acceptable for now; the sample break does the heavy lifting. **Do not add
testimonials or case studies without verified sources** (per brief, and per
brand voice).

- Severity: low (accepted trade-off of the redaction policy)
- Delivery-time claim gap: the page never says when the plan *arrives*
  (only when intake is reviewed). Adding a delivery window would be a NEW
  product promise — out of scope for this branch. **Open question for Eric:
  what turnaround are you willing to commit to per tier?**

### 8. Does the CTA create a clear next action?

**Finding: yes mechanically, no emotionally.** All CTAs anchor to #intake,
tier CTAs preselect the dropdown, deep-link `?tier=` works. But see #3 — the
action is clear, the *stakes* of the action are not. Fixed together with #3.

### 9. Any copy that sounds like fake consultant theater?

**Finding: clean.** No jargon walls, no "synergy," no AI hype. The
chatbot-baseline diff section is the page at its best. Two borderline
phrases — "the moment of doubt after it" (earns its keep, keep) and
"Chaotic input in. Ranked signal out. That's the whole job." (on-brand,
keep). No change.

---

## Non-copy observations (logged, not fixed this pass)

- `.fb-terminal__body` has no `overflow-x: auto`; the ten-field rubric grid
  (`max-content 1fr`) holds at 390px because the value column wraps, but a
  longer field name added later would push it over. Design-system-level fix,
  not page-level — park it.
- Intake posts to the shared `/contact` endpoint with `type:
  "ai-product-repair"`; a dedicated intake endpoint is already TODO'd in the
  page source. Works today (verified in prior session), park it.
- The prod checkout carries untracked dirs (`public/ericmike/`,
  `public/free/audit/tduaufvpck/`) served publicly by the static server —
  unrelated to this page, flag to Eric for cleanup.

---

## ALTERNATE PRICING THINKING — audit-doc only, NOT for the page

Per brief: pricing numbers on the page are untouched. This section is the
only place alternate structures may be discussed.

- The $20k floor (per Eric's standing rule) is respected by both tiers.
- If intake volume is zero after real traffic, the first lever is not price —
  it's the missing commitment-free framing (#3) and the missing cost anchor
  (#1). Fix those before discounting anything.
- A possible future de-risk without touching the floor: keep $20k/$40k but
  name the *repair engagement* pricing ("engagements start after a plan")
  so the plan reads as the cheap first step of a bigger arc rather than an
  expensive document. Needs Eric's call on whether to expose engagement
  pricing at all.

---

## Candidate edits applied in `16ce46a` (Sprint 3)

1. **Pricing anchor line** (#1): after "Not sure which? …" note, add one
   sentence connecting price to the cost of a wasted sprint. No numbers
   changed, no new promises — reuses the page's own argument.
2. **Commitment-free intake line** (#3/#8): near the intake form lede (and
   echoed at the pricing-section CTA), state that submitting starts a fit
   check, not an invoice — mirrors what the success box already says.
3. Nothing else. Everything else on the page earns its place.
