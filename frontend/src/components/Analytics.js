import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function Analytics({ token }) {
  const [scorecard, setScorecard] = useState(null);
  const [processes, setProcesses] = useState(null);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          axios.get(`${API}/api/analytics/compliance-scorecard`, { headers }),
          axios.get(`${API}/api/analytics/processes`, { headers }),
        ]);
        setScorecard(s.data);
        setProcesses(p.data);
      } catch (err) {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadInspectionPdf = async () => {
    const id = window.prompt('Inspection ID to download PDF for:');
    if (!id) return;
    try {
      const res = await axios.get(`${API}/api/analytics/inspections/${id}/report/pdf`, { headers, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection_report_${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('PDF download failed');
    }
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner"></div><span className="loading-text">Loading analytics...</span></div>;
  }

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>📊 Compliance Analytics</h1>
        <p>OSHA compliance scorecard, trends, and inspection report exports</p>
      </div>

      {scorecard && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KpiCard label="Overall Compliance Score" value={`${scorecard.overall_compliance_score}%`} accent="#22c55e" />
            <KpiCard label="Total Violations" value={scorecard.summary.total_violations} accent="#3b82f6" />
            <KpiCard label="Resolved" value={scorecard.summary.resolved_violations} accent="#10b981" />
            <KpiCard label="Open" value={scorecard.summary.open_violations} accent="#f59e0b" />
          </div>

          <div className="data-table-container" style={{ marginBottom: 24 }}>
            <h3 style={{ padding: '16px 20px 0', margin: 0 }}>Score by OSHA Category</h3>
            <table className="data-table">
              <thead><tr><th>OSHA Standard</th><th>Total</th><th>Resolved</th><th>Score</th></tr></thead>
              <tbody>
                {scorecard.by_osha_category.map((c, i) => (
                  <tr key={i}><td>{c.osha_standard}</td><td>{c.total}</td><td>{c.resolved}</td><td>{c.score}%</td></tr>
                ))}
                {scorecard.by_osha_category.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="data-table-container" style={{ marginBottom: 24 }}>
            <h3 style={{ padding: '16px 20px 0', margin: 0 }}>12-Month Trend</h3>
            <table className="data-table">
              <thead><tr><th>Month</th><th>Opened</th><th>Resolved</th><th>Compliance %</th></tr></thead>
              <tbody>
                {scorecard.monthly_trend_12mo.map((m, i) => (
                  <tr key={i}><td>{m.month}</td><td>{m.total_opened}</td><td>{m.resolved}</td><td>{m.compliance_rate}%</td></tr>
                ))}
                {scorecard.monthly_trend_12mo.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="data-table-container" style={{ marginBottom: 24 }}>
            <h3 style={{ padding: '16px 20px 0', margin: 0 }}>Top 5 Recurring Violations</h3>
            <table className="data-table">
              <thead><tr><th>Code</th><th>Title</th><th>Occurrences</th><th>Open</th></tr></thead>
              <tbody>
                {scorecard.top_5_recurring_violations.map((v, i) => (
                  <tr key={i}><td>{v.violation_code}</td><td>{v.violation_name}</td><td>{v.occurrence_count}</td><td>{v.open_count}</td></tr>
                ))}
                {scorecard.top_5_recurring_violations.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {processes && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Total Inspections" value={processes.total_inspections} accent="#6366f1" />
          <KpiCard label="Total Violations" value={processes.total_violations} accent="#ef4444" />
          <KpiCard label="Total Incidents" value={processes.total_incidents} accent="#f59e0b" />
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={downloadInspectionPdf}>
          📄 Download OSHA Inspection PDF
        </button>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }) {
  return (
    <div style={{
      background: 'rgba(30,41,59,0.6)',
      border: '1px solid rgba(99,102,241,0.15)',
      borderRadius: 12,
      padding: '20px',
    }}>
      <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent, marginTop: 4 }}>{value}</div>
    </div>
  );
}
