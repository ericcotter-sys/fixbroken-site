#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Voice & Design System Linter
// ---------------------------------------------------------------------------
// Scans HTML files for:
//   1. Banned voice phrases (from brand.md)
//   2. Generic AI/marketing sludge patterns
//   3. CSS class violations (non-fb-* globals)
//   4. Inline style overrides of fb-* tokens
//   5. Banned font families (third font violation)
//   6. Banned color keywords (purple, glassmorphism)
//   7. Emoji / sparkle decorations
//
// Exit code 0 = clean, 1 = violations found
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Load voice rules from manifest if available, with hardcoded fallback
// ---------------------------------------------------------------------------
const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'design', 'fixbroken-os.manifest.json');

function loadManifestPhrases() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    if (manifest.voice && manifest.voice.avoid && manifest.voice.avoid.length > 0) {
      // Normalize: split compound entries like "Revolutionize / disrupt / next-gen"
      const phrases = [];
      for (const raw of manifest.voice.avoid) {
        const parts = raw.split(/\s*\/\s*/);
        for (const p of parts) {
          const cleaned = p.replace(/^any\s+"?/i, '').replace(/"?\s*variant$/i, '').trim().toLowerCase();
          if (cleaned.length > 2) phrases.push(cleaned);
        }
      }
      return phrases;
    }
  } catch {}
  return null;
}

const manifestPhrases = loadManifestPhrases();

const RULES = {
  // Exact banned phrases — loaded from manifest if available, hardcoded fallback
  bannedPhrases: [
    // Always include these (comprehensive list, superset of manifest)
    'get started today',
    'get started now',
    'learn more',
    'supercharge your',
    'unlock ai',
    'unlock the power',
    'ai-powered insights',
    'ai-powered',
    'revolutionize',
    'disrupt',
    'next-gen',
    'next gen',
    'cutting-edge',
    'cutting edge',
    'best-in-class',
    'best in class',
    'ai for everyone',
    'leverage ai',
    'harness the power',
    'game-changing',
    'game changing',
    'world-class',
    'world class',
    'seamless integration',
    'seamlessly',
    'empower your',
    'turbocharge',
    'skyrocket',
    'unleash',
    'synergy',
    'paradigm shift',
    'thought leader',
    'move the needle',
    'low-hanging fruit',
    'circle back',
    'deep dive into',
    'at the end of the day',
    'it goes without saying',
    // 2026-04-28 hero copy lock — aspirational lock guardrails
    'boutique product, brand, and system shop',
    'shipped but stalled',
    'stalled',
    'we turn impressive ai',
    'start a conversation',
    'unlock',
    'supercharge',
    // NOTE: bare "transform" intentionally NOT banned — would fire on every CSS
    // `transform:` and `text-transform:` property. The existing sludgePattern at
    // line ~97 catches "transform your/the business/workflow/organization".
    // Merge any additional phrases from the manifest
    ...(manifestPhrases || []),
  ].filter((v, i, a) => a.indexOf(v) === i), // deduplicate

  // Slop patterns — shapes of empty copy, not just words (2026-07-07, from the
  // prod copy scrub: lint passed while the page was full of abstraction chains).
  // error = confident shape, warn = heuristic that needs a human eye.
  slopPatterns: [
    { re: /\bbecomes\b[^<>]{1,80}\bbecomes\b/i, msg: 'abstract transformation chain ("X becomes Y becomes Z") — say the concrete thing', severity: 'error' },
    { re: /\b(?:our work|our approach|our process|our method)\s+helps\b/i, msg: 'vague benefit claim ("our work helps…") — name the action and the actor', severity: 'error' },
    { re: /\bfinds the break\b/i, msg: '"finds the break" — scrubbed 2026-07-07, do not reintroduce', severity: 'error' },
    { re: /\bhelps (?:teams|companies|founders|you) (?:build|achieve|unlock|navigate|realize)\b/i, msg: 'vague benefit verb — say what actually happens', severity: 'warn' },
    { re: /\b(?:holistic|frictionless|delightful|robust solution|end-to-end excellence)\b/i, msg: 'consultant adjective — replace with a concrete detail or cut', severity: 'warn' },
    { re: /\boperating layer\b/i, msg: '"operating layer" — layer of what? name it', severity: 'warn' },
  ],

  // Regex patterns for generic AI/marketing sludge
  sludgePatterns: [
    { re: /\bAI\s+for\s+\w+one\b/i, msg: 'generic "AI for X" phrasing' },
    { re: /\btransform(?:ing|ative)?\s+(?:your|the)\s+(?:business|workflow|organization)/i, msg: 'transformative marketing speak' },
    { re: /\bscal(?:e|able|ing)\s+(?:your|the)\s+(?:business|operations)/i, msg: 'scalability marketing cliche' },
    { re: /\bonboard(?:ing)?\s+(?:is\s+)?(?:easy|simple|effortless|seamless)/i, msg: '"easy onboarding" cliche' },
  ],

  // Banned CSS patterns in <style> blocks or style attributes
  bannedInlineTokenOverrides: [
    // Catches style="--fb-signal: ..." or style="--fb-black: ..."
    { re: /style\s*=\s*"[^"]*--fb-[a-z-]+\s*:/gi, msg: 'inline style overriding fb-* token — use a class or override stylesheet' },
  ],

  // Font family violations — only Inter and JetBrains Mono are allowed
  bannedFonts: [
    { re: /font-family\s*:\s*[^;]*(?:Roboto|Lato|Poppins|Montserrat|Playfair|Georgia|Comic|Papyrus|Impact|Lobster|Raleway|Oswald|Nunito|Open Sans|Source Sans|Fira Sans)/i, msg: 'banned font family — only Inter + JetBrains Mono allowed' },
  ],

  // Color violations
  bannedColors: [
    { re: /\bpurple\b/i, msg: 'purple is banned — see brand.md' },
    { re: /\bglassmorphism\b/i, msg: 'glassmorphism is banned — see brand.md' },
    { re: /backdrop-filter\s*:\s*blur/i, msg: 'glassmorphism (backdrop-filter blur) outside fb-nav — verify this is intentional', severity: 'warn' },
  ],

  // Emoji / sparkle violations (in visible text, not in JS or comments)
  bannedEmoji: [
    { re: /[✨\u{1F4AB}\u{1F31F}\u{1FA84}\u{1F389}\u{1F680}\u{1F525}\u{1F4A1}\u{1F4A5}\u{1F91D}]/gu, msg: 'decorative emoji — sparkles, rockets, etc. are banned' },
  ],
};

