const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const https = require('https');
const http = require('http');
const multer = require('multer');
const { body, query: queryValidator, validationResult } = require('express-validator');

// ------- Multer config: memory storage, images only, max 10MB -------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// ------- Validation helpers -------
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

// ------- HTTP helper -------
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

// ------- OpenRouter helpers -------
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

// Vision call: accepts image buffer + mediaType
async function callOpenRouterVision(imageBuffer, mediaType, prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  // Use a vision-capable model
  const model = 'anthropic/claude-3-5-sonnet-20241022';

  const base64Image = imageBuffer.toString('base64');

  const body = JSON.stringify({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an OSHA-certified safety inspector. Analyze construction site photos for safety violations and hazards.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ],
    max_tokens: 2000,
    temperature: 0.3
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
    throw new Error(`OpenRouter Vision API error: ${JSON.stringify(response.data)}`);
  }

  return response.data.choices[0].message.content;
}

// ------- EXISTING ROUTES (unchanged logic, with added validation) -------

// Analyze a specific site
router.post('/analyze-site',
  auth,
  [
    body('site_name')
      .notEmpty().withMessage('site_name is required')
      .isString()
      .isLength({ max: 100 }).withMessage('site_name must be 100 characters or fewer')
      .trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
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
  }
);

// Risk assessment
router.post('/risk-assessment',
  auth,
  [
    body('site_name')
      .notEmpty().withMessage('site_name is required')
      .isString()
      .isLength({ max: 100 }).withMessage('site_name must be 100 characters or fewer')
      .trim(),
    body('description').notEmpty().withMessage('description is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
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
  }
);

// Compliance check
router.post('/compliance-check',
  auth,
  [
    body('site_name')
      .notEmpty().withMessage('site_name is required')
      .isString()
      .isLength({ max: 100 }).withMessage('site_name must be 100 characters or fewer')
      .trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
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
  }
);

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
router.post('/generate-report',
  auth,
  [
    body('site_name')
      .notEmpty().withMessage('site_name is required')
      .isString()
      .isLength({ max: 100 }).withMessage('site_name must be 100 characters or fewer')
      .trim(),
    body('report_type').notEmpty().withMessage('report_type is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
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
  }
);

// Custom AI query
router.post('/custom-query',
  auth,
  [
    body('query').notEmpty().withMessage('query is required').isString().trim(),
    body('site_name').optional().isString().isLength({ max: 100 }).trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
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
  }
);

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

// ------- NEW: Photo upload for inspections with vision AI -------
router.post('/inspections/:id/photos',
  auth,
  upload.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
      }

      const inspectionId = req.params.id;

      // Verify inspection exists
      const inspResult = await pool.query('SELECT * FROM site_inspections WHERE id = $1', [inspectionId]);
      if (inspResult.rows.length === 0) {
        return res.status(404).json({ error: 'Inspection not found' });
      }

      const inspection = inspResult.rows[0];
      const mediaType = req.file.mimetype;

      const visionPrompt = `You are an OSHA-certified safety inspector. Analyze this construction site photo for safety violations. Identify:
- hazard_type: the type of hazard observed
- osha_violation_code: the relevant OSHA standard code (e.g., 29 CFR 1926.502 for fall protection)
- severity: one of [critical, serious, moderate, minor]
- affected_workers: number or description of workers at risk
- immediate_action_required: what must be done immediately
- corrective_steps: numbered list of corrective actions to resolve the violation

Respond in structured JSON format.`;

      const visionAnalysis = await callOpenRouterVision(req.file.buffer, mediaType, visionPrompt);

      // Save analysis back to inspection record
      await pool.query(
        `UPDATE site_inspections SET photo_analysis = $1, updated_at = NOW() WHERE id = $2`,
        [visionAnalysis, inspectionId]
      );

      // Also log to ai_analyses
      await pool.query(
        'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          'photo_analysis',
          `Photo Analysis - Inspection #${inspectionId}`,
          inspection.site_name || 'Unknown',
          `Inspection ID: ${inspectionId}, File: ${req.file.originalname}, Size: ${req.file.size} bytes`,
          visionAnalysis,
          'anthropic/claude-3-5-sonnet-20241022',
          'completed',
          req.user.full_name
        ]
      );

      res.json({
        inspection_id: inspectionId,
        filename: req.file.originalname,
        size_bytes: req.file.size,
        media_type: mediaType,
        analysis: visionAnalysis
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ------- NEW: Analyze incident with AI -------
router.post('/analyze-incident',
  auth,
  [
    body('incident_id').notEmpty().withMessage('incident_id is required')
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { incident_id } = req.body;

      const incidentResult = await pool.query('SELECT * FROM incident_reports WHERE id = $1', [incident_id]);
      if (incidentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      const incident = incidentResult.rows[0];

      // Fetch related incidents for pattern analysis
      const relatedIncidents = await pool.query(
        'SELECT * FROM incident_reports WHERE site_name = $1 AND id != $2 ORDER BY incident_date DESC LIMIT 10',
        [incident.site_name, incident_id]
      );

      const context = `
Incident Details:
${JSON.stringify(incident, null, 2)}

Related Incidents at Same Site:
${JSON.stringify(relatedIncidents.rows, null, 2)}
      `;

      const prompt = `Perform a comprehensive OSHA incident analysis. Provide:

1. OSHA Recordability Determination
   - Is this incident OSHA recordable? (Yes/No with reasoning)
   - Applicable OSHA recordkeeping standard (29 CFR 1904)
   - Record type: injury/illness, days away, restricted duty, or other

2. DART Rate Calculation
   - Days Away, Restricted, or Transferred (DART) rate formula: (DART cases × 200,000) / total hours worked
   - Estimated DART cases from this and related incidents
   - Benchmark comparison to industry average

3. Root Cause Analysis
   - Immediate cause (direct cause of incident)
   - Contributing factors (management systems, work conditions)
   - Root causes (underlying systemic issues)
   - Using 5-Why methodology

4. Systemic Cause Identification
   - Safety management gaps
   - Training deficiencies
   - Equipment/PPE failures
   - Environmental factors
   - Policy/procedure gaps

5. Corrective Action Plan
   - Immediate actions (0-24 hours)
   - Short-term actions (1-30 days)
   - Long-term preventive measures (1-6 months)
   - Responsible parties and target dates
   - Verification methods

Respond in structured format with clear headings.`;

      const aiResponse = await callOpenRouter(prompt, context);

      const saved = await pool.query(
        'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [
          'incident_analysis',
          `Incident Analysis - ${incident.title || incident.incident_number || incident_id}`,
          incident.site_name || 'Unknown',
          context,
          aiResponse,
          process.env.OPENROUTER_MODEL,
          'completed',
          req.user.full_name
        ]
      );

      res.json(saved.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ------- NEW: SSE streaming for site analysis -------
router.get('/analyze-site/stream',
  auth,
  [
    queryValidator('siteId').notEmpty().withMessage('siteId query parameter is required')
  ],
  async (req, res) => {
    if (validate(req, res)) return;

    const siteId = req.query.siteId;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      send('status', { step: 1, message: 'Fetching site inspection history...' });

      const [inspections, violations, incidents, hazards] = await Promise.all([
        pool.query('SELECT * FROM site_inspections WHERE site_name = $1 ORDER BY inspection_date DESC LIMIT 10', [siteId]),
        pool.query('SELECT * FROM violations WHERE site_name = $1', [siteId]),
        pool.query('SELECT * FROM incident_reports WHERE site_name = $1 ORDER BY incident_date DESC LIMIT 10', [siteId]),
        pool.query('SELECT * FROM hazard_assessments WHERE site_name = $1 AND status = $2', [siteId, 'active'])
      ]);

      send('status', { step: 2, message: `Loaded ${inspections.rows.length} inspections, ${violations.rows.length} violations, ${incidents.rows.length} incidents` });

      send('status', { step: 3, message: 'Analyzing violations and compliance status...' });

      const openViolations = violations.rows.filter(v => v.status !== 'resolved');
      const totalViolations = violations.rows.length;
      const complianceScore = totalViolations > 0
        ? Math.round(((totalViolations - openViolations.length) / totalViolations) * 100)
        : 100;

      send('data', {
        step: 3,
        compliance_score: complianceScore,
        open_violations: openViolations.length,
        total_violations: totalViolations
      });

      send('status', { step: 4, message: 'Running AI safety analysis...' });

      const context = `
Site: ${siteId}
Recent Inspections (last 10): ${JSON.stringify(inspections.rows)}
Open Violations: ${JSON.stringify(openViolations)}
Recent Incidents (last 10): ${JSON.stringify(incidents.rows)}
Active Hazards: ${JSON.stringify(hazards.rows)}
      `;

      const aiResponse = await callOpenRouter(
        `Provide a comprehensive safety analysis for this construction site. Include:
        1. Overall Safety Score (0-100)
        2. Critical Risk Areas requiring immediate attention
        3. Compliance Status per OSHA standard categories
        4. Trend analysis from recent inspections
        5. Top 3 immediate action items
        6. Recommendations for improvement`,
        context
      );

      send('status', { step: 5, message: 'Saving analysis to database...' });

      const saved = await pool.query(
        'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        ['site_analysis_stream', `Site Analysis (Stream) - ${siteId}`, siteId, context, aiResponse, process.env.OPENROUTER_MODEL, 'completed', req.user.full_name]
      );

      send('result', {
        step: 6,
        analysis_id: saved.rows[0].id,
        ai_response: aiResponse,
        compliance_score: complianceScore
      });

      send('done', { message: 'Analysis complete' });
    } catch (err) {
      send('error', { message: err.message });
    } finally {
      res.end();
    }
  }
);

// ===========================================================
// NEW PROPOSED FEATURES (Audit report — frontend & AI surface)
// ===========================================================

async function persistAnalysis({ analysis_type, title, site_name, input_data, ai_response, requested_by }) {
  try {
    const saved = await pool.query(
      'INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [analysis_type, title, site_name || 'N/A', input_data, ai_response, process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5', 'completed', requested_by || 'system']
    );
    return saved.rows[0];
  } catch (e) {
    return { id: null, ai_response, title, analysis_type };
  }
}

// 1. Safety Culture Scorecard
router.post('/culture-scorecard', auth,
  [body('site_name').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { site_name, near_misses, safety_meetings_count, behavioral_observations, reporting_rate } = req.body;

      const [incidents, training] = await Promise.all([
        pool.query('SELECT incident_type, severity, COUNT(*) AS c FROM incident_reports WHERE site_name=$1 GROUP BY 1,2', [site_name]).catch(() => ({ rows: [] })),
        pool.query('SELECT training_type, COUNT(*) AS c FROM safety_training WHERE site_name=$1 GROUP BY 1', [site_name]).catch(() => ({ rows: [] })),
      ]);

      const context = `Site: ${site_name}
Near misses reported: ${near_misses || 'unknown'}
Safety meetings (last 30 days): ${safety_meetings_count || 'unknown'}
Behavioral observations: ${behavioral_observations || 'unknown'}
Worker reporting rate: ${reporting_rate || 'unknown'}
Incident counts by type: ${JSON.stringify(incidents.rows)}
Training counts: ${JSON.stringify(training.rows)}`;

      const aiResponse = await callOpenRouter(
        `Score this site's safety culture. Provide:
1. Culture Score (0-100) with 4 sub-scores: Reporting, Engagement, Leadership Visibility, Continuous Improvement
2. Trend analysis vs typical construction site benchmarks
3. Top 3 culture improvement areas with concrete actions (30/60/90 day plan)
4. Recommended KPIs to track monthly`,
        context
      );

      const saved = await persistAnalysis({ analysis_type: 'culture_scorecard', title: `Culture Scorecard - ${site_name}`, site_name, input_data: context, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 2. Equipment Maintenance Predictor
router.post('/equipment-maintenance-predict', auth,
  [body('equipment_id').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { equipment_id } = req.body;
      const eq = await pool.query('SELECT * FROM equipment_inspections WHERE equipment_id=$1 ORDER BY inspection_date DESC', [equipment_id]).catch(() => ({ rows: [] }));
      const ctx = `Equipment ID: ${equipment_id}\nInspection history:\n${JSON.stringify(eq.rows, null, 2)}`;

      const aiResponse = await callOpenRouter(
        `Predict the next maintenance window for this equipment. Provide:
1. Predicted next maintenance date with confidence level
2. Predicted failure risk (low/medium/high) and which subsystems
3. Recommended preventive actions in priority order
4. Estimated downtime cost savings vs reactive maintenance
5. Replacement vs repair recommendation if at end-of-life`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'equipment_maintenance', title: `Maintenance Prediction - ${equipment_id}`, site_name: eq.rows[0]?.site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 3. Worker Competency Matcher
router.post('/competency-match', auth,
  [body('task_description').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { task_description, site_name, required_certifications } = req.body;
      const certs = await pool.query(
        site_name ? 'SELECT * FROM worker_certifications WHERE site_name=$1 AND status=$2' : 'SELECT * FROM worker_certifications WHERE status=$1',
        site_name ? [site_name, 'active'] : ['active']
      ).catch(() => ({ rows: [] }));

      const ctx = `Task: ${task_description}
Site: ${site_name || 'any'}
Required certifications: ${required_certifications || 'auto-detect from task'}
Available worker certifications: ${JSON.stringify(certs.rows)}`;

      const aiResponse = await callOpenRouter(
        `Match worker competencies to this task. Provide:
1. Required certifications & training (with OSHA references)
2. Best-matched workers with reasoning
3. Skill gaps that prevent assignment
4. Recommended training to close gaps (with course references)
5. Risk of mismatch if task assigned without closing gaps`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'competency_match', title: `Competency Match - ${task_description.slice(0, 40)}`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 4. Environmental Hazard Monitor
router.post('/environmental-monitor', auth,
  [body('site_name').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { site_name, weather_forecast, air_quality_index, noise_db, temperature_f } = req.body;
      const ctx = `Site: ${site_name}
Weather forecast: ${weather_forecast || 'n/a'}
Air Quality Index: ${air_quality_index || 'n/a'}
Noise levels (dB): ${noise_db || 'n/a'}
Temperature (F): ${temperature_f || 'n/a'}`;

      const aiResponse = await callOpenRouter(
        `Analyze environmental conditions for safety risks. Provide:
1. Heat/Cold stress risk (with NIOSH/OSHA threshold references)
2. Air quality risk and respiratory PPE recommendations
3. Noise exposure risk and hearing protection requirements
4. Weather-related risks (lightning, wind, precipitation) with stop-work thresholds
5. Recommended schedule adjustments (rest cycles, shift timing) for next 24-72h`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'environmental_monitor', title: `Environmental Monitor - ${site_name}`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 5. Accident Cost Calculator
router.post('/accident-cost-calculator', auth,
  [body('incident_type').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { incident_type, severity, days_lost, medical_cost, equipment_damage, intervention_cost } = req.body;
      const ctx = `Incident type: ${incident_type}
Severity: ${severity || 'unspecified'}
Days lost: ${days_lost || 0}
Direct medical cost: ${medical_cost || 'unknown'}
Equipment damage: ${equipment_damage || 'unknown'}
Proposed intervention cost: ${intervention_cost || 'unknown'}`;

      const aiResponse = await callOpenRouter(
        `Calculate the full cost of this accident scenario:
1. Direct costs (medical, workers' comp, equipment, fines)
2. Indirect costs (productivity, schedule slip, training replacement, reputation, investigation hours) — use Bird's 4:1 to 50:1 ratio with reasoning
3. Total estimated cost (range)
4. ROI of proposed intervention: payback period, NPV @ 5% over 3 years
5. Comparable interventions ranked by cost-benefit`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'accident_cost', title: `Accident Cost - ${incident_type}`, site_name: null, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 6. Contractor Vetting Assistant
router.post('/contractor-vetting', auth,
  [body('contractor_name').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { contractor_name, insurance_summary, references, incident_history, scope_of_work } = req.body;
      const ctx = `Contractor: ${contractor_name}
Insurance: ${insurance_summary || 'not provided'}
References: ${references || 'not provided'}
Past incidents: ${incident_history || 'not provided'}
Scope: ${scope_of_work || 'not provided'}`;

      const aiResponse = await callOpenRouter(
        `Vet this contractor. Provide:
1. Reliability Score (0-100) with sub-scores: Insurance, Safety Record, References, Financial Stability
2. Red flags identified (any missing/expired coverage, prior OSHA violations, lawsuit risks)
3. Required prequalification documents (with checklist)
4. Recommended onboarding controls (orientation, badging, escort requirements)
5. Final recommendation: Approve / Approve with conditions / Reject`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'contractor_vetting', title: `Contractor Vetting - ${contractor_name}`, site_name: null, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 7. Site Photo Analysis (text description path; image path uses existing /inspections/:id/photos)
router.post('/site-photo-analysis', auth,
  [body('description').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { description, site_name, location } = req.body;
      const ctx = `Site: ${site_name || 'unspecified'}
Location: ${location || 'unspecified'}
Photo description: ${description}`;

      const aiResponse = await callOpenRouter(
        `Based on this photo description, identify visible hazards and safety issues. Provide:
1. Visible hazards (numbered list with OSHA standard reference per item)
2. PPE compliance assessment
3. Housekeeping issues (slip/trip/fall, clutter, blocked egress)
4. Severity for each finding (critical/serious/moderate/minor)
5. Immediate actions and corrective steps with target dates`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'site_photo', title: `Photo Analysis - ${site_name || 'site'}`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 8. Safety Bulletin Auto-Generator
router.post('/safety-bulletin', auth,
  [body('period').optional().isString()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { period = 'weekly', site_name } = req.body;
      const days = period === 'monthly' ? 30 : period === 'quarterly' ? 90 : 7;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const [incidents, violations, training] = await Promise.all([
        pool.query(`SELECT * FROM incident_reports WHERE incident_date >= $1 ${site_name ? 'AND site_name=$2' : ''} ORDER BY incident_date DESC LIMIT 25`, site_name ? [since, site_name] : [since]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM violations WHERE date_identified >= $1 ${site_name ? 'AND site_name=$2' : ''} ORDER BY date_identified DESC LIMIT 25`, site_name ? [since, site_name] : [since]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM safety_training WHERE training_date >= $1 ${site_name ? 'AND site_name=$2' : ''} ORDER BY training_date DESC LIMIT 25`, site_name ? [since, site_name] : [since]).catch(() => ({ rows: [] })),
      ]);

      const ctx = `Period: ${period} (${days} days)
Site filter: ${site_name || 'all sites'}
Incidents: ${JSON.stringify(incidents.rows)}
Violations: ${JSON.stringify(violations.rows)}
Training: ${JSON.stringify(training.rows)}`;

      const aiResponse = await callOpenRouter(
        `Generate a ${period} Safety Bulletin formatted for distribution to crews and management:
1. Headline statistics (incidents, violations, training hours)
2. Top trends and contributing factors
3. Toolbox talk topic suggestions for the next period (3 items with talking points)
4. Recognition (positive observations) and Reminders (recurring issues)
5. Acknowledgment block: "I have read and understand this bulletin"
Use markdown formatting suitable for email distribution.`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'safety_bulletin', title: `${period.charAt(0).toUpperCase() + period.slice(1)} Safety Bulletin`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ============================================================
// Apply pass 4 (mechanical backlog) — 5 new AI endpoints
// All return 503 when OPENROUTER_API_KEY is missing.
// ============================================================

function requireKey(res) {
  if (!process.env.OPENROUTER_API_KEY) {
    res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY in .env to enable this feature.' });
    return true;
  }
  return false;
}

// 9. Job Hazard Analysis (JHA) Generator
router.post('/jha-generator', auth,
  [body('task').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    if (requireKey(res)) return;
    try {
      const { task, site_name, location, crew_size, equipment_used, ppe_available } = req.body;
      const ctx = `Site: ${site_name || 'unspecified'}
Location: ${location || 'unspecified'}
Task: ${task}
Crew size: ${crew_size || 'not specified'}
Equipment to be used: ${equipment_used || 'not specified'}
PPE available: ${ppe_available || 'standard hardhat, safety glasses, steel-toe boots, hi-vis vest'}`;

      const aiResponse = await callOpenRouter(
        `Generate a complete Job Hazard Analysis (JHA) for this task. Provide:
1. Step-by-step task breakdown (numbered)
2. For each step: identified hazards, risk rating (low/medium/high/extreme), control measures, required PPE
3. Pre-task checklist (5-10 items)
4. Stop-work conditions
5. Emergency response notes (nearest hospital prompt, contact roles)
6. Required permits or notifications
7. Crew acknowledgment block`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'jha', title: `JHA - ${task.slice(0, 50)}`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 10. Lockout/Tagout (LOTO) Procedure Generator
router.post('/lockout-tagout-plan', auth,
  [body('equipment_description').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    if (requireKey(res)) return;
    try {
      const { equipment_description, energy_sources, site_name, scope } = req.body;
      const ctx = `Site: ${site_name || 'unspecified'}
Equipment: ${equipment_description}
Energy sources (electrical/hydraulic/pneumatic/thermal/chemical/gravitational): ${energy_sources || 'auto-identify from description'}
Scope of work: ${scope || 'maintenance / servicing'}`;

      const aiResponse = await callOpenRouter(
        `Generate an OSHA 1910.147 compliant Lockout/Tagout procedure. Provide:
1. Energy source identification (with isolation point per source)
2. Authorized employee responsibilities
3. Sequence of shutdown (numbered steps)
4. Isolation device application order (with lock+tag requirements)
5. Stored-energy release / verification (zero-energy test)
6. Re-energization sequence
7. Removal of locks (only by applier, exceptions documented)
8. Annual periodic inspection reminder
9. Required tags / lock colors / signage`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'lockout_tagout', title: `LOTO - ${equipment_description.slice(0, 50)}`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 11. Fall Protection Rescue Plan
router.post('/fall-protection-rescue-plan', auth,
  [body('work_description').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    if (requireKey(res)) return;
    try {
      const { work_description, height_ft, anchor_points, site_name, rescue_resources } = req.body;
      const ctx = `Site: ${site_name || 'unspecified'}
Work: ${work_description}
Height (ft): ${height_ft || 'unspecified'}
Anchor points / fall arrest system: ${anchor_points || 'standard 5000 lb rated anchors'}
Available rescue resources: ${rescue_resources || 'standard ladder, mobile crane, EMS call'}`;

      const aiResponse = await callOpenRouter(
        `Generate a written fall protection rescue plan compliant with OSHA 1926.502(d)(20). Include:
1. Fall hazards specific to this work
2. Required fall protection systems (PFAS, guardrail, safety net)
3. Suspension trauma timeline (orthostatic intolerance) and mitigation
4. Self-rescue methods (when feasible)
5. Assisted-rescue method (numbered steps, with required equipment)
6. Roles: rescuer, backup, communicator, EMS liaison
7. Trigger to call 911 (timeline)
8. Pre-use inspection checklist for fall arrest gear
9. Annual training requirements`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'fall_rescue_plan', title: `Fall Rescue Plan - ${work_description.slice(0, 50)}`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 12. Heat Illness Prevention Plan
router.post('/heat-illness-prevention', auth,
  [body('site_name').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    if (requireKey(res)) return;
    try {
      const { site_name, heat_index_f, humidity_pct, work_intensity, shade_available, water_supply } = req.body;
      const ctx = `Site: ${site_name}
Heat index (°F): ${heat_index_f || 'unspecified'}
Humidity (%): ${humidity_pct || 'unspecified'}
Work intensity: ${work_intensity || 'moderate'}
Shade available: ${shade_available || 'unspecified'}
Water supply: ${water_supply || 'unspecified'}`;

      const aiResponse = await callOpenRouter(
        `Generate a heat illness prevention plan per OSHA / Cal-OSHA 3395 best practices. Provide:
1. Heat-stress risk classification (low/moderate/high/extreme)
2. Acclimatization schedule for new and returning workers (14-day plan)
3. Work-rest cycle recommendation (minutes per hour by intensity & heat index)
4. Hydration plan (oz of water per hour, electrolyte sources)
5. Shade requirements (sq ft per worker; shade triggers)
6. Symptom-recognition training summary (heat rash, cramps, exhaustion, stroke)
7. Emergency response protocol (cool first, call 911, no delay for stroke)
8. Daily pre-shift check items
9. Supervisor responsibilities`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'heat_illness_prevention', title: `Heat Illness Plan - ${site_name}`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// 13. Toolbox Talk Generator
router.post('/toolbox-talk-generator', auth,
  [body('topic').notEmpty().isString().trim()],
  async (req, res) => {
    if (validate(req, res)) return;
    if (requireKey(res)) return;
    try {
      const { topic, duration_min, audience, site_name } = req.body;
      const ctx = `Site: ${site_name || 'unspecified'}
Topic: ${topic}
Duration target: ${duration_min || 10} minutes
Audience: ${audience || 'general crew'}`;

      const aiResponse = await callOpenRouter(
        `Generate a complete toolbox talk script. Format:
1. Title
2. Why this matters (1 short paragraph; reference recent incidents if relevant)
3. Key points (3-5 numbered, each 1-2 sentences)
4. Discussion questions for crew (3 open-ended)
5. Demonstration / show-me (one practical demo idea)
6. Action items for the next shift
7. Sign-off block (date, location, presenter, attendees)
Keep total reading time at ~${duration_min || 10} minutes. Use plain language, no jargon.`,
        ctx
      );

      const saved = await persistAnalysis({ analysis_type: 'toolbox_talk', title: `Toolbox Talk - ${topic.slice(0, 50)}`, site_name, input_data: ctx, ai_response: aiResponse, requested_by: req.user?.full_name });
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

module.exports = router;
