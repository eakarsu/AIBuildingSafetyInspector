import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const sites = [
  'Skyline Tower Project', 'Harbor Bridge Renovation', 'Metro Hospital Wing B',
  'Riverside Mall Expansion', 'Central Park Condos', 'Airport Terminal C',
  'Oceanview Resort', 'Tech Campus Building 4', 'Historic Library Restoration',
  'Mountain View Apartments', 'Interstate Bridge 95', 'Solar Farm Installation',
  'Subway Extension Line 3', 'Waterfront Office Complex', 'Community Center Rebuild',
  'Data Center Facility'
];

function formatAIResponse(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let inList = false;
  let listItems = [];
  let listType = 'ul';

  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = listType;
      elements.push(
        <ListTag key={`list-${elements.length}`}>
          {listItems.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />)}
        </ListTag>
      );
      listItems = [];
      inList = false;
    }
  };

  const formatInline = (text) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(59,130,246,0.1);padding:2px 6px;border-radius:4px;color:#60a5fa;font-size:13px">$1</code>');
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={idx}>{trimmed.slice(4)}</h3>);
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={idx}>{trimmed.slice(3)}</h2>);
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={idx}>{trimmed.slice(2)}</h1>);
      return;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      elements.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid rgba(148,163,184,0.15)', margin: '16px 0' }} />);
      return;
    }

    // Numbered list
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      if (!inList || listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      inList = true;
      listItems.push(trimmed.replace(/^\d+[\.\)]\s/, ''));
      return;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      if (!inList || listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      inList = true;
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();

    // Sections with special styling
    if (trimmed.toLowerCase().includes('warning') || trimmed.toLowerCase().includes('critical') || trimmed.toLowerCase().includes('danger')) {
      elements.push(
        <div key={idx} className="ai-section danger">
          <p dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
        </div>
      );
      return;
    }

    if (trimmed.toLowerCase().includes('recommendation') || trimmed.toLowerCase().includes('action item')) {
      elements.push(
        <div key={idx} className="ai-section success">
          <p dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
        </div>
      );
      return;
    }

    elements.push(<p key={idx} dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />);
  });

  flushList();
  return elements;
}

