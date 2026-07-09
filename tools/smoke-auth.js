#!/usr/bin/env node
// tools/smoke-auth.js — end-to-end auth smoke test, no external services.
// Boots server.js against pg-mem and a mock Google token endpoint, then
// exercises register/login/session + the full Google SSO code flow.
//
//   node tools/smoke-auth.js

const http = require('http');
const { spawn } = require('child_process');

const APP_PORT = 3112;
const MOCK_PORT = 3199;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const CLIENT_ID = 'test-client-id';

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  → ' + detail}`);
  if (!ok) failures++;
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

// Unsigned JWT is fine here: the app trusts the token endpoint TLS channel and
// verifies claims (iss/aud/exp), not the signature — mirror that contract.
function fakeIdToken(claims) {
  return `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}.sig`;
}

function mockGoogle() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/token') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          access_token: 'mock-access',
          id_token: fakeIdToken({
            iss: 'https://accounts.google.com',
            aud: CLIENT_ID,
            exp: Math.floor(Date.now() / 1000) + 3600,
            sub: 'google-sub-123',
            email: 'SSO.Person@Example.com',
            email_verified: true,
            name: 'SSO Person'
          })
        }));
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    srv.listen(MOCK_PORT, '127.0.0.1', () => resolve(srv));
  });
}

function startApp() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: require('path').join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(APP_PORT),
        DATABASE_URL: 'memory',
        SESSION_SECRET: 'smoke-test-secret',
        BASE_URL: BASE,
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: 'test-secret',
        GOOGLE_TOKEN_URL: `http://127.0.0.1:${MOCK_PORT}/token`,
        GOOGLE_AUTH_URL: `http://127.0.0.1:${MOCK_PORT}/auth`
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let booted = false;
    child.stdout.on('data', (d) => {
      if (!booted && String(d).includes('listening')) { booted = true; resolve(child); }
    });
    child.stderr.on('data', (d) => process.stderr.write(`[app] ${d}`));
    setTimeout(() => { if (!booted) { child.kill(); reject(new Error('app did not boot')); } }, 8000);
  });
}

// Minimal cookie jar around fetch (redirect: 'manual' everywhere).
function jar() {
  const cookies = new Map();
  return {
    absorb(res) {
      const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const c of set) {
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
  };
}

async function main() {
  const mock = await mockGoogle();
  const app = await startApp();
  try {
    // --- email + password round trip ---------------------------------------
    const j = jar();
    const reg = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pw User', email: 'pw@example.com', password: 'longenough-pass' })
    });
    j.absorb(reg);
    check('register returns 201', reg.status === 201, `got ${reg.status}`);

    const me1 = await (await fetch(`${BASE}/auth/me`, { headers: { Cookie: j.header() } })).json();
    check('session persists after register', me1.user && me1.user.email === 'pw@example.com', JSON.stringify(me1));

    const badLogin = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pw@example.com', password: 'wrong-password' })
    });
    check('wrong password rejected 401', badLogin.status === 401, `got ${badLogin.status}`);

    const dupReg = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pw@example.com', password: 'longenough-pass' })
    });
    check('duplicate email rejected 409', dupReg.status === 409, `got ${dupReg.status}`);

    // --- Google SSO code flow ----------------------------------------------
    const g = jar();
    const start = await fetch(`${BASE}/auth/google?next=/jobs/`, { redirect: 'manual' });
    g.absorb(start);
    const loc = start.headers.get('location') || '';
    check('SSO start redirects to auth URL', start.status === 302 && loc.startsWith(`http://127.0.0.1:${MOCK_PORT}/auth`), loc);
    const authUrl = new URL(loc);
    check('SSO start sends PKCE challenge', authUrl.searchParams.get('code_challenge_method') === 'S256', loc);
    const state = authUrl.searchParams.get('state');

    // state mismatch must fail
    const evil = await fetch(`${BASE}/auth/google/callback?code=abc&state=WRONG`, {
      redirect: 'manual', headers: { Cookie: g.header() }
    });
    check('state mismatch rejected', (evil.headers.get('location') || '').includes('error=google'), evil.headers.get('location'));

    // session consumed the oauth state above — restart the flow for the good path
    const start2 = await fetch(`${BASE}/auth/google?next=/jobs/`, { redirect: 'manual', headers: { Cookie: g.header() } });
    g.absorb(start2);
    const state2 = new URL(start2.headers.get('location')).searchParams.get('state');

    const cb = await fetch(`${BASE}/auth/google/callback?code=abc&state=${state2}`, {
      redirect: 'manual', headers: { Cookie: g.header() }
    });
    g.absorb(cb);
    check('SSO callback redirects to next', cb.status === 302 && cb.headers.get('location') === '/jobs/', cb.headers.get('location'));

    const me2 = await (await fetch(`${BASE}/auth/me`, { headers: { Cookie: g.header() } })).json();
    check('SSO session set, email lowercased', me2.user && me2.user.email === 'sso.person@example.com', JSON.stringify(me2));
  } finally {
    app.kill();
    mock.close();
  }
  console.log(failures === 0 ? '\nsmoke-auth: ALL PASS' : `\nsmoke-auth: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
