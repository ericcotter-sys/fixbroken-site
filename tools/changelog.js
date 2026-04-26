#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Changelog Generator
// ---------------------------------------------------------------------------
// Generates a human-readable changelog entry from design system changes
// between two git refs. Uses the token-diff module for comparison and
// git log for commit context.
//
// Usage:
//   node tools/changelog.js                     # since last tag
//   node tools/changelog.js <ref>               # since ref
//   node tools/changelog.js <ref1> <ref2>       # between refs
//   node tools/changelog.js --markdown          # markdown output
//   -h, --help
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_REL = 'public/design/fixbroken-os.manifest.json';

function parseArgs(argv) {
  const opts = { refs: [], markdown: false };
  for (const arg of argv) {
    if (arg === '--markdown' || arg === '--md') opts.markdown = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: changelog [options] [ref1] [ref2]

Generate a design system changelog between two versions.

Arguments:
  ref1    Start ref (default: last tag, or first commit with manifest)
  ref2    End ref (default: HEAD)

Options:
  --markdown, --md   Markdown output (for PR descriptions)
  -h, --help         Show this help

Examples:
  node tools/changelog.js                  # since last tag
  node tools/changelog.js HEAD~10          # last 10 commits
  node tools/changelog.js v0.1 HEAD --md   # markdown between tags`);
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
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(content);
  } catch { return null; }
}

