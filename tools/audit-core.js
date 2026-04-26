'use strict';

// ---------------------------------------------------------------------------
// FixBroken OS — Audit Core (shared module)
// ---------------------------------------------------------------------------
// Audit logic used by both tools/audit.js (CLI) and server.js (API).
// Does not read files or use process.exit — pure functions only.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

function auditVoice(content) {
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

  let cleaned = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*>AVOID<\/span>[\s\S]*?<\/(?:ul|div|ol)>/gi, '');
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

function auditDesign(content) {
  const findings = [];

  if (/fixbroken-os\.css/.test(content)) {
    findings.push({ severity: 'pass', check: 'design/css-import', msg: 'fixbroken-os.css is loaded' });
  } else {
    findings.push({ severity: 'error', check: 'design/css-import', msg: 'fixbroken-os.css is not loaded' });
  }

  if (/class="[^"]*\bfb-shell\b/.test(content)) {
    findings.push({ severity: 'pass', check: 'design/shell', msg: '.fb-shell wrapper present' });
  } else {
    findings.push({ severity: 'warn', check: 'design/shell', msg: 'missing .fb-shell wrapper' });
  }

  if (/class="[^"]*\bfb-container\b/.test(content)) {
    findings.push({ severity: 'pass', check: 'design/container', msg: '.fb-container present' });
  } else {
    findings.push({ severity: 'warn', check: 'design/container', msg: 'no .fb-container found' });
  }

  if (/font-family\s*:\s*[^;]*(?:Roboto|Lato|Poppins|Montserrat)/i.test(content)) {
    findings.push({ severity: 'error', check: 'design/font', msg: 'banned font family detected' });
  }

  return findings;
}

function auditStructure(content) {
  const findings = [];

  if (/<!doctype html>/i.test(content))
    findings.push({ severity: 'pass', check: 'structure/doctype', msg: 'DOCTYPE present' });
  else
    findings.push({ severity: 'error', check: 'structure/doctype', msg: 'missing DOCTYPE' });

  if (/<html[^>]+lang=/.test(content))
    findings.push({ severity: 'pass', check: 'structure/lang', msg: 'lang attribute set' });
  else
    findings.push({ severity: 'warn', check: 'structure/lang', msg: 'missing lang attribute' });

  if (/charset=["']?utf-8/i.test(content))
    findings.push({ severity: 'pass', check: 'structure/charset', msg: 'UTF-8 charset declared' });
  else
    findings.push({ severity: 'warn', check: 'structure/charset', msg: 'missing UTF-8 charset' });

  if (/name=["']viewport["']/.test(content))
    findings.push({ severity: 'pass', check: 'structure/viewport', msg: 'viewport meta present' });
  else
    findings.push({ severity: 'error', check: 'structure/viewport', msg: 'missing viewport meta' });

  if (/<title>[^<]+<\/title>/.test(content))
    findings.push({ severity: 'pass', check: 'structure/title', msg: 'page title set' });
  else
    findings.push({ severity: 'warn', check: 'structure/title', msg: 'missing or empty <title>' });

  if (/<main[\s>]/.test(content))
    findings.push({ severity: 'pass', check: 'structure/semantic', msg: '<main> element present' });
  else
    findings.push({ severity: 'warn', check: 'structure/semantic', msg: 'no <main> element' });

  return findings;
}

function auditA11y(content) {
  const findings = [];

  const imgs = content.match(/<img[^>]*>/gi) || [];
  const missingAlt = imgs.filter(i => !/alt=/.test(i));
  if (imgs.length > 0 && missingAlt.length === 0)
    findings.push({ severity: 'pass', check: 'a11y/img-alt', msg: `all ${imgs.length} images have alt` });
  else if (missingAlt.length > 0)
    findings.push({ severity: 'error', check: 'a11y/img-alt', msg: `${missingAlt.length} image(s) missing alt` });

  const headings = [];
  const headingRe = /<(h[1-6])[\s>]/gi;
  let hm;
  while ((hm = headingRe.exec(content)) !== null) headings.push(parseInt(hm[1][1]));
  if (headings.length > 0) {
    let skipped = false;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] > headings[i - 1] + 1) { skipped = true; break; }
    }
    if (skipped)
      findings.push({ severity: 'warn', check: 'a11y/heading-order', msg: 'heading levels skip' });
    else
      findings.push({ severity: 'pass', check: 'a11y/heading-order', msg: 'heading hierarchy correct' });
  }

  return findings;
}

function auditResponsive(content) {
  const findings = [];
  if (/width=device-width/.test(content))
    findings.push({ severity: 'pass', check: 'responsive/viewport', msg: 'viewport set' });
  if (/fb-grid/.test(content))
    findings.push({ severity: 'pass', check: 'responsive/grid', msg: 'using fb-grid' });
  return findings;
}

function auditHtml(content) {
  const findings = [
    ...auditVoice(content),
    ...auditDesign(content),
    ...auditStructure(content),
    ...auditA11y(content),
    ...auditResponsive(content),
  ];

  const errors = findings.filter(f => f.severity === 'error').length;
  const warns = findings.filter(f => f.severity === 'warn').length;
  const passes = findings.filter(f => f.severity === 'pass').length;

  const grade = errors === 0 && warns === 0 ? 'A'
    : errors === 0 && warns <= 3 ? 'B'
    : errors <= 2 ? 'C' : 'D';

  return { findings, grade, errors, warns, passes };
}

module.exports = { auditHtml, auditVoice, auditDesign, auditStructure, auditA11y, auditResponsive };
