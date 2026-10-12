import { useState, useEffect } from 'react';
import { departments } from '../../lib/api';
import { LoadingState } from '../../components/UI';
import { extractError } from '../../lib/utils';
import { Building, Plus, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminDepartments() {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'academic', contactReference: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    setLoading(true);
    try {
      const res = await departments.list();
      setDepts(res.data.departments || []);
    } catch (err) { toast.error(extractError(err)); }
    finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await departments.create(form);
      toast.success('Department created');
      setShowCreate(false);
      setForm({ name: '', type: 'academic', contactReference: '' });
      fetch();
    } catch (err) { toast.error(extractError(err)); }
    finally { setSaving(false); }
  }

  async function toggleActive(id, isActive) {
    try {
      await departments.update(id, { isActive: !isActive });
      toast.success(isActive ? 'Deactivated' : 'Activated');
      fetch();
    } catch (err) { toast.error(extractError(err)); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">{depts.length} total departments</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}><Plus size={16} /> Add Department</button>
      </div>

      {showCreate && (
        <div className="glass-card mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200">New Department</h3>
            <button onClick={() => setShowCreate(false)}><X size={18} className="text-slate-400" /></button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" placeholder="Department name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><label className="label">Type</label>
              <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="academic">Academic</option>
                <option value="service">Service</option>
              </select></div>
            <div className="col-span-2"><label className="label">Contact Reference (optional)</label><input className="input" placeholder="Contact info..." value={form.contactReference} onChange={e => setForm(f => ({ ...f, contactReference: e.target.value }))} /></div>
            <div className="col-span-2"><button type="submit" className="btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : null} Create</button></div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead><tr><th>Name</th><th>Type</th><th>Active Staff</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {depts.map(d => (
              <tr key={d.id}>
                <td className="font-medium text-slate-200">{d.name}</td>
                <td><span className={`badge ${d.type === 'academic' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{d.type}</span></td>
                <td>{d._count?.users ?? '—'}/2</td>
                <td><span className={`badge ${d.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>{d.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button className={`btn-sm ${d.isActive ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(d.id, d.isActive)}>
                    {d.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
