/**
 * Training routes: base CRUD + training gap analysis
 */
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

// GET all training records
router.get('/', auth, async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = 'SELECT * FROM safety_training';
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(training_title::text ILIKE $${params.length} OR training_type::text ILIKE $${params.length} OR instructor::text ILIKE $${params.length} OR site_name::text ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY id DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET training by id
router.get('/gaps', auth, async (req, res) => {
  /**
   * Returns workers who are missing required training by role.
   * Required training matrix by role:
   *   - All workers: OSHA 10-Hour, Fall Protection, Hazard Communication
   *   - Supervisors: additionally OSHA 30-Hour, First Aid/CPR
   *   - Equipment operators: additionally Powered Industrial Trucks, Aerial Work Platform
   */
  try {
    // Get all workers (from certifications or training records as a proxy)
    const workersResult = await pool.query(`
      SELECT DISTINCT worker_name, worker_role, site_name
      FROM worker_certifications
      WHERE worker_name IS NOT NULL
    `);

    // Get all completed training
    const trainingResult = await pool.query(`
      SELECT DISTINCT worker_name, training_title, training_type, completion_date
      FROM safety_training
      WHERE status = 'completed' AND worker_name IS NOT NULL
    `);

    const completedTraining = trainingResult.rows;

    const requiredByRole = {
      default: ['OSHA 10-Hour', 'Fall Protection', 'Hazard Communication'],
      supervisor: ['OSHA 10-Hour', 'OSHA 30-Hour', 'Fall Protection', 'Hazard Communication', 'First Aid/CPR'],
      foreman: ['OSHA 10-Hour', 'OSHA 30-Hour', 'Fall Protection', 'Hazard Communication', 'First Aid/CPR'],
      equipment_operator: ['OSHA 10-Hour', 'Fall Protection', 'Hazard Communication', 'Powered Industrial Trucks', 'Aerial Work Platform']
    };

    const gaps = workersResult.rows.map(worker => {
      const role = (worker.worker_role || '').toLowerCase();
      const required = requiredByRole[role] || requiredByRole.default;

      const workerCompleted = completedTraining
        .filter(t => t.worker_name === worker.worker_name)
        .map(t => t.training_title);

      const missing = required.filter(req =>
        !workerCompleted.some(comp => comp.toLowerCase().includes(req.toLowerCase()))
      );

      return {
        worker_name: worker.worker_name,
        worker_role: worker.worker_role || 'Unknown',
        site_name: worker.site_name,
        required_training: required,
        completed_training: workerCompleted,
        missing_training: missing,
        compliance_pct: required.length > 0
          ? Math.round(((required.length - missing.length) / required.length) * 100)
          : 100
      };
    });

    // Sort: most gaps first
    gaps.sort((a, b) => b.missing_training.length - a.missing_training.length);

    res.json({
      total_workers_analyzed: gaps.length,
      workers_with_gaps: gaps.filter(g => g.missing_training.length > 0).length,
      gaps,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single training record
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM safety_training WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create training record
router.post('/',
  auth,
  [
    body('training_title').notEmpty().withMessage('training_title is required').isString().trim(),
    body('training_type').notEmpty().withMessage('training_type is required').isString().trim(),
    body('completion_date').optional().isISO8601().withMessage('completion_date must be a valid date'),
    body('worker_name').optional().isString().trim(),
    body('worker_role').optional().isString().trim(),
    body('site_name').optional().isString().isLength({ max: 100 }).trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const values = keys.map(k => req.body[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const result = await pool.query(
        `INSERT INTO safety_training (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT update training record
router.put('/:id', auth, async (req, res) => {
  try {
    const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    const values = keys.map(k => req.body[k]);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE safety_training SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE training record
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM safety_training WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
