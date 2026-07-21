'use strict';
const router = require('express').Router();
const pool = require('../db');
const rules = require('../domain/safetyCase');
const fail = (res, error) => res.status(error.status || 500).json({ error: error.code || 'INTERNAL_ERROR', message: error.status ? error.message : 'Unexpected server error' });

router.get('/', async (req, res) => { try { const { rows } = await pool.query('SELECT * FROM safety_cases WHERE tenant_id=$1 ORDER BY created_at DESC', [rules.tenantFor(req.user)]); res.json({ cases: rows }); } catch (e) { fail(res, e); } });
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    rules.requireRole(req.user, ['inspector', 'supervisor', 'safety_manager', 'admin']);
    const data = rules.normalizeCase(req.body); const tenant = rules.tenantFor(req.user); const key = rules.idempotencyKey(req.header('Idempotency-Key'));
    await client.query('BEGIN');
    const replay = await client.query('SELECT * FROM safety_cases WHERE tenant_id=$1 AND idempotency_key=$2', [tenant, key]);
    if (replay.rows[0]) { await client.query('COMMIT'); return res.json({ case: replay.rows[0], replayed: true }); }
    const inserted = await client.query(`INSERT INTO safety_cases (tenant_id,site_id,asset_id,jurisdiction,hazard_code,severity,state,record,idempotency_key,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8,$9) RETURNING *`, [tenant,data.siteId,data.assetId,data.jurisdiction,data.hazardCode,data.severity,data,key,String(req.user.id)]);
    await client.query(`INSERT INTO safety_case_events (case_id,tenant_id,actor_id,event_type,evidence_digest,details) VALUES ($1,$2,$3,'created',$4,$5)`, [inserted.rows[0].id,tenant,String(req.user.id),rules.digest(data),data]);
    await client.query('COMMIT'); res.status(201).json({ case: inserted.rows[0], replayed: false });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); fail(res, e); } finally { client.release(); }
});
router.post('/:id/transition', async (req, res) => {
  const client = await pool.connect();
  try {
    const tenant=rules.tenantFor(req.user); const key=rules.idempotencyKey(req.header('Idempotency-Key')); await client.query('BEGIN');
    const found=await client.query('SELECT * FROM safety_cases WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[req.params.id,tenant]); if(!found.rows[0]) throw new rules.SafetyError('NOT_FOUND','Safety case not found',404);
    const replay=await client.query('SELECT id FROM safety_case_events WHERE case_id=$1 AND idempotency_key=$2',[req.params.id,key]); if(replay.rows[0]) { await client.query('COMMIT'); return res.json({case:found.rows[0],replayed:true}); }
    rules.validateTransition(found.rows[0].state,req.body.state,req.user,req.body.evidence||{});
    const updated=await client.query('UPDATE safety_cases SET state=$1,version=version+1,updated_at=NOW() WHERE id=$2 RETURNING *',[req.body.state,req.params.id]);
    await client.query(`INSERT INTO safety_case_events (case_id,tenant_id,actor_id,event_type,from_state,to_state,idempotency_key,evidence_digest,details) VALUES ($1,$2,$3,'transition',$4,$5,$6,$7,$8)`,[req.params.id,tenant,String(req.user.id),found.rows[0].state,req.body.state,key,rules.digest(req.body.evidence||{}),req.body.evidence||{}]);
    await client.query('COMMIT'); res.json({case:updated.rows[0],replayed:false});
  } catch(e){await client.query('ROLLBACK').catch(()=>{});fail(res,e);} finally{client.release();}
});
router.post('/offline-sync/:provider', async (req,res)=>{try{const tenant=rules.tenantFor(req.user);rules.requireRole(req.user,['inspector','supervisor','safety_manager','admin']);if(!rules.PROVIDERS.includes(req.params.provider))throw new rules.SafetyError('UNSUPPORTED_PROVIDER','Unsupported source system');const key=rules.idempotencyKey(req.header('Idempotency-Key'));const {rows}=await pool.query(`INSERT INTO safety_sync_jobs (tenant_id,provider,idempotency_key,payload,requested_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,provider,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`,[tenant,req.params.provider,key,req.body,String(req.user.id)]);res.status(rows[0].status==='queued'?202:200).json({job:rows[0]});}catch(e){fail(res,e);}});
module.exports=router;
