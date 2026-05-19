const express = require('express');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.use('/api/agentic-safety-inspector', require('./routes/agenticSafetyInspector')); // apply pass 6 — audit custom suggestion

app.use('/api/osha-code-rag', require('./routes/oshaCodeRag')); // apply pass 6 — audit custom suggestion

app.use('/api/wearable-safety-stream', require('./routes/wearableSafetyStream')); // apply pass 6 — audit custom suggestion

app.use('/api/consultancy-white-label', require('./routes/consultancyWhiteLabel')); // apply pass 6 — audit custom suggestion

app.use('/api/custom-views', require('./routes/customViews'));
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});


// === Batch 01 Gaps & Frontend Mounts ===
app.use('/api/gap-no-video-cctv-stream-analytics-only-photo-analysis', require('./routes/gap_no_video_cctv_stream_analytics_only_photo_analysis'));
app.use('/api/gap-no-ai-checklist-generator-from-local-building-code', require('./routes/gap_no_ai_checklist_generator_from_local_building_code'));
app.use('/api/gap-no-drone-footage-inspection-ingestion', require('./routes/gap_no_drone_footage_inspection_ingestion'));
app.use('/api/gap-no-ai-training-content-generator-from-incidents', require('./routes/gap_no_ai_training_content_generator_from_incidents'));
app.use('/api/gap-frontend-pages-folder-is-empty-no-spa-ui-shipped', require('./routes/gap_frontend_pages_folder_is_empty_no_spa_ui_shipped'));
app.use('/api/gap-notification-routes-exist-but-no-sms-push-delivery', require('./routes/gap_notification_routes_exist_but_no_sms_push_delivery'));
app.use('/api/gap-no-direct-gc-platform-api-client-procore-plangrid', require('./routes/gap_no_direct_gc_platform_api_client_procore_plangrid'));
app.use('/api/gap-no-qr-code-site-asset-tagging', require('./routes/gap_no_qr_code_site_asset_tagging'));
app.use('/api/gap-no-mobile-offline-mode-for-inspectors', require('./routes/gap_no_mobile_offline_mode_for_inspectors'));
app.use('/api/gap-no-payroll-integrated-certification-expiry-alerts', require('./routes/gap_no_payroll_integrated_certification_expiry_alerts'));
