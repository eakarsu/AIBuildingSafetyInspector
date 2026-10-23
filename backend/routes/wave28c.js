'use strict';
// Wave 28C: authenticated tasks, main-record search/filter + CSV/JSON export, domain AI.
const express=require('express'); const router=express.Router();
const W=require('../domain/wave28c'); const store=W.createTaskStore();
const ownerOf=req=>String(req.user?.id||req.user?.email||req.user?.userId||'unknown');
async function loadRecords(){ try{ const pool=require('../db'); const r=await pool.query('SELECT * FROM site_inspections ORDER BY id DESC LIMIT 500'); return r.rows; }catch(e){ return []; } }
async function tryProvider(feature,rows){
 const useOR=Boolean(process.env.OPENROUTER_API_KEY); const key=useOR?process.env.OPENROUTER_API_KEY:process.env.OPENAI_API_KEY;
 const url=useOR?'https://openrouter.ai/api/v1/chat/completions':'https://api.openai.com/v1/chat/completions';
 const model=process.env.OPENROUTER_MODEL||process.env.OPENAI_MODEL||(useOR?'anthropic/claude-3-5-sonnet-20241022':'gpt-4o-mini');
 const res=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'Return strict JSON grounded only in the supplied records. Include summary, findings (array), and next_actions (array).'},{role:'user',content:`Feature: ${feature}\nRecords: ${JSON.stringify(rows).slice(0,6000)}`}],temperature:0.3,max_tokens:1200})});
 if(!res.ok) throw new Error(`Provider returned ${res.status}`);
 const data=await res.json(); const content=data?.choices?.[0]?.message?.content; if(!content) throw new Error('Provider returned no content');
 let parsed=null; try{parsed=JSON.parse(content)}catch{ const m=content.match(/\{[\s\S]*\}/); if(m) try{parsed=JSON.parse(m[0])}catch{} }
 const result=parsed||{text:content}; return {feature,aiGenerated:true,provider:useOR?'openrouter':'openai',model,result,sections:W.buildSections(result)};
}
router.get('/health',(req,res)=>res.json({ok:true,feature:'wave28c',ai_configured:W.hasProviderKey(),features:Object.keys(W.FEATURES)}));
router.get('/tasks',(req,res)=>res.json({data:store.list(ownerOf(req),req.query)}));
router.post('/tasks',(req,res)=>{ try{ res.status(201).json(store.create(ownerOf(req),req.body)); }catch(e){ res.status(400).json({error:e.message}); } });
router.put('/tasks/:id',(req,res)=>{ try{ const t=store.update(ownerOf(req),req.params.id,req.body); if(!t) return res.status(404).json({error:'Task not found'}); res.json(t); }catch(e){ res.status(400).json({error:e.message}); } });
async function recordsHandler(req,res){ const rows=W.filterRecords(await loadRecords(),req.query); if(String(req.query.format||'').toLowerCase()==='csv'){ res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="records.csv"'); return res.send(W.toCsv(rows)); } res.json({data:rows,total:rows.length}); }
router.get('/records',recordsHandler); router.get('/records/export',recordsHandler);
router.post('/ai/:feature',async(req,res)=>{ const fn=W.FEATURES[req.params.feature]; if(!fn) return res.status(404).json({error:'Unknown feature',features:Object.keys(W.FEATURES)}); const rows=Array.isArray(req.body?.records)?req.body.records:await loadRecords();
 if(!W.hasProviderKey()) return res.json(fn(rows));
 try{ return res.json(await tryProvider(req.params.feature,rows)); }catch(e){ return res.status(502).json({error:e.message,aiGenerated:false}); } });
module.exports=router; module.exports.store=store;
