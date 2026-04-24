const router = require('express').Router;
const pool = require('../db');
const auth = require('../middleware/auth');

function createCrudRoutes(tableName, { searchColumns = [], orderBy = 'id DESC' } = {}) {
  const r = router();

  // GET all
  r.get('/', auth, async (req, res) => {
    try {
      const { search, status } = req.query;
      let query = `SELECT * FROM ${tableName}`;
      const params = [];
      const conditions = [];

      if (search && searchColumns.length > 0) {
        params.push(`%${search}%`);
        const searchClauses = searchColumns.map(col => `${col}::text ILIKE $${params.length}`);
        conditions.push(`(${searchClauses.join(' OR ')})`);
      }
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ` ORDER BY ${orderBy}`;
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET by id
  r.get('/:id', auth, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create
  r.post('/', auth, async (req, res) => {
    try {
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const values = keys.map(k => req.body[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const result = await pool.query(
        `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT update
  r.put('/:id', auth, async (req, res) => {
    try {
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const values = keys.map(k => req.body[k]);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      values.push(req.params.id);
      // Try with updated_at, fall back without
      let query = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`;
      try {
        const testResult = await pool.query(
          `UPDATE ${tableName} SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
          values
        );
        res.json(testResult.rows[0] || {});
        return;
      } catch {
        // Table doesn't have updated_at, use basic query
      }
      const result = await pool.query(query, values);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  r.delete('/:id', auth, async (req, res) => {
    try {
      const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return r;
}

module.exports = createCrudRoutes;
