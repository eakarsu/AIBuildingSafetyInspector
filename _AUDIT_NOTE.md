# Audit Apply Note — AIBuildingSafetyInspector

Source: `_AUDIT/reports/batch_01.md` § 11.

## Original audit recommendations
- Missing notifications system
- Missing integration API (no webhooks)
- Strategic: agentic workflows, RAG, real-time anomaly detection, white-label

## Implemented in this pass (MECHANICAL)

| # | Item | File | Endpoints |
|---|------|------|-----------|
| 1 | Webhook subscription stub | `backend/routes/webhooks.js` (new) + `backend/server.js` | `GET/POST/DELETE /api/webhooks`, `POST /api/webhooks/:id/test`, `GET /api/webhooks/_/events` |

Allowed events: inspection.completed, violation.recorded/resolved, incident.reported/escalated, hazard.identified, certification.expiring, training.completed, correction.due, emergency.activated. Lazy table; payload-only test (no outbound HTTP). `node --check` passes.

## Backlog (not implemented)

| Item | Tag | Why deferred |
|------|-----|---------------|
| Email/SMS/push notifications | NEEDS-CREDS | SMTP / Twilio / FCM credentials |
| Outbound webhook delivery | TOO-RISKY | Background job infra |
| Multi-agent orchestration | NEEDS-PRODUCT-DECISION | Agent topology |
| RAG over safety bulletins / OSHA docs | NEEDS-PRODUCT-DECISION | Vector store + corpus |
| White-label / reseller | NEEDS-PRODUCT-DECISION | Multi-tenant model |

## Apply pass 3 (frontend)

- **Stack:** Express backend + CRA React frontend.
- **Verdict:** FE already wired. No code changes.
- `frontend/src/components/AIAnalysis.js` (registered at `/ai-analysis` in `App.js`) calls every AI endpoint surfaced in `backend/routes/ai.js` via `runAnalysis(endpoint, body)` against `${API}/api/ai/${endpoint}`, with `Authorization: Bearer ${token}` where the token is read from `localStorage.getItem('token')` in `App.js`. Endpoints covered: `analyze-site`, `risk-assessment`, `compliance-check`, `predict-incidents`, `generate-report`, `custom-query`, `culture-scorecard`, `equipment-maintenance-predict`, `competency-match`, `environmental-monitor`, `accident-cost-calculator`, `contractor-vetting`, `site-photo-analysis`, `safety-bulletin`, plus `GET /api/ai/analyses` history and `DELETE /api/ai/analyses/:id`.
- Webhooks UI also present at `/webhooks`.
- See `_AUDIT/apply3_logs/ab3_46.md` for batch context.

## Apply pass 4 (mechanical backlog)

Added 5 new AI endpoints + matching FE tool cards in the existing `AIAnalysis.js` AI Center. Each uses the existing `callOpenRouter` helper, `auth` middleware, `persistAnalysis` save path, and `express-validator`. Each endpoint short-circuits to **HTTP 503** when `OPENROUTER_API_KEY` is not set.

| # | Endpoint | FE card | Notes |
|---|----------|---------|-------|
| 1 | `POST /api/ai/jha-generator` | "JHA Generator" | Job Hazard Analysis with step-by-step controls + PPE |
| 2 | `POST /api/ai/lockout-tagout-plan` | "Lockout/Tagout Plan" | OSHA 1910.147 LOTO procedure |
| 3 | `POST /api/ai/fall-protection-rescue-plan` | "Fall Rescue Plan" | OSHA 1926.502(d)(20) written rescue plan |
| 4 | `POST /api/ai/heat-illness-prevention` | "Heat Illness Prevention" | OSHA / Cal-OSHA 3395 plan generator |
| 5 | `POST /api/ai/toolbox-talk-generator` | "Toolbox Talk" | Crew toolbox-talk script |

All five reuse the existing `runAnalysis(endpoint, body)` flow and inherit the existing JWT bearer auth (`Authorization: Bearer ${token}` from `localStorage.getItem('token')`), markdown response renderer, history list, and toast feedback. The `runAnalysis` helper now branches on `err.response?.status === 503` to surface a distinct "AI not configured" toast.

**Files touched:**
- `backend/routes/ai.js` — added `requireKey()` helper + 5 endpoints below the existing `safety-bulletin` route.
- `frontend/src/components/AIAnalysis.js` — added 5 sets of tool state, 503 branch in `runAnalysis`, and 5 new `<div className="ai-tool-card">` cards inside the existing `.ai-tools-grid`.

**Smoke test:** backend started, login as `admin@safetyfirst.com / password123`, `POST /api/ai/toolbox-talk-generator` with `{ topic: "ladder safety", duration_min: 5, audience: "electrical crew", site_name: "Skyline Tower Project" }` returned a fully-formatted toolbox-talk script (analysis_type=toolbox_talk, persisted with id 17). Backend stopped after test.

**Syntax checks:** `node --check backend/routes/ai.js` passes; `@babel/parser` (jsx + module) passes for `frontend/src/components/AIAnalysis.js`.

**No new deps. No changes to working code.**
