# AI Product Repair — Production Archive

Snapshot of the live production page, taken before any candidate work merges.

- Date: 2026-07-07 ~05:49 UTC
- URL: https://fixbroken.ai/ai-product-repair/
- HTTP status: **200 OK** (`curl -I`, nginx)
- Prod commit: `02089f7741c066850f75b6414e8e11acd8d61134`
  ("Regenerate design manifest for ai-product-repair page")
  Verified identical on the prod checkout (`~/apps/fixbroken`) and `origin/main`.
- Source branch history: `feat/fbai-ai-product-repair`, fast-forwarded to main
  2026-07-07 ~05:35 UTC; webhook auto-deployed and restarted `fixbroken.service`.

## Offer copy verification (grep of live prod response)

| Pattern | Matches |
|---|---|
| `Product Repair` | 4 (+1 uppercase) |
| `Rapid Scan` | 2 |
| `20,000` | 4 |
| `Repair Plan` | 4 (+11 lowercase "repair plan") |

## Screenshots (full-page, live prod at 02089f7)

- Desktop (1440×900 viewport): `/tmp/ai-product-repair-review/prod-archive-02089f7-desktop.png`
- Mobile (390×844 viewport): `/tmp/ai-product-repair-review/prod-archive-02089f7-mobile.png`
- Earlier same-commit captures (05:40 UTC): `prod-02089f7-{desktop,mobile}.png` in the same folder

Note: screenshots live in `/tmp/ai-product-repair-review/` (not committed —
binary archives don't belong in the repo). If this box is rebuilt, recapture
against the commit above.

## Environment map at time of archive

| Env | Branch | Commit | URL | Status |
|---|---|---|---|---|
| Production | `main` | `02089f7` | https://fixbroken.ai/ai-product-repair/ | 200, public |
| Staging | `staging` | `205c6c8` (1 behind) | https://stage.fixbroken.ai/ai-product-repair/ | 200 behind basic auth (401 anonymous) |
| Candidates | `post-prod/*` | see release cards | local serve only | not deployed |
