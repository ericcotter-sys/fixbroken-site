# The Console - FixBroken Tools Brief

The brief that governs every tool shipped at `fixbroken.ai/console/`. Read this before adding tool N+1. Save at repo root: `vumo-fixbroken-site/CONSOLE.md`.

---

## 1. Thesis

The Console is a free, public set of diagnostic tools built on FixBroken OS. Anyone can paste an artifact (design doc, brand guide, URL, copy block) and get a scored, shareable result page in under 30 seconds. The result demonstrates the FixBroken methodology by applying it to the visitor's own work. The methodology IS the marketing.

## 2. Why it exists

- **Lead gen.** Every audit URL footers `fixbroken.ai` with a "fix this for real" CTA. The share mechanic distributes the URL through the visitor's network back to the consulting brand.
- **Methodology demo.** Prospects don't trust consultants who tell them their stuff is broken. They trust tools that show them. The Console lets prospects diagnose themselves.
- **Self-disqualification.** Some visitors will use the audit, get the punch list, fix it themselves, and never become customers. That's fine. They weren't the buyer. The audit clears the funnel.
- **SEO ownership.** Every audit URL is a permanent, indexable page targeting "design system audit," "brand doc review," "LLM ruleset," etc. Compounds over time.

## 3. URL convention

```
fixbroken.ai/console/                           Console home (tool index)
fixbroken.ai/console/<tool>/                    Tool landing + input form
fixbroken.ai/console/<tool>/<slug>/             Result page (shareable, permanent)
fixbroken.ai/console/<tool>/<slug>/?private=1   Noindexed result (exec-safe)
```

Slugs are random tokens, not predictable IDs. No slug enumeration.

## 4. Output convention

Every tool result page follows the same structure. No exceptions.

```
HERO
  - Tool name + tagline
  - Score or one-line verdict
  - "What you gave us" snippet (sanitized input echo)

BODY (tool-specific)
  - Findings, scoring, or analysis
  - Always exec-readable in the headline
  - Designer / engineer detail in expandable sections below

FOOTER (mandatory)
  - "Email this to your team" mailto with prefilled subject + body
  - "Need this fixed for real? Talk to FixBroken" -> /contact
  - "Audited by FixBroken OS" -> /design/
  - Result generated timestamp
```

Every result page uses `.fb-*` classes only. Renders the FixBroken OS aesthetic. The page IS the proof.

## 5. Voice convention

- **Direct.** No hedging. The tool says "your design system is missing X" not "you might consider adding X."
- **Exec-readable headline.** "Your team will ship inconsistent output every session" beats "no agent ruleset detected."
- **Operator-toned CTA.** "Talk to FixBroken" beats "Get started today."
- **No fake AI mystique.** The tools are mechanical (regex, parsing, presence checks). That's the brand. Clarity over magic.
- **No condescension.** A score of 4/29 should not read as "you suck." It should read as "you're missing infrastructure, here's the fix list."

## 6. Tool roster

### Shipped

(none yet - audit is in progress)

### Building now

| Tool | Purpose | Input | Output |
|---|---|---|---|
| **Audit** | Score a design system input vs FixBroken OS rubric | URL or pasted text | 9-29 score, rubric, leak points, punch list, migration prompt |
| **Voice Lint** | Highlight banned SaaS phrases in copy | Pasted copy | Annotated text, banned-phrase count, suggested replacements |

Building both together forces the shared pattern. Tool #3+ becomes copy-paste.

### Planned

| Tool | Purpose |
|---|---|
| Migration Prompt Generator | Paste your brand doc, get a session prompt for your LLM |
| Token Extract | Paste a URL or CSS, get a clean tokens.json |
| Style Guide Render | Paste a CSS file, get a living style guide URL |
| Brand Pulse | Audit a live URL across pages for cohesion drift |

## 7. Anti-patterns

- **No paid tier in v1.** The Console is free. Period. Conversion happens through consulting inquiry, not subscriptions.
- **No email gate.** The share URL IS the capture. Forcing email loses 80% of visitors and dilutes the share mechanic.
- **No fake AI mystique.** Don't pretend the tools use a model when they don't. The brand is mechanical clarity.
- **No "Get started today," "Learn more," "Supercharge," "Unlock," "Revolutionize," "Next-gen,"** or any phrase from `brand.md` Avoid list. The tool itself must pass Voice Lint.
- **No designer jargon in headlines.** Depth in the body, exec language up top.
- **No subdomain.** `fixbroken.ai/console/` consolidates SEO and traffic. Promote to subdomain only if Console becomes a separable product line.

## 8. Build order

1. **Audit** - first. Highest signal, demonstrates the thesis, productizes work already done manually.
2. **Voice Lint** - second. Smallest possible tool. Forces the shared output / footer / persistence pattern out of the code.
3. **Migration Prompt Generator** - third. Highest value to prospects who scored low on Audit.
4. Token Extract, Style Guide Render, Brand Pulse - later, in any order.

Each new tool gets a one-paragraph addition to Section 6 of this brief.

## 9. Ownership + workflow

- **Brief owner:** Eric Cotter
- **Build agent:** Box Claude (server-side Claude Code session inside `vumo-fixbroken-site`)
- **Repo:** `vumo-fixbroken-site` (the flagship, since `/console/` lives on `fixbroken.ai`)
- **Deploy:** push to `main` -> webhook -> live within ~10s
- **Testing:** every new tool must pass against 6 test inputs before declaring shipped (see Audit spec for the pattern)

## 10. Success metrics

- Audits run per week
- Audit URLs shared (referrer logs)
- Inbound consulting inquiries citing a Console tool as the source
- SEO rank for "design system audit," "LLM ruleset," "brand doc review" within 90 days

## 11. The rule

If a tool can't be built to pattern-match the conventions in Sections 3-7, it doesn't belong in The Console. Either rewrite the tool or rewrite the brief. Don't fork the conventions.
