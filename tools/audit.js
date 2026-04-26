#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Page Audit Tool
// ---------------------------------------------------------------------------
// Comprehensive audit of HTML pages against FixBroken OS standards:
//
//   1. VOICE      — banned phrases, marketing sludge, emoji
//   2. DESIGN     — design system compliance (fb-* usage, token adherence)
//   3. STRUCTURE  — semantic HTML, shell/container/section pattern
//   4. A11Y       — basic accessibility checks
//   5. RESPONSIVE — mobile-readiness indicators
//   6. PERF       — asset loading, font strategy
//
// Usage:
//   node tools/audit.js [options] <file-or-dir>
//
// Options:
//   --json       JSON output
//   --verbose    Show passing checks too
//   --manifest   Path to manifest (default: auto-detect)
//   -h, --help   Show help
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'public', 'design', 'fixbroken-os.manifest.json');

function esc(s) {
  return String(s == null ? '' : s).slice(0, 200);
}

// ---------------------------------------------------------------------------
// Audit checks
// ---------------------------------------------------------------------------

function auditVoice(content, lines) {
  const findings = [];
  const bannedPhrases = [
    'get started today', 'get started now', 'learn more',
    'supercharge your', 'unlock ai', 'ai-powered',
    'revolutionize', 'disrupt', 'next-gen', 'cutting-edge',
    'best-in-class', 'ai for everyone', 'leverage ai',
    'harness the power', 'game-changing', 'world-class',
    'seamlessly', 'empower your', 'turbocharge', 'unleash',
    'synergy', 'paradigm shift', 'thought leader',
  ];

  // Strip scripts, comments, styles, and the "AVOID" documentation sections
  // (style guides list banned phrases as examples of what not to do)
  let cleaned = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove AVOID list sections in style guide pages
  cleaned = cleaned.replace(/<span[^>]*>AVOID<\/span>[\s\S]*?<\/(?:ul|div|ol)>/gi, '');
  // Remove voice anti-pattern documentation panels
  cleaned = cleaned.replace(/<span[^>]*color:\s*var\(--fb-red\)[^>]*>AVOID<\/span>[\s\S]*?<\/div>/gi, '');

  const visibleText = cleaned.replace(/<[^>]+>/g, ' ');

  const lower = visibleText.toLowerCase();
  for (const phrase of bannedPhrases) {
    if (lower.includes(phrase)) {
      findings.push({ severity: 'error', check: 'voice/banned-phrase', msg: `contains "${phrase}"` });
    }
  }

  const emojiRe = /[✨\u{1F4AB}\u{1F31F}\u{1FA84}\u{1F389}\u{1F680}\u{1F525}\u{1F4A1}\u{1F4A5}]/gu;
  if (emojiRe.test(visibleText)) {
    findings.push({ severity: 'error', check: 'voice/emoji', msg: 'contains decorative emoji' });
  }

  if (findings.length === 0) {
    findings.push({ severity: 'pass', check: 'voice', msg: 'no banned phrases or emoji detected' });
  }

  return findings;
}

