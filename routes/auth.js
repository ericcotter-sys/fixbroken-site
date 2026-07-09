// routes/auth.js — registration, login, logout, session introspection, and
// Google SSO (OAuth 2.0 authorization-code flow with PKCE, hand-rolled on
// global fetch — no SDK dependency).
//
// Env contract:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — from Google Cloud Console
//     (authorized redirect URI: <BASE_URL>/auth/google/callback)
//   BASE_URL — e.g. https://fixbroken.ai (defaults to localhost for dev)
//   GOOGLE_AUTH_URL / GOOGLE_TOKEN_URL — overridable for tests only.

const express = require('express');
const crypto = require('crypto');
const {
  hashPassword, verifyPassword, requireJson, rateLimit,
  cleanEmail, cleanName, safeNext, publicUser, isAdmin
} = require('../lib/auth');

const GOOGLE_AUTH_URL = process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';

function baseUrl() {
  return (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeJwtPayload(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = function authRoutes(db) {
  const router = express.Router();
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

  // --- session introspection ----------------------------------------------
  router.get('/auth/me', (req, res) => {
    const user = (req.session && req.session.user) || null;
    res.json({ ok: true, user, admin: user ? isAdmin(req) : false });
  });

  // --- email + password ----------------------------------------------------
  router.post('/auth/register', authLimiter, requireJson, async (req, res) => {
    try {
      const email = cleanEmail(req.body.email);
      const name = cleanName(req.body.name);
      const password = String(req.body.password || '');
      if (!email) return res.status(400).json({ ok: false, error: 'invalid_email' });
      if (password.length < 10 || password.length > 200) {
        return res.status(400).json({ ok: false, error: 'weak_password' });
      }
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount > 0) {
        return res.status(409).json({ ok: false, error: 'email_taken' });
      }
      const hash = await hashPassword(password);
      const inserted = await db.query(
        'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
        [email, name, hash]
      );
      req.session.user = publicUser(inserted.rows[0]);
      res.status(201).json({ ok: true, user: req.session.user });
    } catch (e) {
      console.error('register failed:', e.message);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  router.post('/auth/login', authLimiter, requireJson, async (req, res) => {
    try {
      const email = cleanEmail(req.body.email);
      const password = String(req.body.password || '');
      if (!email || !password) return res.status(400).json({ ok: false, error: 'invalid_credentials' });
      const result = await db.query(
        'SELECT id, email, name, password_hash FROM users WHERE email = $1', [email]
      );
      const row = result.rows[0];
      const valid = row ? await verifyPassword(password, row.password_hash) : false;
      if (!valid) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
      req.session.user = publicUser(row);
      res.json({ ok: true, user: req.session.user });
    } catch (e) {
      console.error('login failed:', e.message);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  router.post('/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  // --- Google SSO -----------------------------------------------------------
  router.get('/auth/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ ok: false, error: 'google_sso_not_configured' });
    }
    const state = b64url(crypto.randomBytes(24));
    const verifier = b64url(crypto.randomBytes(48));
    req.session.oauth = {
      state,
      verifier,
      next: safeNext(req.query.next, '/account/')
    };
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${baseUrl()}/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });
    res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
  });

  router.get('/auth/google/callback', async (req, res) => {
    const fail = (reason) => {
      console.error('google callback failed:', reason);
      res.redirect('/account/?error=google');
    };
    try {
      const pending = req.session.oauth;
      delete req.session.oauth;
      if (!pending || !req.query.code || req.query.state !== pending.state) {
        return fail('state_mismatch');
      }
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${baseUrl()}/auth/google/callback`,
          grant_type: 'authorization_code',
          code_verifier: pending.verifier
        })
      });
      if (!tokenRes.ok) return fail(`token_exchange_${tokenRes.status}`);
      const tokens = await tokenRes.json();

      // The id_token arrives directly from Google's token endpoint over TLS,
      // so decoding without JWKS signature verification is standard practice —
      // we still verify the issuer, audience, and expiry claims.
      const claims = decodeJwtPayload(tokens.id_token);
      if (!claims) return fail('bad_id_token');
      const issOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
      if (!issOk || claims.aud !== process.env.GOOGLE_CLIENT_ID) return fail('claim_mismatch');
      if (!claims.exp || claims.exp * 1000 < Date.now()) return fail('token_expired');
      if (!claims.sub || !claims.email || claims.email_verified === false) return fail('unverified_email');

      const email = cleanEmail(claims.email);
      if (!email) return fail('bad_email');
      const name = cleanName(claims.name);

      // Match by google_sub first; else link to an existing email account;
      // else create. (select-then-write, not ON CONFLICT — pg-mem compatible.)
      let user;
      const bySub = await db.query(
        'SELECT id, email, name FROM users WHERE google_sub = $1', [claims.sub]
      );
      if (bySub.rowCount > 0) {
        user = bySub.rows[0];
      } else {
        const byEmail = await db.query('SELECT id, email, name FROM users WHERE email = $1', [email]);
        if (byEmail.rowCount > 0) {
          await db.query('UPDATE users SET google_sub = $1 WHERE id = $2', [claims.sub, byEmail.rows[0].id]);
          user = byEmail.rows[0];
        } else {
          const inserted = await db.query(
            'INSERT INTO users (email, name, google_sub) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, name, claims.sub]
          );
          user = inserted.rows[0];
        }
      }
      req.session.user = publicUser(user);
      res.redirect(safeNext(pending.next, '/account/'));
    } catch (e) {
      fail(e.message);
    }
  });

  return router;
};
