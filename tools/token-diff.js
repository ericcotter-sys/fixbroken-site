#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// FixBroken OS — Token Diff Tool
// ---------------------------------------------------------------------------
// Shows what tokens, components, and classes changed between two manifest
// versions. Useful for PR reviews and changelog generation.
//
// Usage:
//   node tools/token-diff.js                    # diff working vs last commit
//   node tools/token-diff.js <ref>              # diff working vs git ref
//   node tools/token-diff.js <ref1> <ref2>      # diff two git refs
//   node tools/token-diff.js --json             # JSON output
//   -h, --help                                  # show help
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_REL = 'public/design/fixbroken-os.manifest.json';

function parseArgs(argv) {
  const opts = { refs: [], json: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: token-diff [options] [ref1] [ref2]

Compare design system tokens between two versions.

Arguments:
  ref1    First git ref (default: HEAD)
  ref2    Second git ref (default: working tree)

Options:
  --json      JSON output
  -h, --help  Show this help

Examples:
  node tools/token-diff.js                # working tree vs last commit
  node tools/token-diff.js HEAD~5         # working tree vs 5 commits ago
  node tools/token-diff.js main staging   # compare two branches
  node tools/token-diff.js --json         # JSON output`);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      opts.refs.push(arg);
    }
  }
  return opts;
}