// 2026-04-28 hero copy lock — required on public/index.html
const HOMEPAGE_REQUIRED = [
  'We make AI worth using.',
  'users gravitate to it',
  'And oh…',
  'ask our partners',
];

// Context lines to show around violations
const CONTEXT_LINES = 0;

// Files/directories to skip
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor']);
const SKIP_FILES = new Set(['voice-lint.js']); // don't lint ourselves

// Sections to exclude from voice checks (they document the banned phrases)
// We detect the design guide's "AVOID" list section and skip it
function isInAvoidDocSection(lines, lineIdx) {
  // Look backwards up to 10 lines for a label containing "AVOID"
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 10); i--) {
    if (/class="[^"]*fb-label[^"]*"[^>]*style="[^"]*--fb-red/i.test(lines[i]) ||
        />AVOID</.test(lines[i])) {
      // Check if we're still inside the same panel (look for closing div)
      const slice = lines.slice(lineIdx, Math.min(lines.length, lineIdx + 20)).join('\n');
      // If we haven't exited the panel yet, we're in the avoid section
      return true;
    }
  }
  return false;
}

function collectFiles(dir, exts) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (exts.some(ext => e.name.endsWith(ext)) && !SKIP_FILES.has(e.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function stripHtmlComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, (match) => '\n'.repeat((match.match(/\n/g) || []).length));
}

function stripScriptBlocks(content) {
  return content.replace(/<script[\s\S]*?<\/script>/gi, (match) => '\n'.repeat((match.match(/\n/g) || []).length));
}

function extractVisibleText(line) {
  // Strip HTML tags but keep text content
  return line.replace(/<[^>]+>/g, ' ');
}

