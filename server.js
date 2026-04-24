const express = require('express');
const path = require('path');
const fs = require('fs');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Health check for monitoring
app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));

// Signup endpoint - append to flat log
app.post('/signup', (req, res) => {
  const entry = JSON.stringify({ ts: new Date().toISOString(), body: req.body }) + '\n';
  fs.appendFile(path.join(__dirname, 'signups.log'), entry, (err) => {
    if (err) return res.status(500).json({ ok: false });
    res.json({ ok: true });
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, HOST, () => {
  console.log(`fixbroken listening on http://${HOST}:${PORT}`);
});
