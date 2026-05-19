import React, { useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function InspectionReportPdf({ token }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [lastSize, setLastSize] = useState(null);

  const fetchPdf = async () => {
    const r = await axios.get(`${API}/api/custom-views/inspection-report.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });
    return new Blob([r.data], { type: 'application/pdf' });
  };

  const handle = async (mode) => {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await fetchPdf();
      setLastSize(blob.size);
      const url = URL.createObjectURL(blob);
      if (mode === 'open') {
        window.open(url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `inspection-report-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setMsg(`Report generated (${blob.size.toLocaleString()} bytes)`);
    } catch (e) {
      setMsg(`Error: ${e.response?.data?.error || e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }} data-testid="pdf-card">
      <h3 style={{ margin: '0 0 8px 0', color: '#e2e8f0' }}>Inspection Report PDF</h3>
      <p style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: 13 }}>
        Consolidated PDF summarizing recent site inspections, open violations and
        OSHA-recordable incidents. Generated server-side via pdfkit.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => handle('download')}
          disabled={busy}
          data-testid="pdf-download-btn"
          style={{
            padding: '8px 14px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: busy ? 'wait' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {busy ? 'Generating…' : 'Download PDF'}
        </button>
        <button
          onClick={() => handle('open')}
          disabled={busy}
          data-testid="pdf-open-btn"
          style={{
            padding: '8px 14px',
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 6,
            cursor: busy ? 'wait' : 'pointer',
            fontSize: 13,
          }}
        >
          Open in new tab
        </button>
      </div>
      {msg && (
        <div
          style={{ marginTop: 10, color: msg.startsWith('Error') ? '#f87171' : '#34d399', fontSize: 12 }}
          data-testid="pdf-msg"
        >
          {msg}
        </div>
      )}
      {lastSize !== null && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
          Last PDF size: {lastSize.toLocaleString()} bytes
        </div>
      )}
    </div>
  );
}
