const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();

// Trust the Nginx proxy so we can read the real client IP from X-Forwarded-For
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Health check for monitoring
app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));

// ---------------------------------------------------------------------------
// Signup endpoint - append to flat log (legacy; kept for compatibility)
// ---------------------------------------------------------------------------
app.post('/signup', (req, res) => {
  const entry = JSON.stringify({ ts: new Date().toISOString(), body: req.body }) + '\n';
  fs.appendFile(path.join(__dirname, 'signups.log'), entry, (err) => {
    if (err) return res.status(500).json({ ok: false });
    res.json({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// SMTP transporter (lazy, optional — only configured if env vars present)
// ---------------------------------------------------------------------------
// Uses the same env-var contract as BORTON so a simple env-file copy works:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
//   MAIL_FROM_EMAIL, MAIL_FROM_NAME, MAIL_TO
// If SMTP_* is missing the app still runs — we log to file only.
// ---------------------------------------------------------------------------
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  // Verify on boot (fire-and-forget — don't block startup)
  transporter.verify().then(() => {
    console.log('SMTP ready:', process.env.SMTP_HOST);
  }).catch((e) => {
    console.error('SMTP verify failed:', e.message);
  });
} else {
  console.log('SMTP not configured — /contact will log to file only');
}

function mailFrom() {
  const email = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
  const name = process.env.MAIL_FROM_NAME || 'fixbroken.ai';
  return `"${name}" <${email}>`;
}

// ---------------------------------------------------------------------------
// Email templates — HTML + plaintext.
// Email HTML must use inline styles (Gmail strips <style> blocks); tables for
// layout (Outlook compat); hex colors (CSS vars don't work in mail clients);
// system-font fallbacks (Google Fonts @import is unreliable in email).
// Tokens mirror FixBroken OS.
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const EMAIL_FONT_MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const EMAIL_FONT_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Wraps a body block in the FixBroken OS email chrome.
function emailFrame(preheader, innerHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>fixbroken.ai</title>
</head>
<body style="margin:0;padding:0;background:#05070a;color:#e4eaf2;font-family:${EMAIL_FONT_SANS};">
  <span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05070a;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#0f151c;border:1px solid #2a3442;border-radius:10px;overflow:hidden;box-shadow:0 0 48px rgba(255,62,201,0.06);">
        ${innerHtml}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin-top:16px;">
        <tr><td style="font-family:${EMAIL_FONT_MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#556070;text-align:center;">
          <span style="color:#ff3ec9;">◢</span> fixbroken.ai · consulting · product · brand
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ---- SUBMITTER auto-reply ------------------------------------------------ */
function submitterEmailText(entry) {
  return [
    'Signal received.',
    '',
    `Ref: ${entry.ref}`,
    '',
    "I read every one. If it's the right shape of problem, you'll hear back within 48h.",
    '',
    '— Eric',
    'fixbroken.ai'
  ].join('\n');
}
function submitterEmailHtml(entry) {
  const inner = `
    <tr><td style="padding:28px 28px 0 28px;">
      <span style="font-family:${EMAIL_FONT_MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a97a8;">system · fixbroken os</span>
    </td></tr>

    <tr><td style="padding:12px 28px 4px 28px;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00ff88;vertical-align:2px;margin-right:8px;"></span>
      <span style="font-family:${EMAIL_FONT_MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#00ff88;">signal received</span>
    </td></tr>

    <tr><td style="padding:16px 28px 20px 28px;">
      <h1 style="margin:0;font-family:${EMAIL_FONT_SANS};font-size:30px;font-weight:600;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;">
        Got your <span style="color:#ff3ec9;">signal.</span>
      </h1>
    </td></tr>

    <tr><td style="padding:0 28px 20px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0e14;border:1px solid #2a3442;border-radius:6px;">
        <tr><td style="padding:14px 18px;">
          <div style="font-family:${EMAIL_FONT_MONO};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8a97a8;">ref</div>
          <div style="font-family:${EMAIL_FONT_MONO};font-size:20px;color:#ff3ec9;margin-top:4px;letter-spacing:0.02em;">${esc(entry.ref)}</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:0 28px 24px 28px;">
      <p style="margin:0;font-family:${EMAIL_FONT_SANS};font-size:16px;line-height:1.6;color:#e4eaf2;">
        I read every one. If it's the right shape of problem, you'll hear back within 48h.
      </p>
    </td></tr>

    <tr><td style="padding:0 28px;"><div style="height:1px;background:#2a3442;"></div></td></tr>

    <tr><td style="padding:18px 28px 28px 28px;">
      <p style="margin:0;font-family:${EMAIL_FONT_SANS};font-size:14px;color:#8a97a8;line-height:1.6;">
        — Eric<br>
        <a href="https://fixbroken.ai" style="color:#00d4ff;text-decoration:none;">fixbroken.ai</a>
      </p>
    </td></tr>
  `;
  return emailFrame(`Signal received · Ref ${entry.ref}`, inner);
}

/* ---- OWNER notification -------------------------------------------------- */
function ownerEmailText(entry) {
  return [
    'NEW SIGNAL',
    '',
    `Ref:     ${entry.ref}`,
    `When:    ${entry.ts}`,
    `Name:    ${entry.name || '(not provided)'}`,
    `Email:   ${entry.email}`,
    `Company: ${entry.company || '(not provided)'}`,
    `Type:    ${entry.type || '(not provided)'}`,
    '',
    '---',
    '',
    entry.message,
    '',
    '---',
    `IP: ${entry.ip}`,
    `UA: ${entry.ua || ''}`,
    '',
    'Reply-To is set — hit reply to respond to the submitter.'
  ].join('\n');
}
function ownerEmailHtml(entry) {
  const row = (k, v, kcolor, vcolor) => `
    <tr>
      <td style="padding:6px 0;width:90px;vertical-align:top;font-family:${EMAIL_FONT_MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${kcolor || '#556070'};">${esc(k)}</td>
      <td style="padding:6px 0;vertical-align:top;font-family:${EMAIL_FONT_MONO};font-size:13px;color:${vcolor || '#e4eaf2'};word-break:break-word;">${v}</td>
    </tr>
  `;
  const inner = `
    <tr><td style="padding:24px 28px 16px 28px;border-bottom:1px solid #2a3442;">
      <span style="font-family:${EMAIL_FONT_MONO};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#ff3ec9;">▸ new signal · <span style="color:#ffffff;">${esc(entry.ref)}</span></span>
    </td></tr>

    <tr><td style="padding:18px 28px 8px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('name',    esc(entry.name || '—'), '#556070', '#ffffff')}
        ${row('email',   `<a href="mailto:${esc(entry.email)}" style="color:#00d4ff;text-decoration:none;">${esc(entry.email)}</a>`)}
        ${row('company', esc(entry.company || '—'))}
        ${row('type',    esc(entry.type || '—'))}
        ${row('when',    esc(entry.ts))}
      </table>
    </td></tr>

    <tr><td style="padding:12px 28px 20px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0e14;border:1px solid #2a3442;border-radius:6px;">
        <tr><td style="padding:14px 18px 6px 18px;">
          <div style="font-family:${EMAIL_FONT_MONO};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8a97a8;">message</div>
        </td></tr>
        <tr><td style="padding:4px 18px 16px 18px;">
          <p style="margin:0;font-family:${EMAIL_FONT_SANS};font-size:15px;line-height:1.6;color:#e4eaf2;white-space:pre-wrap;">${esc(entry.message)}</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:14px 28px;background:#0a0e14;border-top:1px solid #2a3442;">
      <div style="font-family:${EMAIL_FONT_MONO};font-size:11px;color:#556070;line-height:1.7;">
        ip: ${esc(entry.ip || '—')}<br>
        ua: ${esc((entry.ua || '').slice(0, 140))}<br>
        <span style="color:#00d4ff;">reply-to is set — hit reply to respond directly.</span>
      </div>
    </td></tr>
  `;
  const preheader = `${entry.name || entry.email} · ${(entry.type || 'signal')} · ${entry.message.slice(0, 100)}`;
  return emailFrame(preheader, inner);
}

async function sendContactEmails(entry) {
  if (!transporter) return;

  // 1) Notification to the owner (MAIL_TO)
  try {
    await transporter.sendMail({
      from: mailFrom(),
      to: process.env.MAIL_TO || process.env.SMTP_USER,
      replyTo: entry.email,
      subject: `[fixbroken.ai] ${entry.type || 'contact'} · ${entry.name || entry.email} · ${entry.ref}`,
      text: ownerEmailText(entry),
      html: ownerEmailHtml(entry)
    });
  } catch (e) {
    console.error('owner mail err:', e.message);
  }

  // 2) Auto-reply to the submitter
  try {
    await transporter.sendMail({
      from: mailFrom(),
      to: entry.email,
      subject: `Signal received · ${entry.ref}`,
      text: submitterEmailText(entry),
      html: submitterEmailHtml(entry)
    });
  } catch (e) {
    console.error('auto-reply err:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Contact form endpoint
// ---------------------------------------------------------------------------
// Accepts JSON: { name, email, company, type, message }
// - email + message required
// - rate-limits one submission per IP every 30s
// - writes a JSONL entry to contact.log (always)
// - fires owner notification + auto-reply emails when SMTP is configured
// ---------------------------------------------------------------------------
const rateMap = new Map();
function rateLimitOK(ip) {
  const now = Date.now();
  const last = rateMap.get(ip) || 0;
  if (now - last < 30_000) return false;
  rateMap.set(ip, now);
  if (rateMap.size > 500) {
    for (const [k, v] of rateMap) if (now - v > 3600_000) rateMap.delete(k);
  }
  return true;
}

function genRef() {
  return 'FB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function clean(s, max) {
  return String(s == null ? '' : s).slice(0, max).trim();
}

app.post('/contact', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!rateLimitOK(ip)) {
    return res.status(429).json({ ok: false, err: 'rate_limited' });
  }

  const body = req.body || {};
  const email = clean(body.email, 200);
  const message = clean(body.message, 5000);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ ok: false, err: 'bad_email' });
  }
  if (!message || message.length < 4) {
    return res.status(400).json({ ok: false, err: 'bad_message' });
  }

  const entry = {
    ref: genRef(),
    ts: new Date().toISOString(),
    ip,
    ua: String(req.headers['user-agent'] || '').slice(0, 300),
    name: clean(body.name, 120),
    email,
    company: clean(body.company, 120),
    type: clean(body.type, 40),
    message
  };

  fs.appendFile(
    path.join(__dirname, 'contact.log'),
    JSON.stringify(entry) + '\n',
    { encoding: 'utf8', mode: 0o600 },
    (err) => {
      if (err) {
        console.error('contact log err:', err);
        return res.status(500).json({ ok: false, err: 'server' });
      }
      // Respond immediately; send emails in the background.
      // If SMTP fails the submission is still captured in contact.log.
      res.json({ ok: true, ref: entry.ref });
      sendContactEmails(entry).catch((e) => console.error('mail err:', e.message));
    }
  );
});

// ---------------------------------------------------------------------------
// Token usage endpoint — reads Claude Code transcripts
// ---------------------------------------------------------------------------
const TRANSCRIPT_DIR = path.join(require('os').homedir(), '.claude', 'projects');

function scanTranscripts() {
  const files = [];
  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.jsonl')) files.push(full);
      }
    } catch {}
  }
  walk(TRANSCRIPT_DIR);
  return files;
}

let usageCache = { now: Date.now(), windows: [], lifetime: {} };

function aggregateUsage() {
  const now = Date.now();

  const messages = [];
  for (const file of scanTranscripts()) {
    try {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const d = JSON.parse(line);
          if (d.message && d.message.usage) {
            const u = d.message.usage;
            const ts = d.timestamp || (d.message.created_at ? new Date(d.message.created_at).getTime() : 0);
            messages.push({
              ts: typeof ts === 'string' ? new Date(ts).getTime() : ts,
              input: u.input_tokens || 0,
              output: u.output_tokens || 0,
              cache_read: u.cache_read_input_tokens || 0,
              cache_create: u.cache_creation_input_tokens || 0
            });
          }
        } catch {}
      }
    } catch {}
  }

  const windows = [8, 42, 80, 800, 8000, 18000, 80000, 604800, 800000].map(sec => {
    const cutoff = now - sec * 1000;
    const inWindow = messages.filter(m => m.ts >= cutoff);
    const total = inWindow.reduce((s, m) => s + m.input + m.output + m.cache_read + m.cache_create, 0);
    const msgCount = inWindow.length;
    const rate = sec > 0 ? total / sec : 0;
    return {
      seconds: sec,
      messages: msgCount,
      input: inWindow.reduce((s, m) => s + m.input, 0),
      cache_create: inWindow.reduce((s, m) => s + m.cache_create, 0),
      cache_read: inWindow.reduce((s, m) => s + m.cache_read, 0),
      output: inWindow.reduce((s, m) => s + m.output, 0),
      total,
      billable: total,
      rate_per_sec: Math.round(rate),
      proj_hour: Math.round(rate * 3600),
      proj_day: Math.round(rate * 86400)
    };
  });

  const allTotal = messages.reduce((s, m) => s + m.input + m.output + m.cache_read + m.cache_create, 0);
  const firstTs = messages.length ? Math.min(...messages.map(m => m.ts)) : 0;
  const lastTs = messages.length ? Math.max(...messages.map(m => m.ts)) : 0;

  usageCache = {
    now,
    windows,
    lifetime: {
      messages: messages.length,
      input: messages.reduce((s, m) => s + m.input, 0),
      cache_create: messages.reduce((s, m) => s + m.cache_create, 0),
      cache_read: messages.reduce((s, m) => s + m.cache_read, 0),
      output: messages.reduce((s, m) => s + m.output, 0),
      total: allTotal,
      first_ts: firstTs,
      last_ts: lastTs
    }
  };
  return usageCache;
}

