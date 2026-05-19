// Apply pass 5: RAG over safety bulletins / OSHA docs.
//
// Categories applied:
//  - NEEDS-PRODUCT-DECISION: Vector store + corpus selection.
//      PRODUCT-DECISION: Default to a TF-IDF-style in-memory keyword index
//      (no external vector DB, no embeddings calls). Documents live in a
//      `safety_kb_documents` table (CREATE TABLE IF NOT EXISTS). The retrieval
//      function runs entirely in Node — no new heavy deps. This unblocks the
//      FE/UX flow while leaving a real embeddings backend (pgvector, Pinecone,
//      Weaviate) as a future replacement plug-in. The retrieval interface
//      (search(query) -> [{ document, score }]) won't change.
//  - TOO-RISKY: real embedding pipeline. Stubbed in-memory.
//
// Endpoints (auth):
//   POST   /api/safety-rag/documents       — ingest a new doc
//   GET    /api/safety-rag/documents       — list
//   DELETE /api/safety-rag/documents/:id   — remove
//   POST   /api/safety-rag/search          — keyword similarity search (no AI)
//   POST   /api/safety-rag/answer          — RAG: search → call AI to compose answer.
//                                            Returns 503 if OPENROUTER_API_KEY missing.

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
      CREATE TABLE IF NOT EXISTS safety_kb_documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT,
        content TEXT NOT NULL,
        tags TEXT[],
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

// --- TF-IDF-ish in-memory retrieval (no deps) ---
function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}
function score(queryTokens, docContent) {
  const docTokens = tokenize(docContent);
  if (!docTokens.length) return 0;
  const docFreq = {};
  for (const t of docTokens) docFreq[t] = (docFreq[t] || 0) + 1;
  let s = 0;
  for (const q of queryTokens) {
    if (docFreq[q]) s += docFreq[q];
  }
  // length normalization
  return s / Math.sqrt(docTokens.length);
}

async function retrieve(query, k = 5) {
  await ensureTable();
  const r = await pool.query('SELECT id, title, source, content, tags FROM safety_kb_documents');
  const qTokens = tokenize(query);
  const ranked = r.rows
    .map(d => ({ document: d, score: score(qTokens, d.content + ' ' + (d.title || '')) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return ranked;
}

// --- HTTP helper for OpenRouter (mirrors ai.js) ---
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

async function callOpenRouter(prompt, context = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: 'You are an OSHA-certified safety inspector. Answer using the provided context. If the context is insufficient, say so.' },
      { role: 'user', content: context ? `Context:\n${context}\n\nQuestion:\n${prompt}` : prompt }
    ],
    max_tokens: 1500,
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
      'X-Title': 'AI Building Safety Inspector - RAG'
    }
  };
  const response = await makeRequest(url.toString(), options, body);
  if (response.status !== 200) throw new Error(`OpenRouter error: ${JSON.stringify(response.data)}`);
  return response.data.choices[0].message.content;
}

router.post('/documents', auth,
  [body('title').isString().trim().notEmpty(), body('content').isString().trim().notEmpty()],
  async (req, res) => {
    if (validate(req, res)) return;
    await ensureTable();
    try {
      const { title, source, content, tags } = req.body;
      const r = await pool.query(
        'INSERT INTO safety_kb_documents (title, source, content, tags) VALUES ($1,$2,$3,$4) RETURNING *',
        [title, source || null, content, Array.isArray(tags) ? tags : null]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

router.get('/documents', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('SELECT id, title, source, tags, created_at FROM safety_kb_documents ORDER BY created_at DESC LIMIT 200');
    res.json(r.rows);
  } catch (e) { res.json([]); }
});

router.delete('/documents/:id', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('DELETE FROM safety_kb_documents WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/search', auth,
  [body('query').isString().trim().notEmpty()],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { query, k } = req.body;
      const results = await retrieve(query, Math.min(parseInt(k) || 5, 20));
      res.json({ query, results: results.map(r => ({ id: r.document.id, title: r.document.title, source: r.document.source, score: r.score, snippet: (r.document.content || '').slice(0, 400) })) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

router.post('/answer', auth,
  [body('question').isString().trim().notEmpty()],
  async (req, res) => {
    if (validate(req, res)) return;
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI not configured', missing: 'OPENROUTER_API_KEY' });
    }
    try {
      const { question, k } = req.body;
      const results = await retrieve(question, Math.min(parseInt(k) || 4, 8));
      const context = results.length
        ? results.map((r, i) => `[Source ${i + 1}: ${r.document.title}${r.document.source ? ' / ' + r.document.source : ''}]\n${(r.document.content || '').slice(0, 1500)}`).join('\n\n')
        : '(No documents in knowledge base. Answer from general OSHA knowledge.)';
      const answer = await callOpenRouter(question, context);
      res.json({ question, answer, sources: results.map(r => ({ id: r.document.id, title: r.document.title, source: r.document.source, score: r.score })) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

module.exports = router;
