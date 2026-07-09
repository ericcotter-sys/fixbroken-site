// lib/db.js — Postgres pool + migration runner.
//
// Modes (selected by DATABASE_URL):
//   * unset            → db.enabled = false; auth/jobs endpoints answer 503.
//   * "memory"         → pg-mem in-process Postgres (dev harness, no install).
//   * postgres://...   → real pool via node-pg. Set DATABASE_SSL=true for
//                        managed hosts that require TLS (Lightsail, Neon, …).
//
// Migrations live in db/migrations/*.sql, applied in filename order, tracked
// in _migrations. Statements are split on trailing semicolons — keep the SQL
// files free of functions/triggers (pg-mem can't run them anyway).

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';
const MEMORY = DATABASE_URL === 'memory';

let pool = null;

if (MEMORY) {
  const { newDb } = require('pg-mem');
  const mem = newDb();
  const adapter = mem.adapters.createPg();
  pool = new adapter.Pool();
  console.log('DB: pg-mem (in-memory dev harness — data resets on restart)');
} else if (DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: (process.env.DATABASE_SSL || '').toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10
  });
  pool.on('error', (e) => console.error('DB pool error:', e.message));
} else {
  console.log('DB not configured — set DATABASE_URL to enable accounts + jobs');
}

async function migrate() {
  if (!pool) return;
  await pool.query(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (done.rowCount > 0) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    // Split on semicolon-at-end-of-statement; ignore comment-only fragments.
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s && !s.split('\n').every((line) => line.trim().startsWith('--') || !line.trim()));
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    console.log('DB migration applied:', file);
  }
}

module.exports = {
  enabled: !!pool,
  memory: MEMORY,
  pool,
  query: (text, params) => pool.query(text, params),
  migrate
};
