const express = require('express');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

const authenticateToken = require('./middleware/auth');
const { validateRuntime } = require('./config/runtime');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');next();});
const origins=(process.env.ALLOWED_ORIGINS||'http://localhost:3000').split(',').map(v=>v.trim());
app.use(cors({origin:(origin,cb)=>!origin||origins.includes(origin)?cb(null,true):cb(new Error('Origin not allowed')),credentials:true}));
app.use(express.json({limit:'10mb'}));

// Rate limiter for AI endpoints: 20 requests per user per hour
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Key by user JWT (set by auth middleware) or fallback to IP (IPv6-safe)
    return req.user ? String(req.user.id) : ipKeyGenerator(req.ip);
  },
  message: { error: 'Too many AI requests. You are limited to 20 per hour. Please try again later.' }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/violations', require('./routes/violations'));
app.use('/api/checklists', require('./routes/checklists'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/certifications', require('./routes/certifications'));
app.use('/api/training', require('./routes/training'));
app.use('/api/hazards', require('./routes/hazards'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/ppe', require('./routes/ppe'));
app.use('/api/corrections', require('./routes/corrections'));
app.use('/api/ai', aiRateLimiter, require('./routes/ai'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/incidents-extended', require('./routes/incidentsExtended'));
app.use('/api/webhooks', require('./routes/webhooks'));
// Apply pass 5 backlog: notifications (NEEDS-CREDS), tenants (PRODUCT-DECISION),
// safety RAG (PRODUCT-DECISION + TOO-RISKY embeddings), agents (PRODUCT-DECISION).
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/safety-rag', require('./routes/safetyRag'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/permit-closeout-readiness', require('./routes/permitCloseoutReadiness'));
app.use('/api/safety-lifecycle', authenticateToken, require('./routes/safetyLifecycle'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.use('/api/agentic-safety-inspector', require('./routes/agenticSafetyInspector')); // apply pass 6 — audit custom suggestion

app.use('/api/osha-code-rag', require('./routes/oshaCodeRag')); // apply pass 6 — audit custom suggestion

app.use('/api/wearable-safety-stream', require('./routes/wearableSafetyStream')); // apply pass 6 — audit custom suggestion

app.use('/api/consultancy-white-label', require('./routes/consultancyWhiteLabel')); // apply pass 6 — audit custom suggestion

app.use('/api/custom-views', require('./routes/customViews'));
validateRuntime();
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
