import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function ChecklistEditor({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const load = useCallback(async (preserveIdx = false) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/custom-views/checklists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(r.data);
      const idx = preserveIdx ? activeIdx : 0;
      if (r.data.checklists?.[idx]) {
        setDraft(r.data.checklists[idx].items.map(i => ({ ...i })));
      }
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [token, activeIdx]);

  useEffect(() => {
    load(false);
  }, [token]); // eslint-disable-line

  useEffect(() => {
    if (data?.checklists?.[activeIdx]) {
      setDraft(data.checklists[activeIdx].items.map(i => ({ ...i })));
      setSavedAt(null);
    }
  }, [activeIdx, data]);

  const toggle = (i) => {
    const next = [...draft];
    next[i] = { ...next[i], checked: !next[i].checked };
    setDraft(next);
  };
  const updateLabel = (i, val) => {
    const next = [...draft];
    next[i] = { ...next[i], label: val };
    setDraft(next);
  };
  const addItem = () => {
    setDraft([...draft, { index: draft.length, label: 'New check', checked: false }]);
  };
  const removeItem = (i) => {
    setDraft(draft.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!data?.checklists?.[activeIdx]) return;
    const id = data.checklists[activeIdx].id;
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/custom-views/checklists/${id}`,
        { items: draft },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedAt(new Date().toLocaleTimeString());
      await load(true);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 12, color: '#94a3b8' }}>Loading checklists…</div>;
  if (err) return <div style={{ padding: 12, color: '#f87171' }}>Error: {err}</div>;
  if (!data?.checklists?.length) return <div style={{ padding: 12, color: '#94a3b8' }}>No checklists found.</div>;

  const active = data.checklists[activeIdx];
  const completed = draft.filter(i => i.checked).length;

  return (
    <div style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }} data-testid="checklist-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#e2e8f0' }}>Checklist Editor</h3>
        <span style={{ color: '#64748b', fontSize: 12 }}>{data.count} checklists</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14 }}>
        <div style={{ background: '#020617', padding: 8, borderRadius: 8, maxHeight: 360, overflowY: 'auto' }}>
          {data.checklists.map((c, i) => (
            <div
              key={c.id}
              onClick={() => setActiveIdx(i)}
              data-testid={`checklist-item-${i}`}
              style={{
                padding: '8px 10px',
                marginBottom: 4,
                background: i === activeIdx ? '#2563eb' : 'transparent',
                color: '#e2e8f0',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>{c.checklist_name || `Checklist ${c.id}`}</div>
              <div style={{ color: i === activeIdx ? '#dbeafe' : '#64748b', fontSize: 10 }}>
                {c.site_name} • {c.completion_percentage || 0}%
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#020617', padding: 12, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{active.checklist_name}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>
                {completed} / {draft.length} done ({draft.length ? Math.round((completed / draft.length) * 100) : 0}%)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={addItem}
                data-testid="checklist-add-btn"
                style={{ padding: '5px 10px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              >
                + Item
              </button>
              <button
                onClick={save}
                disabled={saving}
                data-testid="checklist-save-btn"
                style={{ padding: '5px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, cursor: saving ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {draft.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
                <input
                  type="checkbox"
                  checked={!!item.checked}
                  onChange={() => toggle(i)}
                  data-testid={`item-check-${i}`}
                  style={{ cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateLabel(i, e.target.value)}
                  data-testid={`item-label-${i}`}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    color: '#e2e8f0',
                    padding: '5px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={() => removeItem(i)}
                  data-testid={`item-remove-${i}`}
                  style={{ background: 'transparent', color: '#f87171', border: 'none', cursor: 'pointer', fontSize: 14 }}
                  title="remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {savedAt && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#34d399' }} data-testid="checklist-saved-msg">
              Saved at {savedAt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
