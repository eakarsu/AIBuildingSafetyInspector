/**
 * Extended incidents route with full input validation.
 * Mounted at /api/incidents-extended
 * The original /api/incidents is a CRUD stub for backward compat.
 */
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const VALID_INCIDENT_TYPES = ['near_miss', 'first_aid', 'recordable', 'fatality'];

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

// POST create incident with full validation
router.post('/',
  auth,
  [
    body('date')
      .notEmpty().withMessage('date is required')
      .isISO8601().withMessage('date must be a valid ISO 8601 date'),
    body('type')
      .notEmpty().withMessage('type is required')
      .isIn(VALID_INCIDENT_TYPES).withMessage(`type must be one of: ${VALID_INCIDENT_TYPES.join(', ')}`),
    body('description')
      .notEmpty().withMessage('description is required')
      .isString()
      .isLength({ max: 5000 }).withMessage('description must be 5000 characters or fewer')
      .trim(),
    body('injured_workers')
      .optional()
      .isInt({ min: 0 }).withMessage('injured_workers must be a non-negative integer'),
    body('root_cause')
      .optional()
      .isString()
      .isLength({ max: 2000 }).withMessage('root_cause must be 2000 characters or fewer')
      .trim(),
    body('site_name')
      .optional()
      .isString()
      .isLength({ max: 100 }).withMessage('site_name must be 100 characters or fewer')
      .trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const {
        date,
        type,
        description,
        injured_workers,
        root_cause,
        site_name,
        title,
        severity,
        incident_number
      } = req.body;

      const result = await pool.query(
        `INSERT INTO incident_reports
          (incident_date, incident_type, description, injured_workers, root_cause, site_name, title, severity, incident_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [date, type, description, injured_workers || 0, root_cause || null, site_name || null, title || null, severity || null, incident_number || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET incidents list
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incident_reports ORDER BY incident_date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET incident by id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incident_reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
