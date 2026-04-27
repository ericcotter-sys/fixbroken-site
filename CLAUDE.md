# CLAUDE.md — vumo-fixbroken-site

## Product Overview

Fixbroken is Eric Cotter's product strategy, AI execution, and enterprise solution studio. This repo (`vumo-fixbroken-site`) is the source for https://fixbroken.ai — the agency hub that explains what Fixbroken does, who it serves, and how to start a conversation. It also hosts **FixBroken OS**, the global design system used by every tenant subsite (vumo.fixbroken.ai today; others later). See STRATEGY.md for mission, Q2 priorities, and scope boundaries.

**What this repo is:** the source for https://fixbroken.ai — Eric Cotter's consulting site and the home of **FixBroken OS**, the global design system used by every tenant subsite (vumo.fixbroken.ai today; others later).

**Repo naming note:** the repo is prefixed `vumo-` for historical reasons (it was the first client engagement site). It will likely be renamed to `fixbroken-site` once the brand is stable. Don't let the name mislead — this IS the flagship.

---

## Stack

- Node 20 + Express (static file server with a signup endpoint)
- Nginx reverse proxy on Ubuntu 24.04 Lightsail instance
- Let's Encrypt SSL via Certbot
- GitHub webhook → `deploy.sh` on push to `main` (prod) or `staging`

## Layout

```
vumo-fixbroken-site/
├── server.js              Express entry point (port 3000, bound to 127.0.0.1)
├── package.json
├── deploy.sh              webhook-triggered deploy script
├── public/
│   ├── index.html         fixbroken.ai landing
│   ├── work/index.html    /work/ — recent work slider (client handles obfuscated)
│   ├── free/index.html    /free/ — free diagnostic tools (formerly /console/)
│   ├── tokenz/index.html  /tokenz/ — live Claude Code token telemetry
│   ├── internal/ventures/ old scorecard (not linked, robots.txt blocks crawlers)
│   ├── robots.txt         Disallow: /internal/
│   └── design/
│       ├── fixbroken-os.css          THE design system — do not fork
│       ├── fixbroken-os.manifest.json machine-readable system manifest
│       ├── index.html                 hand-maintained style guide
│       ├── generated.html             auto-generated reference
│       └── brand.md                   voice + palette + principles
├── tools/
│   ├── voice-lint.js      voice + design system linter
│   ├── audit.js           6-category page audit (voice/design/a11y/responsive/perf)
│   ├── generate-manifest.js   CSS → JSON manifest generator
│   ├── generate-styleguide.js manifest → living HTML reference
│   ├── scaffold-tenant.js     new tenant subsite generator
│   ├── validate-manifest.js   stale manifest detector
│   ├── check.js               unified quality gate (lint + audit + validate)
│   └── pre-commit             git pre-commit hook
├── CLAUDE.md              this file
├── TOOLS.md               complete toolchain reference
└── README.md
```

## FixBroken OS — the design system

`/public/design/fixbroken-os.css` is the **single source of truth** for the visual system. It is served at:

- `https://fixbroken.ai/design/fixbroken-os.css`

Every subsite in the fixbroken tenant tree imports it:

```html
<link rel="stylesheet" href="https://fixbroken.ai/design/fixbroken-os.css">
<!-- optional per-project override AFTER -->
<link rel="stylesheet" href="/my-project-overrides.css">
```

### The CSS file is organized in 11 sections, heavily commented:

