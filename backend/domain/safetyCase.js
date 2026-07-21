'use strict';
const crypto = require('crypto');
const STATES = Object.freeze(['open', 'inspection_submitted', 'corrective_action', 'closure_review', 'closed', 'reopened']);
const TRANSITIONS = Object.freeze({ open: ['inspection_submitted'], inspection_submitted: ['corrective_action'], corrective_action: ['closure_review'], closure_review: ['closed', 'corrective_action'], closed: ['reopened'], reopened: ['inspection_submitted'] });
const PROVIDERS = Object.freeze(['bim', 'gis', 'sensor', 'wearable', 'contractor', 'incident']);
class SafetyError extends Error { constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; } }
const tenantFor = (user) => { if (!user?.id) throw new SafetyError('AUTH_REQUIRED', 'Authentication required', 401); return String(user.tenant_id || user.tenantId || `personal:${user.id}`); };
const requireRole = (user, roles) => { if (!roles.includes(user.role)) throw new SafetyError('ROLE_FORBIDDEN', `Role ${user.role || 'unknown'} is not authorized`, 403); };
function normalizeCase(input = {}) {
  const required = ['siteId', 'assetId', 'jurisdiction', 'hazardCode', 'severity', 'observedAt', 'description'];
  const missing = required.filter((key) => !input[key]);
  if (missing.length) throw new SafetyError('INVALID_CASE', `Missing: ${missing.join(', ')}`);
  if (!['low', 'medium', 'high', 'critical'].includes(input.severity)) throw new SafetyError('INVALID_SEVERITY', 'Unsupported hazard severity');
  if (Number.isNaN(Date.parse(input.observedAt))) throw new SafetyError('INVALID_TIME', 'observedAt must be ISO-8601');
  return { siteId: String(input.siteId), assetId: String(input.assetId), jurisdiction: String(input.jurisdiction), hazardCode: String(input.hazardCode), severity: input.severity, observedAt: new Date(input.observedAt).toISOString(), description: String(input.description).trim(), location: input.location || null, workerIdentifiers: [] };
}
function validateTransition(current, next, user, evidence = {}) {
  if (!(TRANSITIONS[current] || []).includes(next)) throw new SafetyError('INVALID_TRANSITION', `Cannot move ${current} to ${next}`, 409);
  const roles = next === 'closed' ? ['supervisor', 'safety_manager', 'admin'] : next === 'reopened' ? ['inspector', 'supervisor', 'safety_manager', 'admin'] : ['inspector', 'contractor', 'supervisor', 'safety_manager', 'admin'];
  requireRole(user, roles);
  if (next === 'inspection_submitted' && (!evidence.checklistVersion || !Array.isArray(evidence.evidenceIds) || evidence.evidenceIds.length === 0)) throw new SafetyError('EVIDENCE_REQUIRED', 'Checklist version and evidence IDs are required');
  if (next === 'closure_review' && (!evidence.correctiveAction || !evidence.responsibleParty || !evidence.completedAt)) throw new SafetyError('CORRECTION_REQUIRED', 'Corrective-action evidence is required');
  if (next === 'closed' && (!evidence.supervisorAttestation || !evidence.verificationEvidenceId)) throw new SafetyError('CLOSURE_EVIDENCE_REQUIRED', 'Independent supervisor attestation and closure evidence are required');
}
const idempotencyKey = (key) => { if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new SafetyError('IDEMPOTENCY_REQUIRED', 'Valid Idempotency-Key required'); return key; };
const digest = (data) => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
module.exports = { STATES, PROVIDERS, SafetyError, tenantFor, requireRole, normalizeCase, validateTransition, idempotencyKey, digest };