function getManifestAt(ref) {
  try {
    const content = execSync(`git show ${ref}:${MANIFEST_REL}`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getCurrentManifest() {
  const p = path.join(REPO_ROOT, MANIFEST_REL);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function flattenTokens(manifest) {
  const map = {};
  for (const [group, tokens] of Object.entries(manifest.tokens || {})) {
    for (const t of tokens) {
      map[t.name] = { value: t.value, group, description: t.description };
    }
  }
  return map;
}

function diffManifests(before, after) {
  const diff = {
    tokens: { added: [], removed: [], changed: [] },
    components: { added: [], removed: [] },
    classes: { added: [], removed: [] },
    voice: { addedUse: [], removedUse: [], addedAvoid: [], removedAvoid: [] },
  };

  // Token diff
  const bTokens = flattenTokens(before);
  const aTokens = flattenTokens(after);
  for (const name of Object.keys(aTokens)) {
    if (!bTokens[name]) {
      diff.tokens.added.push({ name, ...aTokens[name] });
    } else if (bTokens[name].value !== aTokens[name].value) {
      diff.tokens.changed.push({ name, before: bTokens[name].value, after: aTokens[name].value });
    }
  }
  for (const name of Object.keys(bTokens)) {
    if (!aTokens[name]) {
      diff.tokens.removed.push({ name, ...bTokens[name] });
    }
  }

  // Component diff
  const bComps = new Set((before.components || []).map(c => c.class));
  const aComps = new Set((after.components || []).map(c => c.class));
  for (const c of aComps) {
    if (!bComps.has(c)) diff.components.added.push(c);
  }
  for (const c of bComps) {
    if (!aComps.has(c)) diff.components.removed.push(c);
  }

  // Class diff
  const bClasses = new Set(before.allClasses || []);
  const aClasses = new Set(after.allClasses || []);
  for (const c of aClasses) {
    if (!bClasses.has(c)) diff.classes.added.push(c);
  }
  for (const c of bClasses) {
    if (!aClasses.has(c)) diff.classes.removed.push(c);
  }

  // Voice diff
  const bUse = new Set((before.voice || {}).use || []);
  const aUse = new Set((after.voice || {}).use || []);
  const bAvoid = new Set((before.voice || {}).avoid || []);
  const aAvoid = new Set((after.voice || {}).avoid || []);
  for (const v of aUse) { if (!bUse.has(v)) diff.voice.addedUse.push(v); }
  for (const v of bUse) { if (!aUse.has(v)) diff.voice.removedUse.push(v); }
  for (const v of aAvoid) { if (!bAvoid.has(v)) diff.voice.addedAvoid.push(v); }
  for (const v of bAvoid) { if (!aAvoid.has(v)) diff.voice.removedAvoid.push(v); }

  return diff;
}

function hasChanges(diff) {
  return diff.tokens.added.length + diff.tokens.removed.length + diff.tokens.changed.length +
    diff.components.added.length + diff.components.removed.length +
    diff.classes.added.length + diff.classes.removed.length +
    diff.voice.addedUse.length + diff.voice.removedUse.length +
    diff.voice.addedAvoid.length + diff.voice.removedAvoid.length > 0;
}

function printDiff(diff, beforeLabel, afterLabel) {
  const g = '\x1b[32m';
  const r = '\x1b[31m';
  const y = '\x1b[33m';
  const d = '\x1b[2m';
  const reset = '\x1b[0m';

  console.log(`\n\x1b[1mDesign System Diff\x1b[0m  ${d}${beforeLabel} → ${afterLabel}${reset}`);
  console.log('─'.repeat(50));

  if (!hasChanges(diff)) {
    console.log(`\n  ${g}No changes.${reset}\n`);
    return;
  }

  // Tokens
  if (diff.tokens.added.length + diff.tokens.removed.length + diff.tokens.changed.length > 0) {
    console.log(`\n  \x1b[1mTokens\x1b[0m`);
    for (const t of diff.tokens.added) {
      console.log(`    ${g}+ ${t.name}: ${t.value}${reset}`);
    }
    for (const t of diff.tokens.removed) {
      console.log(`    ${r}- ${t.name}: ${t.value}${reset}`);
    }
    for (const t of diff.tokens.changed) {
      console.log(`    ${y}~ ${t.name}: ${t.before} → ${t.after}${reset}`);
    }
  }

  // Components
  if (diff.components.added.length + diff.components.removed.length > 0) {
    console.log(`\n  \x1b[1mComponents\x1b[0m`);
    for (const c of diff.components.added) console.log(`    ${g}+ .${c}${reset}`);
    for (const c of diff.components.removed) console.log(`    ${r}- .${c}${reset}`);
  }

  // Classes
  if (diff.classes.added.length + diff.classes.removed.length > 0) {
    console.log(`\n  \x1b[1mClasses\x1b[0m  ${d}(${diff.classes.added.length} added, ${diff.classes.removed.length} removed)${reset}`);
    if (diff.classes.added.length <= 10) {
      for (const c of diff.classes.added) console.log(`    ${g}+ .${c}${reset}`);
    }
    if (diff.classes.removed.length <= 10) {
      for (const c of diff.classes.removed) console.log(`    ${r}- .${c}${reset}`);
    }
  }

  // Voice
  const voiceChanges = diff.voice.addedUse.length + diff.voice.removedUse.length +
    diff.voice.addedAvoid.length + diff.voice.removedAvoid.length;
  if (voiceChanges > 0) {
    console.log(`\n  \x1b[1mVoice\x1b[0m`);
    for (const v of diff.voice.addedUse) console.log(`    ${g}+ use: "${v}"${reset}`);
    for (const v of diff.voice.removedUse) console.log(`    ${r}- use: "${v}"${reset}`);
    for (const v of diff.voice.addedAvoid) console.log(`    ${g}+ avoid: "${v}"${reset}`);
    for (const v of diff.voice.removedAvoid) console.log(`    ${r}- avoid: "${v}"${reset}`);
  }

  console.log('');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  let before, after, beforeLabel, afterLabel;

  if (opts.refs.length === 2) {
    before = getManifestAt(opts.refs[0]);
    after = getManifestAt(opts.refs[1]);
    beforeLabel = opts.refs[0];
    afterLabel = opts.refs[1];
  } else if (opts.refs.length === 1) {
    before = getManifestAt(opts.refs[0]);
    after = getCurrentManifest();
    beforeLabel = opts.refs[0];
    afterLabel = 'working';
  } else {
    before = getManifestAt('HEAD');
    after = getCurrentManifest();
    beforeLabel = 'HEAD';
    afterLabel = 'working';
  }

  if (!before) {
    console.error(`Error: could not load manifest at ${beforeLabel}`);
    process.exit(1);
  }
  if (!after) {
    console.error(`Error: could not load manifest at ${afterLabel}`);
    process.exit(1);
  }

  const diff = diffManifests(before, after);

  if (opts.json) {
    console.log(JSON.stringify({ before: beforeLabel, after: afterLabel, diff }, null, 2));
  } else {
    printDiff(diff, beforeLabel, afterLabel);
  }

  process.exit(hasChanges(diff) ? 1 : 0);
}

main();
