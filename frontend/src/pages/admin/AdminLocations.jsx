import { useState, useEffect } from 'react';
import { locations, departments } from '../../lib/api';
import { LoadingState, Pagination } from '../../components/UI';
import { extractError } from '../../lib/utils';
import { MapPin, Plus, X, Layers } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminLocations() {
  const [locs, setLocs] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ block: '', type: '', status: 'approved' });
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkAddForm, setBulkAddForm] = useState({ block: '', floor: '', startRoom: '', endRoom: '', type: 'classroom' });
  const [bulkAssignForm, setBulkAssignForm] = useState({ block: '', floor: '', ownerDepartmentId: '' });
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => { fetchAll(); }, [page, filters]);
  useEffect(() => { departments.list().then(r => setDepts(r.data.departments || [])); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const params = { page, pageSize: 50, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const res = await locations.list(params);
      setLocs(res.data.locations || []);
      setTotal(res.data.total || 0);
    } catch (err) { toast.error(extractError(err)); }
    finally { setLoading(false); }
  }

  async function handleBulkAdd(e) {
    e.preventDefault();
    setActionLoading('bulkAdd');
    try {
      const res = await locations.bulkAdd(bulkAddForm);
      toast.success(`Added ${res.data.count} locations`);
      setShowBulkAdd(false);
      fetchAll();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  async function handleBulkAssign(e) {
    e.preventDefault();
    setActionLoading('bulkAssign');
    try {
      const res = await locations.bulkAssignOwner(bulkAssignForm);
      toast.success(`Updated ${res.data.count} locations`);
      setShowBulkAssign(false);
      fetchAll();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  async function toggleActive(id, isActive) {
    try {
      await locations.update(id, { isActive: !isActive });
      toast.success(isActive ? 'Deactivated' : 'Activated');
      fetchAll();
    } catch (err) { toast.error(extractError(err)); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="page-subtitle">{total} total locations</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowBulkAdd(!showBulkAdd)}><Layers size={16} /> Bulk Add</button>
          <button className="btn-secondary" onClick={() => setShowBulkAssign(!showBulkAssign)}><Layers size={16} /> Bulk Assign Owner</button>
        </div>
      </div>

      {showBulkAdd && (
        <div className="glass-card mb-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-200">Bulk Add Rooms</h3>
            <button onClick={() => setShowBulkAdd(false)}><X size={18} className="text-slate-400" /></button>
          </div>
          <form onSubmit={handleBulkAdd} className="grid grid-cols-3 gap-3">
            <div><label className="label">Block</label><input className="input" placeholder="A" value={bulkAddForm.block} onChange={e => setBulkAddForm(f => ({ ...f, block: e.target.value }))} required /></div>
            <div><label className="label">Floor</label><input type="number" className="input" placeholder="2" value={bulkAddForm.floor} onChange={e => setBulkAddForm(f => ({ ...f, floor: e.target.value }))} required /></div>
            <div><label className="label">Type</label>
              <select className="select" value={bulkAddForm.type} onChange={e => setBulkAddForm(f => ({ ...f, type: e.target.value }))}>
                <option value="classroom">Classroom</option><option value="lab">Lab</option><option value="washroom">Washroom</option><option value="corridor">Corridor</option>
              </select></div>
            <div><label className="label">Start Room #</label><input type="number" className="input" placeholder="201" value={bulkAddForm.startRoom} onChange={e => setBulkAddForm(f => ({ ...f, startRoom: e.target.value }))} required /></div>
            <div><label className="label">End Room #</label><input type="number" className="input" placeholder="215" value={bulkAddForm.endRoom} onChange={e => setBulkAddForm(f => ({ ...f, endRoom: e.target.value }))} required /></div>
            <div className="flex items-end"><button type="submit" className="btn-primary w-full" disabled={actionLoading === 'bulkAdd'}>{actionLoading === 'bulkAdd' ? <span className="spinner" /> : null} Add Rooms</button></div>
          </form>
        </div>
      )}

      {showBulkAssign && (
        <div className="glass-card mb-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-200">Bulk Assign Owner Department</h3>
            <button onClick={() => setShowBulkAssign(false)}><X size={18} className="text-slate-400" /></button>
          </div>
          <form onSubmit={handleBulkAssign} className="grid grid-cols-2 gap-3">
            <div><label className="label">Block (optional)</label><input className="input" placeholder="All blocks if empty" value={bulkAssignForm.block} onChange={e => setBulkAssignForm(f => ({ ...f, block: e.target.value }))} /></div>
            <div><label className="label">Floor (optional)</label><input type="number" className="input" placeholder="All floors if empty" value={bulkAssignForm.floor} onChange={e => setBulkAssignForm(f => ({ ...f, floor: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Owner Department *</label>
              <select className="select" value={bulkAssignForm.ownerDepartmentId} onChange={e => setBulkAssignForm(f => ({ ...f, ownerDepartmentId: e.target.value }))} required>
                <option value="">Select department...</option>
                {depts.filter(d => d.isActive).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div className="col-span-2"><button type="submit" className="btn-primary" disabled={actionLoading === 'bulkAssign'}>{actionLoading === 'bulkAssign' ? <span className="spinner" /> : null} Assign Owner</button></div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="input max-w-32" placeholder="Block..." value={filters.block} onChange={e => setFilters(f => ({ ...f, block: e.target.value }))} />
        <select className="select max-w-36" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>
          <option value="classroom">Classroom</option><option value="lab">Lab</option>
          <option value="washroom">Washroom</option><option value="corridor">Corridor</option><option value="other">Other</option>
        </select>
        <select className="select max-w-36" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead><tr><th>Name</th><th>Block</th><th>Floor</th><th>Type</th><th>Owner Dept</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {locs.map(loc => (
              <tr key={loc.id}>
                <td className="text-slate-200">{loc.name}</td>
                <td>{loc.block || '—'}</td>
                <td>{loc.floor ?? '—'}</td>
                <td><span className="badge bg-slate-700/60 text-slate-300">{loc.type}</span></td>
                <td className="text-xs">{loc.ownerDepartment?.name || <span className="text-slate-600">None</span>}</td>
                <td><span className={`badge ${loc.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : loc.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>{loc.status}</span></td>
                <td>
                  <button className={`btn-sm ${loc.isActive ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(loc.id, loc.isActive)}>
                    {loc.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination total={total} page={page} pageSize={50} onPageChange={setPage} />
    </div>
  );
}