function auditDesign(content, manifest) {
  const findings = [];

  // Check for fixbroken-os.css import
  const hasCssImport = /fixbroken-os\.css/.test(content);
  if (hasCssImport) {
    findings.push({ severity: 'pass', check: 'design/css-import', msg: 'fixbroken-os.css is loaded' });
  } else {
    findings.push({ severity: 'error', check: 'design/css-import', msg: 'fixbroken-os.css is not loaded — page does not use the design system' });
  }

  // Check for fb-shell wrapper
  if (/class="[^"]*\bfb-shell\b/.test(content)) {
    findings.push({ severity: 'pass', check: 'design/shell', msg: '.fb-shell wrapper present' });
  } else {
    findings.push({ severity: 'warn', check: 'design/shell', msg: 'missing .fb-shell wrapper — page may not have correct layout structure' });
  }

  // Check for fb-container usage
  if (/class="[^"]*\bfb-container\b/.test(content)) {
    findings.push({ severity: 'pass', check: 'design/container', msg: '.fb-container present' });
  } else {
    findings.push({ severity: 'warn', check: 'design/container', msg: 'no .fb-container found — content may not be properly constrained' });
  }

  // Check for fb-nav
  if (/class="[^"]*\bfb-nav\b/.test(content)) {
    findings.push({ severity: 'pass', check: 'design/nav', msg: '.fb-nav present' });
  } else {
    findings.push({ severity: 'info', check: 'design/nav', msg: 'no .fb-nav found' });
  }

  // Check for fb-footer
  if (/class="[^"]*\bfb-footer\b/.test(content)) {
    findings.push({ severity: 'pass', check: 'design/footer', msg: '.fb-footer present' });
  } else {
    findings.push({ severity: 'info', check: 'design/footer', msg: 'no .fb-footer found' });
  }

  // Check for non-fb classes that might indicate system bypass
  const classMatches = content.match(/class="([^"]+)"/g) || [];
  const nonFbClasses = new Set();
  const knownPrefixes = ['fb-', 'sg-', 'hp-', 'v-', 'vumo-', 'tokenz-'];
  for (const m of classMatches) {
    const classes = m.replace(/class="/, '').replace(/"/, '').split(/\s+/);
    for (const cls of classes) {
      if (!cls) continue;
      if (knownPrefixes.some(p => cls.startsWith(p))) continue;
      if (/^[a-z]/.test(cls) && !cls.includes('-scope')) {
        nonFbClasses.add(cls);
      }
    }
  }
  if (nonFbClasses.size > 0 && nonFbClasses.size <= 10) {
    findings.push({ severity: 'info', check: 'design/namespace', msg: `non-standard classes found: ${[...nonFbClasses].join(', ')}` });
  } else if (nonFbClasses.size > 10) {
    findings.push({ severity: 'warn', check: 'design/namespace', msg: `${nonFbClasses.size} non-standard classes found — consider using fb-* or a project prefix` });
  }

  // Check for banned font imports
  if (/font-family\s*:\s*[^;]*(?:Roboto|Lato|Poppins|Montserrat)/i.test(content)) {
    findings.push({ severity: 'error', check: 'design/font', msg: 'banned font family detected — only Inter + JetBrains Mono allowed' });
  }

  // Check for inline style overriding fb-* tokens
  const tokenOverrides = (content.match(/style="[^"]*--fb-[a-z-]+\s*:/gi) || []);
  if (tokenOverrides.length > 5) {
    findings.push({ severity: 'warn', check: 'design/inline-tokens', msg: `${tokenOverrides.length} inline fb-* token overrides — consider using a class or override stylesheet` });
  }

  return findings;
}

