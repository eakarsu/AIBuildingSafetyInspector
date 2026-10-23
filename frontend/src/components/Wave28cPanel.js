import React, { useState } from 'react';
// Wave 28C panel: tasks + record search/export + domain AI with labelled sections.
export function formatWaveValue(v){ if(v===false) return 'false'; if(v===0) return '0'; if(v===''||v===null||v===undefined) return '(empty)'; if(typeof v==='object') return JSON.stringify(v); return String(v); }
export function WaveSections({ sections }){ if(!sections?.length) return null; return <div>{sections.map((s,i)=><div key={i}><strong>{s.label}:</strong> {formatWaveValue(s.value)}</div>)}</div>; }
export default function Wave28cPanel({ features=[] }){ const [result,setResult]=useState(null); const [error,setError]=useState('');
 async function run(feature){ setError(''); try{ const token=localStorage.getItem('token'); const r=await fetch(`/api/wave28c/ai/${feature}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Request failed'); setResult(d); }catch(e){ setError(e.message); } }
 return <section><h2>Wave 28C Insights</h2>{features.map(f=><button key={f} onClick={()=>run(f)}>{f}</button>)}
 {error&&<p role="alert">{error}</p>}
 {result&&<div>{result.aiGenerated===false&&<p>Deterministic fallback (not AI-generated): {result.notice||''}</p>}<WaveSections sections={result.sections||Object.entries(result.result||{}).map(([k,v])=>({label:k,value:v}))}/></div>}
 <p><a href="/api/wave28c/records/export?format=csv">Export records CSV</a> {' | '} <a href="/api/wave28c/records/export?format=json">Export records JSON</a></p></section>; }