function getCurrentManifest() {
  const p = path.join(REPO_ROOT, MANIFEST_REL);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function getLastTag() {
  try {
    return execSync('git describe --tags --abbrev=0 2>/dev/null', {
      cwd: REPO_ROOT, encoding: 'utf8',
    }).trim();
  } catch { return null; }
}

function getCommits(from, to) {
  try {
    const range = from ? `${from}..${to || 'HEAD'}` : to || 'HEAD';
    const log = execSync(
      `git log ${range} --oneline -- public/design/fixbroken-os.css public/design/brand.md`,
      { cwd: REPO_ROOT, encoding: 'utf8' }
    ).trim();
    return log ? log.split('\n') : [];
  } catch { return []; }
}

function flattenTokens(manifest) {
  const map = {};
  for (const [group, tokens] of Object.entries(manifest.tokens || {})) {
    for (const t of tokens) {
      map[t.name] = { value: t.value, group };
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
    breakpoints: { added: [], removed: [] },
  };

  const bTokens = flattenTokens(before);
  const aTokens = flattenTokens(after);
  for (const name of Object.keys(aTokens)) {
    if (!bTokens[name]) diff.tokens.added.push({ name, ...aTokens[name] });
    else if (bTokens[name].value !== aTokens[name].value)
      diff.tokens.changed.push({ name, before: bTokens[name].value, after: aTokens[name].value });
  }
  for (const name of Object.keys(bTokens)) {
    if (!aTokens[name]) diff.tokens.removed.push({ name, ...bTokens[name] });
  }

  const bComps = new Set((before.components || []).map(c => c.class));
  const aComps = new Set((after.components || []).map(c => c.class));
  for (const c of aComps) { if (!bComps.has(c)) diff.components.added.push(c); }
  for (const c of bComps) { if (!aComps.has(c)) diff.components.removed.push(c); }

  const bClasses = new Set(before.allClasses || []);
  const aClasses = new Set(after.allClasses || []);
  for (const c of aClasses) { if (!bClasses.has(c)) diff.classes.added.push(c); }
  for (const c of bClasses) { if (!aClasses.has(c)) diff.classes.removed.push(c); }

  const bBp = new Set(before.breakpoints || []);
  const aBp = new Set(after.breakpoints || []);
  for (const bp of aBp) { if (!bBp.has(bp)) diff.breakpoints.added.push(bp); }
  for (const bp of bBp) { if (!aBp.has(bp)) diff.breakpoints.removed.push(bp); }

  return diff;
}

function hasChanges(diff) {
  return Object.values(diff).some(cat =>
    Object.values(cat).some(arr => arr.length > 0)
  );
}

function renderMarkdown(diff, from, to, commits) {
  const lines = [];
  lines.push(`## Design System Changelog`);
  lines.push(`\n> ${from} → ${to}\n`);

  if (!hasChanges(diff) && commits.length === 0) {
    lines.push('No design system changes in this range.\n');
    return lines.join('\n');
  }

  if (diff.tokens.added.length > 0) {
    lines.push('### New Tokens\n');
    for (const t of diff.tokens.added) lines.push(`- \`${t.name}\`: \`${t.value}\``);
    lines.push('');
  }
  if (diff.tokens.changed.length > 0) {
    lines.push('### Changed Tokens\n');
    for (const t of diff.tokens.changed) lines.push(`- \`${t.name}\`: \`${t.before}\` ��� \`${t.after}\``);
    lines.push('');
  }
  if (diff.tokens.removed.length > 0) {
    lines.push('### Removed Tokens\n');
    for (const t of diff.tokens.removed) lines.push(`- ~~\`${t.name}\`~~: was \`${t.value}\``);
    lines.push('');
  }
  if (diff.components.added.length > 0) {
    lines.push('### New Components\n');
    for (const c of diff.components.added) lines.push(`- \`.${c}\``);
    lines.push('');
  }
  if (diff.components.removed.length > 0) {
    lines.push('### Removed Components\n');
    for (const c of diff.components.removed) lines.push(`- ~~\`.${c}\`~~`);
    lines.push('');
  }
  if (diff.classes.added.length > 0) {
    lines.push(`### New Classes (${diff.classes.added.length})\n`);
    if (diff.classes.added.length <= 15) {
      for (const c of diff.classes.added) lines.push(`- \`.${c}\``);
    } else {
      lines.push(`${diff.classes.added.length} new classes added.`);
    }
    lines.push('');
  }

  if (commits.length > 0) {
    lines.push('### Related Commits\n');
    for (const c of commits) lines.push(`- ${c}`);
    lines.push('');
  }

  return lines.join('\n');
}

function renderTerminal(diff, from, to, commits) {
  const g = '\x1b[32m';
  const r = '\x1b[31m';
  const y = '\x1b[33m';
  const d = '\x1b[2m';
  const b = '\x1b[1m';
  const reset = '\x1b[0m';

  const lines = [];
  lines.push(`\n${b}Design System Changelog${reset}  ${d}${from} → ${to}${reset}`);
  lines.push('─'.repeat(50));

  if (!hasChanges(diff) && commits.length === 0) {
    lines.push(`\n  ${d}No design system changes.${reset}\n`);
    return lines.join('\n');
  }

  if (diff.tokens.added.length > 0) {
    lines.push(`\n  ${b}New Tokens${reset}`);
    for (const t of diff.tokens.added) lines.push(`    ${g}+ ${t.name}: ${t.value}${reset}`);
  }
  if (diff.tokens.changed.length > 0) {
    lines.push(`\n  ${b}Changed Tokens${reset}`);
    for (const t of diff.tokens.changed) lines.push(`    ${y}~ ${t.name}: ${t.before} → ${t.after}${reset}`);
  }
  if (diff.tokens.removed.length > 0) {
    lines.push(`\n  ${b}Removed Tokens${reset}`);
    for (const t of diff.tokens.removed) lines.push(`    ${r}- ${t.name}: ${t.value}${reset}`);
  }
  if (diff.components.added.length > 0) {
    lines.push(`\n  ${b}New Components${reset}`);
    for (const c of diff.components.added) lines.push(`    ${g}+ .${c}${reset}`);
  }
  if (diff.components.removed.length > 0) {
    lines.push(`\n  ${b}Removed Components${reset}`);
    for (const c of diff.components.removed) lines.push(`    ${r}- .${c}${reset}`);
  }
  if (diff.classes.added.length + diff.classes.removed.length > 0) {
    lines.push(`\n  ${b}Classes${reset}  ${d}+${diff.classes.added.length} -${diff.classes.removed.length}${reset}`);
  }
  if (commits.length > 0) {
    lines.push(`\n  ${b}Related Commits${reset}`);
    for (const c of commits) lines.push(`    ${d}${c}${reset}`);
  }

  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  let from, to;
  if (opts.refs.length === 2) {
    from = opts.refs[0];
    to = opts.refs[1];
  } else if (opts.refs.length === 1) {
    from = opts.refs[0];
    to = 'HEAD';
  } else {
    const lastTag = getLastTag();
    from = lastTag || 'HEAD~20';
    to = 'HEAD';
  }

  const beforeManifest = getManifestAt(from);
  const afterManifest = to === 'HEAD' ? (getManifestAt('HEAD') || getCurrentManifest()) : getManifestAt(to);

  if (!beforeManifest) {
    console.error(`No manifest found at ${from}. The manifest was introduced later.`);
    process.exit(1);
  }
  if (!afterManifest) {
    console.error(`No manifest found at ${to}.`);
    process.exit(1);
  }

  const diff = diffManifests(beforeManifest, afterManifest);
  const commits = getCommits(from, to);

  if (opts.markdown) {
    console.log(renderMarkdown(diff, from, to, commits));
  } else {
    console.log(renderTerminal(diff, from, to, commits));
  }
}

main();
