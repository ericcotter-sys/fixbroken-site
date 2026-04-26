#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Override Validation
// ---------------------------------------------------------------------------
// Validates that tenant CSS override files follow the scoped pattern:
//   1. All fb-* overrides must be inside a project scope class
//   2. No global fb-* class redefinitions
//   3. New classes use project prefix, not fb-*
//   4. No @import of fixbroken-os.css (it should be a <link>, not @import)
//
// Usage:
//   node tools/validate-overrides.js                    # scan all apps
//   node tools/validate-overrides.js <file>             # check specific file
//   node tools/validate-overrides.js --json             # JSON output
//   -h, --help
// ---------------------------------------------------------------------------

const APPS_DIR = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const opts = { files: [], json: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: validate-overrides [options] [file...]

Validate tenant CSS override files follow the scoped pattern.

Options:
  --json      JSON output
  -h, --help  Show this help

Rules:
  1. fb-* overrides must be inside a scope class (.vumo-scope .fb-cta)
  2. No bare .fb-* definitions at root level
  3. New classes use project prefix, not fb-*
  4. No @import of fixbroken-os.css

Examples:
  node tools/validate-overrides.js
  node tools/validate-overrides.js /path/to/overrides.css`);
      process.exit(0);
    } else {
      opts.files.push(path.resolve(arg));
    }
  }
  return opts;
}

function findOverrideFiles() {
  const files = [];
  try {
    const dirs = fs.readdirSync(APPS_DIR, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory() || d.name === 'fixbroken' || d.name.startsWith('.')) continue;
      const publicDir = path.join(APPS_DIR, d.name, 'public');
      if (!fs.existsSync(publicDir)) continue;
      const entries = fs.readdirSync(publicDir);
      for (const e of entries) {
        if (e.endsWith('-overrides.css') || e.endsWith('-override.css')) {
          files.push(path.join(publicDir, e));
        }
      }
    }
  } catch {}
  return files;
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  const relPath = path.relative(APPS_DIR, filePath);

  let inComment = false;
  let nestingDepth = 0;
  let currentSelector = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Track block comments
    if (trimmed.includes('/*')) inComment = true;
    if (trimmed.includes('*/')) { inComment = false; continue; }
    if (inComment) continue;
    if (trimmed.startsWith('//')) continue;
    if (!trimmed) continue;

    // Check for @import of fixbroken-os
    if (/@import.*fixbroken-os/i.test(trimmed)) {
      violations.push({
        file: relPath, line: lineNum, severity: 'error',
        msg: 'use <link> tag to load fixbroken-os.css, not @import in override files',
        source: trimmed,
      });
    }

    // Check for bare .fb-* selector definitions (not inside a scope)
    const selectorMatch = trimmed.match(/^(\.[a-z][a-z0-9-]*(?:\s+\.[a-z][a-z0-9-]*)*)\s*\{/);
    if (selectorMatch) {
      currentSelector = selectorMatch[1];
      nestingDepth++;

      // Check if it's a bare .fb-* definition
      if (/^\.fb-/.test(currentSelector)) {
        violations.push({
          file: relPath, line: lineNum, severity: 'error',
          msg: `bare .fb-* definition — must be scoped inside a project class (e.g., .vumo-scope ${currentSelector})`,
          source: trimmed,
        });
      }

      // Check for new .fb-* classes being defined
      const newFbClass = currentSelector.match(/\.(fb-[a-z][a-z0-9-]*)/);
      if (newFbClass && !currentSelector.includes('-scope')) {
        // Allow if it's inside a scope selector
        const parts = currentSelector.split(/\s+/);
        const hasScopeParent = parts.some(p => p.endsWith('-scope'));
        if (!hasScopeParent) {
          violations.push({
            file: relPath, line: lineNum, severity: 'warn',
            msg: `fb-* class "${newFbClass[1]}" not inside a scope class — use a project wrapper`,
            source: trimmed,
          });
        }
      }
    }

    // Track braces
    const opens = (trimmed.match(/\{/g) || []).length;
    const closes = (trimmed.match(/\}/g) || []).length;
    nestingDepth += opens - closes;
    if (nestingDepth < 0) nestingDepth = 0;
  }

  return violations;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  let files = opts.files;
  if (files.length === 0) {
    files = findOverrideFiles();
  }

  if (files.length === 0) {
    console.log('No override files found.');
    process.exit(0);
  }

  let allViolations = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`Error: ${file} does not exist`);
      process.exit(1);
    }
    allViolations = allViolations.concat(validateFile(file));
  }

  if (opts.json) {
    console.log(JSON.stringify({
      filesChecked: files.length,
      violations: allViolations,
      count: allViolations.length,
    }, null, 2));
    return;
  }

  console.log(`\n\x1b[1mOverride Validation\x1b[0m  ${files.length} file(s) checked`);
  console.log('─'.repeat(50));

  if (allViolations.length === 0) {
    console.log('  \x1b[32m✓\x1b[0m All override files follow the scoped pattern.');
    console.log('');
    process.exit(0);
  }

  for (const v of allViolations) {
    const color = v.severity === 'error' ? '\x1b[31m' : '\x1b[33m';
    console.log(`  ${color}${v.severity}\x1b[0m \x1b[2m${v.file}:${v.line}\x1b[0m ${v.msg}`);
    if (v.source) console.log(`    \x1b[2m${v.source.slice(0, 100)}\x1b[0m`);
  }

  const errors = allViolations.filter(v => v.severity === 'error').length;
  const warns = allViolations.filter(v => v.severity === 'warn').length;
  console.log(`\n  ${errors} error(s), ${warns} warning(s)\n`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
