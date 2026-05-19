// Apply pass 5: Multi-agent orchestration backlog.
//
// Category: NEEDS-PRODUCT-DECISION (agent topology).
// PRODUCT-DECISION: Picked a *single-pass sequential pipeline* default, NOT
//   a recursive ReAct/AutoGen loop. This is the safest default — predictable
//   token spend, no infinite loops, no shell-tool execution. The pipeline runs
//   N predefined "agents" (each an LLM persona prompt) in order, threading the
//   prior agent's output as the next agent's input. Topology can be widened
//   later (parallel fanout, voting, tool-calling) without breaking the API.
//
// This is *additive* — no existing AI route is touched. Returns 503 when
// OPENROUTER_API_KEY missing.
//
// Endpoints (auth):
//   GET  /api/agents/_/personas   — list available persona ids
//   POST /api/agents/run          — { task, personas: ["risk", "compliance", "writer"], site_name }
//
// Output: { runs: [{ persona, output }], final, run_id }

const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const https = require('https');
const http = require('http');

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id SERIAL PRIMARY KEY,
        task TEXT NOT NULL,
        site_name TEXT,
        personas TEXT[],
        steps JSONB,
        final_output TEXT,
        requested_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    tableReady = true;
  } catch (e) { /* schema-tolerant */ }
}

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return true; }
  return false;
}

const PERSONAS = {
  risk: { name: 'Risk Analyst', system: 'You are a risk-analysis safety officer. Identify hazards, severity, and likelihood. Be specific and concise.' },
  compliance: { name: 'OSHA Compliance Officer', system: 'You are an OSHA compliance officer. Cite relevant 29 CFR 1926/1910 standards and identify gaps.' },
  controls: { name: 'Controls Engineer', system: 'You are a safety controls engineer. Recommend hierarchy of controls (elimination > substitution > engineering > admin > PPE). Provide actionable controls.' },
  writer: { name: 'Communications Lead', system: 'You are a safety communications lead. Synthesize prior analysis into a crew-readable briefing using markdown. Include action items and acknowledgment block.' },
  inspector: { name: 'Site Inspector', system: 'You are a senior site inspector. Walk through the scenario and list visible-condition observations a frontline inspector would capture.' }
};

function makeRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}
async function callOpenRouter(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1200,
    temperature: 0.5
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
      'X-Title': 'AI Building Safety Inspector - Agents'
    }
  };
  const response = await makeRequest(url.toString(), options, body);
  if (response.status !== 200) throw new Error(`OpenRouter error: ${JSON.stringify(response.data)}`);
  return response.data.choices[0].message.content;
}

router.get('/_/personas', auth, (req, res) => {
  res.json(Object.entries(PERSONAS).map(([id, p]) => ({ id, name: p.name })));
});

router.post('/run', auth,
  [body('task').isString().trim().notEmpty(), body('personas').isArray({ min: 1, max: 5 })],
  async (req, res) => {
    if (validate(req, res)) return;
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI not configured', missing: 'OPENROUTER_API_KEY' });
    }
    await ensureTable();
    try {
      const { task, personas, site_name } = req.body;
      const validIds = personas.filter(p => PERSONAS[p]);
      if (!validIds.length) return res.status(400).json({ error: 'no valid personas; see GET /api/agents/_/personas' });

      const steps = [];
      let lastOutput = '';
      for (const id of validIds) {
        const persona = PERSONAS[id];
        const userPrompt = lastOutput
          ? `Task: ${task}\nSite: ${site_name || 'unspecified'}\n\nPrior agent output:\n${lastOutput}\n\nNow respond from your role.`
          : `Task: ${task}\nSite: ${site_name || 'unspecified'}\n\nRespond from your role.`;
        const out = await callOpenRouter(persona.system, userPrompt);
        steps.push({ persona: id, name: persona.name, output: out });
        lastOutput = out;
      }

      const saved = await pool.query(
        'INSERT INTO agent_runs (task, site_name, personas, steps, final_output, requested_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [task, site_name || null, validIds, JSON.stringify(steps), lastOutput, req.user?.full_name || req.user?.email || null]
      ).catch(() => ({ rows: [{ id: null }] }));

      res.json({ run_id: saved.rows[0]?.id || null, steps, final: lastOutput });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

router.get('/runs', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('SELECT id, task, site_name, personas, requested_by, created_at FROM agent_runs ORDER BY created_at DESC LIMIT 100');
    res.json(r.rows);
  } catch (e) { res.json([]); }
});

router.get('/runs/:id', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('SELECT * FROM agent_runs WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
