const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const https = require('https');
const http = require('http');

function makeRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function callOpenRouter(prompt, context = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  const body = JSON.stringify({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert AI Building Safety Inspector assistant. Provide detailed, professional safety analysis, recommendations, and assessments. Use construction safety standards (OSHA, NFPA, ANSI) in your responses. Format your responses with clear sections and bullet points.'
      },
      {
        role: 'user',
        content: context ? `Context:\n${context}\n\nRequest:\n${prompt}` : prompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.7
  });

  const url = new URL(baseUrl + '/chat/completions');
  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Building Safety Inspector'
    }
  };

  const response = await makeRequest(url.toString(), options, body);

  if (response.status !== 200) {
    throw new Error(`OpenRouter API error: ${JSON.stringify(response.data)}`);
  }

  return response.data.choices[0].message.content;
}

// Analyze a specific site
router.post('/analyze-site', auth, async (req, res) => {
  try {
    const { site_name } = req.body;

    const [inspections, violations, incidents] = await Promise.all([
      pool.query('SELECT * FROM site_inspections WHERE site_name = $1 ORDER BY inspection_date DESC LIMIT 5', [site_name]),
      pool.query('SELECT * FROM violations WHERE site_name = $1 AND status != $2', [site_name, 'resolved']),
      pool.query('SELECT * FROM incident_reports WHERE site_name = $1 ORDER BY incident_date DESC LIMIT 5', [site_name])
    ]);

    const context = `
Site: ${site_name}
Recent Inspections: ${JSON.stringify(inspections.rows)}
Open Violations: ${JSON.stringify(violations.rows)}
Recent Incidents: ${JSON.stringify(incidents.rows)}
    `;

    const aiResponse = await callOpenRouter(
      `Provide a comprehensive safety analysis for this construction site. Include:
      1. Overall Safety Score (0-100)
      2. Key Risk Areas
      3. Immediate Action Items
      4. Compliance Status
      5. Recommendations for improvement`,
      context
    );

    const saved = await pool.query(
      'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      ['site_analysis', `Site Analysis - ${site_name}`, site_name, context, aiResponse, process.env.OPENROUTER_MODEL, 'completed', req.user.full_name]
    );

    res.json(saved.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Risk assessment
router.post('/risk-assessment', auth, async (req, res) => {
  try {
    const { description, site_name } = req.body;

    const hazards = await pool.query('SELECT * FROM hazard_assessments WHERE site_name = $1', [site_name]);

    const context = `Site: ${site_name}\nExisting Hazards: ${JSON.stringify(hazards.rows)}\nNew Activity: ${description}`;

    const aiResponse = await callOpenRouter(
      `Perform a detailed risk assessment for this new activity at the construction site. Include:
      1. Identified Hazards
      2. Risk Level (Low/Medium/High/Extreme)
      3. Probability and Impact ratings
      4. Required Control Measures
      5. Required PPE
      6. OSHA Standards applicable
      7. Recommended safety procedures`,
      context
    );

    const saved = await pool.query(
      'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      ['risk_assessment', `Risk Assessment - ${site_name}`, site_name, context, aiResponse, process.env.OPENROUTER_MODEL, 'completed', req.user.full_name]
    );

    res.json(saved.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Compliance check
router.post('/compliance-check', auth, async (req, res) => {
  try {
    const { site_name } = req.body;

    const [docs, violations, certs, training] = await Promise.all([
      pool.query('SELECT * FROM compliance_documents WHERE site_name = $1', [site_name]),
      pool.query('SELECT * FROM violations WHERE site_name = $1', [site_name]),
      pool.query('SELECT * FROM worker_certifications WHERE site_name = $1', [site_name]),
      pool.query('SELECT * FROM safety_training WHERE site_name = $1 OR site_name IS NULL', [site_name])
    ]);

    const context = `
Site: ${site_name}
Documents: ${JSON.stringify(docs.rows)}
Violations: ${JSON.stringify(violations.rows)}
Worker Certifications: ${JSON.stringify(certs.rows)}
Training Records: ${JSON.stringify(training.rows)}
    `;

    const aiResponse = await callOpenRouter(
      `Perform a comprehensive OSHA compliance check for this site. Include:
      1. Compliance Score (0-100%)
      2. Expired or missing permits/documents
      3. Worker certification gaps
      4. Training deficiencies
      5. Outstanding violations and estimated fine exposure
      6. Recommended actions by priority
      7. Timeline for achieving full compliance`,
      context
    );

    const saved = await pool.query(
      'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      ['compliance_check', `Compliance Check - ${site_name}`, site_name, context, aiResponse, process.env.OPENROUTER_MODEL, 'completed', req.user.full_name]
    );

    res.json(saved.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Incident prediction
router.post('/predict-incidents', auth, async (req, res) => {
  try {
    const incidents = await pool.query('SELECT * FROM incident_reports ORDER BY incident_date DESC');
    const hazards = await pool.query('SELECT * FROM hazard_assessments WHERE status = $1', ['active']);

    const context = `
All Incidents: ${JSON.stringify(incidents.rows)}
Active Hazards: ${JSON.stringify(hazards.rows)}
    `;

    const aiResponse = await callOpenRouter(
      `Based on historical incident data and active hazards, provide:
      1. Predicted high-risk areas for the next 30 days
      2. Incident type probability ranking
      3. Sites most likely to have incidents
      4. Seasonal/weather risk factors
      5. Preventive recommendations by priority
      6. Resource allocation suggestions`,
      context
    );

    const saved = await pool.query(
      'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      ['incident_prediction', 'Incident Prediction Analysis', 'All Sites', context, aiResponse, process.env.OPENROUTER_MODEL, 'completed', req.user.full_name]
    );

    res.json(saved.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate inspection report
router.post('/generate-report', auth, async (req, res) => {
  try {
    const { site_name, report_type } = req.body;

    const [inspections, violations, incidents, checklists] = await Promise.all([
      pool.query('SELECT * FROM site_inspections WHERE site_name = $1 ORDER BY inspection_date DESC', [site_name]),
      pool.query('SELECT * FROM violations WHERE site_name = $1', [site_name]),
      pool.query('SELECT * FROM incident_reports WHERE site_name = $1', [site_name]),
      pool.query('SELECT * FROM safety_checklists WHERE site_name = $1', [site_name])
    ]);

    const context = `
Site: ${site_name}
Report Type: ${report_type}
Inspections: ${JSON.stringify(inspections.rows)}
Violations: ${JSON.stringify(violations.rows)}
Incidents: ${JSON.stringify(incidents.rows)}
Checklists: ${JSON.stringify(checklists.rows)}
    `;

    const aiResponse = await callOpenRouter(
      `Generate a professional ${report_type} safety report for this construction site. Include:
      1. Executive Summary
      2. Inspection History and Findings
      3. Violation Status and Trends
      4. Incident Summary and Root Cause Analysis
      5. Safety Checklist Compliance
      6. Risk Assessment Summary
      7. Recommendations and Action Items
      8. Conclusion and Next Steps`,
      context
    );

    const saved = await pool.query(
      'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      ['report_generation', `${report_type} Report - ${site_name}`, site_name, context, aiResponse, process.env.OPENROUTER_MODEL, 'completed', req.user.full_name]
    );

    res.json(saved.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Custom AI query
router.post('/custom-query', auth, async (req, res) => {
  try {
    const { query, site_name } = req.body;
    let context = '';

    if (site_name) {
      const [inspections, violations, incidents] = await Promise.all([
        pool.query('SELECT * FROM site_inspections WHERE site_name = $1', [site_name]),
        pool.query('SELECT * FROM violations WHERE site_name = $1', [site_name]),
        pool.query('SELECT * FROM incident_reports WHERE site_name = $1', [site_name])
      ]);
      context = `Site: ${site_name}\nInspections: ${JSON.stringify(inspections.rows)}\nViolations: ${JSON.stringify(violations.rows)}\nIncidents: ${JSON.stringify(incidents.rows)}`;
    }

    const aiResponse = await callOpenRouter(query, context);

    const saved = await pool.query(
      'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      ['custom_query', `Custom Query${site_name ? ' - ' + site_name : ''}`, site_name || 'General', query, aiResponse, process.env.OPENROUTER_MODEL, 'completed', req.user.full_name]
    );

    res.json(saved.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all analyses
router.get('/analyses', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_analyses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get analysis by id
router.get('/analyses/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_analyses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete analysis
router.delete('/analyses/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM ai_analyses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