// Server-side poll: recompute every 2s, clients just read the snapshot
setInterval(() => { try { aggregateUsage(); } catch {} }, 2000);
aggregateUsage();

app.get('/api/usage', (_req, res) => {
  try {
    res.json(usageCache);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Audit API endpoint — programmatic page audits
// ---------------------------------------------------------------------------
// POST /api/audit  { html: "<html>..." }
// Returns audit findings, grade, and score.
// ---------------------------------------------------------------------------
let auditCore;
try {
  auditCore = require('./tools/audit-core');
} catch {}

if (auditCore) {
  app.post('/api/audit', (req, res) => {
    const { html } = req.body || {};
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ ok: false, err: 'missing html field' });
    }
    if (html.length > 500_000) {
      return res.status(413).json({ ok: false, err: 'html too large (max 500KB)' });
    }
    try {
      const result = auditCore.auditHtml(html);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  app.get('/api/audit', (_req, res) => {
    res.json({
      endpoint: 'POST /api/audit',
      body: '{ "html": "<html>...</html>" }',
      response: '{ ok: true, grade: "A", findings: [...], errors: 0, warns: 0, passes: N }',
    });
  });
}

// ---------------------------------------------------------------------------
// Manifest API endpoint — live design system data
// ---------------------------------------------------------------------------
app.get('/api/manifest', (_req, res) => {
  const manifestPath = path.join(__dirname, 'public', 'design', 'fixbroken-os.manifest.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    res.json(manifest);
  } catch (e) {
    res.status(500).json({ error: 'manifest not found — run npm run generate:manifest' });
  }
});

// ---------------------------------------------------------------------------
// Design system stats API
// ---------------------------------------------------------------------------
app.get('/api/stats', (_req, res) => {
  const manifestPath = path.join(__dirname, 'public', 'design', 'fixbroken-os.manifest.json');
  const cssPath = path.join(__dirname, 'public', 'design', 'fixbroken-os.css');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const css = fs.readFileSync(cssPath, 'utf8');
    const cssLines = css.split('\n').length;
    const tokenCount = Object.values(manifest.tokens).reduce((s, arr) => s + arr.length, 0);

    res.json({
      version: manifest.version,
      css: {
        lines: cssLines,
        bytes: Buffer.byteLength(css, 'utf8'),
        sections: 11,
      },
      tokens: tokenCount,
      tokenGroups: Object.keys(manifest.tokens).length,
      components: manifest.components.length,
      classes: manifest.allClasses.length,
      keyframes: manifest.keyframes.length,
      breakpoints: manifest.breakpoints,
      typography: manifest.typography.families.length,
      voice: {
        use: manifest.voice.use.length,
        avoid: manifest.voice.avoid.length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/ventures', (req, res) => res.redirect(301, '/work/'));
app.get('/ventures/', (req, res) => res.redirect(301, '/work/'));

// ---------------------------------------------------------------------------
// Console Audit — productized design system audit tool
// ---------------------------------------------------------------------------
const consoleAudit = require('./tools/console-audit');
const consoleRender = require('./tools/console-render');
const https = require('https');
const http = require('http');

const auditRateMap = new Map();
function auditRateLimitOK(ip) {
  const now = Date.now();
  const key = ip;
  const record = auditRateMap.get(key);
  const dayMs = 86400_000;
  if (!record || now - record.start > dayMs) {
    auditRateMap.set(key, { start: now, count: 1 });
    return true;
  }
  if (record.count >= 5) return false;
  record.count++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of auditRateMap) if (now - v.start > 86400_000) auditRateMap.delete(k);
}, 3600_000);

function fetchUrl(url, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith('https') ? https : http;
    var req = mod.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'FixBroken-Audit/1.0' } }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      var chunks = [];
      var size = 0;
      res.on('data', function(chunk) {
        size += chunk.length;
        if (size > 500000) { req.destroy(); reject(new Error('Response too large')); }
        chunks.push(chunk);
      });
      res.on('end', function() { resolve(Buffer.concat(chunks).toString('utf8')); });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractTextFromHtml(rawHtml) {
  var styles = [];
  rawHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, function(_, css) { styles.push(css); return ''; });
  var text = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return styles.join('\n\n') + '\n\n' + text;
}

app.post('/api/console/audit', function(req, res) {
  var ip = req.ip || 'unknown';
  if (!auditRateLimitOK(ip)) {
    return res.status(429).json({ ok: false, err: 'Rate limit reached (5 audits per day). Try again tomorrow.' });
  }

  var body = req.body || {};
  var mode = body.mode;
  var input = body.input;
  var isPrivate = body['private'];

  if (!mode || !input || typeof input !== 'string') {
    return res.status(400).json({ ok: false, err: 'Missing mode or input.' });
  }
  if (input.length > 500000) {
    return res.status(413).json({ ok: false, err: 'Input too large (max 500 KB).' });
  }

  if (consoleAudit.containsCredentials(input)) {
    return res.status(400).json({ ok: false, err: 'Your input contains what looks like API keys or credentials. Remove them and retry.' });
  }

  function processInput(rawText) {
    var sanitized = consoleAudit.sanitizeInput(rawText);
    var audit = consoleAudit.runAudit(sanitized);
    var migrationPrompt = consoleAudit.generateMigrationPrompt(audit);
    var slug = consoleAudit.generateSlug();
    var timestamp = new Date().toISOString();

    var resultHtml = consoleRender.renderAuditPage(audit, slug, {
      'private': isPrivate,
      timestamp: timestamp,
      inputSnippet: sanitized.slice(0, 300),
      migrationPrompt: migrationPrompt,
    });

    var manifest = {
      slug: slug,
      tool: 'audit',
      score: audit.score,
      maxScore: audit.maxScore,
      pct: audit.pct,
      verdict: audit.verdict,
      timestamp: timestamp,
      'private': !!isPrivate,
      inputStats: audit.inputStats,
    };

    var dir = path.join(__dirname, 'public', 'console', 'audit', slug);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), resultHtml, 'utf8');
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      fs.writeFileSync(path.join(dir, 'source.txt'), sanitized.slice(0, 100000), { encoding: 'utf8', mode: 0o600 });
    } catch (e) {
      return res.status(500).json({ ok: false, err: 'Failed to persist audit result.' });
    }

    res.json({
      ok: true,
      slug: slug,
      url: '/console/audit/' + slug + '/',
      score: audit.score,
      maxScore: audit.maxScore,
      pct: audit.pct,
    });
  }

  if (mode === 'url') {
    try { new URL(input); } catch (e) { return res.status(400).json({ ok: false, err: 'Invalid URL.' }); }
    fetchUrl(input).then(function(html) {
      processInput(extractTextFromHtml(html));
    }).catch(function(e) {
      res.status(502).json({ ok: false, err: 'Could not fetch URL: ' + e.message });
    });
  } else {
    processInput(input);
  }
});

// ---------------------------------------------------------------------------
// Console Voice Lint - banned phrase scanner
// ---------------------------------------------------------------------------
var consoleVoiceLint = require('./tools/console-voice-lint');

app.post('/api/console/voice-lint', function(req, res) {
  var ip = req.ip || 'unknown';
  if (!auditRateLimitOK(ip)) {
    return res.status(429).json({ ok: false, err: 'Rate limit reached (5 per day). Try again tomorrow.' });
  }

  var body = req.body || {};
  var input = body.input;
  var isPrivate = body['private'];

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ ok: false, err: 'Missing input.' });
  }
  if (input.length > 200000) {
    return res.status(413).json({ ok: false, err: 'Input too large (max 200 KB).' });
  }

  var lint = consoleVoiceLint.runVoiceLint(input);
  var slug = consoleAudit.generateSlug();
  var timestamp = new Date().toISOString();

  var resultHtml = consoleRender.renderVoiceLintPage(lint, slug, {
    'private': isPrivate,
    timestamp: timestamp,
    inputText: input,
    costCents: 1,
  });

  var manifest = {
    slug: slug,
    tool: 'voice-lint',
    hitCount: lint.hitCount,
    uniqueCount: lint.uniqueCount,
    wordCount: lint.wordCount,
    verdict: lint.verdict,
    timestamp: timestamp,
    'private': !!isPrivate,
  };

  var dir = path.join(__dirname, 'public', 'console', 'voice-lint', slug);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), resultHtml, 'utf8');
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'source.txt'), input.slice(0, 100000), { encoding: 'utf8', mode: 0o600 });
  } catch (e) {
    return res.status(500).json({ ok: false, err: 'Failed to persist result.' });
  }

  res.json({
    ok: true,
    slug: slug,
    url: '/console/voice-lint/' + slug + '/',
    hitCount: lint.hitCount,
    clean: lint.clean,
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, HOST, function() {
  console.log('fixbroken listening on http://' + HOST + ':' + PORT);
});
