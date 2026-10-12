import { useState, useEffect } from 'react';
import { users, departments } from '../../lib/api';
import { LoadingState, ErrorState } from '../../components/UI';
import { formatDate, extractError } from '../../lib/utils';
import { Users, Plus, X, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminStaff() {
  const [staffList, setStaffList] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', departmentId: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [filterDept, setFilterDept] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    setError('');
    try {
      const [staffRes, deptRes] = await Promise.all([
        users.list({ role: 'STAFF' }),
        departments.list(),
      ]);
      setStaffList(staffRes.data.users || []);
      setDepts(deptRes.data.departments || []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await users.create({ ...createForm, role: 'STAFF' });
      toast.success('Staff account created');
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', departmentId: '' });
      fetchAll();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setCreateLoading(false);
    }
  }

  async function toggleActive(staffId, isActive) {
    try {
      await users.update(staffId, { isActive: !isActive });
      toast.success(isActive ? 'Staff deactivated' : 'Staff activated');
      fetchAll();
    } catch (err) {
      toast.error(extractError(err));
    }
  }

  async function toggleLeave(staffId, onLeave) {
    try {
      await users.update(staffId, { onLeave: !onLeave });
      toast.success(!onLeave ? 'Staff marked on leave' : 'Leave cancelled');
      fetchAll();
    } catch (err) {
      toast.error(extractError(err));
    }
  }

  // Group staff by department
  const staffByDept = depts.reduce((acc, d) => {
    acc[d.id] = { dept: d, staff: staffList.filter(s => s.departmentId === d.id) };
    return acc;
  }, {});

  const filteredDepts = filterDept ? { [filterDept]: staffByDept[filterDept] } : staffByDept;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">{staffList.length} staff across {depts.length} departments (max 2 per dept)</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* Create staff form */}
      {showCreate && (
        <div className="glass-card mb-6 animate-fade-in">
          <h3 className="font-semibold text-slate-200 mb-4 flex items-center justify-between">
            New Staff Account
            <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
          </h3>
          <div className="safety-banner mb-4">
            <AlertTriangle size={14} />
            <p className="text-xs">Maximum 2 active staff per department. The system will reject this if the cap is reached.</p>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" placeholder="Staff name" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="staff.dept@svecw.edu.in" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="Min 8 chars" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
            </div>
            <div>
              <label className="label">Department</label>
              <select className="select" value={createForm.departmentId} onChange={e => setCreateForm(f => ({ ...f, departmentId: e.target.value }))} required>
                <option value="">Select department...</option>
                {depts.filter(d => d.isActive).map(d => {
                  const count = staffByDept[d.id]?.staff.filter(s => s.isActive).length || 0;
                  return <option key={d.id} value={d.id} disabled={count >= 2}>{d.name} ({count}/2 staff) {count >= 2 ? '— FULL' : ''}</option>;
                })}
              </select>
            </div>
            <div className="col-span-2">
              <button type="submit" className="btn-primary" disabled={createLoading}>
                {createLoading ? <span className="spinner" /> : <Plus size={16} />} Create Staff Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4">
        <select className="select max-w-xs" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Dept cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(filteredDepts).filter(Boolean).map(({ dept, staff: deptStaff }) => {
          const activeStaff = deptStaff.filter(s => s.isActive);
          const capReached = activeStaff.length >= 2;
          return (
            <div key={dept.id} className={`glass-card ${!dept.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-200 text-sm">{dept.name}</p>
                  <p className="text-xs text-slate-500">{dept.type}</p>
                </div>
                <div className={`badge ${capReached ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {activeStaff.length}/2
                </div>
              </div>
              <div className="space-y-2">
                {deptStaff.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">No staff assigned</p>
                ) : deptStaff.map(s => (
                  <div key={s.id} className={`p-2 rounded-xl ${s.isActive ? 'bg-slate-800/50' : 'bg-slate-900/50 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-200">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.email}</p>
                        <div className="flex gap-1 mt-1">
                          {!s.isActive && <span className="badge bg-slate-700 text-slate-400">Inactive</span>}
                          {s.onLeave && <span className="badge bg-yellow-500/20 text-yellow-300">On Leave</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button className={`btn-sm text-xs ${s.isActive ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(s.id, s.isActive)}>
                          {s.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {s.isActive && (
                          <button className={`btn-sm text-xs ${s.onLeave ? 'btn-primary' : 'btn-warning'}`} onClick={() => toggleLeave(s.id, s.onLeave)}>
                            {s.onLeave ? 'End Leave' : 'Set Leave'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
