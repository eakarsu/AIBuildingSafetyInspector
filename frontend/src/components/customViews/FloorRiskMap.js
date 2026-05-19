import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const RISK_COLORS = {
  1: '#1a7f37',
  2: '#9bcc4a',
  3: '#f6c344',
  4: '#f08a3e',
  5: '#d63031',
};

export default function FloorRiskMap({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [activeSite, setActiveSite] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/custom-views/risk-map`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setData(r.data);
      } catch (e) {
        if (!cancelled) setErr(e.response?.data?.error || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <div style={{ padding: 12, color: '#94a3b8' }}>Loading risk map…</div>;
  if (err) return <div style={{ padding: 12, color: '#f87171' }}>Error: {err}</div>;
  if (!data?.sites?.length) return <div style={{ padding: 12, color: '#94a3b8' }}>No risk data available.</div>;

  const site = data.sites[activeSite] || data.sites[0];
  const cellSize = 42;

  return (
    <div style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }} data-testid="floor-risk-map">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#e2e8f0' }}>Floor Risk Map</h3>
        <span style={{ color: '#64748b', fontSize: 12 }}>{data.siteCount} sites • {site.zoneCount} zones</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {data.sites.map((s, i) => (
          <button
            key={s.site + i}
            onClick={() => setActiveSite(i)}
            data-testid={`site-tab-${i}`}
            style={{
              padding: '5px 10px',
              fontSize: 12,
              background: i === activeSite ? '#2563eb' : '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {s.site} ({s.maxScore})
          </button>
        ))}
      </div>

      <div style={{ display: 'inline-block', background: '#020617', padding: 10, borderRadius: 8 }}>
        <svg
          width={site.cols * cellSize + (site.cols - 1) * 3}
          height={site.rows * cellSize + (site.rows - 1) * 3}
          data-testid="risk-svg"
        >
          {site.cells.map((c, idx) => {
            const x = c.col * (cellSize + 3);
            const y = c.row * (cellSize + 3);
            return (
              <g key={idx}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={4}
                  fill={RISK_COLORS[c.score] || '#334155'}
                  data-testid={`risk-cell-${idx}`}
                >
                  <title>{`${c.label} (${c.type}) — risk ${c.score}`}</title>
                </rect>
                <text
                  x={x + cellSize / 2}
                  y={y + cellSize / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="white"
                >
                  {c.type === 'violation' ? '!' : c.type === 'hazard' ? 'H' : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#cbd5e1' }}>
            <span style={{ width: 14, height: 14, background: RISK_COLORS[s], borderRadius: 3 }} />
            Risk {s}
          </div>
        ))}
      </div>
    </div>
  );
}
