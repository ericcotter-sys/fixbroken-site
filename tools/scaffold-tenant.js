#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Tenant Scaffolding Generator
// ---------------------------------------------------------------------------
// Creates a complete new tenant subsite under the fixbroken.ai umbrella.
//
// Generates:
//   <output-dir>/
//     ├── server.js          Express static server
//     ├── package.json
//     ├── deploy.sh           Webhook-triggered deploy script
//     ├── public/
//     │   ├── index.html      Landing page with FixBroken OS + override CSS
//     │   └── <name>-overrides.css   Token/component overrides
//     ├── CLAUDE.md            Agent instructions
//     └── README.md
//
//   Plus templates for:
//     - systemd unit file (<name>.service)
//     - nginx server block (<name>.nginx.conf)
//
// Usage:
//   node tools/scaffold-tenant.js <name> [options]
//
// Options:
//   --port <port>    Express port (default: next available from 3020)
//   --domain <fqdn>  Full domain (default: <name>.fixbroken.ai)
//   --output <dir>   Output directory (default: ../apps/<name>)
//   --dry-run        Print what would be created, don't write
//   -h, --help       Show help
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const APPS_DIR = path.resolve(REPO_ROOT, '..');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseArgs(argv) {
  const args = { name: null, port: null, domain: null, output: null, dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--port') {
      args.port = parseInt(argv[++i], 10);
    } else if (arg === '--domain') {
      args.domain = argv[++i];
    } else if (arg === '--output') {
      args.output = argv[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (!arg.startsWith('-') && !args.name) {
      args.name = arg.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: scaffold-tenant <name> [options]

Creates a new FixBroken OS tenant subsite.

Arguments:
  name              Tenant name (lowercase, alphanumeric + hyphens)

Options:
  --port <port>     Express port (default: auto-detect next available)
  --domain <fqdn>   Domain (default: <name>.fixbroken.ai)
  --output <dir>    Output directory (default: /home/ubuntu/apps/<name>)
  --dry-run         Show what would be created without writing files
  -h, --help        Show this help

Examples:
  node tools/scaffold-tenant.js acme
  node tools/scaffold-tenant.js acme --port 3030 --domain acme.fixbroken.ai
  node tools/scaffold-tenant.js census --dry-run`);
}

function detectNextPort() {
  // Scan existing apps for the highest port in use
  const knownPorts = [3000, 3001, 3002, 3010]; // fixbroken, webhook, staging, vumo
  try {
    const dirs = fs.readdirSync(APPS_DIR, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const serverPath = path.join(APPS_DIR, d.name, 'server.js');
      if (!fs.existsSync(serverPath)) continue;
      const content = fs.readFileSync(serverPath, 'utf8');
      const portMatch = content.match(/PORT.*?['"](\d+)['"]/);
      if (portMatch) knownPorts.push(parseInt(portMatch[1]));
    }
  } catch {}
  const maxPort = Math.max(...knownPorts);
  return maxPort < 3020 ? 3020 : maxPort + 10;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function serverJs(name, port) {
  return `const express = require('express');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '${port}', 10);
const app = express();

app.disable('x-powered-by');
app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.listen(PORT, HOST, () => {
  console.log(\`${name} listening on http://\${HOST}:\${PORT}\`);
});
`;
}

function packageJson(name) {
  return JSON.stringify({
    name: `${name}-site`,
    version: '0.1.0',
    private: true,
    type: 'commonjs',
    main: 'server.js',
    scripts: { start: 'node server.js' },
    dependencies: { express: '^4.21.0' },
  }, null, 2) + '\n';
}

function deployScript(name) {
  return `#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/apps/${name}
git fetch --all
git reset --hard origin/main
npm ci --omit=dev || npm install --omit=dev
sudo /usr/bin/systemctl restart ${name}
`;
}

function indexHtml(name, domain) {
  const titleName = name.charAt(0).toUpperCase() + name.slice(1);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titleName)} · fixbroken.ai</title>
<meta name="description" content="${esc(titleName)} — a fixbroken.ai tenant.">
<meta name="theme-color" content="#05070a">
<link rel="stylesheet" href="https://fixbroken.ai/design/fixbroken-os.css">
<link rel="stylesheet" href="/${name}-overrides.css">
</head>
<body class="${name}-scope">

<div class="fb-grid-bg"></div>
<div class="fb-scanline"></div>

<div class="fb-shell">

  <nav class="fb-nav">
    <div class="fb-nav__inner">
      <a href="/" class="fb-nav__brand">${esc(titleName)}</a>
      <div class="fb-nav__links">
        <a class="fb-nav__link fb-nav__link--active" href="/">Home</a>
        <a class="fb-nav__link" href="https://fixbroken.ai">fixbroken.ai</a>
      </div>
    </div>
  </nav>

  <main>
    <section class="fb-section fb-section--loose" style="position:relative; overflow:hidden;">
      <div class="fb-mcp-cone" style="--cone-h: 400px;"></div>
      <div class="fb-container" style="position:relative;">
        <div class="fb-stack">
          <span class="fb-kicker">System · ${esc(titleName)}</span>
          <h1 class="fb-display">${esc(titleName)}.</h1>
          <p class="fb-lede">
            Welcome to the ${esc(titleName)} console. This is a tenant subsite running on FixBroken OS.
          </p>
          <div class="fb-row fb-row--wrap" style="gap: var(--fb-s-2);">
            <span class="fb-chip fb-chip--signal">v0.1</span>
            <span class="fb-status">system online</span>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="fb-footer">
    <div class="fb-footer__row">
      <span>${esc(domain)}</span>
      <span>powered by FixBroken OS</span>
      <span class="fb-status">system online</span>
    </div>
  </footer>

</div>

</body>
</html>
`;
}

function overridesCss(name) {
  return `/* ==========================================================================
   ${name} — Project Overrides
   --------------------------------------------------------------------------
   Loaded AFTER fixbroken-os.css. Override tokens or components here.
   Scope all overrides to .${name}-scope to avoid polluting the global system.
   ========================================================================== */

/* Token overrides — uncomment and adjust as needed */
/*
.${name}-scope {
  --fb-signal: #5bb8ff;
  --fb-signal-dim: #4a9ad6;
  --fb-signal-bright: #8ecfff;
  --fb-signal-glow: rgba(91, 184, 255, 0.35);
  --fb-signal-wash: rgba(91, 184, 255, 0.06);
}
*/

/* Component overrides — scope to .${name}-scope */
/*
.${name}-scope .fb-cta {
  text-transform: none;
}
*/

/* Project-specific components — use ${name}- prefix */
/*
.${name}-example {
  padding: var(--fb-s-4);
}
*/
`;
}

function claudeMd(name, domain, port) {
  const titleName = name.charAt(0).toUpperCase() + name.slice(1);
  return `# CLAUDE.md — ${name}-site

## Overview

${titleName} is a tenant subsite under fixbroken.ai, running on FixBroken OS.

**Live URL:** https://${domain}
**Port:** ${port}

## Stack

- Node 20 + Express (static file server)
- Nginx reverse proxy on the fixbroken.ai Lightsail instance
- FixBroken OS design system (loaded from https://fixbroken.ai/design/fixbroken-os.css)

## Layout

\`\`\`
${name}-site/
├── server.js              Express entry point (port ${port})
├── package.json
├── deploy.sh              webhook-triggered deploy script
├── public/
│   ├── index.html         landing page
│   └── ${name}-overrides.css   token/component overrides
├── CLAUDE.md              this file
└── README.md
\`\`\`

## Design System Rules

1. FixBroken OS is the base. Load it first, always.
2. Overrides go in \`${name}-overrides.css\`, scoped to \`.${name}-scope\`.
3. New components use \`.${name}-\` prefix, never \`.fb-\`.
4. Do NOT use pink — that's the fixbroken.ai flagship color.
5. Test at 375px, 768px, and 1440px before shipping.

## Development

\`\`\`bash
npm start                     # http://127.0.0.1:${port}
\`\`\`

Push to \`main\` to deploy via webhook.
`;
}

function readmeMd(name, domain) {
  const titleName = name.charAt(0).toUpperCase() + name.slice(1);
  return `# ${titleName}

Tenant subsite at [${domain}](https://${domain}), running on FixBroken OS.

## Quick start

\`\`\`bash
npm install
npm start
\`\`\`

## Deploy

Push to \`main\`. Webhook auto-deploys in ~10 seconds.
`;
}

function systemdUnit(name, port) {
  const titleName = name.charAt(0).toUpperCase() + name.slice(1);
  return `[Unit]
Description=${titleName} subsite Node app
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/apps/${name}
ExecStart=/usr/bin/node /home/ubuntu/apps/${name}/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=${port}

[Install]
WantedBy=multi-user.target
`;
}

function nginxConf(name, domain, port) {
  return `server {
  server_name ${domain};

  location / {
    proxy_pass http://127.0.0.1:${port};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # After setting up DNS, run:
  #   sudo certbot --nginx -d ${domain}
  listen 80;
  listen [::]:80;
}
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.name) {
    console.error('Error: tenant name is required.\n');
    printHelp();
    process.exit(1);
  }

  const name = args.name;
  const port = args.port || detectNextPort();
  const domain = args.domain || `${name}.fixbroken.ai`;
  const outputDir = args.output ? path.resolve(args.output) : path.join(APPS_DIR, name);

  const files = [
    { rel: 'server.js', content: serverJs(name, port) },
    { rel: 'package.json', content: packageJson(name) },
    { rel: 'deploy.sh', content: deployScript(name), executable: true },
    { rel: 'public/index.html', content: indexHtml(name, domain) },
    { rel: `public/${name}-overrides.css`, content: overridesCss(name) },
    { rel: 'CLAUDE.md', content: claudeMd(name, domain, port) },
    { rel: 'README.md', content: readmeMd(name, domain) },
  ];

  const infraFiles = [
    { rel: `${name}.service`, content: systemdUnit(name, port), infra: true },
    { rel: `${name}.nginx.conf`, content: nginxConf(name, domain, port), infra: true },
  ];

  console.log(`\nScaffolding tenant: ${name}`);
  console.log(`  Domain: ${domain}`);
  console.log(`  Port:   ${port}`);
  console.log(`  Output: ${outputDir}`);
  console.log('');

  if (args.dryRun) {
    console.log('Dry run — files that would be created:\n');
    for (const f of [...files, ...infraFiles]) {
      const tag = f.infra ? ' (infrastructure template)' : '';
      console.log(`  ${path.join(outputDir, f.rel)}${tag}`);
    }
    console.log('\nRe-run without --dry-run to create files.');
    process.exit(0);
  }

  if (fs.existsSync(outputDir)) {
    const existing = fs.readdirSync(outputDir);
    if (existing.length > 0) {
      console.error(`Error: ${outputDir} already exists and is not empty.`);
      console.error('Use --output to specify a different directory, or remove the existing one.');
      process.exit(1);
    }
  }

  // Write project files
  for (const f of files) {
    const fullPath = path.join(outputDir, f.rel);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, f.content);
    if (f.executable) fs.chmodSync(fullPath, 0o755);
    console.log(`  created ${f.rel}`);
  }

  // Write infra templates into the project root
  for (const f of infraFiles) {
    const fullPath = path.join(outputDir, f.rel);
    fs.writeFileSync(fullPath, f.content);
    console.log(`  created ${f.rel} (infrastructure template)`);
  }

  console.log(`
Done. Next steps:

  1. cd ${outputDir}
  2. npm install
  3. npm start                    # test at http://127.0.0.1:${port}

  To deploy:
  4. git init && git remote add origin <repo-url>
  5. sudo cp ${name}.service /etc/systemd/system/
  6. sudo systemctl enable --now ${name}
  7. sudo cp ${name}.nginx.conf /etc/nginx/sites-enabled/${name}
  8. sudo nginx -t && sudo systemctl reload nginx
  9. Point DNS for ${domain} to this server
  10. sudo certbot --nginx -d ${domain}
`);
}

main();