function auditStructure(content) {
  const findings = [];

  // DOCTYPE
  if (/<!doctype html>/i.test(content)) {
    findings.push({ severity: 'pass', check: 'structure/doctype', msg: 'DOCTYPE present' });
  } else {
    findings.push({ severity: 'error', check: 'structure/doctype', msg: 'missing DOCTYPE declaration' });
  }

  // lang attribute
  if (/<html[^>]+lang=/.test(content)) {
    findings.push({ severity: 'pass', check: 'structure/lang', msg: 'lang attribute set' });
  } else {
    findings.push({ severity: 'warn', check: 'structure/lang', msg: 'missing lang attribute on <html>' });
  }

  // charset
  if (/charset=["']?utf-8/i.test(content)) {
    findings.push({ severity: 'pass', check: 'structure/charset', msg: 'UTF-8 charset declared' });
  } else {
    findings.push({ severity: 'warn', check: 'structure/charset', msg: 'missing UTF-8 charset declaration' });
  }

  // viewport
  if (/name=["']viewport["']/.test(content)) {
    findings.push({ severity: 'pass', check: 'structure/viewport', msg: 'viewport meta present' });
  } else {
    findings.push({ severity: 'error', check: 'structure/viewport', msg: 'missing viewport meta — page will not be responsive' });
  }

  // title
  if (/<title>[^<]+<\/title>/.test(content)) {
    findings.push({ severity: 'pass', check: 'structure/title', msg: 'page title set' });
  } else {
    findings.push({ severity: 'warn', check: 'structure/title', msg: 'missing or empty <title>' });
  }

  // description
  if (/name=["']description["']/.test(content)) {
    findings.push({ severity: 'pass', check: 'structure/description', msg: 'meta description present' });
  } else {
    findings.push({ severity: 'info', check: 'structure/description', msg: 'no meta description' });
  }

  // semantic HTML
  const hasMain = /<main[\s>]/.test(content);
  const hasNav = /<nav[\s>]/.test(content);
  const hasFooter = /<footer[\s>]/.test(content);
  const hasSection = /<section[\s>]/.test(content);
  if (hasMain) findings.push({ severity: 'pass', check: 'structure/semantic', msg: '<main> element present' });
  else findings.push({ severity: 'warn', check: 'structure/semantic', msg: 'no <main> element' });

  return findings;
}

function auditA11y(content) {
  const findings = [];

  // Images without alt
  const imgs = content.match(/<img[^>]*>/gi) || [];
  const missingAlt = imgs.filter(i => !/alt=/.test(i));
  if (imgs.length > 0 && missingAlt.length === 0) {
    findings.push({ severity: 'pass', check: 'a11y/img-alt', msg: `all ${imgs.length} images have alt attributes` });
  } else if (missingAlt.length > 0) {
    findings.push({ severity: 'error', check: 'a11y/img-alt', msg: `${missingAlt.length} image(s) missing alt attribute` });
  }

  // Form inputs without labels
  const inputs = content.match(/<input[^>]*>/gi) || [];
  const textareas = content.match(/<textarea[^>]*>/gi) || [];
  const formFields = inputs.length + textareas.length;
  const labels = (content.match(/<label[\s>]/gi) || []).length;
  const ariaLabels = (content.match(/aria-label=/gi) || []).length;
  if (formFields > 0) {
    if (labels + ariaLabels >= formFields) {
      findings.push({ severity: 'pass', check: 'a11y/form-labels', msg: `${formFields} form fields have associated labels` });
    } else {
      findings.push({ severity: 'warn', check: 'a11y/form-labels', msg: `${formFields} form fields but only ${labels + ariaLabels} labels/aria-labels` });
    }
  }

  // Links with no text
  const emptyLinks = (content.match(/<a[^>]*>\s*<\/a>/gi) || []).length;
  if (emptyLinks > 0) {
    findings.push({ severity: 'warn', check: 'a11y/empty-links', msg: `${emptyLinks} link(s) with no visible text` });
  }

  // Heading hierarchy
  const headings = [];
  const headingRe = /<(h[1-6])[\s>]/gi;
  let hm;
  while ((hm = headingRe.exec(content)) !== null) {
    headings.push(parseInt(hm[1][1]));
  }
  if (headings.length > 0) {
    let skipped = false;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] > headings[i - 1] + 1) {
        skipped = true;
        break;
      }
    }
    if (skipped) {
      findings.push({ severity: 'warn', check: 'a11y/heading-order', msg: 'heading levels are not sequential (e.g., h1 then h3)' });
    } else {
      findings.push({ severity: 'pass', check: 'a11y/heading-order', msg: 'heading hierarchy is correct' });
    }
  }

  // Color contrast (can't check computationally without rendering, but flag dark-on-dark risks)
  if (/color:\s*#0[0-3]/i.test(content) && /background.*#0[0-3]/i.test(content)) {
    findings.push({ severity: 'warn', check: 'a11y/contrast', msg: 'possible low-contrast dark-on-dark text — verify manually' });
  }

  return findings;
}

