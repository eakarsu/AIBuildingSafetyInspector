import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const cardConfigs = [
  { key: 'inspections', path: '/inspections', title: 'Site Inspections', icon: '🔍', color: '#3b82f6', stats: (d) => [
    { label: 'Completed', value: d.completed, cls: 'success' },
    { label: 'Action Required', value: d.action_required, cls: 'danger' }
  ]},
  { key: 'violations', path: '/violations', title: 'Violations', icon: '⚠️', color: '#ef4444', stats: (d) => [
    { label: 'Open', value: d.open, cls: 'warning' },
    { label: 'Critical', value: d.critical, cls: 'danger' },
    { label: 'Fines', value: `$${Number(d.total_fines).toLocaleString()}`, cls: 'danger' }
  ]},
  { key: 'incidents', path: '/incidents', title: 'Incident Reports', icon: '🚨', color: '#f59e0b', stats: (d) => [
    { label: 'Investigating', value: d.investigating, cls: 'warning' },
    { label: 'OSHA Recordable', value: d.recordable, cls: 'danger' }
  ]},
  { key: 'checklists', path: '/checklists', title: 'Safety Checklists', icon: '✅', color: '#22c55e', stats: (d) => [
    { label: 'Overdue', value: d.overdue, cls: 'danger' },
    { label: 'Avg Completion', value: `${d.avg_completion}%`, cls: 'info' }
  ]},
  { key: 'equipment', path: '/equipment', title: 'Equipment', icon: '🏗️', color: '#8b5cf6', stats: (d) => [
    { label: 'Needs Repair', value: d.needs_repair, cls: 'warning' },
    { label: 'Out of Service', value: d.out_of_service, cls: 'danger' }
  ]},
  { key: 'certifications', path: '/certifications', title: 'Worker Certs', icon: '📋', color: '#06b6d4', stats: (d) => [
    { label: 'Expired', value: d.expired, cls: 'danger' },
    { label: 'Expiring Soon', value: d.expiring_soon, cls: 'warning' }
  ]},
  { key: 'training', path: '/training', title: 'Safety Training', icon: '🎓', color: '#ec4899', stats: (d) => [
    { label: 'Upcoming', value: d.upcoming, cls: 'info' },
    { label: 'Completed', value: d.completed, cls: 'success' }
  ]},
  { key: 'hazards', path: '/hazards', title: 'Hazard Assessments', icon: '☢️', color: '#f97316', stats: (d) => [
    { label: 'Extreme', value: d.extreme, cls: 'danger' },
    { label: 'High', value: d.high, cls: 'warning' }
  ]},
  { key: 'documents', path: '/documents', title: 'Compliance Docs', icon: '📄', color: '#14b8a6', stats: (d) => [
    { label: 'Expired', value: d.expired, cls: 'danger' }
  ]},
  { key: 'emergency', path: '/emergency', title: 'Emergency Plans', icon: '🚒', color: '#e11d48', stats: (d) => [
    { label: 'Needs Update', value: d.needs_update, cls: 'warning' }
  ]},
  { key: 'ppe', path: '/ppe', title: 'PPE Inventory', icon: '🦺', color: '#a855f7', stats: (d) => [
    { label: 'Low Stock', value: d.low_stock, cls: 'warning' }
  ]},
  { key: 'corrections', path: '/corrections', title: 'Corrective Actions', icon: '🔧', color: '#0ea5e9', stats: (d) => [
    { label: 'Open', value: d.open, cls: 'warning' },
    { label: 'In Progress', value: d.in_progress, cls: 'info' }
  ]},
  { key: 'analyses', path: '/ai-analysis', title: 'AI Analyses', icon: '🤖', color: '#6366f1', stats: () => [] },
  { key: 'reports', path: '/reports', title: 'Daily Reports', icon: '📊', color: '#84cc16', stats: () => [] }
];

export default function Dashboard({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/api/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="loading-spinner"><div className="spinner"></div><span className="loading-text">Loading dashboard...</span></div>;
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Safety Dashboard</h1>
        <p>AI-powered construction safety management overview</p>
      </div>
      <div className="dashboard-grid">
        {cardConfigs.map(card => {
          const d = data?.[card.key] || {};
          const stats = card.stats(d);
          return (
            <div key={card.key} className="dashboard-card" style={{ '--card-accent': card.color }} onClick={() => navigate(card.path)}>
              <div className="card-header">
                <div className="card-icon" style={{ background: `${card.color}20`, color: card.color }}>
                  {card.icon}
                </div>
              </div>
              <div className="card-title">{card.title}</div>
              <div className="card-value">{d.total || 0}</div>
              {stats.length > 0 && (
                <div className="card-stats">
                  {stats.map((s, i) => (
                    <div key={i} className={`card-stat ${s.cls}`}>
                      <span>{s.value}</span> {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
