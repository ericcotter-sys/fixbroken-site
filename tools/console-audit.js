'use strict';

// ---------------------------------------------------------------------------
// Console Audit Engine — Design System Rubric Scorer
// ---------------------------------------------------------------------------
// Scores a pasted design system / brand doc / CSS against the FixBroken OS
// 29-item rubric. Pure mechanical scoring — no LLM calls.
//
// Input: raw text (any format: YAML, JSON, CSS, prose, mixed)
// Output: { score, maxScore, verdict, items[], leakPoints[], punchList[], comparison }
// ---------------------------------------------------------------------------

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Input parsing — be liberal
// ---------------------------------------------------------------------------

const CREDENTIAL_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[a-zA-Z0-9]{20,}/,
  /Bearer\s+[a-zA-Z0-9\-._~+\/]{20,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /glpat-[a-zA-Z0-9\-]{20,}/,
  /xox[bpors]-[a-zA-Z0-9\-]{10,}/,
  /sk-[a-zA-Z0-9]{32,}/,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
];

function containsCredentials(text) {
  for (const pat of CREDENTIAL_PATTERNS) {
    if (pat.test(text)) return true;
  }
  return false;
}

function sanitizeInput(text) {
  let sanitized = text;
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[email-redacted]');
  for (const pat of CREDENTIAL_PATTERNS) {
    sanitized = sanitized.replace(new RegExp(pat.source, pat.flags + (pat.flags.includes('g') ? '' : 'g')), '[credential-redacted]');
  }
  return sanitized;
}

function tryParseYAML(text) {
  const yamlIndicators = /^---\s*$/m.test(text) ||
    /^[a-zA-Z_][\w-]*:\s/m.test(text);
  if (!yamlIndicators) return null;

  const tokens = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([a-zA-Z_][\w-]*):\s*(.+)/);
    if (m) tokens[m[1]] = m[2].trim();
  }
  return Object.keys(tokens).length > 2 ? { format: 'yaml', tokens } : null;
}

function tryParseJSON(text) {
  const jsonBlock = text.match(/\{[\s\S]*\}/);
  if (!jsonBlock) return null;
  try {
    const obj = JSON.parse(jsonBlock[0]);
    if (typeof obj === 'object' && Object.keys(obj).length > 0) {
      return { format: 'json', data: obj, raw: jsonBlock[0] };
    }
  } catch {}
  return null;
}

function tryParseCSS(text) {
  const varMatches = text.match(/--[\w-]+\s*:\s*[^;]+/g) || [];
  const ruleMatches = text.match(/\.[a-zA-Z][\w-]*\s*\{/g) || [];
  if (varMatches.length > 2 || ruleMatches.length > 2) {
    return {
      format: 'css',
      variables: varMatches.map(v => {
        const [name, ...val] = v.split(':');
        return { name: name.trim(), value: val.join(':').trim() };
      }),
      classes: ruleMatches.map(r => r.replace(/\s*\{/, '').trim()),
    };
  }
  return null;
}

function extractColors(text) {
  const hexColors = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const rgbColors = text.match(/rgba?\s*\([^)]+\)/gi) || [];
  const hslColors = text.match(/hsla?\s*\([^)]+\)/gi) || [];
  return [...new Set([...hexColors, ...rgbColors, ...hslColors])];
}