function auditResponsive(content) {
  const findings = [];

  // Check viewport meta
  if (/width=device-width/.test(content)) {
    findings.push({ severity: 'pass', check: 'responsive/viewport', msg: 'viewport width=device-width set' });
  }

  // Check for fixed widths in inline styles
  const fixedWidths = (content.match(/style="[^"]*width:\s*\d{4,}px/gi) || []).length;
  if (fixedWidths > 0) {
    findings.push({ severity: 'warn', check: 'responsive/fixed-width', msg: `${fixedWidths} inline style(s) with fixed width > 999px — may break on mobile` });
  }

  // Check for responsive grids
  if (/fb-grid/.test(content)) {
    findings.push({ severity: 'pass', check: 'responsive/grid', msg: 'using fb-grid for responsive layout' });
  }

  // Check for responsive images
  const imgTags = content.match(/<img[^>]*>/gi) || [];
  const responsiveImgs = imgTags.filter(i => /max-width|srcset|sizes/.test(i));
  if (imgTags.length > 3 && responsiveImgs.length < imgTags.length / 2) {
    findings.push({ severity: 'info', check: 'responsive/images', msg: 'consider adding srcset/sizes for responsive images' });
  }

  return findings;
}

function auditPerf(content) {
  const findings = [];

  // Font loading strategy
  if (/display=swap/.test(content)) {
    findings.push({ severity: 'pass', check: 'perf/font-display', msg: 'font-display: swap is used' });
  }

  // Render-blocking resources
  const cssLinks = (content.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || []).length;
  if (cssLinks > 3) {
    findings.push({ severity: 'info', check: 'perf/css-count', msg: `${cssLinks} CSS files — consider combining if possible` });
  }

  // Large inline styles
  const styleBlocks = content.match(/<style[\s\S]*?<\/style>/gi) || [];
  const totalStyleChars = styleBlocks.reduce((s, b) => s + b.length, 0);
  if (totalStyleChars > 5000) {
    findings.push({ severity: 'info', check: 'perf/inline-css', msg: `${Math.round(totalStyleChars / 1024)}KB of inline CSS — consider extracting to a stylesheet` });
  }

  // Script count
  const scripts = (content.match(/<script[\s\S]*?<\/script>/gi) || []).length;
  if (scripts > 5) {
    findings.push({ severity: 'info', check: 'perf/script-count', msg: `${scripts} script blocks` });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function formatReport(file, findings, verbose) {
  const errors = findings.filter(f => f.severity === 'error');
  const warns = findings.filter(f => f.severity === 'warn');
  const infos = findings.filter(f => f.severity === 'info');
  const passes = findings.filter(f => f.severity === 'pass');

  const lines = [];
  lines.push('');
  lines.push(`\x1b[1m${file}\x1b[0m`);
  lines.push(`${'─'.repeat(Math.min(file.length + 4, 60))}`);

  const categories = {};
  for (const f of findings) {
    const cat = f.check.split('/')[0];
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(f);
  }

  for (const [cat, items] of Object.entries(categories)) {
    const catErrors = items.filter(i => i.severity === 'error').length;
    const catWarns = items.filter(i => i.severity === 'warn').length;
    const catPasses = items.filter(i => i.severity === 'pass').length;
    const icon = catErrors > 0 ? '\x1b[31m✗\x1b[0m' : catWarns > 0 ? '\x1b[33m!\x1b[0m' : '\x1b[32m✓\x1b[0m';

    lines.push(`\n  ${icon} ${cat.toUpperCase()}`);

    for (const f of items) {
      if (!verbose && f.severity === 'pass') continue;
      const color = f.severity === 'error' ? '\x1b[31m' : f.severity === 'warn' ? '\x1b[33m' : f.severity === 'pass' ? '\x1b[32m' : '\x1b[2m';
      const sym = f.severity === 'error' ? '✗' : f.severity === 'warn' ? '!' : f.severity === 'pass' ? '✓' : '·';
      lines.push(`    ${color}${sym}\x1b[0m ${f.msg}`);
    }
  }

  lines.push('');
  lines.push(`  \x1b[1mScore:\x1b[0m ${passes.length} pass, ${errors.length} error, ${warns.length} warn, ${infos.length} info`);

  const grade = errors.length === 0 && warns.length === 0 ? 'A'
    : errors.length === 0 && warns.length <= 3 ? 'B'
    : errors.length <= 2 ? 'C'
    : 'D';
  const gradeColor = grade === 'A' ? '\x1b[32m' : grade === 'B' ? '\x1b[33m' : '\x1b[31m';
  lines.push(`  \x1b[1mGrade:\x1b[0m ${gradeColor}${grade}\x1b[0m`);
  lines.push('');

  return { text: lines.join('\n'), grade, errors: errors.length, warns: warns.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  let targets = [];
  let jsonOutput = false;
  let verbose = false;
  let manifestPath = DEFAULT_MANIFEST;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') jsonOutput = true;
    else if (args[i] === '--verbose' || args[i] === '-v') verbose = true;
    else if (args[i] === '--manifest') manifestPath = path.resolve(args[++i]);
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: audit [options] <file-or-dir>

Audit HTML pages against FixBroken OS standards.

Options:
  --json          JSON output
  --verbose, -v   Show passing checks
  --manifest      Path to manifest JSON (default: auto-detect)
  -h, --help      Show this help

Checks:
  VOICE       Banned phrases, marketing sludge, emoji
  DESIGN      CSS import, shell/container/section, namespace, fonts
  STRUCTURE   DOCTYPE, lang, charset, viewport, title, semantics
  A11Y        Alt text, form labels, heading order, contrast
  RESPONSIVE  Viewport, fixed widths, responsive grids
  PERF        Font loading, CSS count, inline styles

Exit codes:
  0  All pages pass (grade A or B)
  1  One or more pages have errors (grade C or D)

Examples:
  node tools/audit.js public/index.html
  node tools/audit.js public/
  node tools/audit.js --verbose --json public/`);
      process.exit(0);
    } else {
      targets.push(path.resolve(args[i]));
    }
  }

  if (targets.length === 0) {
    targets = [path.join(REPO_ROOT, 'public')];
  }

  // Load manifest if available
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {}

  // Collect HTML files
  let htmlFiles = [];
  for (const t of targets) {
    if (!fs.existsSync(t)) {
      console.error(`Error: ${t} does not exist`);
      process.exit(1);
    }
    if (fs.statSync(t).isDirectory()) {
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name === 'node_modules' || e.name === '.git') continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (/\.html?$/.test(e.name)) htmlFiles.push(full);
        }
      };
      walk(t);
    } else {
      htmlFiles.push(t);
    }
  }

  if (htmlFiles.length === 0) {
    console.error('No HTML files found.');
    process.exit(1);
  }

  const allResults = [];
  let hasFailure = false;

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const relPath = path.relative(REPO_ROOT, file);

    const findings = [
      ...auditVoice(content, lines),
      ...auditDesign(content, manifest),
      ...auditStructure(content),
      ...auditA11y(content),
      ...auditResponsive(content),
      ...auditPerf(content),
    ];

    const { text, grade, errors, warns } = formatReport(relPath, findings, verbose);

    allResults.push({
      file: relPath,
      grade,
      errors,
      warns,
      findings,
    });

    if (!jsonOutput) {
      console.log(text);
    }

    if (grade === 'C' || grade === 'D') hasFailure = true;
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      files: allResults.length,
      results: allResults,
      summary: {
        total: allResults.length,
        gradeA: allResults.filter(r => r.grade === 'A').length,
        gradeB: allResults.filter(r => r.grade === 'B').length,
        gradeC: allResults.filter(r => r.grade === 'C').length,
        gradeD: allResults.filter(r => r.grade === 'D').length,
      },
    }, null, 2));
  } else if (allResults.length > 1) {
    console.log(`${'═'.repeat(40)}`);
    console.log(`  SUMMARY: ${allResults.length} files audited`);
    for (const r of allResults) {
      const c = r.grade === 'A' ? '\x1b[32m' : r.grade === 'B' ? '\x1b[33m' : '\x1b[31m';
      console.log(`    ${c}${r.grade}\x1b[0m  ${r.file}`);
    }
    console.log('');
  }

  process.exit(hasFailure ? 1 : 0);
}

main();
