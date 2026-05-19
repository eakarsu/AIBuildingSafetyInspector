const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// GET /api/analytics/compliance-scorecard
// Returns overall compliance score, by OSHA category, monthly trend (12 months), top 5 recurring violations
router.get('/compliance-scorecard', auth, async (req, res) => {
  try {
    // 1. Overall compliance score: resolved vs total violations
    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
        COUNT(*) FILTER (WHERE status != 'resolved') AS open
      FROM violations
    `);
    const { total, resolved, open } = totalsResult.rows[0];
    const totalNum = parseInt(total) || 0;
    const resolvedNum = parseInt(resolved) || 0;
    const overallScore = totalNum > 0 ? Math.round((resolvedNum / totalNum) * 100) : 100;

    // 2. Score by OSHA standard category
    const categoryResult = await pool.query(`
      SELECT
        COALESCE(osha_standard, 'Uncategorized') AS osha_standard,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved
      FROM violations
      GROUP BY osha_standard
      ORDER BY total DESC
    `);
    const byCategory = categoryResult.rows.map(row => ({
      osha_standard: row.osha_standard,
      total: parseInt(row.total),
      resolved: parseInt(row.resolved),
      score: parseInt(row.total) > 0 ? Math.round((parseInt(row.resolved) / parseInt(row.total)) * 100) : 100
    }));

    // 3. Monthly trend — last 12 months (violations opened and resolved per month)
    const trendResult = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*) AS total_opened,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved
      FROM violations
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `);
    const trend = trendResult.rows.map(row => ({
      month: row.month,
      total_opened: parseInt(row.total_opened),
      resolved: parseInt(row.resolved),
      compliance_rate: parseInt(row.total_opened) > 0
        ? Math.round((parseInt(row.resolved) / parseInt(row.total_opened)) * 100)
        : 100
    }));

    // 4. Top 5 recurring violation types
    const recurringResult = await pool.query(`
      SELECT
        COALESCE(violation_code, 'Unknown') AS violation_code,
        COALESCE(title, description, 'Unknown Violation') AS violation_name,
        COUNT(*) AS occurrence_count,
        COUNT(*) FILTER (WHERE status != 'resolved') AS open_count
      FROM violations
      GROUP BY violation_code, title, description
      ORDER BY occurrence_count DESC
      LIMIT 5
    `);
    const topRecurring = recurringResult.rows.map(row => ({
      violation_code: row.violation_code,
      violation_name: row.violation_name,
      occurrence_count: parseInt(row.occurrence_count),
      open_count: parseInt(row.open_count)
    }));

    res.json({
      overall_compliance_score: overallScore,
      summary: {
        total_violations: totalNum,
        resolved_violations: resolvedNum,
        open_violations: parseInt(open) || 0
      },
      by_osha_category: byCategory,
      monthly_trend_12mo: trend,
      top_5_recurring_violations: topRecurring,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/processes
// Process/workflow analytics overview
router.get('/processes', auth, async (req, res) => {
  try {
    const inspResult = await pool.query('SELECT COUNT(*) AS total FROM site_inspections');
    const violResult = await pool.query('SELECT COUNT(*) AS total FROM violations');
    const incidentResult = await pool.query('SELECT COUNT(*) AS total FROM incident_reports');

    res.json({
      total_inspections: parseInt(inspResult.rows[0].total),
      total_violations: parseInt(violResult.rows[0].total),
      total_incidents: parseInt(incidentResult.rows[0].total),
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inspections/:id/report/pdf
// OSHA-formatted PDF inspection report
router.get('/inspections/:id/report/pdf', auth, async (req, res) => {
  try {
    const inspId = req.params.id;

    const inspResult = await pool.query('SELECT * FROM site_inspections WHERE id = $1', [inspId]);
    if (inspResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    const inspection = inspResult.rows[0];

    const violResult = await pool.query(
      'SELECT * FROM violations WHERE site_name = $1 ORDER BY severity DESC',
      [inspection.site_name]
    );
    const violations = violResult.rows;

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="inspection_report_${inspId}.pdf"`);
    doc.pipe(res);

    // ---- Header ----
    doc.fontSize(18).font('Helvetica-Bold').text('OSHA CONSTRUCTION SITE INSPECTION REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // ---- Site Information ----
    doc.fontSize(13).font('Helvetica-Bold').text('SITE INFORMATION');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Site Name: ${inspection.site_name || 'N/A'}`);
    doc.text(`Inspection Date: ${inspection.inspection_date ? new Date(inspection.inspection_date).toLocaleDateString() : 'N/A'}`);
    doc.text(`Inspection Type: ${inspection.inspection_type || 'N/A'}`);
    doc.text(`Overall Rating: ${inspection.overall_rating || 'N/A'}`);
    doc.moveDown(1);

    // ---- Inspector Details ----
    doc.fontSize(13).font('Helvetica-Bold').text('INSPECTOR DETAILS');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Inspector Name: ${inspection.inspector_name || 'N/A'}`);
    doc.text(`Inspector ID: ${inspection.inspector_id || 'N/A'}`);
    doc.moveDown(1);

    // ---- Findings Summary ----
    doc.fontSize(13).font('Helvetica-Bold').text('INSPECTION FINDINGS');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    const findings = inspection.findings || 'No findings recorded.';
    doc.text(findings, { width: doc.page.width - 100 });
    doc.moveDown(1);

    // ---- Violations Table ----
    doc.fontSize(13).font('Helvetica-Bold').text('VIOLATIONS');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);

    if (violations.length === 0) {
      doc.fontSize(10).font('Helvetica').text('No violations recorded for this site.');
    } else {
      // Table headers
      const colX = [50, 150, 260, 350, 450];
      const headers = ['OSHA Code', 'Title', 'Severity', 'Status', 'Corrective Action'];
      doc.fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: 95, lineBreak: false }));
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown(0.3);

      doc.fontSize(8).font('Helvetica');
      violations.forEach((v) => {
        if (doc.y > doc.page.height - 80) { doc.addPage(); }
        const rowY = doc.y;
        const cells = [
          v.osha_standard || v.violation_code || 'N/A',
          (v.title || 'N/A').substring(0, 30),
          v.severity || v.hazard_level || 'N/A',
          v.status || 'N/A',
          (v.corrective_action || 'N/A').substring(0, 40)
        ];
        cells.forEach((c, i) => doc.text(String(c), colX[i], rowY, { width: 95, lineBreak: false }));
        doc.moveDown(0.8);
      });
    }

    doc.moveDown(2);

    // ---- Sign-off Section ----
    doc.fontSize(13).font('Helvetica-Bold').text('SIGN-OFF & CERTIFICATION');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica');
    doc.text('I certify that this inspection report accurately reflects the conditions observed at the site.');
    doc.moveDown(2);
    doc.text('Inspector Signature: ________________________________    Date: ____________');
    doc.moveDown(1);
    doc.text('Site Supervisor Signature: ____________________________    Date: ____________');
    doc.moveDown(2);
    doc.fontSize(8).text('This report is prepared in accordance with 29 CFR 1926 (OSHA Construction Standards) and applicable federal and state regulations.', { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
