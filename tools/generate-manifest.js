#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FixBroken OS — Manifest Generator
// ---------------------------------------------------------------------------
// Parses fixbroken-os.css and brand.md to produce a machine-readable
// JSON manifest of the entire design system.
//
// Output: public/design/fixbroken-os.manifest.json
//
// This file is consumed by:
//   - Voice linter (tools/voice-lint.js)
//   - Tenant scaffolder (tools/scaffold-tenant.js)
//   - Style guide generator (tools/generate-styleguide.js)
//   - External agents and automation
//   - Any LLM that needs to understand FixBroken OS
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const CSS_PATH = path.join(REPO_ROOT, 'public', 'design', 'fixbroken-os.css');
const BRAND_PATH = path.join(REPO_ROOT, 'public', 'design', 'brand.md');
const OUTPUT_PATH = path.join(REPO_ROOT, 'public', 'design', 'fixbroken-os.manifest.json');

// ---------------------------------------------------------------------------
// Parse CSS tokens from :root block
// ---------------------------------------------------------------------------
function parseTokens(css) {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) return {};

  const rootBlock = rootMatch[1];
  const tokens = {};
  let currentGroup = 'ungrouped';

  for (const line of rootBlock.split('\n')) {
    const trimmed = line.trim();

    // Detect group comment: /* ------ Color: base surfaces ... */
    const groupMatch = trimmed.match(/^\/\*\s*-+\s*(.+?)\s*-+\s*\*\/$/);
    if (groupMatch) {
      currentGroup = groupMatch[1].trim().toLowerCase()
        .replace(/\s*\(.*\)\s*$/, '')  // strip parentheticals
        .replace(/[^a-z0-9]+/g, '-')    // normalize
        .replace(/^-+|-+$/g, '');        // trim dashes
      continue;
    }

    // Parse variable declaration
    const varMatch = trimmed.match(/^(--fb-[a-z0-9-]+)\s*:\s*(.+?)\s*;\s*(?:\/\*\s*(.*?)\s*\*\/)?$/);
    if (varMatch) {
      const [, name, value, comment] = varMatch;
      if (!tokens[currentGroup]) tokens[currentGroup] = [];
      const entry = { name, value };
      if (comment) entry.description = comment.trim();
      tokens[currentGroup].push(entry);
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parse CSS components (class selectors with section comments)
// ---------------------------------------------------------------------------
function parseComponents(css) {
  const components = [];
  const seen = new Set();
  const lines = css.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Match multiple comment formats:
    //   /* .fb-shell — description */
    //   /* ---------- .fb-nav — description ---------- */
    //      .fb-nav — description (indented, inside /* --- */ block)
    //   /* .fb-shell — description. More text across lines */
    const inlineMatch = trimmed.match(/^(?:\/\*\s*(?:-+\s*)?)?\.?(fb-[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)\s*[—–]\s*(.+?)(?:\s*-+)?\s*\*?\/?$/);
    if (inlineMatch && /fb-/.test(trimmed)) {
      const cls = inlineMatch[1];
      // Skip modifier classes (contain -- which are BEM modifiers, not root components)
      if (cls.includes('--')) continue;
      let desc = inlineMatch[2].replace(/\*\/\s*$/, '').replace(/-+\s*\*\/\s*$/, '').trim();
      if (!trimmed.endsWith('*/')) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const next = lines[j].trim();
          if (next.includes('*/') || next.startsWith('-')) {
            const cleaned = next.replace(/\*\/.*$/, '').replace(/-+$/, '').replace(/^\*?\s*/, '').trim();
            if (cleaned) desc += ' ' + cleaned;
            break;
          }
          desc += ' ' + next.replace(/^\*?\s*/, '').trim();
        }
      }
      desc = desc.replace(/-+\s*$/, '').replace(/\s+/g, ' ').trim();
      if (!seen.has(cls)) {
        seen.add(cls);
        components.push({ class: cls, description: desc });
      }
    }
  }

  const allClasses = new Set();
  const classRe = /\.(fb-[a-z][a-z0-9_-]*)/g;
  let m;
  while ((m = classRe.exec(css)) !== null) {
    allClasses.add(m[1]);
  }

  return { components, allClasses: [...allClasses].sort() };
}

