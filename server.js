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

function ownerEmailBody(entry) {
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

function submitterEmailBody(entry) {
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

async function sendContactEmails(entry) {
  if (!transporter) return;

  // 1) Notification to the owner (MAIL_TO)
  try {
    await transporter.sendMail({
      from: mailFrom(),
      to: process.env.MAIL_TO || process.env.SMTP_USER,
      replyTo: entry.email,
      subject: `[fixbroken.ai] ${entry.type || 'contact'} · ${entry.name || entry.email} · ${entry.ref}`,
      text: ownerEmailBody(entry)
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
      text: submitterEmailBody(entry)
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

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, HOST, () => {
  console.log(`fixbroken listening on http://${HOST}:${PORT}`);
});
