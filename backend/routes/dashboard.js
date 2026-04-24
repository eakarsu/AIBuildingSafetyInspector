const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [
      inspections,
      violations,
      incidents,
      checklists,
      equipment,
      certifications,
      training,
      hazards,
      documents,
      emergency,
      ppe,
      corrections,
      analyses,
      reports
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'completed\') as completed, COUNT(*) FILTER (WHERE status = \'action_required\') as action_required FROM site_inspections'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'open\') as open, COUNT(*) FILTER (WHERE severity = \'critical\') as critical, COALESCE(SUM(fine_amount) FILTER (WHERE status = \'open\'), 0) as total_fines FROM violations'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'under_investigation\') as investigating, COUNT(*) FILTER (WHERE osha_recordable = true) as recordable FROM incident_reports'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'overdue\') as overdue, ROUND(AVG(completion_percentage)) as avg_completion FROM safety_checklists'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'needs_repair\') as needs_repair, COUNT(*) FILTER (WHERE status = \'out_of_service\') as out_of_service FROM equipment_inspections'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE expiry_date < NOW()) as expired, COUNT(*) FILTER (WHERE expiry_date < NOW() + INTERVAL \'30 days\') as expiring_soon FROM worker_certifications'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'scheduled\') as upcoming, COUNT(*) FILTER (WHERE status = \'completed\') as completed FROM safety_training'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE risk_level = \'extreme\') as extreme, COUNT(*) FILTER (WHERE risk_level = \'high\') as high FROM hazard_assessments'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'expired\') as expired FROM compliance_documents'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'needs_update\') as needs_update FROM emergency_plans'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'low_stock\') as low_stock FROM ppe_inventory'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'open\') as open, COUNT(*) FILTER (WHERE status = \'in_progress\') as in_progress FROM corrective_actions'),
      pool.query('SELECT COUNT(*) as total FROM ai_analyses'),
      pool.query('SELECT COUNT(*) as total FROM daily_reports')
    ]);

    res.json({
      inspections: inspections.rows[0],
      violations: violations.rows[0],
      incidents: incidents.rows[0],
      checklists: checklists.rows[0],
      equipment: equipment.rows[0],
      certifications: certifications.rows[0],
      training: training.rows[0],
      hazards: hazards.rows[0],
      documents: documents.rows[0],
      emergency: emergency.rows[0],
      ppe: ppe.rows[0],
      corrections: corrections.rows[0],
      analyses: analyses.rows[0],
      reports: reports.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