// ---------------------------------------------------------------------------
// Parse keyframe names
// ---------------------------------------------------------------------------
function parseKeyframes(css) {
  const keyframes = [];
  const re = /@keyframes\s+(fb-[a-z-]+)/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    keyframes.push(m[1]);
  }
  return keyframes;
}

// ---------------------------------------------------------------------------
// Parse CSS sections with line counts
// ---------------------------------------------------------------------------
function parseSections(css) {
  const sections = [];
  const lines = css.split('\n');
  let currentSection = null;
  let sectionStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*\/\*\s*=+\s*\n?\s*(\d+)\.\s+(\w[\w\s]+)/);
    if (!match) {
      const altMatch = lines[i].match(/^\s*(\d+)\.\s+([\w\s]+?)(?:\s*—|\s*$)/);
      if (altMatch && lines[i - 1] && /=+/.test(lines[i - 1])) {
        if (currentSection) {
          currentSection.endLine = i - 2;
          currentSection.lines = currentSection.endLine - currentSection.startLine + 1;
          sections.push(currentSection);
        }
        currentSection = { number: parseInt(altMatch[1]), name: altMatch[2].trim().toLowerCase(), startLine: i - 1 };
        continue;
      }
    }
    // Match section headers like: /* ========== \n   1. TOKENS \n   ========== */
    const sectionHeader = lines[i].match(/^\s*(\d+)\.\s+([\w\s]+?)(?:\s*—|\s*-|\s*$)/);
    if (sectionHeader && i > 0 && /=+/.test(lines[i - 1])) {
      if (currentSection) {
        currentSection.endLine = i - 2;
        currentSection.lines = currentSection.endLine - currentSection.startLine + 1;
        sections.push(currentSection);
      }
      currentSection = { number: parseInt(sectionHeader[1]), name: sectionHeader[2].trim().toLowerCase(), startLine: i - 1 };
    }
  }
  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    currentSection.lines = currentSection.endLine - currentSection.startLine + 1;
    sections.push(currentSection);
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Parse responsive breakpoints
// ---------------------------------------------------------------------------
function parseBreakpoints(css) {
  const breakpoints = [];
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(css)) !== null) {
    const px = parseInt(m[1]);
    if (!seen.has(px)) {
      seen.add(px);
      breakpoints.push(px);
    }
  }
  return breakpoints.sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// Parse brand.md voice rules