function parseInput(rawText) {
  const result = {
    raw: rawText,
    length: rawText.length,
    lineCount: rawText.split('\n').length,
    formats: [],
    colors: extractColors(rawText),
    cssVars: (rawText.match(/--[\w-]+\s*:\s*[^;]+/g) || []),
    cssClasses: (rawText.match(/\.[\w-]+/g) || []).map(c => c.slice(1)),
    fontFamilies: [],
    mediaQueries: (rawText.match(/@media\s*\([^)]+\)/g) || []),
    keyframes: (rawText.match(/@keyframes\s+[\w-]+/g) || []),
    mentions: {},
  };

  const yaml = tryParseYAML(rawText);
  if (yaml) result.formats.push(yaml);

  const json = tryParseJSON(rawText);
  if (json) result.formats.push(json);

  const css = tryParseCSS(rawText);
  if (css) result.formats.push(css);

  const fontMatches = rawText.match(/font-family\s*:\s*([^;}\n]+)/gi) || [];
  const fontMentions = rawText.match(/(?:typeface|font|typography)[:\s]+["']?([A-Z][\w\s]+)/gi) || [];
  result.fontFamilies = [...new Set([...fontMatches, ...fontMentions].map(f => f.trim()))];

  const lower = rawText.toLowerCase();
  const mentionKeys = [
    'color', 'palette', 'typography', 'font', 'spacing', 'radius', 'shadow',
    'elevation', 'motion', 'animation', 'transition', 'z-index', 'layer',
    'grid', 'layout', 'container', 'breakpoint', 'responsive', 'mobile',
    'navigation', 'nav', 'button', 'cta', 'card', 'panel', 'input', 'form',
    'select', 'textarea', 'heading', 'body', 'label', 'badge', 'chip', 'tag',
    'status', 'footer', 'header', 'accessibility', 'a11y', 'focus', 'aria',
    'contrast', 'reduced-motion', 'voice', 'tone', 'brand', 'avoid',
    'banned', 'do not', 'don\'t', 'never use', 'naming', 'convention',
    'prefix', 'bem', 'override', 'extend', 'theme', 'token', 'variable',
    'json', 'yaml', 'manifest', 'claude', 'prompt', 'agent', 'llm',
    'style guide', 'documentation', 'reference',
  ];
  for (const key of mentionKeys) {
    const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lower.match(re) || [];
    if (matches.length > 0) result.mentions[key] = matches.length;
  }

  return result;
}


// ---------------------------------------------------------------------------
// 29-item rubric
// ---------------------------------------------------------------------------
// Each item: { id, category, name, execLabel, test(parsed) -> { score, evidence } }
// score: 2 = YES, 1 = WEAK, 0 = NO
// ---------------------------------------------------------------------------

const RUBRIC = [
  // --- 1. TOKEN FOUNDATION (8 items) ---
  {
    id: 1, category: 'Token Foundation', name: 'Color tokens',
    execLabel: 'Your team has no shared color vocabulary',
    test(p) {
      const cssColorVars = p.cssVars.filter(v => /color|bg|background|surface|text|ink|brand|accent|primary|signal/i.test(v));
      if (cssColorVars.length >= 5) return { score: 2, evidence: `${cssColorVars.length} color tokens as CSS variables` };
      if (p.colors.length >= 5) return { score: 1, evidence: `${p.colors.length} color values found but not tokenized` };
      if (p.colors.length > 0 || p.mentions.color) return { score: 1, evidence: 'Colors mentioned but not structured' };
      return { score: 0, evidence: 'No color tokens detected' };
    }
  },
  {
    id: 2, category: 'Token Foundation', name: 'Typography scale',
    execLabel: 'Font sizes are improvised per page',
    test(p) {
      const sizeVars = p.cssVars.filter(v => /font-size|fs-|type-|text-/i.test(v));
      if (sizeVars.length >= 4) return { score: 2, evidence: `${sizeVars.length} type scale tokens` };
      const sizeMentions = (p.raw.match(/\b\d+px\b/g) || []).length;
      if (sizeMentions >= 4 || p.mentions.typography) return { score: 1, evidence: 'Font sizes present but not tokenized into a scale' };
      return { score: 0, evidence: 'No typography scale detected' };
    }
  },
  {
    id: 3, category: 'Token Foundation', name: 'Spacing scale',
    execLabel: 'Whitespace is eyeballed every time',
    test(p) {
      const spacingVars = p.cssVars.filter(v => /spacing|space|gap|pad|margin|s-\d/i.test(v));
      if (spacingVars.length >= 4) return { score: 2, evidence: `${spacingVars.length} spacing tokens` };
      if (p.mentions.spacing) return { score: 1, evidence: 'Spacing mentioned but not tokenized' };
      return { score: 0, evidence: 'No spacing scale detected' };
    }
  },
  {
    id: 4, category: 'Token Foundation', name: 'Font families',
    execLabel: 'No type contract — each page picks its own fonts',
    test(p) {
      if (p.fontFamilies.length >= 1) return { score: 2, evidence: `Font families declared: ${p.fontFamilies.length}` };
      if (p.mentions.font) return { score: 1, evidence: 'Fonts mentioned in prose but not declared' };
      return { score: 0, evidence: 'No font family declarations' };
    }
  },
  {
    id: 5, category: 'Token Foundation', name: 'Border radius tokens',
    execLabel: 'Rounding is inconsistent across components',
    test(p) {
      const radiusVars = p.cssVars.filter(v => /radius|round|r-\d/i.test(v));
      if (radiusVars.length >= 2) return { score: 2, evidence: `${radiusVars.length} radius tokens` };
      if (p.mentions.radius || /border-radius/i.test(p.raw)) return { score: 1, evidence: 'Radius values present but not tokenized' };
      return { score: 0, evidence: 'No radius tokens detected' };
    }
  },
  {
    id: 6, category: 'Token Foundation', name: 'Shadow / elevation tokens',
    execLabel: 'Depth and elevation are ad-hoc',
    test(p) {
      const shadowVars = p.cssVars.filter(v => /shadow|elevation|lift|glow/i.test(v));
      if (shadowVars.length >= 2) return { score: 2, evidence: `${shadowVars.length} shadow/elevation tokens` };
      if (p.mentions.shadow || p.mentions.elevation) return { score: 1, evidence: 'Shadows mentioned but not tokenized' };
      return { score: 0, evidence: 'No shadow/elevation tokens' };
    }
  },
  {
    id: 7, category: 'Token Foundation', name: 'Motion / transition tokens',
    execLabel: 'Animations are uncoordinated',
    test(p) {
      const motionVars = p.cssVars.filter(v => /motion|transition|duration|ease|timing|anim/i.test(v));
      if (motionVars.length >= 2) return { score: 2, evidence: `${motionVars.length} motion tokens` };
      if (p.keyframes.length > 0 || p.mentions.animation || p.mentions.transition) return { score: 1, evidence: 'Motion present but not tokenized' };
      return { score: 0, evidence: 'No motion/transition tokens' };
    }
  },
  {
    id: 8, category: 'Token Foundation', name: 'Z-index layers',
    execLabel: 'Z-index wars in production',
    test(p) {
      const zVars = p.cssVars.filter(v => /z-index|z-\w|layer/i.test(v));
      if (zVars.length >= 3) return { score: 2, evidence: `${zVars.length} z-index layer tokens` };
      if (p.mentions['z-index'] || p.mentions.layer) return { score: 1, evidence: 'Z-index mentioned but no defined scale' };
      return { score: 0, evidence: 'No z-index layer system' };
    }
  },

  // --- 2. COLOR SYSTEM (4 items) ---
  {
    id: 9, category: 'Color System', name: 'Surface palette',
    execLabel: 'Background colors are random per page',
    test(p) {
      const surfaceVars = p.cssVars.filter(v => /surface|background|bg|panel|ink|canvas|base/i.test(v));
      if (surfaceVars.length >= 3) return { score: 2, evidence: `${surfaceVars.length} surface/background tokens` };
      if (surfaceVars.length > 0 || p.mentions.palette) return { score: 1, evidence: 'Some surface colors but incomplete hierarchy' };
      return { score: 0, evidence: 'No surface color hierarchy' };
    }
  },
  {
    id: 10, category: 'Color System', name: 'Text color hierarchy',
    execLabel: 'Text contrast is uncontrolled',
    test(p) {
      const textVars = p.cssVars.filter(v => /text|foreground|fg|copy|body-color/i.test(v));
      if (textVars.length >= 3) return { score: 2, evidence: `${textVars.length} text color tokens` };
      if (textVars.length > 0) return { score: 1, evidence: 'Some text colors but no full hierarchy' };
      return { score: 0, evidence: 'No text color hierarchy' };
    }
  },
  {
    id: 11, category: 'Color System', name: 'Semantic / state colors',
    execLabel: 'Success and error states look different everywhere',
    test(p) {
      const stateVars = p.cssVars.filter(v => /success|error|warning|danger|info|amber|red|green|state/i.test(v));
      const stateWords = ['success', 'error', 'warning', 'danger', 'info'].filter(w => p.mentions[w]);
      if (stateVars.length >= 3) return { score: 2, evidence: `${stateVars.length} semantic state color tokens` };
      if (stateVars.length > 0 || stateWords.length > 0) return { score: 1, evidence: 'Some state colors but incomplete' };
      return { score: 0, evidence: 'No semantic state colors' };
    }
  },
  {
    id: 12, category: 'Color System', name: 'Accent / signal color',
    execLabel: 'No clear primary action color',
    test(p) {
      const accentVars = p.cssVars.filter(v => /accent|primary|signal|brand|action|cta|main/i.test(v));
      if (accentVars.length >= 1) return { score: 2, evidence: `Accent/primary color defined: ${accentVars[0]}` };
      if (p.mentions.brand || p.mentions.accent) return { score: 1, evidence: 'Brand/accent color mentioned but not tokenized' };
      return { score: 0, evidence: 'No accent/primary color defined' };
    }
  },

  // --- 3. COMPONENT LIBRARY (8 items) ---
  {
    id: 13, category: 'Component Library', name: 'Layout primitives',
    execLabel: 'Every page reinvents its layout from scratch',
    test(p) {
      const layoutClasses = p.cssClasses.filter(c => /container|grid|stack|row|flex|col|layout|wrapper/i.test(c));
      if (layoutClasses.length >= 2) return { score: 2, evidence: `${layoutClasses.length} layout classes: ${layoutClasses.slice(0, 4).join(', ')}` };
      if (p.mentions.grid || p.mentions.layout || p.mentions.container) return { score: 1, evidence: 'Layout concepts mentioned but no reusable classes' };
      return { score: 0, evidence: 'No layout primitives' };
    }
  },
  {
    id: 14, category: 'Component Library', name: 'Navigation component',
    execLabel: 'Nav is built differently on every page',
    test(p) {
      const navClasses = p.cssClasses.filter(c => /nav|header|topbar|menu|navbar/i.test(c));
      if (navClasses.length >= 1) return { score: 2, evidence: `Nav component: ${navClasses.slice(0, 3).join(', ')}` };
      if (p.mentions.nav || p.mentions.navigation) return { score: 1, evidence: 'Navigation mentioned but not componentized' };
      return { score: 0, evidence: 'No navigation component' };
    }
  },
  {
    id: 15, category: 'Component Library', name: 'Button / CTA component',
    execLabel: 'Buttons are styled inline every time',
    test(p) {
      const btnClasses = p.cssClasses.filter(c => /btn|button|cta|action/i.test(c));
      if (btnClasses.length >= 1) return { score: 2, evidence: `Button/CTA component: ${btnClasses.slice(0, 3).join(', ')}` };
      if (p.mentions.button || p.mentions.cta) return { score: 1, evidence: 'Buttons mentioned but not componentized' };
      return { score: 0, evidence: 'No button/CTA component' };
    }
  },
  {
    id: 16, category: 'Component Library', name: 'Card / panel component',
    execLabel: 'Content containers have no shared structure',
    test(p) {
      const cardClasses = p.cssClasses.filter(c => /card|panel|box|tile|module|block/i.test(c));
      if (cardClasses.length >= 1) return { score: 2, evidence: `Card/panel component: ${cardClasses.slice(0, 3).join(', ')}` };
      if (p.mentions.card || p.mentions.panel) return { score: 1, evidence: 'Cards/panels mentioned but not componentized' };
      return { score: 0, evidence: 'No card/panel component' };
    }
  },
  {
    id: 17, category: 'Component Library', name: 'Form controls',
    execLabel: 'Form inputs look different across the product',
    test(p) {
      const formClasses = p.cssClasses.filter(c => /input|form|field|select|textarea|checkbox|radio/i.test(c));
      if (formClasses.length >= 2) return { score: 2, evidence: `${formClasses.length} form control classes` };
      if (formClasses.length > 0 || p.mentions.form || p.mentions.input) return { score: 1, evidence: 'Some form styling but incomplete' };
      return { score: 0, evidence: 'No form control components' };
    }
  },
  {
    id: 18, category: 'Component Library', name: 'Typography classes',
    execLabel: 'Headings and body text are ad-hoc',
    test(p) {
      const typoClasses = p.cssClasses.filter(c => /heading|title|display|body|caption|label|text-|lede|subtitle|mono/i.test(c));
      if (typoClasses.length >= 3) return { score: 2, evidence: `${typoClasses.length} typography classes` };
      if (typoClasses.length > 0 || p.mentions.heading) return { score: 1, evidence: 'Some typography classes but incomplete hierarchy' };
      return { score: 0, evidence: 'No typography classes' };
    }
  },
  {
    id: 19, category: 'Component Library', name: 'Status / badge component',
    execLabel: 'Status indicators are improvised',
    test(p) {
      const statusClasses = p.cssClasses.filter(c => /badge|chip|tag|status|pill|indicator|label/i.test(c));
      if (statusClasses.length >= 1) return { score: 2, evidence: `Status/badge component: ${statusClasses.slice(0, 3).join(', ')}` };
      if (p.mentions.badge || p.mentions.chip || p.mentions.status || p.mentions.tag) return { score: 1, evidence: 'Status indicators mentioned but not componentized' };
      return { score: 0, evidence: 'No status/badge component' };
    }
  },
  {
    id: 20, category: 'Component Library', name: 'Footer component',
    execLabel: 'Footer varies across pages',
    test(p) {
      const footerClasses = p.cssClasses.filter(c => /footer/i.test(c));
      if (footerClasses.length >= 1) return { score: 2, evidence: `Footer component: ${footerClasses[0]}` };
      if (p.mentions.footer) return { score: 1, evidence: 'Footer mentioned but not componentized' };
      return { score: 0, evidence: 'No footer component' };
    }
  },

  // --- 4. GOVERNANCE (6 items) ---
  {
    id: 21, category: 'Governance', name: 'Naming convention',
    execLabel: 'Class names are inconsistent — no one knows what to use',
    test(p) {
      const prefixed = p.cssClasses.filter(c => /^[a-z]+-[a-z]/i.test(c));
      const ratio = p.cssClasses.length > 0 ? prefixed.length / p.cssClasses.length : 0;
      if (ratio >= 0.6 && prefixed.length >= 5) return { score: 2, evidence: `${Math.round(ratio * 100)}% of classes use a consistent naming convention` };
      if (ratio >= 0.3 || p.mentions.naming || p.mentions.convention || p.mentions.prefix || p.mentions.bem) return { score: 1, evidence: 'Some naming consistency but not enforced' };
      return { score: 0, evidence: 'No consistent naming convention detected' };
    }
  },
  {
    id: 22, category: 'Governance', name: 'Override / extension pattern',
    execLabel: 'No guidance on how teams customize — they fork instead',
    test(p) {
      if (p.mentions.override || p.mentions.extend || p.mentions.theme) {
        const hasDetail = /override|extend|theme|wrapper|scope/i.test(p.raw) && p.raw.length > 200;
        if (hasDetail) return { score: 2, evidence: 'Override/extension pattern documented' };
        return { score: 1, evidence: 'Theming mentioned but pattern not fully documented' };
      }
      return { score: 0, evidence: 'No override/extension guidance' };
    }
  },
  {
    id: 23, category: 'Governance', name: 'Responsive breakpoints',
    execLabel: 'Mobile behavior is undefined — every page does its own thing',
    test(p) {
      if (p.mediaQueries.length >= 2) return { score: 2, evidence: `${p.mediaQueries.length} media queries defined` };
      if (p.mediaQueries.length > 0 || p.mentions.breakpoint || p.mentions.responsive || p.mentions.mobile) return { score: 1, evidence: 'Responsive mentioned but breakpoints not fully defined' };
      return { score: 0, evidence: 'No responsive breakpoints' };
    }
  },
  {
    id: 24, category: 'Governance', name: 'Accessibility',
    execLabel: 'Accessibility is not addressed in the system',
    test(p) {
      const a11ySignals = [
        /prefers-reduced-motion/i.test(p.raw),
        /focus-visible|:focus\b/i.test(p.raw),
        /aria-/i.test(p.raw),
        p.mentions.accessibility > 0,
        p.mentions.a11y > 0,
        p.mentions.contrast > 0,
      ].filter(Boolean).length;
      if (a11ySignals >= 3) return { score: 2, evidence: `${a11ySignals} accessibility signals detected` };
      if (a11ySignals >= 1) return { score: 1, evidence: 'Some accessibility consideration but incomplete' };
      return { score: 0, evidence: 'No accessibility provisions' };
    }
  },
  {
    id: 25, category: 'Governance', name: 'Voice / tone guidelines',
    execLabel: 'Copy reads differently on every page — no shared voice',
    test(p) {
      if (p.mentions.voice && p.mentions.tone) return { score: 2, evidence: 'Voice and tone guidelines present' };
      if (p.mentions.voice || p.mentions.tone || p.mentions.brand) return { score: 1, evidence: 'Brand voice partially addressed' };
      return { score: 0, evidence: 'No voice/tone guidelines' };
    }
  },
  {
    id: 26, category: 'Governance', name: 'Banned patterns',
    execLabel: 'No guardrails — anything goes',
    test(p) {
      const banSignals = [
        p.mentions.avoid > 0,
        p.mentions.banned > 0,
        p.mentions['do not'] > 0,
        p.mentions['don\'t'] > 0,
        p.mentions['never use'] > 0,
      ].filter(Boolean).length;
      if (banSignals >= 2) return { score: 2, evidence: 'Clear banned-pattern documentation' };
      if (banSignals >= 1) return { score: 1, evidence: 'Some restrictions mentioned but not comprehensive' };
      return { score: 0, evidence: 'No banned patterns documented' };
    }
  },

  // --- 5. IMPLEMENTATION EVIDENCE (3 items) ---
  {
    id: 27, category: 'Implementation Evidence', name: 'Machine-readable format',
    execLabel: 'Your design system only exists as a PDF — machines can\'t use it',
    test(p) {
      const hasCSSVars = p.cssVars.length >= 5;
      const hasJSON = p.formats.some(f => f.format === 'json');
      const hasYAML = p.formats.some(f => f.format === 'yaml');
      if (hasCSSVars || hasJSON) return { score: 2, evidence: hasCSSVars ? `${p.cssVars.length} CSS custom properties (machine-readable)` : 'JSON token structure detected' };
      if (hasYAML || p.cssVars.length > 0) return { score: 1, evidence: 'Partially machine-readable' };
      return { score: 0, evidence: 'Not machine-readable — prose only' };
    }
  },
  {
    id: 28, category: 'Implementation Evidence', name: 'Agent / LLM session prompt',
    execLabel: 'Your LLM has no instructions — it guesses your brand every session',
    test(p) {
      const promptSignals = [
        p.mentions.claude > 0,
        p.mentions.prompt > 0,
        p.mentions.agent > 0,
        p.mentions.llm > 0,
        /CLAUDE\.md|system\s*prompt|session\s*prompt|ruleset/i.test(p.raw),
      ].filter(Boolean).length;
      if (promptSignals >= 2) return { score: 2, evidence: 'LLM/agent prompt infrastructure present' };
      if (promptSignals >= 1) return { score: 1, evidence: 'LLM mentioned but no structured prompt' };
      return { score: 0, evidence: 'No LLM session prompt or agent instructions' };
    }
  },
  {
    id: 29, category: 'Implementation Evidence', name: 'Living reference / style guide',
    execLabel: 'No one can see what the system looks like without reading code',
    test(p) {
      const refSignals = [
        p.mentions['style guide'] > 0,
        p.mentions.documentation > 0,
        p.mentions.reference > 0,
        /storybook|chromatic|style\s*guide|living\s*doc|component\s*library/i.test(p.raw),
      ].filter(Boolean).length;
      if (refSignals >= 2) return { score: 2, evidence: 'Living reference/style guide documented' };
      if (refSignals >= 1) return { score: 1, evidence: 'Documentation mentioned but not a living reference' };
      return { score: 0, evidence: 'No living reference or style guide' };
    }
  },
];


// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function runAudit(rawText) {
  const parsed = parseInput(rawText);

  const items = RUBRIC.map(item => {
    const result = item.test(parsed);
    return {
      id: item.id,
      category: item.category,
      name: item.name,
      execLabel: item.execLabel,
      score: result.score,
      status: result.score === 2 ? 'YES' : result.score === 1 ? 'WEAK' : 'NO',
      evidence: result.evidence,
    };
  });

  const score = items.reduce((s, i) => s + i.score, 0);
  const maxScore = items.length * 2;

  const nothingFound = parsed.formats.length === 0 &&
    parsed.colors.length === 0 &&
    parsed.cssVars.length === 0 &&
    parsed.cssClasses.length === 0 &&
    parsed.fontFamilies.length === 0 &&
    Object.keys(parsed.mentions).length < 3;

  let verdict;
  const pct = score / maxScore;
  if (nothingFound) {
    verdict = 'No design system detected. This input contains no structured tokens, components, or governance rules. That itself is the finding.';
  } else if (pct >= 0.85) {
    verdict = 'Solid foundation. Your system covers most bases — tighten the gaps below and you\'re operating at high level.';
  } else if (pct >= 0.6) {
    verdict = 'Partial system. You have pieces, but your team is still improvising in the gaps. Every gap is a place where output drifts.';
  } else if (pct >= 0.35) {
    verdict = 'Fragments, not a system. What you have doesn\'t connect — your team rebuilds from scratch more than they reuse.';
  } else {
    verdict = 'No operating system. Your LLM and your team are guessing every session. Output will be inconsistent by default.';
  }

  const leakPoints = items
    .filter(i => i.score === 0)
    .sort((a, b) => a.id - b.id)
    .slice(0, 3)
    .map(i => ({ name: i.name, execLabel: i.execLabel, category: i.category }));

  const punchList = items
    .filter(i => i.score < 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((i, idx) => {
      let effort;
      if (i.category === 'Token Foundation') effort = '1-2 hours';
      else if (i.category === 'Color System') effort = '1-2 hours';
      else if (i.category === 'Component Library') effort = '2-4 hours';
      else if (i.category === 'Governance') effort = '1-3 hours';
      else effort = '2-4 hours';
      return { rank: idx + 1, name: i.name, status: i.status, effort, category: i.category };
    });

  const comparison = {
    theirs: {
      label: 'Your input',
      fileCount: 1,
      kb: Math.round(rawText.length / 1024 * 10) / 10,
      ruleTypes: parsed.formats.map(f => f.format),
      hasCLAUDE: /CLAUDE\.md/i.test(rawText),
      hasBrand: /brand\.md|brand\s*guide/i.test(rawText),
      hasCSSSource: parsed.cssVars.length > 0 || parsed.formats.some(f => f.format === 'css'),
      hasSessionPrompt: /session\s*prompt|system\s*prompt/i.test(rawText),
      tokenCount: parsed.cssVars.length,
      componentCount: parsed.cssClasses.length,
      colorCount: parsed.colors.length,
    },
    reference: {
      label: 'FixBroken OS',
      fileCount: 5,
      kb: 37.8,
      ruleTypes: ['css', 'json', 'markdown'],
      hasCLAUDE: true,
      hasBrand: true,
      hasCSSSource: true,
      hasSessionPrompt: true,
      tokenCount: 89,
      componentCount: 28,
      colorCount: 24,
    },
  };

  const categories = {};
  for (const item of items) {
    if (!categories[item.category]) categories[item.category] = { yes: 0, weak: 0, no: 0, items: [] };
    categories[item.category][item.status === 'YES' ? 'yes' : item.status === 'WEAK' ? 'weak' : 'no']++;
    categories[item.category].items.push(item);
  }

  return {
    score,
    maxScore,
    pct: Math.round(pct * 100),
    verdict,
    nothingFound,
    items,
    categories,
    leakPoints,
    punchList,
    comparison,
    inputStats: {
      length: parsed.length,
      lineCount: parsed.lineCount,
      formats: parsed.formats.map(f => f.format),
      colorCount: parsed.colors.length,
      cssVarCount: parsed.cssVars.length,
      classCount: parsed.cssClasses.length,
    },
  };
}


// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------
function generateSlug() {
  return crypto.randomBytes(6).toString('base64url').toLowerCase().slice(0, 10);
}


// ---------------------------------------------------------------------------
// Migration prompt generator
// ---------------------------------------------------------------------------
function generateMigrationPrompt(auditResult) {
  const missing = auditResult.items.filter(i => i.score === 0).map(i => i.name);
  const weak = auditResult.items.filter(i => i.score === 1).map(i => i.name);

  let prompt = `You are building a design system. The current system scored ${auditResult.score}/${auditResult.maxScore} on the FixBroken OS rubric.\n\n`;

  if (missing.length > 0) {
    prompt += `MISSING (add these):\n${missing.map(m => `- ${m}`).join('\n')}\n\n`;
  }
  if (weak.length > 0) {
    prompt += `WEAK (strengthen these):\n${weak.map(m => `- ${m}`).join('\n')}\n\n`;
  }

  prompt += `Requirements:\n`;
  prompt += `- Define all tokens as CSS custom properties with a consistent prefix\n`;
  prompt += `- Include at minimum: color, typography, spacing, radius, shadow, motion, z-index tokens\n`;
  prompt += `- Create reusable component classes for: layout, nav, buttons, cards, forms, typography, status indicators, footer\n`;
  prompt += `- Document naming convention, override pattern, responsive breakpoints, and accessibility rules\n`;
  prompt += `- Add voice/tone guidelines and banned patterns\n`;
  prompt += `- Output a machine-readable manifest (JSON) alongside the CSS\n`;
  prompt += `- Write a CLAUDE.md or equivalent agent prompt so LLMs can use the system correctly\n`;
  prompt += `- Create a living style guide page that renders every component\n`;

  return prompt;
}


module.exports = {
  containsCredentials,
  sanitizeInput,
  parseInput,
  runAudit,
  generateSlug,
  generateMigrationPrompt,
  RUBRIC,
};