1. TOKENS — CSS variables (colors, type, spacing, radius, shadows, motion, z-index, layout)
2. RESET — tight box-sizing, no baggage
3. FONTS — Google Fonts import (Inter + JetBrains Mono)
4. BASE — html/body, headings, links, selection
5. LAYOUT — `.fb-shell`, `.fb-container`, `.fb-section`, `.fb-stack`, `.fb-row`, `.fb-grid`
6. TYPOGRAPHY CLASSES — `.fb-display`, `.fb-lede`, `.fb-mono`, `.fb-label`, `.fb-kicker`
7. COMPONENTS — `.fb-nav`, `.fb-panel`, `.fb-terminal`, `.fb-command`, `.fb-cta`, `.fb-chip`, `.fb-status`, `.fb-signal-card`, `.fb-context-rail`, `.fb-input`/`.fb-textarea`, `.fb-footer`, `.fb-divider`
8. EFFECTS — `.fb-grid-bg`, `.fb-scanline`, `.fb-mcp-cone`, `.fb-beam`, `.fb-cursor`, `.fb-glow`
9. MOTION — `@keyframes` + `.fb-rise` animation helpers
10. RESPONSIVE — tablet (`<960px`) and mobile (`<640px`) overrides
11. ACCESSIBILITY — `prefers-reduced-motion`, `:focus-visible`

---

## Rules for future agents editing this repo

### ✅ Do

- Update `fixbroken-os.css` when a new token or component is truly universal.
- Add new `.fb-*` components with proper section comments so they're discoverable.
- Keep every new component responsive — test at 375px before you ship.
- Update `/design/index.html` to document any new component.
- Update `brand.md` when voice or palette evolves.
- Keep the CSS in a single file for now. If it grows past ~2000 lines, revisit.

### ❌ Don't

- Do NOT fork the design system into individual page `<style>` blocks. If you need a token, reference the variable.
- Do NOT create new non-prefixed global classes. Everything public is `.fb-*`.
- Do NOT redefine `.fb-*` classes outside of `fixbroken-os.css`. Projects override via wrapper classes (see below).
- Do NOT introduce a third font family. Inter + JetBrains Mono is the contract.
- Do NOT use purple, glassmorphism, sparkle icons, emoji decorations, or generic AI tropes. See `brand.md` for the "avoid" list.

### Navigation (CRITICAL - read before touching any page)

The nav is duplicated in every HTML file. There is no server-side include. Every page MUST have identical nav links in the same order:

```
Home    /
Work    /work/
Design  /design/
Free    /free/
Signal  /#signal
```

Rules:
- The `--active` class goes on the current page's link only.
- Signal ALWAYS links to `/#signal` (never mailto). The homepage JS opens the contact modal on `#signal` hash. Other pages navigate to the homepage which then opens the modal.
- Do NOT use `mailto:` hrefs anywhere on the site. All contact goes through the form.
- When adding a new page to the nav, update ALL pages: `public/index.html`, `public/work/index.html`, `public/design/index.html`, `public/design/generated.html`, `public/free/index.html`, and any future pages.
- If you add a nav link and forget to update even one page, the nav will be inconsistent and visitors will see different menus on different pages.
- `/console/` was renamed to `/free/`. If you see references to `/console/` anywhere, update them to `/free/`.

### Client handle convention (/work/ page)

Client engagements on `/work/` use obfuscated handles: `0x` + 4 lowercase hex chars (e.g. `client//0x9f2a`). The real client-to-handle mapping is in `/etc/fixbroken/client-handles.md` on the server (never committed, never served).

Rules:
- Never use real client names, industries, or identifying details on any public page.
- The section eyebrow says "names redacted - revealed under NDA on request" - that covers confidentiality for every tile.
- No placeholder tiles. Every tile on /work/ must represent real shipped work.
- Handle must render lowercase everywhere, including slider breadcrumbs. Use `text-transform: none` spans if the parent has `text-transform: uppercase`.

### Deploy workflow

Do NOT SSH into the prod server to edit files directly. The deploy webhook overwrites prod on every push to main. Direct prod edits get destroyed.

1. Edit files in the repo.
2. Commit and push to `origin/main`.
3. Webhook auto-deploys in ~10 seconds.
4. Verify with `curl -sL -o /dev/null -w "%{http_code}\n" https://fixbroken.ai/<path>`.

### Override pattern (for projects that need a twist)

Projects load their override stylesheet AFTER `fixbroken-os.css` and scope their overrides to a wrapper class. Example:

