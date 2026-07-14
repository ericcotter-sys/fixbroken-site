# fixbroken-site

Source for **https://fixbroken.ai** — Eric Cotter's consulting site and the home of **FixBroken OS**, the global design system used across the entire tenant tree (client subsites).

## Stack

Node 20 · Express · static HTML · Nginx · Ubuntu 24.04 (Lightsail) · Let's Encrypt

## Layout

```
public/
  index.html              fixbroken.ai landing
  design/
    fixbroken-os.css      ← THE design system (imported by every tenant)
    index.html            living style guide at /design/
    brand.md              voice, palette, principles
server.js                 Express on 127.0.0.1:3000
deploy.sh                 webhook auto-deploy (git pull + restart)
CLAUDE.md                 agent instructions
```

## Design system

FixBroken OS lives at `/public/design/fixbroken-os.css`. It is served publicly at https://fixbroken.ai/design/fixbroken-os.css and imported by every subsite in the tenant tree. See `CLAUDE.md` for the rules on how to extend, override, and ship to it.

Style guide: https://fixbroken.ai/design/

## Dev

```bash
npm install
HOST=127.0.0.1 PORT=3000 node server.js
open http://127.0.0.1:3000
```

## Deploy

Push to `main` → webhook → production at https://fixbroken.ai.  
Push to `staging` → webhook → preview at https://stage.fixbroken.ai (basic auth).