function lintFile(filePath, rootDir) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(rootDir, filePath);
  const violations = [];

  // For voice checks, strip comments and scripts
  const cleaned = stripScriptBlocks(stripHtmlComments(raw));
  const lines = cleaned.split('\n');
  const rawLines = raw.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const visibleText = extractVisibleText(line);

    // Skip the "avoid" documentation section in style guides
    if (isInAvoidDocSection(lines, i)) continue;

    // 1. Banned phrases (check visible text only)
    for (const phrase of RULES.bannedPhrases) {
      if (visibleText.toLowerCase().includes(phrase)) {
        violations.push({
          file: relPath,
          line: lineNum,
          severity: 'error',
          rule: 'voice/banned-phrase',
          msg: `banned phrase: "${phrase}"`,
          source: rawLines[i]?.trim(),
        });
      }
    }

    // 1b. Slop shapes (check visible text; per-pattern severity)
    for (const { re, msg, severity } of RULES.slopPatterns) {
      re.lastIndex = 0;
      if (re.test(visibleText)) {
        violations.push({
          file: relPath,
          line: lineNum,
          severity: severity || 'warn',
          rule: 'voice/slop',
          msg,
          source: rawLines[i]?.trim(),
        });
      }
    }

    // 2. Sludge patterns (check visible text)
    for (const { re, msg } of RULES.sludgePatterns) {
      re.lastIndex = 0;
      if (re.test(visibleText)) {
        violations.push({
          file: relPath,
          line: lineNum,
          severity: 'error',
          rule: 'voice/sludge',
          msg,
          source: rawLines[i]?.trim(),
        });
      }
    }

    // 3. Emoji violations (check visible text)
    for (const { re, msg } of RULES.bannedEmoji) {
      re.lastIndex = 0;
      if (re.test(visibleText)) {
        violations.push({
          file: relPath,
          line: lineNum,
          severity: 'error',
          rule: 'brand/emoji',
          msg,
          source: rawLines[i]?.trim(),
        });
      }
    }
  }

  // Full-file checks (CSS patterns — apply to <style> blocks and style attrs)
  for (const { re, msg, severity } of [
    ...RULES.bannedInlineTokenOverrides,
    ...RULES.bannedFonts,
    ...RULES.bannedColors,
  ]) {
    // Reset regex state
    const globalRe = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let match;
    while ((match = globalRe.exec(raw)) !== null) {
      const upToMatch = raw.slice(0, match.index);
      const lineNum = (upToMatch.match(/\n/g) || []).length + 1;
      violations.push({
        file: relPath,
        line: lineNum,
        severity: severity || 'warn',
        rule: 'css/violation',
        msg,
        source: rawLines[lineNum - 1]?.trim(),
      });
    }
  }

  // Prose budget — the mom test (2026-07-07). A page nobody finishes converts
  // nobody. Counts readable words with scripts/comments/tags stripped.
  // Exemptions: design docs (reference material), internal (not a sales
  // surface), and the homepage (layered — the pre-CTA read path is ~100 words;
  // the verbose/fleet content is opt-in).
  const PROSE_BUDGET_WORDS = 2500;
  const PROSE_EXEMPT = [/^public\/design\//, /^public\/internal\//, /^public\/index\.html$/];
  if (!PROSE_EXEMPT.some(re => re.test(relPath))) {
    const words = cleaned.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    if (words > PROSE_BUDGET_WORDS) {
      violations.push({
        file: relPath,
        line: 0,
        severity: 'warn',
        rule: 'voice/prose-budget',
        msg: `~${words} readable words (budget ${PROSE_BUDGET_WORDS}) — would a human finish this page? cut or split`,
        source: '',
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// CSS-specific linting (for .css files)
// ---------------------------------------------------------------------------
function lintCssFile(filePath, rootDir) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(rootDir, filePath);
  const violations = [];
  const lines = raw.split('\n');

  // Skip the design system itself — it defines the rules
  if (relPath.includes('fixbroken-os.css')) return violations;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) continue;

    // Check for non-fb-* class definitions that look global
    const classMatch = trimmed.match(/^\.([a-z][a-z0-9-]+)\s*[{,]/);
    if (classMatch) {
      const className = classMatch[1];
      // Allow: fb-* prefixed, sg-* (style guide), hp-* (homepage), v-* (ventures), project scope prefixes
      if (!/^(fb-|sg-|hp-|v-|vumo-|tokenz-)/.test(className)) {
        violations.push({
          file: relPath,
          line: lineNum,
          severity: 'warn',
          rule: 'css/namespace',
          msg: `class ".${className}" is not fb-* prefixed — use a project-scoped prefix`,
          source: trimmed,
        });
      }
    }

    // Font family violations
    for (const { re, msg } of RULES.bannedFonts) {
      if (re.test(trimmed)) {
        violations.push({
          file: relPath,
          line: lineNum,
          severity: 'error',
          rule: 'css/font',
          msg,
          source: trimmed,
        });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  let targetDir = null;
  let targetFiles = [];
  let jsonOutput = false;
  let warnAsError = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') jsonOutput = true;
    else if (args[i] === '--strict') warnAsError = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: voice-lint [options] [dir-or-files...]

Options:
  --json      Output violations as JSON (for CI/tool consumption)
  --strict    Treat warnings as errors (exit 1 on any violation)
  -h, --help  Show this help

Examples:
  node tools/voice-lint.js                    # lint public/
  node tools/voice-lint.js public/index.html  # lint specific file
  node tools/voice-lint.js --json             # JSON output for CI`);
      process.exit(0);
    } else {
      const resolved = path.resolve(args[i]);
      if (!fs.existsSync(resolved)) {
        console.error(`Error: ${args[i]} does not exist`);
        process.exit(1);
      }
      if (fs.statSync(resolved).isDirectory()) targetDir = resolved;
      else targetFiles.push(resolved);
    }
  }

  // Default: scan public/ from the repo root
  const repoRoot = path.resolve(__dirname, '..');
  if (!targetDir && targetFiles.length === 0) {
    targetDir = path.join(repoRoot, 'public');
  }

  // Collect files
  if (targetDir) {
    targetFiles = [
      ...targetFiles,
      ...collectFiles(targetDir, ['.html', '.htm']),
    ];
  }

  const cssFiles = targetDir
    ? collectFiles(targetDir, ['.css'])
    : targetFiles.filter(f => f.endsWith('.css'));

  // Lint
  let allViolations = [];
  for (const f of targetFiles.filter(f => /\.html?$/.test(f))) {
    allViolations = allViolations.concat(lintFile(f, repoRoot));
  }
  for (const f of cssFiles) {
    allViolations = allViolations.concat(lintCssFile(f, repoRoot));
  }

  // Hero copy lock — required strings on homepage
  const homepagePath = path.join(repoRoot, 'public', 'index.html');
  if (fs.existsSync(homepagePath)) {
    const homepageContent = fs.readFileSync(homepagePath, 'utf8');
    for (const required of HOMEPAGE_REQUIRED) {
      if (!homepageContent.includes(required)) {
        allViolations.push({
          file: 'public/index.html',
          line: 0,
          severity: 'error',
          rule: 'voice/required-string',
          msg: `homepage missing required hero string: "${required}"`,
          source: '',
        });
      }
    }
  }

  // Output
  if (jsonOutput) {
    console.log(JSON.stringify({ violations: allViolations, count: allViolations.length }, null, 2));
  } else {
    if (allViolations.length === 0) {
      console.log('\x1b[32m✓\x1b[0m Voice lint clean — no violations.');
      process.exit(0);
    }

    const errors = allViolations.filter(v => v.severity === 'error');
    const warns = allViolations.filter(v => v.severity === 'warn');

    for (const v of allViolations) {
      const color = v.severity === 'error' ? '\x1b[31m' : '\x1b[33m';
      const reset = '\x1b[0m';
      const dim = '\x1b[2m';
      console.log(`${color}${v.severity}${reset} ${dim}${v.file}:${v.line}${reset} [${v.rule}] ${v.msg}`);
      if (v.source) {
        console.log(`  ${dim}${v.source.slice(0, 120)}${reset}`);
      }
    }

    console.log('');
    console.log(`  ${errors.length} error(s), ${warns.length} warning(s)`);

    if (errors.length > 0 || (warnAsError && warns.length > 0)) {
      process.exit(1);
    }
  }
}

main();
