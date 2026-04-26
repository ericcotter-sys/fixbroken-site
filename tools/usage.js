#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Component Usage Analyzer
// ---------------------------------------------------------------------------
// Scans HTML files and reports which .fb-* classes are used, how often,
// and which classes defined in the CSS are never used.
//
// Usage:
//   node tools/usage.js                      # scan public/
//   node tools/usage.js <dir>                # scan specific dir
//   node tools/usage.js --all                # scan all apps
//   node tools/usage.js --json               # JSON output
//   node tools/usage.js --unused             # show only unused classes
//   -h, --help
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const APPS_DIR = path.resolve(REPO_ROOT, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'public', 'design', 'fixbroken-os.manifest.json');

function parseArgs(argv) {
  const opts = { dirs: [], json: false, all: false, unused: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--unused') opts.unused = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: usage [options] [dir...]

Analyze .fb-* class usage across HTML files.

Options:
  --all       Scan all apps (fixbroken, vumo, comply, etc.)
  --unused    Show only unused classes
  --json      JSON output
  -h, --help  Show this help

Examples:
  node tools/usage.js                # scan public/
  node tools/usage.js --all          # scan all tenant apps
  node tools/usage.js --unused       # find dead CSS classes`);
      process.exit(0);
    } else {
      opts.dirs.push(path.resolve(arg));
    }
  }
  return opts;
}

function collectHtmlFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.html?$/.test(e.name)) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function extractClasses(content) {
  const classes = {};
  const classAttrRe = /class="([^"]+)"/g;
  let match;
  while ((match = classAttrRe.exec(content)) !== null) {
    const classList = match[1].split(/\s+/);
    for (const cls of classList) {
      if (cls.startsWith('fb-')) {
        classes[cls] = (classes[cls] || 0) + 1;
      }
    }
  }
  return classes;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Load manifest for defined classes
  let definedClasses = new Set();
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    definedClasses = new Set(manifest.allClasses || []);
  } catch {
    console.error('Warning: manifest not found. Run npm run generate:manifest');
  }

  // Collect directories to scan
  let dirs = opts.dirs;
  if (dirs.length === 0) {
    if (opts.all) {
      try {
        const entries = fs.readdirSync(APPS_DIR, { withFileTypes: true });
        dirs = entries
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => path.join(APPS_DIR, e.name, 'public'))
          .filter(d => fs.existsSync(d));
      } catch {
        dirs = [path.join(REPO_ROOT, 'public')];
      }
    } else {
      dirs = [path.join(REPO_ROOT, 'public')];
    }
  }

  // Scan files
  const usageByFile = {};
  const totalUsage = {};
  let totalFiles = 0;

  for (const dir of dirs) {
    const files = collectHtmlFiles(dir);
    for (const file of files) {
      totalFiles++;
      const content = fs.readFileSync(file, 'utf8');
      const classes = extractClasses(content);
      const relPath = path.relative(APPS_DIR, file);
      usageByFile[relPath] = classes;

      for (const [cls, count] of Object.entries(classes)) {
        totalUsage[cls] = (totalUsage[cls] || 0) + count;
      }
    }
  }

  // Compute unused
  const usedClasses = new Set(Object.keys(totalUsage));
  const unusedClasses = [...definedClasses].filter(c => !usedClasses.has(c)).sort();
  const undefinedClasses = [...usedClasses].filter(c => !definedClasses.has(c)).sort();

  if (opts.json) {
    console.log(JSON.stringify({
      filesScanned: totalFiles,
      definedClasses: definedClasses.size,
      usedClasses: usedClasses.size,
      unusedClasses,
      undefinedClasses,
      usage: Object.entries(totalUsage)
        .sort((a, b) => b[1] - a[1])
        .map(([cls, count]) => ({ class: cls, count })),
    }, null, 2));
    return;
  }

  if (opts.unused) {
    if (unusedClasses.length === 0) {
      console.log('\x1b[32m✓\x1b[0m All defined classes are used.');
    } else {
      console.log(`\n\x1b[1m${unusedClasses.length} unused classes\x1b[0m (defined in CSS but never found in HTML)\n`);
      for (const cls of unusedClasses) {
        console.log(`  \x1b[2m.${cls}\x1b[0m`);
      }
    }
    console.log('');
    return;
  }

  // Full report
  console.log(`\n\x1b[1mComponent Usage Report\x1b[0m`);
  console.log('─'.repeat(50));
  console.log(`  Files scanned: ${totalFiles}`);
  console.log(`  Defined classes: ${definedClasses.size}`);
  console.log(`  Used classes: ${usedClasses.size}`);
  console.log(`  Unused classes: ${unusedClasses.length}`);
  if (undefinedClasses.length > 0) {
    console.log(`  \x1b[33mUndefined classes: ${undefinedClasses.length}\x1b[0m (used but not in CSS)`);
  }

  // Top used
  const sorted = Object.entries(totalUsage).sort((a, b) => b[1] - a[1]);
  console.log(`\n  \x1b[1mTop 20 most used:\x1b[0m`);
  for (const [cls, count] of sorted.slice(0, 20)) {
    const bar = '█'.repeat(Math.min(Math.ceil(count / 2), 30));
    const defined = definedClasses.has(cls) ? '' : ' \x1b[33m(undefined)\x1b[0m';
    console.log(`    ${String(count).padStart(4)}  .${cls.padEnd(28)} \x1b[36m${bar}\x1b[0m${defined}`);
  }

  // Unused
  if (unusedClasses.length > 0) {
    console.log(`\n  \x1b[1mUnused (${unusedClasses.length}):\x1b[0m`);
    for (const cls of unusedClasses.slice(0, 20)) {
      console.log(`    \x1b[2m.${cls}\x1b[0m`);
    }
    if (unusedClasses.length > 20) {
      console.log(`    \x1b[2m... and ${unusedClasses.length - 20} more\x1b[0m`);
    }
  }

  console.log('');
}

main();
