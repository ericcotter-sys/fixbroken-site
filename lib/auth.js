// lib/auth.js — password hashing (Node crypto.scrypt, zero deps), session
// helpers, guards, and a small in-memory rate limiter for the auth endpoints.

const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString('base64')}:${key.toString('base64')}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    if (!stored) return resolve(false);
    const parts = stored.split(':');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return resolve(false);
    const [, N, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    crypto.scrypt(password, salt, expected.length, { N: +N, r: +r, p: +p }, (err, key) => {
      if (err) return resolve(false);
      resolve(key.length === expected.length && crypto.timingSafeEqual(key, expected));
    });
  });
}

// --- guards ----------------------------------------------------------------

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ ok: false, error: 'auth_required' });
}

function isAdmin(req) {
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!(req.session && req.session.user && admins.includes(req.session.user.email));
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, error: 'auth_required' });
  if (!isAdmin(req)) return res.status(403).json({ ok: false, error: 'admin_only' });
  next();
}

// Mutating JSON endpoints must be called with a JSON content type. Cross-site
// HTML forms can't send application/json without a CORS preflight, so combined
// with sameSite=lax cookies this closes the classic CSRF hole without tokens.
function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ ok: false, error: 'json_required' });
  }
  next();
}

// --- rate limiter ----------------------------------------------------------
// Sliding window per IP, in-memory (single-process app; resets on restart).

function rateLimit({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      return res.status(429).json({ ok: false, error: 'rate_limited' });
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 10000) hits.clear(); // crude memory cap
    next();
  };
}

// --- validation ------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

function cleanName(raw) {
  const name = String(raw || '').trim().slice(0, 120);
  return name || null;
}

// Only allow same-site relative redirect targets ("/jobs/", not "//evil.com").
function safeNext(raw, fallback) {
  const next = String(raw || '');
  return /^\/(?!\/)/.test(next) ? next : fallback;
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name };
}

module.exports = {
  hashPassword, verifyPassword,
  requireAuth, requireAdmin, requireJson, isAdmin,
  rateLimit, cleanEmail, cleanName, safeNext, publicUser
};
