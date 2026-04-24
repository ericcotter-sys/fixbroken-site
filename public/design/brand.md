# FixBroken OS — Brand

## Identity

**fixbroken.ai** is Eric Cotter's consulting brand for teams shipping AI that needs to work for actual humans.

Not a startup. Not a studio. An operator who sees the pattern, opens the console, and works inside the product until it behaves.

## The metaphor

**The MCP Cone** — a central beam that takes chaotic input, parses signal, and outputs usable clarity. Every page in the stack should feel like entering that beam.

## The aesthetic

Matrix energy + MacOS CLI discipline + TRON MCP Cone geometry.

- Black canvas, controlled neon.
- Terminal precision. Command-center utility.
- Executive-grade hacker interface, not gamer cosplay.
- Signal over spectacle. Every pixel earns its place.

## What it is

- A live operating layer for broken systems.
- Terminal clarity, MacOS restraint, TRON metaphors.
- Weird enough to be memorable. Clean enough for executives.

## What it isn't

- Not cyberpunk cosplay. No glitch text, no crypto-bro chrome.
- Not generic SaaS. No purple AI sludge, no sparkle icons, no "Get started today."
- Not dev-only. Executives, founders, operators, customers all need to feel welcome in the room.

## Voice

Short. Direct. Operator tone.

### Use

- Run the signal
- Open the console
- Trace the pattern
- Send the signal
- Enter the room
- See what broke
- Something broken?
- System online

### Avoid

- Get started today
- Learn more
- Supercharge your workflow
- Unlock AI-powered insights
- Revolutionize / disrupt / next-gen
- Cutting-edge / best-in-class
- Any "AI for everyone" variant

## Palette summary

| Role | Color | Token |
|---|---|---|
| Base | near-black | `--fb-black` |
| Signal (primary) | electric cyan | `--fb-signal` |
| **Pink (flagship signature)** | **neon magenta** | **`--fb-pink`** |
| Matrix (alive / runtime) | green | `--fb-matrix` |
| Coral (human accent) | warm orange | `--fb-coral` |
| Warn | amber | `--fb-amber` |
| Error | red | `--fb-red` |

**Pink is the operator's mark.** Used sparingly on fixbroken.ai (the flagship) for hero highlights, signature CTAs, and key human moments. The classic cyan + pink TRON pairing. Tenant sites (VUMO, future clients) do NOT use pink — that's what makes the flagship feel like the flagship.

Full swatches + tokens live in `/design/` (the style guide).

## Typography

- **Inter** — human copy (lede, body, headings that need to breathe).
- **JetBrains Mono** — system copy (labels, prompts, commands, chips, statuses).

No third family. No decorative fonts. No script.

## Core components

Documented in `/design/`:
`.fb-shell .fb-nav .fb-container .fb-section .fb-panel .fb-terminal .fb-command .fb-cta .fb-chip .fb-status .fb-signal-card .fb-context-rail .fb-mcp-cone .fb-cursor .fb-grid-bg .fb-scanline`

## Rules for using this brand

1. **Default is FixBroken OS.** Every page inherits it unless explicitly overridden.
2. **Overrides are scoped.** Projects (VUMO, future clients) can override tokens via a wrapper class, but never redefine `.fb-*` globally.
3. **VUMO exception.** VUMO may soften the palette for dealer / customer approachability. Typography and spacing stay FixBroken.
4. **Mobile is first-class.** Every component must be reviewed at 375px before shipping.
5. **Neon is a signal, not a decoration.** If you add glow, it should mean something.

## Files

| File | Purpose |
|---|---|
| `/public/design/fixbroken-os.css` | Complete design system |
| `/public/design/index.html` | Living reference (style guide) |
| `/public/design/brand.md` | This doc |
| `/CLAUDE.md` | Agent instructions |