```html
<body class="vumo-scope">
  <link rel="stylesheet" href="https://fixbroken.ai/design/fixbroken-os.css">
  <link rel="stylesheet" href="/vumo-overrides.css">
</body>
```

```css
/* vumo-overrides.css */
.vumo-scope {
  --fb-black: #0d1520;      /* softer base */
  --fb-signal: #5bb8ff;     /* softer cyan */
}

.vumo-scope .fb-cta { /* component-level override */
  text-transform: none;     /* VUMO uses sentence case */
}

.vumo-walkaround {          /* new project-specific component */
  /* ... */
}
```

### Development workflow

1. Edit files locally on your Mac under `~/Documents/Claude/Projects/VUMO/repos/vumo-fixbroken-site/`.
2. Run `npm run check` before committing (or let the pre-commit hook catch issues).
3. Test at multiple widths in browser (375, 768, 1440).
4. Commit + push to `main` → webhook auto-deploys to https://fixbroken.ai within ~10s.
5. For risky changes: push to `staging` → preview at https://stage.fixbroken.ai (basic auth).

### Toolchain (see TOOLS.md for full reference)

- `npm run check` — unified quality gate (manifest + lint + audit). Run before every commit.
- `npm run lint:voice` — voice linter for banned phrases and CSS violations.
- `npm run audit` — 6-category page audit (voice, design, structure, a11y, responsive, perf).
- `npm run generate` — regenerate manifest + style guide from CSS.
- `npm run scaffold -- <name>` — create a new tenant subsite.
- Pre-commit hook runs voice-lint on all staged HTML/CSS files automatically.

---

## Operational notes

- App listens on `127.0.0.1:3000` (not `0.0.0.0`) — Nginx proxies external traffic.
- Webhook secret is in `/home/ubuntu/apps/fixbroken-webhook/.secret` on the server.
- Deploy logs: `/var/log/fixbroken-main-deploy.log` and `/var/log/fixbroken-staging-deploy.log`.
- If a deploy fails, check `sudo journalctl -u fixbroken-webhook` and `sudo systemctl status fixbroken`.

## Points of contact

- Operator: Eric Cotter (`eric.cotter@gmail.com`)
- Host: AWS Lightsail us-east-2 (Ohio)
- Domain: GoDaddy
- Static IP: `3.140.37.153`

## Deploy Targets

| Target | Branch | URL | Auth |
|---|---|---|---|
| Production | `main` | https://fixbroken.ai | Public |
| Staging | `staging` | https://stage.fixbroken.ai | Basic auth |

Deploy is automatic via GitHub webhook. Push to the target branch and the site updates in ~10 seconds. See SDLC.md for branching rules.

## Definition of Done

A change is done when all of the following are true:

1. PR is green on CI (once CI is configured via FBAI-001).
2. Lint passes (once linter is configured via FBAI-001).
3. Tested at 375px, 768px, and 1440px viewports.
4. Design system not forked — no inline styles overriding `.fb-*` tokens. Use wrapper classes per the override pattern above.
5. STRATEGY.md alignment checked — does this work serve a Q2 priority? Is it in scope? If not, do not ship it.
6. Deploy verified on staging before merging to main.
7. QA sign-off per QA.md.

## Governance Docs

This repo is governed by the Fixbroken AI SDLC. See:

- [STRATEGY.md](STRATEGY.md) — mission, Q2 priorities, out-of-scope, kill criteria (CPO owns)
- [SDLC.md](SDLC.md) — branching model, PR rules, test requirements, release cadence
- [AGENTS.md](AGENTS.md) — org chart, reporting lines, escalation rules
- [PM.md](PM.md) — PM operating rules, ticket format, status digest template
- [CTO.md](CTO.md) — CTO operating rules, ADR requirements, build-vs-buy threshold
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, stack, data model, security posture (CTO owns)
- [QA.md](QA.md) — test plan format, regression checklist, bug intake, sign-off rules
- [ADRs/](ADRs/) — architecture decision records (CTO owns)
