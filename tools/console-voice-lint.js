'use strict';

// ---------------------------------------------------------------------------
// Console Voice Lint Engine
// ---------------------------------------------------------------------------
// Highlights banned SaaS phrases in pasted copy. Mechanical only - no LLM.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'design', 'fixbroken-os.manifest.json');

function loadManifestPhrases() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    if (manifest.voice && manifest.voice.avoid && manifest.voice.avoid.length > 0) {
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
  return [];
}

const BANNED_PHRASES = [
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
  ...loadManifestPhrases(),
].filter((v, i, a) => a.indexOf(v) === i);

const SLUDGE_PATTERNS = [
  { re: /\bAI\s+for\s+\w+one\b/i, label: 'generic "AI for X"' },
  { re: /\btransform(?:ing|ative)?\s+(?:your|the)\s+(?:business|workflow|organization)/i, label: '"transformative" marketing' },
  { re: /\bscal(?:e|able|ing)\s+(?:your|the)\s+(?:business|operations)/i, label: '"scalable" cliche' },
  { re: /\bonboard(?:ing)?\s+(?:is\s+)?(?:easy|simple|effortless|seamless)/i, label: '"easy onboarding" cliche' },
  { re: /\bdeliver\s+(?:value|results|outcomes|insights)\b/i, label: '"deliver value" filler' },
  { re: /\bactionable\s+insights?\b/i, label: '"actionable insights" filler' },
  { re: /\brobust\s+(?:solution|platform|tool)\b/i, label: '"robust solution" filler' },
  { re: /\bend-to-end\s+(?:solution|platform)\b/i, label: '"end-to-end" filler' },
  { re: /\bfrictionless\b/i, label: '"frictionless" buzzword' },
  { re: /\bholistic\s+(?:approach|solution|view)\b/i, label: '"holistic approach" filler' },
];

const REPLACEMENTS = {
  'get started today': 'Open the console',
  'get started now': 'Run the signal',
  'learn more': 'See what broke',
  'supercharge your': '(just say what it does)',
  'unlock ai': '(describe the actual capability)',
  'unlock the power': '(say what it actually does)',
  'ai-powered insights': '(name the specific insight)',
  'ai-powered': '(drop it - say what the tool does)',
  'revolutionize': '(say what changes, specifically)',
  'disrupt': '(say what you fix)',
  'next-gen': '(say what is new about it)',
  'cutting-edge': '(say what is new about it)',
  'best-in-class': '(compared to what? say that)',
  'ai for everyone': '(who is it actually for?)',
  'leverage ai': '(say what the AI does)',
  'harness the power': '(say what it does)',
  'game-changing': '(say what changes)',
  'world-class': '(remove it - adds nothing)',
  'seamlessly': '(remove it - describe the integration)',
  'seamless integration': '(describe what connects to what)',
  'empower your': '(say what they can now do)',
  'turbocharge': '(say how much faster)',
  'unleash': '(say what becomes possible)',
  'synergy': '(say what combines with what)',
  'paradigm shift': '(say what changed)',
  'thought leader': '(say what they know)',
  'move the needle': '(say which metric, by how much)',
  'actionable insights': '(name the specific insight)',
  'frictionless': '(describe what got easier)',
};

const BANNED_EMOJI_RE = /[✨\u{1F4AB}\u{1F31F}\u{1FA84}\u{1F389}\u{1F680}\u{1F525}\u{1F4A1}\u{1F4A5}\u{1F91D}]/gu;

function runVoiceLint(text) {
  const lines = text.split('\n');
  const hits = [];
  const lower = text.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    let idx = 0;
    const phraseLower = phrase.toLowerCase();
    while (true) {
      const pos = lower.indexOf(phraseLower, idx);
      if (pos === -1) break;
      let lineNum = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= pos) {
          lineNum = i;
          break;
        }
        charCount += lines[i].length + 1;
      }
      const col = pos - charCount;
      hits.push({
        type: 'banned-phrase',
        phrase: phrase,
        matched: text.slice(pos, pos + phrase.length),
        line: lineNum + 1,
        col: col,
        pos: pos,
        len: phrase.length,
        replacement: REPLACEMENTS[phrase] || '(rewrite without this phrase)',
      });
      idx = pos + phrase.length;
    }
  }

  for (const { re, label } of SLUDGE_PATTERNS) {
    const globalRe = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let match;
    while ((match = globalRe.exec(text)) !== null) {
      let lineNum = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= match.index) {
          lineNum = i;
          break;
        }
        charCount += lines[i].length + 1;
      }
      const alreadyHit = hits.some(h => h.pos === match.index);
      if (!alreadyHit) {
        hits.push({
          type: 'sludge',
          phrase: label,
          matched: match[0],
          line: lineNum + 1,
          col: match.index - charCount,
          pos: match.index,
          len: match[0].length,
          replacement: '(rewrite in plain language)',
        });
      }
    }
  }

  BANNED_EMOJI_RE.lastIndex = 0;
  let emojiMatch;
  while ((emojiMatch = BANNED_EMOJI_RE.exec(text)) !== null) {
    let lineNum = 0;
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= emojiMatch.index) {
        lineNum = i;
        break;
      }
      charCount += lines[i].length + 1;
    }
    hits.push({
      type: 'emoji',
      phrase: 'banned emoji',
      matched: emojiMatch[0],
      line: lineNum + 1,
      col: emojiMatch.index - charCount,
      pos: emojiMatch.index,
      len: emojiMatch[0].length,
      replacement: '(remove)',
    });
  }

  hits.sort((a, b) => a.pos - b.pos);

  const uniquePhrases = [...new Set(hits.map(h => h.phrase))];
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  let verdict;
  if (hits.length === 0) {
    verdict = 'Clean copy. No banned phrases detected. Your text reads like yours, not like every other AI company.';
  } else if (hits.length <= 2) {
    verdict = 'Almost clean. A couple of phrases slipped through. Easy fixes below.';
  } else if (hits.length <= 5) {
    verdict = 'Noisy. Your copy has several phrases that read like generic SaaS marketing. Your brand disappears behind them.';
  } else {
    verdict = 'SaaS sludge. This reads like it was written by a marketing template. Your audience has seen every one of these phrases a hundred times this quarter.';
  }

  return {
    hits,
    hitCount: hits.length,
    uniquePhrases,
    uniqueCount: uniquePhrases.length,
    wordCount,
    density: wordCount > 0 ? Math.round(hits.length / wordCount * 1000) / 10 : 0,
    verdict,
    clean: hits.length === 0,
  };
}

module.exports = { runVoiceLint, BANNED_PHRASES, REPLACEMENTS };