export default function AIAnalysis({ token, user }) {
  const [analyses, setAnalyses] = useState([]);
  const [activeResponse, setActiveResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Tool states
  const [siteAnalysisSite, setSiteAnalysisSite] = useState('');
  const [riskSite, setRiskSite] = useState('');
  const [riskDescription, setRiskDescription] = useState('');
  const [complianceSite, setComplianceSite] = useState('');
  const [reportSite, setReportSite] = useState('');
  const [reportType, setReportType] = useState('Monthly');
  const [customQuery, setCustomQuery] = useState('');
  const [customSite, setCustomSite] = useState('');

  // ===== NEW PROPOSED FEATURES tool states =====
  const [cultureSite, setCultureSite] = useState('');
  const [cultureNearMisses, setCultureNearMisses] = useState('');
  const [cultureMeetings, setCultureMeetings] = useState('');
  const [cultureObs, setCultureObs] = useState('');
  const [cultureRate, setCultureRate] = useState('');

  const [eqId, setEqId] = useState('');

  const [compTask, setCompTask] = useState('');
  const [compSite, setCompSite] = useState('');
  const [compRequired, setCompRequired] = useState('');

  const [envSite, setEnvSite] = useState('');
  const [envWeather, setEnvWeather] = useState('');
  const [envAQI, setEnvAQI] = useState('');
  const [envNoise, setEnvNoise] = useState('');
  const [envTemp, setEnvTemp] = useState('');

  const [costType, setCostType] = useState('');
  const [costSeverity, setCostSeverity] = useState('moderate');
  const [costDays, setCostDays] = useState('');
  const [costMedical, setCostMedical] = useState('');
  const [costEquipment, setCostEquipment] = useState('');
  const [costIntervention, setCostIntervention] = useState('');

  const [vetName, setVetName] = useState('');
  const [vetInsurance, setVetInsurance] = useState('');
  const [vetReferences, setVetReferences] = useState('');
  const [vetIncidents, setVetIncidents] = useState('');
  const [vetScope, setVetScope] = useState('');

  const [photoDesc, setPhotoDesc] = useState('');
  const [photoSite, setPhotoSite] = useState('');
  const [photoLocation, setPhotoLocation] = useState('');

  const [bulletinPeriod, setBulletinPeriod] = useState('weekly');
  const [bulletinSite, setBulletinSite] = useState('');

  // ===== Apply pass 4 (mechanical backlog) — new tool states =====
  // 9. JHA Generator
  const [jhaTask, setJhaTask] = useState('');
  const [jhaSite, setJhaSite] = useState('');
  const [jhaCrew, setJhaCrew] = useState('');
  const [jhaEquipment, setJhaEquipment] = useState('');
  // 10. LOTO
  const [lotoEquipment, setLotoEquipment] = useState('');
  const [lotoEnergy, setLotoEnergy] = useState('');
  const [lotoSite, setLotoSite] = useState('');
  const [lotoScope, setLotoScope] = useState('');
  // 11. Fall protection rescue
  const [fallWork, setFallWork] = useState('');
  const [fallHeight, setFallHeight] = useState('');
  const [fallSite, setFallSite] = useState('');
  const [fallAnchors, setFallAnchors] = useState('');
  // 12. Heat illness
  const [heatSite, setHeatSite] = useState('');
  const [heatIndex, setHeatIndex] = useState('');
  const [heatHumidity, setHeatHumidity] = useState('');
  const [heatIntensity, setHeatIntensity] = useState('moderate');
  // 13. Toolbox talk
  const [tbtTopic, setTbtTopic] = useState('');
  const [tbtDuration, setTbtDuration] = useState('10');
  const [tbtAudience, setTbtAudience] = useState('');
  const [tbtSite, setTbtSite] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/api/ai/analyses`, { headers });
      setAnalyses(res.data);
    } catch (err) {
      console.error(err);
    }
    setHistoryLoading(false);
  };

  const runAnalysis = async (endpoint, body) => {
    setLoading(true);
    setActiveResponse(null);
    try {
      const res = await axios.post(`${API}/api/ai/${endpoint}`, body, { headers });
      setActiveResponse(res.data);
      fetchHistory();
      toast.success('Analysis complete!');
    } catch (err) {
      if (err.response?.status === 503) {
        toast.error(err.response?.data?.error || 'AI not configured (503). Set OPENROUTER_API_KEY in .env.');
      } else {
        toast.error(err.response?.data?.error || 'Analysis failed. Check your OpenRouter API key.');
      }
    }
    setLoading(false);
  };

  const handleDeleteAnalysis = async (id) => {
    try {
      await axios.delete(`${API}/api/ai/analyses/${id}`, { headers });
      setAnalyses(analyses.filter(a => a.id !== id));
      if (activeResponse?.id === id) setActiveResponse(null);
      toast.success('Deleted');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const SiteSelect = ({ value, onChange }) => (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select site...</option>
      {sites.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );

  return (
    <div className="ai-page">
      <div className="page-header">
        <h1>🤖 AI Safety Analysis</h1>
        <p>Powered by OpenRouter - Intelligent construction safety insights</p>
      </div>

      <div className="ai-tools-grid">
        {/* Site Analysis */}
        <div className="ai-tool-card">
          <h3>🏗️ Site Analysis</h3>
          <p>Comprehensive AI safety analysis for any construction site</p>
          <div className="ai-input-group">
            <SiteSelect value={siteAnalysisSite} onChange={setSiteAnalysisSite} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => siteAnalysisSite && runAnalysis('analyze-site', { site_name: siteAnalysisSite })}
            disabled={loading || !siteAnalysisSite}>
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>

        {/* Risk Assessment */}
        <div className="ai-tool-card">
          <h3>⚡ Risk Assessment</h3>
          <p>AI-powered risk assessment for new activities or hazards</p>
          <div className="ai-input-group">
            <SiteSelect value={riskSite} onChange={setRiskSite} />
          </div>
          <div className="ai-input-group">
            <textarea placeholder="Describe the activity or hazard..." value={riskDescription} onChange={e => setRiskDescription(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => riskSite && riskDescription && runAnalysis('risk-assessment', { site_name: riskSite, description: riskDescription })}
            disabled={loading || !riskSite || !riskDescription}>
            {loading ? 'Assessing...' : 'Assess Risk'}
          </button>
        </div>

        {/* Compliance Check */}
        <div className="ai-tool-card">
          <h3>📋 Compliance Check</h3>
          <p>OSHA compliance gap analysis and fine exposure assessment</p>
          <div className="ai-input-group">
            <SiteSelect value={complianceSite} onChange={setComplianceSite} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => complianceSite && runAnalysis('compliance-check', { site_name: complianceSite })}
            disabled={loading || !complianceSite}>
            {loading ? 'Checking...' : 'Check Compliance'}
          </button>
        </div>

        {/* Incident Prediction */}
        <div className="ai-tool-card">
          <h3>🔮 Incident Prediction</h3>
          <p>Predict high-risk areas based on historical data and trends</p>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => runAnalysis('predict-incidents', {})}
            disabled={loading}>
            {loading ? 'Predicting...' : 'Predict Incidents'}
          </button>
        </div>

        {/* Generate Report */}
        <div className="ai-tool-card">
          <h3>📄 Generate Report</h3>
          <p>AI-generated professional safety report for any site</p>
          <div className="ai-input-group">
            <SiteSelect value={reportSite} onChange={setReportSite} />
          </div>
          <div className="ai-input-group">
            <select value={reportType} onChange={e => setReportType(e.target.value)}>
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annual">Annual</option>
              <option value="Incident">Incident</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => reportSite && runAnalysis('generate-report', { site_name: reportSite, report_type: reportType })}
            disabled={loading || !reportSite}>
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {/* Custom Query */}
        <div className="ai-tool-card">
          <h3>💬 Custom Query</h3>
          <p>Ask any safety-related question with optional site context</p>
          <div className="ai-input-group">
            <SiteSelect value={customSite} onChange={setCustomSite} />
          </div>
          <div className="ai-input-group">
            <textarea placeholder="Ask a safety question..." value={customQuery} onChange={e => setCustomQuery(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => customQuery && runAnalysis('custom-query', { query: customQuery, site_name: customSite || undefined })}
            disabled={loading || !customQuery}>
            {loading ? 'Thinking...' : 'Ask AI'}
          </button>
        </div>

        {/* ===== NEW PROPOSED FEATURES ===== */}

        {/* 1. Safety Culture Scorecard */}
        <div className="ai-tool-card">
          <h3>🏆 Safety Culture Scorecard</h3>
          <p>Score reporting, engagement, leadership, and continuous improvement</p>
          <div className="ai-input-group"><SiteSelect value={cultureSite} onChange={setCultureSite} /></div>
          <div className="ai-input-group"><input placeholder="Near misses (last 30 days)" value={cultureNearMisses} onChange={e => setCultureNearMisses(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Safety meetings count" value={cultureMeetings} onChange={e => setCultureMeetings(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Behavioral observations" value={cultureObs} onChange={e => setCultureObs(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Worker reporting rate %" value={cultureRate} onChange={e => setCultureRate(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => cultureSite && runAnalysis('culture-scorecard', { site_name: cultureSite, near_misses: cultureNearMisses, safety_meetings_count: cultureMeetings, behavioral_observations: cultureObs, reporting_rate: cultureRate })}
            disabled={loading || !cultureSite}>
            {loading ? 'Scoring...' : 'Score Culture'}
          </button>
        </div>

        {/* 2. Equipment Maintenance Predictor */}
        <div className="ai-tool-card">
          <h3>🔧 Equipment Maintenance Predictor</h3>
          <p>Predict next maintenance window and failure risk per asset</p>
          <div className="ai-input-group"><input placeholder="Equipment ID (e.g. CRN-001)" value={eqId} onChange={e => setEqId(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => eqId && runAnalysis('equipment-maintenance-predict', { equipment_id: eqId })}
            disabled={loading || !eqId}>
            {loading ? 'Predicting...' : 'Predict'}
          </button>
        </div>

        {/* 3. Worker Competency Matcher */}
        <div className="ai-tool-card">
          <h3>👷 Worker Competency Matcher</h3>
          <p>Match certifications to task; identify gaps and training</p>
          <div className="ai-input-group"><SiteSelect value={compSite} onChange={setCompSite} /></div>
          <div className="ai-input-group"><textarea placeholder="Task to assign (e.g. 'work at height on scaffolding')" value={compTask} onChange={e => setCompTask(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Required certifications (optional)" value={compRequired} onChange={e => setCompRequired(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => compTask && runAnalysis('competency-match', { task_description: compTask, site_name: compSite || undefined, required_certifications: compRequired })}
            disabled={loading || !compTask}>
            {loading ? 'Matching...' : 'Match'}
          </button>
        </div>

        {/* 4. Environmental Hazard Monitor */}
        <div className="ai-tool-card">
          <h3>🌦️ Environmental Hazard Monitor</h3>
          <p>Weather, AQI, noise, temperature → schedule guidance</p>
          <div className="ai-input-group"><SiteSelect value={envSite} onChange={setEnvSite} /></div>
          <div className="ai-input-group"><input placeholder="Weather forecast (e.g. 'thunderstorms PM')" value={envWeather} onChange={e => setEnvWeather(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="AQI" value={envAQI} onChange={e => setEnvAQI(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Noise (dB)" value={envNoise} onChange={e => setEnvNoise(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Temp (°F)" value={envTemp} onChange={e => setEnvTemp(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => envSite && runAnalysis('environmental-monitor', { site_name: envSite, weather_forecast: envWeather, air_quality_index: envAQI, noise_db: envNoise, temperature_f: envTemp })}
            disabled={loading || !envSite}>
            {loading ? 'Analyzing...' : 'Monitor'}
          </button>
        </div>

        {/* 5. Accident Cost Calculator */}
        <div className="ai-tool-card">
          <h3>💵 Accident Cost Calculator</h3>
          <p>Direct + indirect cost; ROI of safety interventions</p>
          <div className="ai-input-group"><input placeholder="Incident type (e.g. 'fall from height')" value={costType} onChange={e => setCostType(e.target.value)} /></div>
          <div className="ai-input-group">
            <select value={costSeverity} onChange={e => setCostSeverity(e.target.value)}>
              <option value="critical">Critical</option><option value="major">Major</option>
              <option value="moderate">Moderate</option><option value="minor">Minor</option>
            </select>
          </div>
          <div className="ai-input-group"><input placeholder="Days lost" value={costDays} onChange={e => setCostDays(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Direct medical cost ($)" value={costMedical} onChange={e => setCostMedical(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Equipment damage ($)" value={costEquipment} onChange={e => setCostEquipment(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Proposed intervention cost ($)" value={costIntervention} onChange={e => setCostIntervention(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => costType && runAnalysis('accident-cost-calculator', { incident_type: costType, severity: costSeverity, days_lost: costDays, medical_cost: costMedical, equipment_damage: costEquipment, intervention_cost: costIntervention })}
            disabled={loading || !costType}>
            {loading ? 'Calculating...' : 'Calculate'}
          </button>
        </div>

        {/* 6. Contractor Vetting Assistant */}
        <div className="ai-tool-card">
          <h3>📑 Contractor Vetting Assistant</h3>
          <p>Score reliability, flag red flags, generate checklist</p>
          <div className="ai-input-group"><input placeholder="Contractor name" value={vetName} onChange={e => setVetName(e.target.value)} /></div>
          <div className="ai-input-group"><textarea placeholder="Insurance summary" value={vetInsurance} onChange={e => setVetInsurance(e.target.value)} /></div>
          <div className="ai-input-group"><textarea placeholder="References" value={vetReferences} onChange={e => setVetReferences(e.target.value)} /></div>
          <div className="ai-input-group"><textarea placeholder="Past incident history" value={vetIncidents} onChange={e => setVetIncidents(e.target.value)} /></div>
          <div className="ai-input-group"><textarea placeholder="Scope of work" value={vetScope} onChange={e => setVetScope(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => vetName && runAnalysis('contractor-vetting', { contractor_name: vetName, insurance_summary: vetInsurance, references: vetReferences, incident_history: vetIncidents, scope_of_work: vetScope })}
            disabled={loading || !vetName}>
            {loading ? 'Vetting...' : 'Vet Contractor'}
          </button>
        </div>

        {/* 7. Site Photo Analysis */}
        <div className="ai-tool-card">
          <h3>📷 Site Photo Analysis</h3>
          <p>Describe a photo; AI lists hazards, PPE issues, housekeeping</p>
          <div className="ai-input-group"><SiteSelect value={photoSite} onChange={setPhotoSite} /></div>
          <div className="ai-input-group"><input placeholder="Location (e.g. 'Floor 3 east')" value={photoLocation} onChange={e => setPhotoLocation(e.target.value)} /></div>
          <div className="ai-input-group"><textarea placeholder="Describe what is visible in the photo (people, PPE, equipment, environment)..." value={photoDesc} onChange={e => setPhotoDesc(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => photoDesc && runAnalysis('site-photo-analysis', { description: photoDesc, site_name: photoSite || undefined, location: photoLocation })}
            disabled={loading || !photoDesc}>
            {loading ? 'Analyzing...' : 'Analyze Photo'}
          </button>
        </div>

        {/* 8. Safety Bulletin Auto-Generator */}
        <div className="ai-tool-card">
          <h3>📰 Safety Bulletin Generator</h3>
          <p>Auto-compile incidents, trends and toolbox topics</p>
          <div className="ai-input-group">
            <select value={bulletinPeriod} onChange={e => setBulletinPeriod(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div className="ai-input-group"><SiteSelect value={bulletinSite} onChange={setBulletinSite} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => runAnalysis('safety-bulletin', { period: bulletinPeriod, site_name: bulletinSite || undefined })}
            disabled={loading}>
            {loading ? 'Generating...' : 'Generate Bulletin'}
          </button>
        </div>

        {/* ===== Apply pass 4 (mechanical backlog) — 5 new cards ===== */}

        {/* 9. JHA Generator */}
        <div className="ai-tool-card">
          <h3>📝 JHA Generator</h3>
          <p>Step-by-step Job Hazard Analysis with controls and PPE</p>
          <div className="ai-input-group"><SiteSelect value={jhaSite} onChange={setJhaSite} /></div>
          <div className="ai-input-group"><textarea placeholder="Task description (e.g. 'Replace HVAC unit on roof')" value={jhaTask} onChange={e => setJhaTask(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Crew size (e.g. 4)" value={jhaCrew} onChange={e => setJhaCrew(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Equipment used (optional)" value={jhaEquipment} onChange={e => setJhaEquipment(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => jhaTask && runAnalysis('jha-generator', { task: jhaTask, site_name: jhaSite || undefined, crew_size: jhaCrew, equipment_used: jhaEquipment })}
            disabled={loading || !jhaTask}>
            {loading ? 'Generating...' : 'Generate JHA'}
          </button>
        </div>

        {/* 10. LOTO Plan */}
        <div className="ai-tool-card">
          <h3>🔒 Lockout/Tagout Plan</h3>
          <p>OSHA 1910.147 LOTO procedure with isolation steps</p>
          <div className="ai-input-group"><SiteSelect value={lotoSite} onChange={setLotoSite} /></div>
          <div className="ai-input-group"><textarea placeholder="Equipment description (e.g. 'overhead crane #3, 480V, hydraulic hoist')" value={lotoEquipment} onChange={e => setLotoEquipment(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Energy sources (electrical, hydraulic, ...)" value={lotoEnergy} onChange={e => setLotoEnergy(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Scope (e.g. monthly servicing)" value={lotoScope} onChange={e => setLotoScope(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => lotoEquipment && runAnalysis('lockout-tagout-plan', { equipment_description: lotoEquipment, energy_sources: lotoEnergy, site_name: lotoSite || undefined, scope: lotoScope })}
            disabled={loading || !lotoEquipment}>
            {loading ? 'Generating...' : 'Generate LOTO'}
          </button>
        </div>

        {/* 11. Fall Protection Rescue Plan */}
        <div className="ai-tool-card">
          <h3>🪂 Fall Rescue Plan</h3>
          <p>Written rescue plan per OSHA 1926.502(d)(20)</p>
          <div className="ai-input-group"><SiteSelect value={fallSite} onChange={setFallSite} /></div>
          <div className="ai-input-group"><textarea placeholder="Work description (e.g. 'roof edge work, parapet absent')" value={fallWork} onChange={e => setFallWork(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Height (ft)" value={fallHeight} onChange={e => setFallHeight(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Anchor points / system" value={fallAnchors} onChange={e => setFallAnchors(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => fallWork && runAnalysis('fall-protection-rescue-plan', { work_description: fallWork, height_ft: fallHeight, anchor_points: fallAnchors, site_name: fallSite || undefined })}
            disabled={loading || !fallWork}>
            {loading ? 'Generating...' : 'Generate Rescue Plan'}
          </button>
        </div>

        {/* 12. Heat Illness Prevention Plan */}
        <div className="ai-tool-card">
          <h3>🌡️ Heat Illness Prevention</h3>
          <p>Per OSHA / Cal-OSHA 3395 — work-rest, hydration, acclimatization</p>
          <div className="ai-input-group"><SiteSelect value={heatSite} onChange={setHeatSite} /></div>
          <div className="ai-input-group"><input placeholder="Heat index (°F)" value={heatIndex} onChange={e => setHeatIndex(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Humidity (%)" value={heatHumidity} onChange={e => setHeatHumidity(e.target.value)} /></div>
          <div className="ai-input-group">
            <select value={heatIntensity} onChange={e => setHeatIntensity(e.target.value)}>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="heavy">Heavy</option>
              <option value="very heavy">Very Heavy</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => heatSite && runAnalysis('heat-illness-prevention', { site_name: heatSite, heat_index_f: heatIndex, humidity_pct: heatHumidity, work_intensity: heatIntensity })}
            disabled={loading || !heatSite}>
            {loading ? 'Generating...' : 'Generate Plan'}
          </button>
        </div>

        {/* 13. Toolbox Talk Generator */}
        <div className="ai-tool-card">
          <h3>🧰 Toolbox Talk</h3>
          <p>Generate a complete crew toolbox talk script</p>
          <div className="ai-input-group"><SiteSelect value={tbtSite} onChange={setTbtSite} /></div>
          <div className="ai-input-group"><input placeholder="Topic (e.g. 'ladder safety')" value={tbtTopic} onChange={e => setTbtTopic(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Duration (minutes)" value={tbtDuration} onChange={e => setTbtDuration(e.target.value)} /></div>
          <div className="ai-input-group"><input placeholder="Audience (e.g. 'electrical crew')" value={tbtAudience} onChange={e => setTbtAudience(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => tbtTopic && runAnalysis('toolbox-talk-generator', { topic: tbtTopic, duration_min: tbtDuration, audience: tbtAudience, site_name: tbtSite || undefined })}
            disabled={loading || !tbtTopic}>
            {loading ? 'Generating...' : 'Generate Talk'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="ai-response">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span className="loading-text">AI is analyzing your data... This may take a moment.</span>
          </div>
        </div>
      )}

      {/* Active Response */}
      {activeResponse && !loading && (
        <div className="ai-response">
          <div className="ai-response-header">
            <h3>
              <span style={{ fontSize: 24 }}>🤖</span>
              {activeResponse.title}
            </h3>
            <div className="ai-response-meta">
              <span>Model: {activeResponse.model_used}</span>
              <span>Type: {activeResponse.analysis_type?.replace(/_/g, ' ')}</span>
              <span>{new Date(activeResponse.created_at).toLocaleString()}</span>
            </div>
          </div>
          <div className="ai-response-body">
            {formatAIResponse(activeResponse.ai_response)}
          </div>
        </div>
      )}

      {/* History */}
      <div className="ai-history">
        <h3>Analysis History</h3>
        {historyLoading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : analyses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h3>No analyses yet</h3>
            <p>Run your first AI analysis above</p>
          </div>
        ) : (
          analyses.map(a => (
            <div key={a.id} className="ai-history-item" onClick={() => setActiveResponse(a)}>
              <div>
                <h4>{a.title}</h4>
                <div className="meta">
                  {a.analysis_type?.replace(/_/g, ' ')} • {a.site_name} • {new Date(a.created_at).toLocaleString()} • by {a.requested_by}
                </div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDeleteAnalysis(a.id); }}>
                🗑
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
