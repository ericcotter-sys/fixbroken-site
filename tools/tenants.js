#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

// ---------------------------------------------------------------------------
// FixBroken OS — Tenant Manager
// ---------------------------------------------------------------------------
// Lists active tenants, their ports, domains, health, and running state.
//
// Usage:
//   node tools/tenants.js              # list all tenants
//   node tools/tenants.js --json       # JSON output
//   node tools/tenants.js --health     # include live health checks
//   -h, --help                         # show help
// ---------------------------------------------------------------------------

const APPS_DIR = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const opts = { json: false, health: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--health') opts.health = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: tenants [options]

Lists active FixBroken OS tenants.

Options:
  --json      JSON output
  --health    Include live health check (hits /healthz on each port)
  -h, --help  Show this help

Examples:
  node tools/tenants.js
  node tools/tenants.js --health
  node tools/tenants.js --json`);
      process.exit(0);
    }
  }
  return opts;
}

function discoverTenants() {
  const tenants = [];
  let dirs;
  try {
    dirs = fs.readdirSync(APPS_DIR, { withFileTypes: true });
  } catch {
    return tenants;
  }

  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const appDir = path.join(APPS_DIR, d.name);
    const serverPath = path.join(appDir, 'server.js');
    const pkgPath = path.join(appDir, 'package.json');

    if (!fs.existsSync(serverPath)) continue;

    const tenant = {
      name: d.name,
      dir: appDir,
      port: null,
      host: '127.0.0.1',
      domain: null,
      hasDesignSystem: false,
      hasDeploy: false,
      type: 'unknown',
    };

    // Extract port: check systemd unit first (runtime override), then server.js
    try {
      const unitPath = `/etc/systemd/system/${d.name}.service`;
      if (fs.existsSync(unitPath)) {
        const unit = fs.readFileSync(unitPath, 'utf8');
        const unitPort = unit.match(/Environment=PORT=(\d+)/);
        if (unitPort) tenant.port = parseInt(unitPort[1]);
      }
    } catch {}
    if (!tenant.port) {
      try {
        const serverContent = fs.readFileSync(serverPath, 'utf8');
        const portMatch = serverContent.match(/PORT.*?['"](\d+)['"]/);
        if (portMatch) tenant.port = parseInt(portMatch[1]);
      } catch {}
    }

    // Check for package.json
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      tenant.name = pkg.name || d.name;
    } catch {}

    // Check for deploy script
    tenant.hasDeploy = fs.existsSync(path.join(appDir, 'deploy.sh'));

    // Check if it loads fixbroken-os.css
    const indexPath = path.join(appDir, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      try {
        const indexContent = fs.readFileSync(indexPath, 'utf8');
        tenant.hasDesignSystem = /fixbroken-os\.css/.test(indexContent);
      } catch {}
    }

    // Determine type
    if (d.name === 'fixbroken') tenant.type = 'flagship';
    else if (d.name === 'fixbroken-staging') tenant.type = 'staging';
    else if (d.name === 'fixbroken-webhook') tenant.type = 'infrastructure';
    else tenant.type = 'tenant';

    // Determine domain: known names first, then CLAUDE.md, then convention
    if (d.name === 'fixbroken') tenant.domain = 'fixbroken.ai';
    else if (d.name === 'fixbroken-staging') tenant.domain = 'stage.fixbroken.ai';
    else if (d.name === 'vumo') tenant.domain = 'vumo.fixbroken.ai';
    else {
      try {
        const claudePath = path.join(appDir, 'CLAUDE.md');
        if (fs.existsSync(claudePath)) {
          const claude = fs.readFileSync(claudePath, 'utf8');
          const urlMatch = claude.match(/\*\*Live URL:\*\*\s*https?:\/\/([a-z0-9.-]+)/i);
          if (urlMatch) tenant.domain = urlMatch[1];
        }
      } catch {}
      if (!tenant.domain) tenant.domain = `${d.name}.fixbroken.ai`;
    }

    tenants.push(tenant);
  }

  return tenants.sort((a, b) => (a.port || 0) - (b.port || 0));
}

function checkHealth(host, port) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/healthz`, { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode === 200 ? 'healthy' : 'unhealthy', code: res.statusCode, body: data.trim() });
      });
    });
    req.on('error', () => resolve({ status: 'down', code: null, body: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout', code: null, body: null }); });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tenants = discoverTenants();

  if (tenants.length === 0) {
    console.log('No tenants found.');
    process.exit(0);
  }

  // Health checks
  if (opts.health) {
    await Promise.all(tenants.map(async (t) => {
      if (t.port) {
        t.health = await checkHealth(t.host, t.port);
      } else {
        t.health = { status: 'no-port', code: null, body: null };
      }
    }));
  }

  if (opts.json) {
    console.log(JSON.stringify({ tenants }, null, 2));
    return;
  }

  // Table output
  console.log('');
  console.log('\x1b[1mFixBroken OS — Active Tenants\x1b[0m');
  console.log('─'.repeat(74));

  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const typeColors = {
    flagship: '\x1b[35m',      // pink
    staging: '\x1b[33m',       // amber
    tenant: '\x1b[36m',        // cyan
    infrastructure: '\x1b[2m', // dim
  };

  for (const t of tenants) {
    const tc = typeColors[t.type] || '';

    const portStr = t.port ? `:${t.port}` : '  — ';
    const dsStr = t.hasDesignSystem ? '\x1b[32m●\x1b[0m OS' : '\x1b[2m○\x1b[0m   ';
    const deployStr = t.hasDeploy ? '\x1b[32m●\x1b[0m' : '\x1b[2m○\x1b[0m';

    let healthStr = '';
    if (t.health) {
      const hc = t.health.status === 'healthy' ? '\x1b[32m' : t.health.status === 'down' ? '\x1b[31m' : '\x1b[33m';
      healthStr = `  ${hc}${t.health.status}${reset}`;
    }

    console.log(`  ${tc}${t.type.padEnd(14)}${reset} ${portStr.padEnd(6)} ${(t.domain || '').padEnd(28)} ${dsStr} ${deployStr}${healthStr}`);
  }

  console.log('');
  console.log(`  ${dim}● = yes  ○ = no  OS = FixBroken OS loaded${reset}`);

  if (opts.health) {
    const healthy = tenants.filter(t => t.health && t.health.status === 'healthy').length;
    const total = tenants.filter(t => t.port).length;
    console.log(`  ${dim}Health: ${healthy}/${total} responding${reset}`);
  }

  console.log('');
}

main();
