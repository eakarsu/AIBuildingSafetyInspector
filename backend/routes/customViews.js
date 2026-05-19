// Custom Views router — 4 endpoints for inspector custom dashboards.
// 2 VIZ: /risk-map, /inspection-trends
// 2 NON-VIZ: /inspection-report.pdf (pdfkit), /checklists (CRUD)
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// In-memory store for synthesized checklist item edits, keyed by checklist id.
const checklistEdits = new Map();

// ---------- VIZ 1: Floor / Site Risk Map ----------
// Builds an 8x6 grid per site from hazard_assessments + violations.
router.get('/risk-map', auth, async (req, res) => {
  try {
    const hazards = await pool.query(
      `SELECT site_name, location_detail, risk_level, hazard_type
         FROM hazard_assessments
        ORDER BY assessment_date DESC NULLS LAST
        LIMIT 400`
    );
    const violations = await pool.query(
      `SELECT site_name, location_detail, severity
         FROM violations
        WHERE status IS NULL OR status != 'resolved'
        LIMIT 400`
    );

    const score = (level) => {
      const l = String(level || '').toLowerCase();
      if (l.includes('extreme') || l.includes('critical')) return 5;
      if (l.includes('high')) return 4;
      if (l.includes('medium') || l.includes('moderate')) return 3;
      if (l.includes('low')) return 2;
      return 1;
    };

    const siteMap = new Map();
    const push = (key, zone) => {
      if (!siteMap.has(key)) siteMap.set(key, { site: key, zones: [], maxScore: 0 });
      const s = siteMap.get(key);
      s.zones.push(zone);
      if (zone.score > s.maxScore) s.maxScore = zone.score;
    };

    hazards.rows.forEach(h => {
      push(h.site_name || 'Unknown Site', {
        label: h.location_detail || h.hazard_type || 'hazard zone',
        type: 'hazard',
        risk: h.risk_level || 'Unknown',
        score: score(h.risk_level),
      });
    });
    violations.rows.forEach(v => {
      push(v.site_name || 'Unknown Site', {
        label: v.location_detail || 'violation zone',
        type: 'violation',
        risk: v.severity || 'Unknown',
        score: score(v.severity),
      });
    });

    const cols = 8, rows = 6;
    const sites = Array.from(siteMap.values()).slice(0, 12).map(site => {
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const z = site.zones.length ? site.zones[idx % site.zones.length] : null;
          cells.push({
            row: r,
            col: c,
            score: z ? z.score : 1,
            label: z ? z.label : 'safe',
            type: z ? z.type : 'safe',
          });
        }
      }
      return { site: site.site, maxScore: site.maxScore, rows, cols, cells, zoneCount: site.zones.length };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      siteCount: sites.length,
      sites,
    });
  } catch (err) {
    console.error('[custom-views] risk-map error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- VIZ 2: Inspection Trend Chart ----------
// Weekly inspection counts grouped by status + avg rating.
router.get('/inspection-trends', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT inspection_date, status, overall_rating
         FROM site_inspections
        WHERE inspection_date IS NOT NULL
        ORDER BY inspection_date ASC
        LIMIT 2000`
    );

    const buckets = new Map();
    const ratingMap = { excellent: 5, good: 4, satisfactory: 3, 'needs improvement': 2, poor: 1 };

    result.rows.forEach(r => {
      const d = new Date(r.inspection_date);
      if (Number.isNaN(d.getTime())) return;
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          week: key, total: 0, completed: 0, action_required: 0,
          pending: 0, in_progress: 0, avgRatingScore: 0, ratingCount: 0,
        });
      }
      const b = buckets.get(key);
      b.total += 1;
      const status = String(r.status || 'pending').toLowerCase();
      if (b[status] !== undefined) b[status] += 1;
      const rs = ratingMap[String(r.overall_rating || '').toLowerCase()];
      if (rs) {
        b.avgRatingScore += rs;
        b.ratingCount += 1;
      }
    });

    const series = Array.from(buckets.values())
      .map(b => ({
        ...b,
        avgRating: b.ratingCount ? +(b.avgRatingScore / b.ratingCount).toFixed(2) : null,
      }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-16);

    res.json({
      generatedAt: new Date().toISOString(),
      weekCount: series.length,
      totalInspections: series.reduce((s, w) => s + w.total, 0),
      series,
    });
  } catch (err) {
    console.error('[custom-views] inspection-trends error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- NON-VIZ 1: Inspection Report PDF (pdfkit) ----------
router.get('/inspection-report.pdf', auth, async (req, res) => {
  try {
    const inspections = await pool.query(
      `SELECT site_name, inspector_name, inspection_date, inspection_type,
              overall_rating, status, findings, recommendations, num_workers_onsite
         FROM site_inspections
        ORDER BY inspection_date DESC NULLS LAST
        LIMIT 25`
    );
    const violationCount = await pool.query(
      `SELECT COUNT(*)::int AS c
         FROM violations
        WHERE status IS NULL OR status != 'resolved'`
    );
    const incidentCount = await pool.query(
      `SELECT COUNT(*)::int AS c FROM incident_reports WHERE osha_recordable = true`
    );

    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="inspection-report.pdf"');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#1e3a8a').text('Building Safety Inspection Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#555').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(13).fillColor('#000').text('Executive Summary');
    doc.fontSize(10).fillColor('#333').text(
      `Total inspections analyzed: ${inspections.rows.length}\n` +
      `Open / unresolved violations: ${violationCount.rows[0].c}\n` +
      `OSHA-recordable incidents: ${incidentCount.rows[0].c}`
    );
    doc.moveDown();

    doc.fontSize(13).fillColor('#000').text('Recent Inspections');
    doc.moveDown(0.3);

    inspections.rows.forEach((r, i) => {
      doc.fontSize(11).fillColor('#1e40af').text(`${i + 1}. ${r.site_name || 'Unknown site'}`);
      doc.fontSize(9).fillColor('#333').text(
        `Inspector: ${r.inspector_name || '-'}  |  ` +
        `Date: ${r.inspection_date ? new Date(r.inspection_date).toLocaleDateString() : '-'}  |  ` +
        `Type: ${r.inspection_type || '-'}  |  ` +
        `Rating: ${r.overall_rating || '-'}  |  ` +
        `Status: ${r.status || '-'}  |  ` +
        `Workers: ${r.num_workers_onsite ?? '-'}`
      );
      if (r.findings) doc.fontSize(9).fillColor('#555').text(`Findings: ${String(r.findings).slice(0, 240)}`);
      if (r.recommendations) doc.fontSize(9).fillColor('#555').text(`Recommendations: ${String(r.recommendations).slice(0, 240)}`);
      doc.moveDown(0.4);
    });

    doc.end();
  } catch (err) {
    console.error('[custom-views] inspection-report error', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ---------- NON-VIZ 2: Checklist Template Editor (CRUD) ----------
// GET: list checklists + synthesized item arrays
router.get('/checklists', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, checklist_name, site_name, category, assigned_to, due_date,
              completion_percentage, status, total_items, completed_items, priority, notes
         FROM safety_checklists
        ORDER BY due_date ASC NULLS LAST
        LIMIT 50`
    );

    const templates = [
      'PPE compliance verified', 'Fire extinguishers accessible', 'Emergency exits clear',
      'Fall protection in place', 'Scaffolding inspected', 'Electrical panels labeled',
      'First aid kit stocked', 'Material storage secured', 'Hazmat properly tagged',
      'Toolbox talk completed', 'Site signage posted', 'Excavation barriers up',
    ];

    const checklists = r.rows.map(c => {
      const total = Math.max(c.total_items || 8, 1);
      const completed = c.completed_items || 0;
      const override = checklistEdits.get(c.id);
      const items = [];
      for (let i = 0; i < total; i++) {
        const o = override && override[i];
        items.push({
          index: i,
          label: o?.label || templates[i % templates.length],
          checked: o?.checked !== undefined ? !!o.checked : i < completed,
        });
      }
      return { ...c, items };
    });

    res.json({ count: checklists.length, checklists });
  } catch (err) {
    console.error('[custom-views] checklists list error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT: update items for a checklist (in-memory + persist stats)
router.put('/checklists/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const { items } = req.body || {};
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    const sanitized = items.map((it, i) => ({
      index: i,
      label: String(it?.label || '').slice(0, 200) || `Item ${i + 1}`,
      checked: !!it?.checked,
    }));
    checklistEdits.set(id, sanitized);

    const completed = sanitized.filter(i => i.checked).length;
    const total = sanitized.length;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    await pool.query(
      `UPDATE safety_checklists
          SET completed_items = $1,
              total_items = $2,
              completion_percentage = $3
        WHERE id = $4`,
      [completed, total, pct, id]
    );

    res.json({ ok: true, id, completed, total, completion_percentage: pct });
  } catch (err) {
    console.error('[custom-views] checklists update error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
