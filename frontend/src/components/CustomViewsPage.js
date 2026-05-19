import React from 'react';
import FloorRiskMap from './customViews/FloorRiskMap';
import InspectionTrendChart from './customViews/InspectionTrendChart';
import InspectionReportPdf from './customViews/InspectionReportPdf';
import ChecklistEditor from './customViews/ChecklistEditor';

export default function CustomViewsPage({ token }) {
  return (
    <div
      style={{ padding: 24, background: '#0b1120', minHeight: '100vh' }}
      data-testid="custom-views-page"
    >
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: '#f1f5f9' }}>Inspector Views</h1>
        <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: 14 }}>
          Custom synthesized dashboards for building safety inspection workflows —
          floor risk grid, weekly trend, downloadable PDF, and checklist editor.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>
        <FloorRiskMap token={token} />
        <InspectionTrendChart token={token} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: 16 }}>
        <InspectionReportPdf token={token} />
        <ChecklistEditor token={token} />
      </div>
    </div>
  );
}
