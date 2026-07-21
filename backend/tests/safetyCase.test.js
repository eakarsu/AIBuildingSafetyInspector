const assert=require('assert');const test=require('node:test');const rules=require('../domain/safetyCase');
const sample={siteId:'S-1',assetId:'A-2',jurisdiction:'NYC',hazardCode:'FALL',severity:'critical',observedAt:'2026-07-18T12:00:00Z',description:'Missing guard rail'};
test('normalizes safety observations without worker identifiers',()=>assert.deepEqual(rules.normalizeCase(sample).workerIdentifiers,[]));
test('rejects invalid severity',()=>assert.throws(()=>rules.normalizeCase({...sample,severity:'catastrophic'}),/severity/));
test('requires closure verification',()=>assert.throws(()=>rules.validateTransition('closure_review','closed',{role:'supervisor'},{}),/closure evidence/));
test('allows supervisor closure with independent evidence',()=>assert.doesNotThrow(()=>rules.validateTransition('closure_review','closed',{role:'supervisor'},{supervisorAttestation:true,verificationEvidenceId:'E-9'})));
