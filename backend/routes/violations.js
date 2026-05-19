const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const VALID_HAZARD_LEVELS = ['low', 'medium', 'high', 'critical'];

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

// GET all violations
router.get('/', auth, async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = 'SELECT * FROM violations';
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(violation_code::text ILIKE $${params.length} OR title::text ILIKE $${params.length} OR site_name::text ILIKE $${params.length} OR severity::text ILIKE $${params.length} OR description::text ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY id DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET violation by id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM violations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create violation — with input validation
router.post('/',
  auth,
  [
    body('site_name')
      .notEmpty().withMessage('site_name is required')
      .isString()
      .isLength({ max: 100 }).withMessage('site_name must be 100 characters or fewer')
      .trim(),
    body('hazard_level')
      .notEmpty().withMessage('hazard_level is required')
      .isIn(VALID_HAZARD_LEVELS).withMessage(`hazard_level must be one of: ${VALID_HAZARD_LEVELS.join(', ')}`),
    body('osha_standard')
      .notEmpty().withMessage('osha_standard is required when submitting violations')
      .isString()
      .trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const values = keys.map(k => req.body[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const result = await pool.query(
        `INSERT INTO violations (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT update violation
router.put('/:id',
  auth,
  [
    body('site_name').optional().isString().isLength({ max: 100 }).trim(),
    body('hazard_level').optional().isIn(VALID_HAZARD_LEVELS).withMessage(`hazard_level must be one of: ${VALID_HAZARD_LEVELS.join(', ')}`)
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const values = keys.map(k => req.body[k]);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      values.push(req.params.id);
      const result = await pool.query(
        `UPDATE violations SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE violation
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM violations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
