# AI Product Repair — Offer Audit

- Date: 2026-07-07
- Page: https://fixbroken.ai/ai-product-repair/ at prod commit `02089f7`
- Companion docs: `ai-product-repair-post-prod-audit.md` (copy-level, same day),
  `ai-product-repair-prod-archive.md` (prod snapshot)
- This audit is offer-level: does the $20k/$40k productized teardown sell as
  structured, or does it leak buyers at predictable points?

---

## 1. Is the $20k floor credible?

**Half.** The deliverable side is credible — ten-field structure, worked
sample, human sign-off, one operator. What's missing is the buyer-side math:
the page never costs out the problem it solves. The raw materials are on the
page ("four plausible fixes deep, each one costs a sprint") but the reader
has to do the multiplication themselves. At $20k, nobody does homework to
justify your price for you. **Fix: connect the sprint-cost logic to the
price, one line.** (Addressed in `hardening` and `lower-friction` candidates.)

## 2. Is the buyer outcome clear?

**The document is clear; the outcome is one step behind.** The buyer knows
they get a ranked plan, one top call, a do-not-fix list, a 7-day sequence.
What the page undersells is the *state change*: before — team argues about
four plausible fixes; after — team executes one agreed list in order. The
"what arrives" panel gestures at it ("re-check the metric you named"). Close
but implicit. Minor.

## 3. Is Rapid Scan distinct from deeper work?

**Distinct in scope, blurred in deliverable.** One-surface vs. full-diagnostic
is clean. But the Rapid card doesn't say it uses the same ten-field structure,
so a careful reader can't tell if $20k buys the "real" document or a lite
version. Five-word fix on the Rapid card. Also: the boundary between the
*plan* (this offer) and the *repair engagement* (future work) is only drawn in
the FAQ, below pricing — a skeptic who stops at the price cards never sees it.

## 4. Is the CTA specific enough?

**Specific, but not stakes-labeled.** "Request a repair plan" / "Request a
Rapid Scan" say exactly what you're asking for — good. What they don't say is
what requesting *costs* (nothing, yet). Next to a $20,000 figure, "Request"
reads as "commit." Every CTA on the page shares this ambiguity. It's the
single cheapest conversion fix available. (Addressed in all three candidates,
different intensities.)

## 5. Does it sound too expensive too early?

**No — prices arrive late and in context, which is right.** Six sections of
value-building precede the pricing block, and the pricing section is skippable
by structure. The deep-link `?tier=` support means paid traffic can land
pre-qualified. The risk is not "too early" — it's "unanchored when it
arrives" (see #1).

## 6. Does it overpromise?

**No.** All claims are process claims. No outcome guarantees, no metric
promises, no timeline promises (see #8 for the flip side). The sample break
is labeled "invented" twice. This restraint is an asset — none of the
candidate branches add a single new promise.

## 7. Does it need proof?

**It needs proof-shaped structure, not proof-shaped decoration.** Real options
given the redaction policy:
- The worked sample IS the proof — it demonstrates the thinking quality
  directly. Already strong.
- "What we look for" specificity (concrete failure patterns) proves expertise
  without clients. (Added in `proof-risk` candidate.)
- Honest risk caveats — saying what the teardown *can't* do is itself proof
  of judgment. (Added in `proof-risk` candidate.)
- **Never:** testimonials, logos, case studies, "as seen in" — unavailable
  without fabrication, and fabrication is fatal here. The page sells trust
  repair; fake trust signals would be self-refuting.

## 8. Is 48-hour review believable?

**Yes.** Consistently scoped in all three mentions: intake *reviewed* in 48
hours, not plan *delivered*. One-operator model makes it plausible. The gap:
delivery time of the actual plan is never stated. That silence is honest but
will cost some deals — a buyer paying $20-40k wants to know if the answer
arrives in a week or a quarter. **Needs Eric's decision, not copy — do not
invent a turnaround.**

## 9. What would a skeptical founder object to?

Ranked, with page's current answer:

1. **"$20k for a document?"** — page answer: weak (see #1). Candidates fix.
2. **"Who are you? Show me clients."** — page answer: redaction policy +
   /work/ link. Honest but thin; the sample carries it. Partially fixable
   (see #7), fully fixable only by Eric shipping verifiable public work.
3. **"How long until I get it?"** — page answer: silent. Eric decision.
4. **"What if you find nothing?"** — page answer: strong (FAQ: short plan,
   honest severities, paying for the call not page count).
5. **"Is this just ChatGPT with extra steps?"** — page answer: strongest
   section on the page (the diff terminal).
6. **"Will this turn into a retainer pitch?"** — page answer: strong ("not a
   retainer pitch wearing a report" + engagement starts only after a plan).

## 10. What should NOT ship without outside review?

Per the single-source guardrail (public-shipping copy, no outside input yet):

- **Any candidate branch merging to prod.** All copy changes in
  `post-prod/*` need one external read first. The audit docs are written to
  hand to a reviewer as-is.
- **Any pricing presentation change** beyond the anchor line — pricing is
  Eric's locked domain ($20k floor is a standing rule).
- **Any delivery-time commitment** — business decision, not copy.
- Safe to ship without review: nothing on this page. It's the revenue
  surface of a trust-repair business; the bar is "second set of eyes,
  always."
