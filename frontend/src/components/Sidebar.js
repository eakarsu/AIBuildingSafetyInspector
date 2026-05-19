import React from 'react';
import { NavLink } from 'react-router-dom';
import { featureConfigs } from '../config/features';

export default function Sidebar({ open, onToggle, user, onLogout }) {
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('') || 'U';

  return (
    <div className={`sidebar ${open ? '' : 'collapsed'}`}>
      <button className="sidebar-toggle" onClick={onToggle}>
        {open ? '◀' : '▶'}
      </button>
      <div className="sidebar-header">
        <div className="logo-sm">🏗️</div>
        {open && <h2>Safety Inspector</h2>}
      </div>
      <nav className="sidebar-nav">
        {open && <div className="nav-section">Overview</div>}
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">📊</span>
          {open && 'Dashboard'}
        </NavLink>
        {open && <div className="nav-section">Management</div>}
        {featureConfigs.map(config => (
          <NavLink key={config.key} to={config.path} className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">{config.icon}</span>
            {open && config.title}
          </NavLink>
        ))}
        {open && <div className="nav-section">Insights</div>}
        <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">📊</span>
          {open && 'Compliance Analytics'}
        </NavLink>
        {open && <div className="nav-section">AI Tools</div>}
        <NavLink to="/ai-analysis" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">🤖</span>
          {open && 'AI Analysis'}
        </NavLink>
        {open && <div className="nav-section">Integrations</div>}
        <NavLink to="/webhooks" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">🔔</span>
          {open && 'Webhooks'}
        </NavLink>
        <NavLink to="/custom-views" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">🗺️</span>
          {open && 'Inspector Views'}
        </NavLink>
      </nav>
      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        {open && (
          <>
            <div className="user-info">
              <h4>{user?.full_name}</h4>
              <p>{user?.role}</p>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Logout">⏻</button>
          </>
        )}
      </div>
    </div>
  );
}
