#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const http = require('http');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Pre-Deploy Check
// ---------------------------------------------------------------------------
// Validates that the codebase is ready for deploy:
//   1. Git state (clean working tree, on correct branch)
//   2. Quality gate (manifest + lint + audit)
//   3. Server health (optional, for post-deploy verification)
//
// Usage:
//   node tools/deploy-check.js                  # pre-deploy checks
//   node tools/deploy-check.js --post           # post-deploy verification
//   node tools/deploy-check.js --target staging # check staging branch
//   -h, --help
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = { post: false, target: 'main' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--post') opts.post = true;
    else if (argv[i] === '--target') opts.target = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(`Usage: deploy-check [options]

Pre-deploy and post-deploy validation for FixBroken OS.

Options:
  --post            Run post-deploy health checks instead
  --target <branch> Target branch (default: main)
  -h, --help        Show this help

Pre-deploy checks:
  1. Working tree is clean (no uncommitted changes)
  2. On the target branch
  3. Up to date with remote
  4. Quality gate passes (manifest + lint + audit)

Post-deploy checks:
  1. Server responds on /healthz
  2. Homepage returns 200
  3. Design system CSS is accessible
  4. Manifest API responds

Examples:
  node tools/deploy-check.js                  # before deploying to main
  node tools/deploy-check.js --target staging # before deploying to staging
  node tools/deploy-check.js --post           # after deploy`);
      process.exit(0);
    }
  }
  return opts;
}

function run(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null;
  }
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, body: data.slice(0, 200) }));
    });
    req.on('error', (e) => resolve({ ok: false, status: null, body: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: null, body: 'timeout' }); });
  });
}

function step(pass, msg) {
  const icon = pass ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} ${msg}`);
  return pass;
}

async function preDeployChecks(target) {
  console.log(`\n\x1b[1mPre-deploy checks\x1b[0m  target: ${target}`);
  console.log('─'.repeat(40));
  let allPass = true;

  // 1. Clean working tree
  const status = run('git status --porcelain');
  allPass = step(status === '', status === '' ? 'working tree clean' : `uncommitted changes:\n    ${status.split('\n').slice(0, 5).join('\n    ')}`) && allPass;

  // 2. Correct branch
  const branch = run('git rev-parse --abbrev-ref HEAD');
  allPass = step(branch === target, branch === target ? `on branch ${target}` : `on branch ${branch}, expected ${target}`) && allPass;

  // 3. Up to date with remote
  run('git fetch origin --quiet');
  const local = run('git rev-parse HEAD');
  const remote = run(`git rev-parse origin/${target}`);
  if (remote) {
    const behind = run(`git rev-list HEAD..origin/${target} --count`);
    const ahead = run(`git rev-list origin/${target}..HEAD --count`);
    allPass = step(behind === '0', behind === '0' ? `up to date with origin/${target}` : `${behind} commits behind origin/${target}`) && allPass;
    if (ahead !== '0') {
      console.log(`  \x1b[33m!\x1b[0m ${ahead} commits ahead of origin/${target} (will be deployed)`);
    }
  }

  // 4. Quality gate
  console.log('');
  try {
    execSync('node tools/check.js', { cwd: REPO_ROOT, stdio: 'inherit' });
    allPass = step(true, 'quality gate passed') && allPass;
  } catch {
    allPass = step(false, 'quality gate failed') && allPass;
  }

  return allPass;
}

async function postDeployChecks() {
  console.log(`\n\x1b[1mPost-deploy checks\x1b[0m`);
  console.log('─'.repeat(40));
  let allPass = true;

  const checks = [
    { url: 'http://127.0.0.1:3000/healthz', name: 'server /healthz' },
    { url: 'http://127.0.0.1:3000/', name: 'homepage' },
    { url: 'http://127.0.0.1:3000/design/fixbroken-os.css', name: 'design system CSS' },
    { url: 'http://127.0.0.1:3000/design/fixbroken-os.manifest.json', name: 'manifest JSON' },
    { url: 'http://127.0.0.1:3000/api/stats', name: 'stats API' },
  ];

  for (const check of checks) {
    const result = await checkUrl(check.url);
    allPass = step(result.ok, result.ok ? `${check.name} (${result.status})` : `${check.name} — ${result.body}`) && allPass;
  }

  return allPass;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let pass;
  if (opts.post) {
    pass = await postDeployChecks();
  } else {
    pass = await preDeployChecks(opts.target);
  }

  console.log('');
  if (pass) {
    console.log('\x1b[32m✓ All checks passed.\x1b[0m Ready to deploy.');
  } else {
    console.log('\x1b[31m✗ Some checks failed.\x1b[0m Fix before deploying.');
  }
  process.exit(pass ? 0 : 1);
}

main();
