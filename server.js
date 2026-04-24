const express = require('express');
const path = require('path');
const fs = require('fs');

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
// Contact form endpoint
// ---------------------------------------------------------------------------
// Accepts JSON: { name, email, company, type, message }
// - email + message required
// - rate-limits one submission per IP every 30s
// - writes a JSONL entry to contact.log
// - returns { ok: true, ref: "FB-XXXXXX" } on success
// TODO: once Workspace MX is live for fixbroken.ai, also send an email
// notification to hello@fixbroken.ai using nodemailer (SMTP).
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
      res.json({ ok: true, ref: entry.ref });
    }
  );
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, HOST, () => {
  console.log(`fixbroken listening on http://${HOST}:${PORT}`);
});
