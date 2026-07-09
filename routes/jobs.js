// routes/jobs.js — job board API.
//   GET  /api/jobs             open listings (public)
//   GET  /api/jobs/:slug       one listing (public)
//   POST /api/jobs             create (admin — email in ADMIN_EMAILS)
//   PATCH /api/jobs/:id        update fields / close (admin)
//   POST /api/jobs/:slug/apply apply (signed-in users)
//   GET  /api/me/applications  the caller's applications

const express = require('express');
const { requireAuth, requireAdmin, requireJson, rateLimit } = require('../lib/auth');

const JOB_FIELDS = 'id, slug, title, summary, description, location, job_type, status, created_at';

function slugify(title) {
  return String(title).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'role';
}

function cleanText(raw, max) {
  const s = String(raw == null ? '' : raw).trim().slice(0, max);
  return s || null;
}

module.exports = function jobsRoutes(db) {
  const router = express.Router();
  const applyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

  router.get('/api/jobs', async (_req, res) => {
    try {
      const result = await db.query(
        `SELECT ${JOB_FIELDS} FROM jobs WHERE status = 'open' ORDER BY created_at DESC, id DESC`
      );
      res.json({ ok: true, jobs: result.rows });
    } catch (e) {
      console.error('jobs list failed:', e.message);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  router.get('/api/jobs/:slug', async (req, res) => {
    try {
      const result = await db.query(
        `SELECT ${JOB_FIELDS} FROM jobs WHERE slug = $1`, [req.params.slug]
      );
      if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, job: result.rows[0] });
    } catch (e) {
      console.error('job get failed:', e.message);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  router.post('/api/jobs', requireAdmin, requireJson, async (req, res) => {
    try {
      const title = cleanText(req.body.title, 140);
      if (!title) return res.status(400).json({ ok: false, error: 'title_required' });
      const base = slugify(title);
      // Uniquify the slug if taken: role, role-2, role-3, …
      let slug = base;
      for (let i = 2; ; i++) {
        const clash = await db.query('SELECT 1 FROM jobs WHERE slug = $1', [slug]);
        if (clash.rowCount === 0) break;
        slug = `${base}-${i}`;
      }
      const status = ['open', 'draft', 'closed'].includes(req.body.status) ? req.body.status : 'open';
      const inserted = await db.query(
        `INSERT INTO jobs (slug, title, summary, description, location, job_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${JOB_FIELDS}`,
        [slug, title, cleanText(req.body.summary, 300), cleanText(req.body.description, 8000),
         cleanText(req.body.location, 120), cleanText(req.body.job_type, 60), status]
      );
      res.status(201).json({ ok: true, job: inserted.rows[0] });
    } catch (e) {
      console.error('job create failed:', e.message);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  router.patch('/api/jobs/:id', requireAdmin, requireJson, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'bad_id' });
      const allowed = {
        title: (v) => cleanText(v, 140),
        summary: (v) => cleanText(v, 300),
        description: (v) => cleanText(v, 8000),
        location: (v) => cleanText(v, 120),
        job_type: (v) => cleanText(v, 60),
        status: (v) => (['open', 'draft', 'closed'].includes(v) ? v : null)
      };
      const sets = [];
      const params = [];
      for (const [field, clean] of Object.entries(allowed)) {
        if (field in req.body) {
          const value = clean(req.body[field]);
          if (field === 'status' && value === null) {
            return res.status(400).json({ ok: false, error: 'bad_status' });
          }
          params.push(value);
          sets.push(`${field} = $${params.length}`);
        }
      }
      if (sets.length === 0) return res.status(400).json({ ok: false, error: 'no_fields' });
      params.push(id);
      const updated = await db.query(
        `UPDATE jobs SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING ${JOB_FIELDS}`,
        params
      );
      if (updated.rowCount === 0) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, job: updated.rows[0] });
    } catch (e) {
      console.error('job update failed:', e.message);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  router.post('/api/jobs/:slug/apply', requireAuth, applyLimiter, requireJson, async (req, res) => {
    try {
      const job = await db.query(
        "SELECT id FROM jobs WHERE slug = $1 AND status = 'open'", [req.params.slug]
      );
      if (job.rowCount === 0) return res.status(404).json({ ok: false, error: 'not_found' });
      const jobId = job.rows[0].id;
      const userId = req.session.user.id;
      const dup = await db.query(
        'SELECT 1 FROM applications WHERE job_id = $1 AND user_id = $2', [jobId, userId]
      );
      if (dup.rowCount > 0) return res.status(409).json({ ok: false, error: 'already_applied' });
      const link = cleanText(req.body.link, 300);
      if (link && !/^https?:\/\//i.test(link)) {
        return res.status(400).json({ ok: false, error: 'bad_link' });
      }
      const inserted = await db.query(
        `INSERT INTO applications (job_id, user_id, note, link)
         VALUES ($1, $2, $3, $4) RETURNING id, job_id, note, link, status, created_at`,
        [jobId, userId, cleanText(req.body.note, 2000), link]
      );
      res.status(201).json({ ok: true, application: inserted.rows[0] });
    } catch (e) {
      console.error('apply failed:', e.message);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  router.get('/api/me/applications', requireAuth, async (req, res) => {
    try {
      const result = await db.query(
        `SELECT a.id, a.note, a.link, a.status, a.created_at, j.title, j.slug
           FROM applications a JOIN jobs j ON j.id = a.job_id
          WHERE a.user_id = $1 ORDER BY a.created_at DESC, a.id DESC`,
        [req.session.user.id]
      );
      res.json({ ok: true, applications: result.rows });
    } catch (e) {
      console.error('my applications failed:', e.message);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  return router;
};