// ---------------------------------------------------------------------------
function parseVoice(brandMd) {
  const voice = { use: [], avoid: [], identity: '', metaphor: '', aesthetic: [] };

  // Extract "Use" list
  const useMatch = brandMd.match(/### Use\n([\s\S]*?)(?=\n###|\n## )/);
  if (useMatch) {
    voice.use = useMatch[1].split('\n')
      .map(l => l.replace(/^-\s*/, '').trim())
      .filter(Boolean);
  }

  // Extract "Avoid" list
  const avoidMatch = brandMd.match(/### Avoid\n([\s\S]*?)(?=\n## |\n$)/);
  if (avoidMatch) {
    voice.avoid = avoidMatch[1].split('\n')
      .map(l => l.replace(/^-\s*/, '').trim())
      .filter(Boolean);
  }

  // Extract identity
  const identityMatch = brandMd.match(/## Identity\n\n([\s\S]*?)(?=\n## )/);
  if (identityMatch) {
    voice.identity = identityMatch[1].split('\n')
      .map(l => l.replace(/^\*\*.*?\*\*\s*/, '').trim())
      .filter(Boolean)
      .join(' ');
  }

  // Extract metaphor
  const metaphorMatch = brandMd.match(/## The metaphor\n\n([\s\S]*?)(?=\n## )/);
  if (metaphorMatch) {
    voice.metaphor = metaphorMatch[1].split('\n')
      .map(l => l.replace(/^\*\*.*?\*\*\s*[—–-]\s*/, '').trim())
      .filter(Boolean)
      .join(' ');
  }

  // Extract aesthetic bullets
  const aestheticMatch = brandMd.match(/## The aesthetic\n\n[\s\S]*?\n\n([\s\S]*?)(?=\n## )/);
  if (aestheticMatch) {
    voice.aesthetic = aestheticMatch[1].split('\n')
      .map(l => l.replace(/^-\s*/, '').trim())
      .filter(Boolean);
  }

  return voice;
}

// ---------------------------------------------------------------------------
// Parse palette from brand.md table
// ---------------------------------------------------------------------------
function parsePalette(brandMd) {
  const palette = [];
  const tableMatch = brandMd.match(/## Palette summary\n\n\|[\s\S]*?\n\n/);
  if (!tableMatch) return palette;

  const rows = tableMatch[0].split('\n').filter(l => l.startsWith('|') && !l.includes('---'));
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split('|').map(c => c.replace(/\*\*/g, '').trim()).filter(Boolean);
    if (cols.length >= 3) {
      palette.push({
        role: cols[0],
        color: cols[1],
        token: cols[2].replace(/`/g, ''),
      });
    }
  }
  return palette;
}

// ---------------------------------------------------------------------------
// Parse typography from brand.md
// ---------------------------------------------------------------------------
function parseTypography(brandMd) {
  const fonts = [];
  const fontMatch = brandMd.match(/## Typography\n\n([\s\S]*?)(?=\n## |\nNo third)/);
  if (fontMatch) {
    const lines = fontMatch[1].split('\n').filter(l => l.startsWith('-'));
    for (const line of lines) {
      const m = line.match(/\*\*(.+?)\*\*\s*[—–-]\s*(.+)/);
      if (m) fonts.push({ family: m[1], usage: m[2].trim().replace(/\.$/, '') });
    }
  }
  return {
    families: fonts,
    rule: 'No third family. No decorative fonts. No script.',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`Usage: generate-manifest [options]

Parses fixbroken-os.css and brand.md to produce a machine-readable JSON manifest.

Options:
  -h, --help    Show this help

Output: public/design/fixbroken-os.manifest.json`);
    process.exit(0);
  }

  if (!fs.existsSync(CSS_PATH)) {
    console.error(`Error: CSS file not found at ${CSS_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(BRAND_PATH)) {
    console.error(`Error: brand.md not found at ${BRAND_PATH}`);
    process.exit(1);
  }

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const brandMd = fs.readFileSync(BRAND_PATH, 'utf8');

  const tokens = parseTokens(css);
  const { components, allClasses } = parseComponents(css);
  const keyframes = parseKeyframes(css);
  const breakpoints = parseBreakpoints(css);
  const sections = parseSections(css);
  const voice = parseVoice(brandMd);
  const palette = parsePalette(brandMd);
  const typography = parseTypography(brandMd);

  const cssLines = css.split('\n').length;
  const cssBytes = Buffer.byteLength(css, 'utf8');

  const manifest = {
    $schema: 'https://fixbroken.ai/design/fixbroken-os.manifest.schema.json',
    name: 'FixBroken OS',
    version: '0.1.0',
    generated: new Date().toISOString(),
    source: {
      css: '/design/fixbroken-os.css',
      brand: '/design/brand.md',
      styleguide: '/design/',
      cssLines,
      cssBytes,
      sections,
    },
    tokens,
    palette,
    typography,
    components,
    allClasses,
    keyframes,
    breakpoints,
    voice,
    rules: {
      namespace: 'All public classes use .fb-* prefix',
      overridePattern: 'Load project stylesheet AFTER fixbroken-os.css. Override tokens via wrapper class.',
      bannedFonts: ['Any font besides Inter and JetBrains Mono'],
      bannedColors: ['purple', 'glassmorphism'],
      bannedEmoji: ['sparkles', 'rocket', 'fire', 'lightbulb', 'party', 'handshake'],
      mobile: 'Every component must be reviewed at 375px before shipping',
      neon: 'Neon is a signal, not a decoration. If you add glow, it should mean something.',
    },
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2) + '\n');

  const tokenCount = Object.values(tokens).reduce((s, arr) => s + arr.length, 0);
  console.log(`✓ Manifest generated: ${OUTPUT_PATH}`);
  console.log(`  ${tokenCount} tokens, ${components.length} components, ${allClasses.length} classes, ${keyframes.length} keyframes`);
  console.log(`  ${voice.use.length} voice exemplars, ${voice.avoid.length} voice anti-patterns`);
  console.log(`  ${breakpoints.length} breakpoints: ${breakpoints.join('px, ')}px`);
}

main();
