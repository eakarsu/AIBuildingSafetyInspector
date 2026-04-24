import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function formatValue(value, type) {
  if (value === null || value === undefined) return '—';
  if (type === 'date') return new Date(value).toLocaleDateString();
  if (type === 'money') return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (type === 'boolean') return value === true || value === 'true' ? 'Yes' : 'No';
  if (type === 'progress') return `${value}%`;
  return String(value);
}

function StatusBadge({ value }) {
  if (!value) return '—';
  return <span className={`status-badge ${value}`}>{value.replace(/_/g, ' ')}</span>;
}

function SeverityBadge({ value }) {
  if (!value) return '—';
  return <span className={`severity-badge ${value}`}>{value}</span>;
}

function CellRenderer({ value, type }) {
  if (type === 'status') return <StatusBadge value={value} />;
  if (type === 'severity' || type === 'badge') return <SeverityBadge value={value} />;
  if (type === 'progress') {
    const pct = Number(value) || 0;
    const color = pct === 100 ? '#22c55e' : pct >= 70 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 60, height: 6, background: 'rgba(148,163,184,0.1)', borderRadius: 3 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 12, color }}>{pct}%</span>
      </div>
    );
  }
  return <span>{formatValue(value, type)}</span>;
}

export default function FeaturePage({ config, token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}${config.apiPath}`, { headers, params: { search } });
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  }, [config.apiPath, search, token]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetail(true);
  };

  const handleNew = () => {
    setFormData({});
    setEditMode(false);
    setShowForm(true);
  };

  const handleEdit = () => {
    setFormData({ ...selectedItem });
    setEditMode(true);
    setShowDetail(false);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await axios.delete(`${API}${config.apiPath}/${selectedItem.id}`, { headers });
      toast.success('Deleted successfully');
      setShowDetail(false);
      fetchItems();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editMode) {
        await axios.put(`${API}${config.apiPath}/${formData.id}`, formData, { headers });
        toast.success('Updated successfully');
      } else {
        await axios.post(`${API}${config.apiPath}`, formData, { headers });
        toast.success('Created successfully');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
    setSaving(false);
  };

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>{config.icon} {config.title}</h1>
        <p>Manage and track {config.title.toLowerCase()}</p>
      </div>

      <div className="page-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder={`Search ${config.title.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={handleNew}>+ New {config.title.split(' ').pop()}</button>
          <button className="btn btn-secondary" onClick={fetchItems}>↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div><span className="loading-text">Loading...</span></div>
      ) : items.length === 0 ? (
        <div className="data-table-container">
          <div className="empty-state">
            <div className="empty-icon">{config.icon}</div>
            <h3>No {config.title} Found</h3>
            <p>Create your first entry or adjust your search</p>
          </div>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                {config.tableColumns.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} onClick={() => handleRowClick(item)}>
                  {config.tableColumns.map(col => (
                    <td key={col.key}>
                      <CellRenderer value={item[col.key]} type={col.type} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{config.icon} {config.title} Details</h2>
              <button className="modal-close" onClick={() => setShowDetail(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                {config.detailFields.map(field => (
                  <div key={field.key} className={`detail-field ${field.fullWidth ? 'full-width' : ''}`}>
                    <label>{field.label}</label>
                    <div className={`value ${field.type === 'money' ? 'money' : ''}`}>
                      {field.type === 'status' ? <StatusBadge value={selectedItem[field.key]} /> :
                       field.type === 'severity' ? <SeverityBadge value={selectedItem[field.key]} /> :
                       formatValue(selectedItem[field.key], field.type)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={handleDelete}>🗑 Delete</button>
              <button className="btn btn-primary" onClick={handleEdit}>✏️ Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? '✏️ Edit' : '+ New'} {config.title.split(' ').pop()}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid">
                  {config.formFields.map(field => (
                    <div key={field.key} className={`form-group ${field.fullWidth ? 'full-width' : ''}`}>
                      <label>{field.label} {field.required && '*'}</label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={formData[field.key] || ''}
                          onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                          required={field.required}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={formData[field.key] || ''}
                          onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                          required={field.required}
                        >
                          <option value="">Select...</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type || 'text'}
                          value={formData[field.key] || ''}
                          onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                          required={field.required}
                          step={field.type === 'number' ? 'any' : undefined}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editMode ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
