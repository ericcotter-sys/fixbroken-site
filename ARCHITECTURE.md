# ARCHITECTURE — Fixbroken

Owned by the CTO. Updated on every architectural change. ADR required before modifying this document.

## System Overview

Fixbroken.ai is a static-first marketing and consulting site with a server-side contact form. It serves as both the agency hub for Fixbroken and the host for FixBroken OS, the shared design system used across all Fixbroken tenant sites.

## Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.x |
| Framework | Express | 4.21.x |
| Email | Nodemailer | 6.9.x |
| Reverse proxy | Nginx | System package |
| TLS | Let's Encrypt / Certbot | Auto-renew via systemd timer |
| Process manager | systemd | `fixbroken.service` |
| Hosting | AWS Lightsail | us-east-2 (Ohio) |
| Domain registrar | GoDaddy | `fixbroken.ai` |

## Data Model

There is no database. Data storage is flat-file:

| Data | Location | Format |
|---|---|---|
| Contact submissions | `contact.log` | JSONL (one JSON object per line) |
| Signup submissions (legacy) | `signups.log` | JSONL |
| SMTP config | `~/.fixbroken.env` | Shell environment variables |

## Service Boundaries

```
Internet
  │
  ▼
Nginx (:443 TLS)
  ├── /hooks/*  →  Webhook server (:3001)
  └── /*        →  Express app (:3000)
                     ├── GET  /           → static HTML (public/)
                     ├── GET  /healthz    → health check
                     ├── POST /contact    → contact form handler
                     ├── POST /signup     → legacy signup handler
                     └── GET  /design/*   → FixBroken OS assets
```

## External Dependencies

| Dependency | Purpose | Cost | Notes |
|---|---|---|---|
| AWS Lightsail | Hosting | ~$5/mo | Single instance, static IP 3.140.37.153 |
| GoDaddy | Domain | ~$20/yr | fixbroken.ai |
| Let's Encrypt | TLS certificates | Free | Auto-renew |
| SMTP provider | Contact form email delivery | Varies | Optional; degrades to file-only logging |
| GitHub | Source control + webhook deploy | Free tier | ericcotter-sys/vumo-fixbroken-site |

No third-party APIs, analytics, CDNs, or SaaS dependencies in production.

## Deploy Pipeline

```
git push origin main
  → GitHub webhook fires
  → /hooks/ endpoint on Lightsail receives it
  → deploy.sh runs:
      git fetch --all
      git reset --hard origin/main
      npm ci --omit=dev
      systemctl restart fixbroken
  → Site live in ~10 seconds
```

Staging: push to `staging` branch deploys to `stage.fixbroken.ai` (behind basic auth).

## Security Posture

- Express binds to `127.0.0.1:3000` — not reachable from the internet directly.
- Nginx handles TLS termination and proxies to loopback.
- `x-powered-by` header disabled.
- Request body size limited to 64KB.
- Webhook endpoint authenticated via shared secret in `/home/ubuntu/apps/fixbroken-webhook/.secret`.
- No user accounts, sessions, or authentication on the public site.
- Staging behind Nginx basic auth.
- Environment secrets in `~/.fixbroken.env`, not committed to repo.

## FixBroken OS (Design System)

Single CSS file: `public/design/fixbroken-os.css`. Namespace: `.fb-*`. Two fonts: Inter + JetBrains Mono. Subsites import from `https://fixbroken.ai/design/fixbroken-os.css` and override via scoped wrapper classes. See CLAUDE.md for full design system rules.

## Rejected Patterns ("No" List)

CTO maintains this list. When proposing something listed here, reference the entry instead of re-debating.

| Pattern/Tool | Rejected | Reason |
|---|---|---|
| — | — | No entries yet. |
