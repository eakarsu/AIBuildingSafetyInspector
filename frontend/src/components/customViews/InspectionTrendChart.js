import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function InspectionTrendChart({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/custom-views/inspection-trends`, {
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

  if (loading) return <div style={{ padding: 12, color: '#94a3b8' }}>Loading trends…</div>;
  if (err) return <div style={{ padding: 12, color: '#f87171' }}>Error: {err}</div>;
  if (!data?.series?.length) {
    return (
      <div style={{ padding: 12, color: '#94a3b8', background: '#0f172a', borderRadius: 12 }}>
        No inspection trend data available yet.
      </div>
    );
  }

  const max = Math.max(...data.series.map(s => s.total), 1);
  const width = 600;
  const height = 240;
  const pad = { top: 20, right: 20, bottom: 50, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const barW = Math.max(chartW / data.series.length - 4, 6);

  return (
    <div style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }} data-testid="trend-chart">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#e2e8f0' }}>Inspection Trend</h3>
        <span style={{ color: '#64748b', fontSize: 12 }}>
          {data.totalInspections} inspections / {data.weekCount} weeks
        </span>
      </div>

      <svg width={width} height={height} data-testid="trend-svg" style={{ background: '#020617', borderRadius: 8 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = pad.top + chartH * (1 - p);
          return (
            <g key={i}>
              <line x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="#1e293b" strokeWidth={1} />
              <text x={pad.left - 6} y={y + 3} fontSize={9} fill="#64748b" textAnchor="end">
                {Math.round(max * p)}
              </text>
            </g>
          );
        })}

        {data.series.map((s, i) => {
          const x = pad.left + i * (chartW / data.series.length) + 2;
          const totalH = (s.total / max) * chartH;
          const completedH = (s.completed / max) * chartH;
          const actionH = (s.action_required / max) * chartH;
          const otherH = Math.max(totalH - completedH - actionH, 0);
          let yCursor = pad.top + chartH - totalH;
          const segments = (
            <g key={s.week} data-testid={`bar-${i}`}>
              <rect x={x} y={yCursor} width={barW} height={completedH} fill="#22c55e" rx={2}>
                <title>{s.week}: {s.completed} completed</title>
              </rect>
              <rect x={x} y={yCursor + completedH} width={barW} height={otherH} fill="#64748b" rx={2}>
                <title>{s.week}: {s.pending + s.in_progress} pending/progress</title>
              </rect>
              <rect x={x} y={yCursor + completedH + otherH} width={barW} height={actionH} fill="#ef4444" rx={2}>
                <title>{s.week}: {s.action_required} action required</title>
              </rect>
              {i % 2 === 0 && (
                <text
                  x={x + barW / 2}
                  y={height - pad.bottom + 14}
                  fontSize={9}
                  fill="#94a3b8"
                  textAnchor="middle"
                  transform={`rotate(-35, ${x + barW / 2}, ${height - pad.bottom + 14})`}
                >
                  {s.week.replace(/^\d{4}-/, '')}
                </text>
              )}
            </g>
          );
          return segments;
        })}
      </svg>

      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: '#cbd5e1' }}>
        <Legend color="#22c55e" label="Completed" />
        <Legend color="#64748b" label="Pending / In Progress" />
        <Legend color="#ef4444" label="Action Required" />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 12, height: 12, background: color, borderRadius: 2 }} />
      {label}
    </span>
  );
}
