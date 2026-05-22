const express = require('express');

const router = express.Router();

let rows = [
  {
    id: 1,
    permit_number: 'BLD-2026-1187',
    site_name: 'Riverfront Tower',
    inspector_name: 'M. Chen',
    closeout_stage: 'Final inspection',
    readiness_score: 88,
    blocking_items: 2,
    priority: 'high',
    status: 'action_required',
    next_action: 'Upload fire marshal signoff and elevator certificate.',
  },
  {
    id: 2,
    permit_number: 'MEP-2026-0412',
    site_name: 'North Clinic Fitout',
    inspector_name: 'A. Patel',
    closeout_stage: 'Documentation review',
    readiness_score: 96,
    blocking_items: 0,
    priority: 'medium',
    status: 'ready',
    next_action: 'Schedule final closeout meeting with AHJ.',
  },
];

const nextId = () => rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

router.get('/', (req, res) => res.json(rows));
router.post('/', (req, res) => {
  const row = { id: nextId(), ...req.body };
  rows.unshift(row);
  res.status(201).json(row);
});
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = rows.findIndex((row) => row.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  rows[idx] = { ...rows[idx], ...req.body, id };
  res.json(rows[idx]);
});
router.delete('/:id', (req, res) => {
  rows = rows.filter((row) => row.id !== Number(req.params.id));
  res.json({ message: 'deleted' });
});

module.exports = router;
