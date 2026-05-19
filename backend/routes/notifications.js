// Apply pass 5: Notifications backlog implementation.
//
// Categories applied to this file:
//  - NEEDS-CREDS: SMTP / Twilio / FCM credentials. If unset, returns 503
//    with `missing: <ENV>` payload. No outbound transport is invoked.
//  - TOO-RISKY: outbound webhook delivery is OUT-OF-SCOPE; this route only
//    queues notifications into a `notifications` table (CREATE TABLE IF NOT
//    EXISTS) for an external worker to drain. No background worker / cron
//    is started here.
//
// Required env vars (per channel):
//   SMTP:    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//   SMS:     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//   PUSH:    FCM_SERVER_KEY  (or FCM_PROJECT_ID)
//
// Endpoints (all behind `auth`):
//   POST   /api/notifications        — queue a notification (channel, to, subject, body)
//   GET    /api/notifications        — list queued notifications (most recent first)
//   GET    /api/notifications/:id    — get one
//   DELETE /api/notifications/:id    — delete (only `pending`)
//   POST   /api/notifications/:id/send — *attempts* delivery; returns 503 if
//                                        creds missing for that channel.
//   GET    /api/notifications/_/channels — report which channels are configured.
//
// This is additive only. Working code is untouched.

const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(20) NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        attempts INT DEFAULT 0,
        last_error TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      )
    `);
    tableReady = true;
  } catch (e) { /* schema-tolerant */ }
}

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

function channelStatus() {
  return {
    email: !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
    sms: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
    push: !!(process.env.FCM_SERVER_KEY || process.env.FCM_PROJECT_ID),
    missing: {
      email: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].filter(k => !process.env[k]),
      sms: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'].filter(k => !process.env[k]),
      push: !process.env.FCM_SERVER_KEY && !process.env.FCM_PROJECT_ID ? ['FCM_SERVER_KEY'] : []
    }
  };
}

router.get('/_/channels', auth, async (req, res) => {
  await ensureTable();
  res.json(channelStatus());
});

router.post('/', auth,
  [
    body('channel').isIn(['email', 'sms', 'push']),
    body('recipient').isString().trim().notEmpty(),
    body('body').isString().trim().notEmpty(),
    body('subject').optional().isString()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    await ensureTable();
    try {
      const { channel, recipient, body: msgBody, subject } = req.body;
      const r = await pool.query(
        'INSERT INTO notifications (channel, recipient, subject, body, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [channel, recipient, subject || null, msgBody, req.user?.full_name || req.user?.email || null]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

router.get('/', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200');
    res.json(r.rows);
  } catch (err) { res.json([]); }
});

router.get('/:id', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('SELECT * FROM notifications WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query("DELETE FROM notifications WHERE id = $1 AND status = 'pending' RETURNING *", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found or already sent' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Attempt delivery — returns 503 with `missing: <ENV>` if creds for the channel are unset.
// We do NOT make outbound network calls here (TOO-RISKY for production secrets); we
// only mark `status='sent'` when a real worker is wired in. This stub validates creds
// presence and updates status to `ready` if creds OK, else 503.
router.post('/:id/send', auth, async (req, res) => {
  await ensureTable();
  try {
    const r = await pool.query('SELECT * FROM notifications WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    const n = r.rows[0];
    const status = channelStatus();
    if (n.channel === 'email' && !status.email) {
      return res.status(503).json({ error: 'Email not configured', missing: status.missing.email.join(', ') || 'SMTP_HOST' });
    }
    if (n.channel === 'sms' && !status.sms) {
      return res.status(503).json({ error: 'SMS not configured', missing: status.missing.sms.join(', ') || 'TWILIO_ACCOUNT_SID' });
    }
    if (n.channel === 'push' && !status.push) {
      return res.status(503).json({ error: 'Push not configured', missing: 'FCM_SERVER_KEY' });
    }
    // Creds present: mark as ready-for-worker. Real send is intentionally NOT performed
    // from this request handler. A worker (out of scope) should drain `status='ready'`.
    const upd = await pool.query("UPDATE notifications SET status='ready', attempts = attempts + 1 WHERE id = $1 RETURNING *", [req.params.id]);
    res.json({ queued: true, notification: upd.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
