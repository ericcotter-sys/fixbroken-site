# ACCOUNTS.md — accounts, Google SSO, and the job board

Runbook for the accounts + jobs system added 2026-07-08. Covers env setup,
Google OAuth provisioning, how the pieces degrade, and how to move the whole
system to another repo if it turns out it belongs elsewhere.

## What exists

| Surface | Path | Notes |
|---|---|---|
| Registration / sign-in | `/account/` | email+password or Google; signed-in view shows application history |
| Job board | `/jobs/` | open roles, apply inline when signed in; admin panel for ADMIN_EMAILS sessions |
| Auth API | `/auth/*` | register, login, logout, me, google, google/callback |
| Jobs API | `/api/jobs*`, `/api/me/applications` | see routes/jobs.js header comment |

Neither page is in the global nav yet (pending placement decision).

## Environment contract

Everything is opt-in by env var. With **no** vars set, the site behaves exactly
as before: APIs answer 503 `accounts_offline`, pages show their offline panels.

| Var | Required for | Example |
|---|---|---|
| `DATABASE_URL` | everything | `postgres://user:pass@host:5432/fixbroken` — or `memory` for the pg-mem dev harness |
| `DATABASE_SSL` | managed PG with TLS | `true` (uses `rejectUnauthorized: false`) |
| `SESSION_SECRET` | stable sessions | long random string; unset → per-boot random (sessions die on restart) |
| `BASE_URL` | Google SSO | `https://fixbroken.ai` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google SSO | from Google Cloud Console |
| `ADMIN_EMAILS` | admin panel | comma-separated, e.g. `eric.cotter@gmail.com` |
| `ALLOW_ADMIN_PASSWORD` | **dev harness only** | lets admin emails register with a password because pg-mem has no Google. **Never set in production** — it reopens the admin-takeover hole closed in commit 1f0798a. |
| `SMTP_*` + `MAIL_TO` | application emails | same contract as /contact (see server.js) |

On the box these live wherever the systemd unit reads its env (same place as
the SMTP vars). After changing them: `sudo systemctl restart fixbroken`.

## Google OAuth setup (one-time)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID.
2. Application type: Web application.
3. Authorized redirect URI: `https://fixbroken.ai/auth/google/callback`
   (staging: add `https://stage.fixbroken.ai/auth/google/callback` and set
   staging's `BASE_URL` accordingly).
4. Copy client ID + secret into the env.

No SDK is used — the flow is authorization-code + PKCE, hand-rolled in
routes/auth.js. ID-token claims (iss/aud/exp/email_verified) are verified;
signature verification is delegated to the TLS channel to Google's token
endpoint, which is standard for this flow shape.

## Security posture (QA-reviewed)

An adversarial review ran 2026-07-08; all findings fixed in commit 1f0798a:

- **Admin emails cannot register via password** (`sso_required` 403) — admin
  entry is Google-verified only. This is why `ALLOW_ADMIN_PASSWORD` must never
  ship to prod.
- Session ID regenerates on register/login/SSO (fixation).
- `?next=` accepts only same-site paths; `//host` and `/\host` both rejected
  (server and client).
- Login burns scrypt work even for unknown emails (timing oracle).
- Unique-constraint races surface as 409s, not 500s.
- Parameterized SQL throughout; DOM built with createElement/textContent (XSS).

## Testing

- `node tools/smoke-auth.js` — boots server.js on pg-mem with a mocked Google
  token endpoint; 13 checks including the security regressions. No network, no
  services, ~5s.
- Manual: `DATABASE_URL=memory ADMIN_EMAILS=you@x.com ALLOW_ADMIN_PASSWORD=true node server.js`

## Migrations

`db/migrations/*.sql`, applied in filename order at boot, tracked in
`_migrations`. Add a new numbered file; never edit an applied one. Keep the SQL
pg-mem-compatible (no functions/triggers/dollar-quoting) so the dev harness and
smoke test keep working.

## Porting to another repo

The system was built repo-agnostic on purpose:

1. Copy `lib/db.js`, `lib/auth.js`, `routes/`, `db/migrations/`,
   `tools/smoke-auth.js`.
2. `npm i pg express-session connect-pg-simple && npm i -D pg-mem`
3. In the host Express app: mount session middleware + the two routers behind
   a `db.enabled` check (copy the block from server.js, search "Accounts +
   jobs"), and pass a `notifyApplication` callback if you want apply emails.
4. Re-skin `public/account/` and `public/jobs/` to the host design system —
   all logic is vanilla fetch against the same endpoints.
