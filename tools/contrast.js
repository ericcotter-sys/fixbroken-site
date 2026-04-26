#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Color Contrast Checker
// ---------------------------------------------------------------------------
// Parses color tokens from the manifest and computes WCAG 2.1 contrast
// ratios for common text/background combinations.
//
// Usage:
//   node tools/contrast.js             # check all combinations
//   node tools/contrast.js --json      # JSON output
//   node tools/contrast.js --fail-only # show only failures
//   -h, --help
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'public', 'design', 'fixbroken-os.manifest.json');

function parseArgs(argv) {
  const opts = { json: false, failOnly: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--fail-only' || arg === '--failures') opts.failOnly = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: contrast [options]

Check WCAG 2.1 color contrast ratios for FixBroken OS tokens.

Options:
  --fail-only    Show only failing combinations
  --json         JSON output
  -h, --help     Show this help

WCAG 2.1 requirements:
  AA normal text:  4.5:1 minimum
  AA large text:   3:1 minimum
  AAA normal text: 7:1 minimum

Examples:
  node tools/contrast.js
  node tools/contrast.js --fail-only
  node tools/contrast.js --json`);
      process.exit(0);
    }
  }
  return opts;
}

// Parse hex color to RGB
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

// Relative luminance per WCAG 2.1
function luminance(rgb) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contrast ratio per WCAG 2.1
function contrastRatio(hex1, hex2) {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function gradeContrast(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'FAIL';
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    console.error('Manifest not found. Run: npm run generate:manifest');
    process.exit(1);
  }

  // Extract hex colors from tokens
  const colors = {};
  for (const [group, tokens] of Object.entries(manifest.tokens)) {
    for (const t of tokens) {
      if (/^#[0-9a-fA-F]{3,8}$/.test(t.value)) {
        colors[t.name] = t.value;
      }
    }
  }

  // Define common text/background pairs to check
  const pairs = [
    // Primary text on surfaces
    { fg: '--fb-text', bg: '--fb-black', usage: 'body text on background' },
    { fg: '--fb-text', bg: '--fb-ink', usage: 'body text on ink surface' },
    { fg: '--fb-text', bg: '--fb-panel', usage: 'body text on panels' },
    { fg: '--fb-text', bg: '--fb-surface', usage: 'body text on surface' },
    { fg: '--fb-text-loud', bg: '--fb-black', usage: 'headings on background' },
    { fg: '--fb-text-loud', bg: '--fb-panel', usage: 'headings on panels' },
    { fg: '--fb-text-dim', bg: '--fb-black', usage: 'secondary text on background' },
    { fg: '--fb-text-dim', bg: '--fb-panel', usage: 'secondary text on panels' },
    { fg: '--fb-text-mute', bg: '--fb-black', usage: 'labels on background' },
    { fg: '--fb-text-mute', bg: '--fb-panel', usage: 'labels on panels' },
    { fg: '--fb-text-ghost', bg: '--fb-black', usage: 'placeholder on background' },

    // Signal colors on surfaces
    { fg: '--fb-signal', bg: '--fb-black', usage: 'signal cyan on background' },
    { fg: '--fb-signal', bg: '--fb-panel', usage: 'signal cyan on panels' },
    { fg: '--fb-signal', bg: '--fb-ink', usage: 'signal cyan on ink' },
    { fg: '--fb-matrix', bg: '--fb-black', usage: 'matrix green on background' },
    { fg: '--fb-matrix', bg: '--fb-panel', usage: 'matrix green on panels' },
    { fg: '--fb-coral', bg: '--fb-black', usage: 'coral on background' },
    { fg: '--fb-pink', bg: '--fb-black', usage: 'pink on background' },
    { fg: '--fb-pink', bg: '--fb-panel', usage: 'pink on panels' },
    { fg: '--fb-amber', bg: '--fb-black', usage: 'amber warning on background' },
    { fg: '--fb-red', bg: '--fb-black', usage: 'red error on background' },

    // CTA button text
    { fg: '--fb-black', bg: '--fb-signal', usage: 'solid CTA text on signal' },
    { fg: '--fb-black', bg: '--fb-pink', usage: 'solid CTA text on pink' },
    { fg: '--fb-black', bg: '--fb-matrix', usage: 'solid CTA text on matrix' },
  ];

  const results = [];
  for (const pair of pairs) {
    const fgHex = colors[pair.fg];
    const bgHex = colors[pair.bg];
    if (!fgHex || !bgHex) continue;

    const ratio = contrastRatio(fgHex, bgHex);
    const grade = gradeContrast(ratio);
    results.push({
      fg: pair.fg,
      fgHex,
      bg: pair.bg,
      bgHex,
      ratio: Math.round(ratio * 100) / 100,
      grade,
      usage: pair.usage,
      pass: grade !== 'FAIL',
    });
  }

  if (opts.json) {
    const passing = results.filter(r => r.pass).length;
    const failing = results.filter(r => !r.pass).length;
    console.log(JSON.stringify({ total: results.length, passing, failing, results }, null, 2));
    return;
  }

  // Terminal output
  console.log(`\n\x1b[1mColor Contrast Report\x1b[0m  WCAG 2.1`);
  console.log('─'.repeat(70));

  const filtered = opts.failOnly ? results.filter(r => !r.pass) : results;

  for (const r of filtered) {
    const color = r.grade === 'AAA' ? '\x1b[32m' : r.grade === 'AA' ? '\x1b[32m' : r.grade === 'AA-large' ? '\x1b[33m' : '\x1b[31m';
    const icon = r.pass ? '✓' : '✗';
    console.log(`  ${color}${icon}\x1b[0m ${r.ratio.toFixed(1).padStart(5)}:1  ${color}${r.grade.padEnd(8)}\x1b[0m  \x1b[2m${r.usage}\x1b[0m`);
    console.log(`    \x1b[2m${r.fg} (${r.fgHex}) on ${r.bg} (${r.bgHex})\x1b[0m`);
  }

  const passing = results.filter(r => r.pass).length;
  const failing = results.filter(r => !r.pass).length;
  console.log(`\n  \x1b[1mResults:\x1b[0m ${passing} pass, ${failing} fail out of ${results.length} combinations`);

  if (failing > 0) {
    console.log(`  \x1b[31mFailing combinations need at least 3:1 contrast for large text or 4.5:1 for normal text.\x1b[0m`);
  } else {
    console.log(`  \x1b[32mAll combinations meet at least AA-large requirements.\x1b[0m`);
  }
  console.log('');

  process.exit(failing > 0 ? 1 : 0);
}

main();
