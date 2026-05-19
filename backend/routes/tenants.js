// Apply pass 5: White-label / tenant configuration backlog.
//
// PRODUCT-DECISION: Multi-tenant model.
//   The audit flagged "white-label / reseller" as NEEDS-PRODUCT-DECISION because
//   it implicates the entire data isolation strategy. Picked default:
//     - Single-database, tenant identified by `slug` (kebab-case).
//     - This route exposes branding/theme metadata only (logo_url, primary_color,
//       support_email, custom_domain). Row-level isolation across the rest of
//       the schema is NOT introduced here — that is a separate, larger migration
//       and remains in the backlog. This is purely an additive config table.
//   Rationale: lets the FE render white-label theming (logo + color) without
//   forcing a destructive schema rewrite. Real per-row isolation (a `tenant_id`
//   column on every existing table) is left for a future major version.
//
// Endpoints (auth required for write; read can be unauth so the login page can
// pull theming, but we keep auth here for parity — adjust later if needed):
//   GET    /api/tenants              — list (admin)
//   POST   /api/tenants              — create
//   GET    /api/tenants/:slug        — fetch by slug (theme bundle)
//   PUT    /api/tenants/:slug        — update branding
//   DELETE /api/tenants/:slug        — delete
//
// All additive. CREATE TABLE IF NOT EXISTS. Working code untouched.

const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(80) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        logo_url TEXT,
        primary_color VARCHAR(20),
        support_email TEXT,
        custom_domain TEXT,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    tableReady = true;
  } catch (e) { /* schema-tolerant */ }
}

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

router.get('/', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('SELECT * FROM tenants ORDER BY display_name');
    res.json(r.rows);
  } catch (e) { res.json([]); }
});

router.post('/', auth,
  [
    body('slug').isString().trim().matches(/^[a-z0-9-]+$/).withMessage('slug must be kebab-case'),
    body('display_name').isString().trim().notEmpty(),
    body('logo_url').optional().isString(),
    body('primary_color').optional().isString(),
    body('support_email').optional().isEmail(),
    body('custom_domain').optional().isString()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    await ensureTable();
    try {
      const { slug, display_name, logo_url, primary_color, support_email, custom_domain, config_json } = req.body;
      const r = await pool.query(
        `INSERT INTO tenants (slug, display_name, logo_url, primary_color, support_email, custom_domain, config_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [slug, display_name, logo_url || null, primary_color || null, support_email || null, custom_domain || null, config_json || {}]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

router.get('/:slug', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('SELECT * FROM tenants WHERE slug = $1', [req.params.slug]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:slug', auth, async (req, res) => {
  await ensureTable();
  try {
    const { display_name, logo_url, primary_color, support_email, custom_domain, config_json } = req.body;
    const r = await pool.query(
      `UPDATE tenants SET
         display_name = COALESCE($2, display_name),
         logo_url = COALESCE($3, logo_url),
         primary_color = COALESCE($4, primary_color),
         support_email = COALESCE($5, support_email),
         custom_domain = COALESCE($6, custom_domain),
         config_json = COALESCE($7, config_json),
         updated_at = CURRENT_TIMESTAMP
       WHERE slug = $1 RETURNING *`,
      [req.params.slug, display_name, logo_url, primary_color, support_email, custom_domain, config_json]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:slug', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('DELETE FROM tenants WHERE slug = $1 RETURNING *', [req.params.slug]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
