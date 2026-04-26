# TOOLS.md — FixBroken OS Toolchain

All tools live in `tools/` and run with Node 20. No external dependencies beyond what's in `package.json`.

## Quick reference

| Command | What it does |
|---|---|
| `npm run check` | Full quality gate (manifest + lint + audit) |
| `npm run check:fix` | Same, but auto-fix stale manifest |
| `npm run lint:voice` | Voice + design system linter |
| `npm run audit` | 6-category page audit |
| `npm run generate` | Regenerate manifest + style guide |
| `npm run scaffold -- <name>` | Create new tenant subsite |
| `npm run tenants` | List active tenants |
| `npm run tenants:health` | List tenants with live health checks |
| `npm run diff:tokens` | Diff design tokens vs last commit |

## Tools

### Voice Linter (`tools/voice-lint.js`)

Scans HTML files for banned phrases, CSS violations, font/color violations, and emoji.

```bash
npm run lint:voice                     # scan public/
node tools/voice-lint.js file.html     # scan specific file
node tools/voice-lint.js --json        # JSON output (for CI)
node tools/voice-lint.js --strict      # treat warnings as errors
```

**Rules checked:**
- Banned phrases from brand.md (33 phrases)
- Marketing sludge patterns (regex-based)
- Inline style overrides of `--fb-*` tokens
- Banned font families (only Inter + JetBrains Mono)
- Banned colors (purple, glassmorphism)
- Decorative emoji

**Exit codes:** 0 = clean, 1 = violations found

### Pre-commit Hook (`tools/pre-commit`)

Runs voice-lint on staged `.html` and `.css` files. Installed automatically into `.git/hooks/pre-commit`.

To reinstall:
```bash
cp tools/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

### Page Audit (`tools/audit.js`)

Comprehensive 6-category audit of HTML pages.

```bash
npm run audit                          # audit public/
node tools/audit.js file.html          # audit specific file
node tools/audit.js --verbose          # show passing checks
node tools/audit.js --json             # JSON output
```

**Categories:**
1. **VOICE** — banned phrases, sludge, emoji
2. **DESIGN** — CSS import, fb-shell/container, namespace, fonts
3. **STRUCTURE** — DOCTYPE, lang, charset, viewport, title, semantics
4. **A11Y** — alt text, form labels, heading order, contrast hints
5. **RESPONSIVE** — viewport, fixed widths, responsive grids
6. **PERF** — font loading, CSS count, inline styles

**Grading:** A (clean), B (warnings only), C (few errors), D (many errors)

**Exit codes:** 0 = all pages A or B, 1 = any page C or D

### Manifest Generator (`tools/generate-manifest.js`)

Parses `fixbroken-os.css` and `brand.md` to produce a machine-readable JSON manifest.

```bash
npm run generate:manifest
```

**Output:** `public/design/fixbroken-os.manifest.json`

**Contents:**
- All CSS tokens (grouped by category)
- All `.fb-*` components with descriptions
- Complete class inventory
- Keyframe animations
- Responsive breakpoints
- Voice rules (use/avoid)
- Palette definitions
- Typography rules
- System constraints

This file is served at `/design/fixbroken-os.manifest.json` and can be consumed by any agent, tool, or LLM that needs to understand FixBroken OS.

### Manifest Validator (`tools/validate-manifest.js`)

Detects stale manifests by regenerating and comparing.

```bash
npm run validate:manifest              # check only
node tools/validate-manifest.js --fix  # auto-update if stale
```

**Exit codes:** 0 = current, 1 = stale

### Style Guide Generator (`tools/generate-styleguide.js`)

Reads the manifest and produces a comprehensive auto-generated HTML reference.

```bash
npm run generate:styleguide
```

**Output:** `public/design/generated.html`

This is a machine-complete reference separate from the hand-maintained `/design/index.html`. It regenerates from the manifest, so it's always in sync with the CSS.

### Tenant Scaffolder (`tools/scaffold-tenant.js`)

Creates a complete new tenant subsite.

```bash
npm run scaffold -- comply                          # default settings
npm run scaffold -- comply --port 3030              # custom port
npm run scaffold -- comply --domain comply.ai       # custom domain
npm run scaffold -- comply --dry-run                # preview only
```

**Generated files:**
- `server.js` — Express static server
- `package.json`
- `deploy.sh` — webhook-triggered deploy
- `public/index.html` — landing page with FixBroken OS
- `public/<name>-overrides.css` — token/component overrides
- `CLAUDE.md` — agent instructions
- `README.md`
- `<name>.service` — systemd unit template
- `<name>.nginx.conf` — nginx server block template

**Port detection:** auto-scans existing apps for the next available port.

### Unified Quality Gate (`tools/check.js`)

Runs all checks in sequence: manifest validation, voice lint, page audit.

```bash
npm run check                          # full gate
npm run check:fix                      # auto-fix stale manifest
```

Exits 1 on first failure. Use in CI pipelines.

### Tenant Manager (`tools/tenants.js`)

Lists active tenants, their ports, domains, and health.

```bash
npm run tenants                        # list all tenants
npm run tenants:health                 # include live health checks
node tools/tenants.js --json           # JSON output
```

Discovers tenants from `/home/ubuntu/apps/`, reads ports from systemd units (with server.js fallback), and checks FixBroken OS CSS import.

### Token Diff (`tools/token-diff.js`)

Shows what design tokens changed between two manifest versions.

```bash
npm run diff:tokens                    # working tree vs last commit
node tools/token-diff.js HEAD~5        # vs 5 commits ago
node tools/token-diff.js main staging  # compare two branches
node tools/token-diff.js --json        # JSON output
```

Reports added, removed, and changed tokens, components, classes, and voice rules. Exit code 1 if there are changes, 0 if identical.

## Integration patterns

### CI pipeline
```yaml
- run: npm run check
```

### Pre-push hook
```bash
#!/bin/bash
npm run check || exit 1
```

### Agent workflow
```bash
# Agent reads the manifest to understand the system
curl -s https://fixbroken.ai/design/fixbroken-os.manifest.json | jq .

# Agent scaffolds a new tenant
node tools/scaffold-tenant.js newclient --dry-run

# Agent audits their work
node tools/audit.js public/index.html --json
```

## Adding new rules

### Voice rules
Edit the `RULES.bannedPhrases` array in `tools/voice-lint.js`. Regenerate the manifest after updating `brand.md`.

### Design system components
Add new `.fb-*` classes to `fixbroken-os.css` with proper section comments. Then run `npm run generate` to update the manifest and style guide.

### Audit checks
Add new check functions in `tools/audit.js` following the pattern of existing `audit*()` functions. Return an array of `{ severity, check, msg }` objects.
