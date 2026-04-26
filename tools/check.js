#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Unified Quality Gate
// ---------------------------------------------------------------------------
// Runs all checks in sequence. Exit 1 on first failure.
//
// Checks:
//   1. Manifest validation (is it current?)
//   2. Voice lint (banned phrases, CSS violations)
//   3. Page audit (design, structure, a11y, responsive, perf)
//
// Usage:
//   node tools/check.js [--fix]
//   npm run check
//
// --fix will auto-regenerate the manifest if stale.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const fix = process.argv.includes('--fix');

const steps = [
  {
    name: 'Manifest validation',
    cmd: `node tools/validate-manifest.js${fix ? ' --fix' : ''}`,
  },
  {
    name: 'Voice lint',
    cmd: 'node tools/voice-lint.js',
  },
  {
    name: 'Page audit',
    cmd: 'node tools/audit.js public/',
  },
];

let failed = false;

for (const step of steps) {
  console.log(`\n\x1b[1m▸ ${step.name}\x1b[0m`);
  console.log('─'.repeat(40));
  try {
    execSync(step.cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
    console.log(`\x1b[32m✓ ${step.name} passed\x1b[0m`);
  } catch (e) {
    console.log(`\x1b[31m✗ ${step.name} failed\x1b[0m`);
    failed = true;
    break;
  }
}

console.log('');
if (failed) {
  console.log('\x1b[31m✗ Quality gate failed.\x1b[0m Fix the issues above and re-run.');
  process.exit(1);
} else {
  console.log('\x1b[32m✓ All checks passed.\x1b[0m');
  process.exit(0);
}
