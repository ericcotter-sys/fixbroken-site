#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Manifest Validator
// ---------------------------------------------------------------------------
// Re-generates the manifest into a temp file and compares with the committed
// version. If they differ, the manifest is stale.
//
// Usage:
//   node tools/validate-manifest.js [--fix]
//
// Exit codes:
//   0  Manifest is current
//   1  Manifest is stale (run npm run generate:manifest to update)
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'public', 'design', 'fixbroken-os.manifest.json');

function main() {
  const fix = process.argv.includes('--fix');

  if (!fs.existsSync(MANIFEST_PATH)) {
    if (fix) {
      console.log('Manifest missing — generating...');
      execSync('node tools/generate-manifest.js', { cwd: REPO_ROOT, stdio: 'inherit' });
      process.exit(0);
    }
    console.error('Error: manifest does not exist. Run: npm run generate:manifest');
    process.exit(1);
  }

  const before = fs.readFileSync(MANIFEST_PATH, 'utf8');

  // Re-generate
  execSync('node tools/generate-manifest.js', { cwd: REPO_ROOT, stdio: 'pipe' });

  const after = fs.readFileSync(MANIFEST_PATH, 'utf8');

  // Strip the "generated" timestamp for comparison
  const normalize = (s) => JSON.stringify(
    JSON.parse(s),
    (k, v) => k === 'generated' ? '__TIMESTAMP__' : v
  );

  if (normalize(before) === normalize(after)) {
    // Restore the original file (so we don't touch the timestamp)
    fs.writeFileSync(MANIFEST_PATH, before);
    console.log('\x1b[32m✓\x1b[0m Manifest is current.');
    process.exit(0);
  }

  if (fix) {
    console.log('\x1b[33m!\x1b[0m Manifest was stale — updated.');
    process.exit(0);
  }

  // Restore original and report stale
  fs.writeFileSync(MANIFEST_PATH, before);
  console.error('\x1b[31m✗\x1b[0m Manifest is stale. Run: npm run generate:manifest');

  // Show what changed
  try {
    const beforeObj = JSON.parse(before);
    const afterObj = JSON.parse(after);
    const diffs = [];
    const bTokens = Object.values(beforeObj.tokens || {}).reduce((s, a) => s + a.length, 0);
    const aTokens = Object.values(afterObj.tokens || {}).reduce((s, a) => s + a.length, 0);
    if (bTokens !== aTokens) diffs.push(`tokens: ${bTokens} → ${aTokens}`);
    if ((beforeObj.components || []).length !== (afterObj.components || []).length) {
      diffs.push(`components: ${beforeObj.components.length} → ${afterObj.components.length}`);
    }
    if ((beforeObj.allClasses || []).length !== (afterObj.allClasses || []).length) {
      diffs.push(`classes: ${beforeObj.allClasses.length} → ${afterObj.allClasses.length}`);
    }
    if (diffs.length > 0) {
      console.error('  Changes: ' + diffs.join(', '));
    }
  } catch {}

  process.exit(1);
}

main();
