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
      toast.error(err.response?.data?.error || 'Analysis failed. Check your OpenRouter API key.');
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
