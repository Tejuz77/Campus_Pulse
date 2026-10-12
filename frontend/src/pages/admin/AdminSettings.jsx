import { useState, useEffect } from 'react';
import { settingsApi } from '../../lib/api';
import { LoadingState } from '../../components/UI';
import { extractError } from '../../lib/utils';
import { Settings, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

const EDITABLE_SETTINGS = [
  { key: 'SAFETY_BANNER', label: 'Safety Banner Text', type: 'textarea' },
  { key: 'CONFIRM_WINDOW_HOURS', label: 'Confirmation Window (hours)', type: 'number' },
  { key: 'REOPEN_WINDOW_DAYS', label: 'Reopen Window (days)', type: 'number' },
  { key: 'REPORTS_PER_HOUR', label: 'Max Reports per Hour per Student', type: 'number' },
  { key: 'ESCALATION_CRITICAL_RESPONSE_H', label: 'Critical Response Threshold (hours)', type: 'number' },
  { key: 'ESCALATION_CRITICAL_RESOLUTION_H', label: 'Critical Resolution Threshold (hours)', type: 'number' },
  { key: 'ESCALATION_HIGH_RESPONSE_H', label: 'High Response Threshold (hours)', type: 'number' },
  { key: 'ESCALATION_HIGH_RESOLUTION_H', label: 'High Resolution Threshold (hours)', type: 'number' },
  { key: 'ESCALATION_MEDIUM_RESPONSE_H', label: 'Medium Response Threshold (hours)', type: 'number' },
  { key: 'ESCALATION_MEDIUM_RESOLUTION_H', label: 'Medium Resolution Threshold (hours)', type: 'number' },
  { key: 'ESCALATION_LOW_RESPONSE_H', label: 'Low Response Threshold (hours)', type: 'number' },
  { key: 'ESCALATION_LOW_RESOLUTION_H', label: 'Low Resolution Threshold (hours)', type: 'number' },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState({});
  const [editReasons, setEditReasons] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    setLoading(true);
    try {
      const res = await settingsApi.list();
      setSettings(res.data.settings || {});
      setEditValues(res.data.settings || {});
    } catch (err) { toast.error(extractError(err)); }
    finally { setLoading(false); }
  }

  async function handleSave(key) {
    if (!editReasons[key]) { toast.error('Reason required for admin override'); return; }
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await settingsApi.update({ key, value: editValues[key], reason: editReasons[key] });
      toast.success(`Setting "${key}" updated`);
      setEditReasons(r => ({ ...r, [key]: '' }));
      fetch();
    } catch (err) { toast.error(extractError(err)); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Settings size={22} /> System Settings</h1>
        <p className="page-subtitle">All changes are audited. A reason is required.</p>
      </div>

      <div className="space-y-4">
        {EDITABLE_SETTINGS.map(s => (
          <div key={s.key} className="glass-card">
            <label className="label text-slate-200 font-semibold">{s.label}</label>
            <p className="text-xs text-slate-500 mb-2 font-mono">{s.key}</p>
            {s.type === 'textarea' ? (
              <textarea className="textarea mb-3" rows={3} value={editValues[s.key] || ''} onChange={e => setEditValues(v => ({ ...v, [s.key]: e.target.value }))} />
            ) : (
              <input type="number" className="input mb-3" value={editValues[s.key] || ''} onChange={e => setEditValues(v => ({ ...v, [s.key]: e.target.value }))} />
            )}
            <input className="input mb-2" placeholder="Reason for change (required for audit)..." value={editReasons[s.key] || ''} onChange={e => setEditReasons(r => ({ ...r, [s.key]: e.target.value }))} />
            <button
              className="btn-primary btn-sm"
              onClick={() => handleSave(s.key)}
              disabled={saving[s.key] || editValues[s.key] === settings[s.key]}
            >
              {saving[s.key] ? <span className="spinner" /> : <Save size={14} />} Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
