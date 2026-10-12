import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { categories, locations, reports } from '../../lib/api';
import { extractError, saveFormDraft, loadFormDraft, clearFormDraft, generateIdempotencyKey } from '../../lib/utils';
import { AlertTriangle, Upload, X, MapPin, Plus, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';

const DRAFT_KEY = 'report_form';

export default function ReportIssuePage() {
  const navigate = useNavigate();

  const [cats, setCats] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [similarIncidents, setSimilarIncidents] = useState([]);
  const [linkToIncident, setLinkToIncident] = useState(null);

  const [form, setForm] = useState(() => {
    const draft = loadFormDraft(DRAFT_KEY);
    return draft || {
      categoryId: '',
      block: '',
      floor: '',
      locationId: '',
      systemNumber: '',
      description: '',
      idempotencyKey: generateIdempotencyKey(),
    };
  });

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [showPropose, setShowPropose] = useState(false);
  const [proposeForm, setProposeForm] = useState({ block: '', floor: '', name: '', type: 'classroom' });
  const [proposedLocation, setProposedLocation] = useState(null);
  const [routingDept, setRoutingDept] = useState(null);

  // Load categories and locations
  useEffect(() => {
    Promise.all([categories.list(), locations.list({ pageSize: 500 })]).then(([catRes, locRes]) => {
      setCats(catRes.data.categories || []);
      const locs = locRes.data.locations || [];
      setAllLocations(locs);
      const uniqueBlocks = [...new Set(locs.filter(l => l.block).map(l => l.block))].sort();
      setBlocks(uniqueBlocks);
    }).catch(console.error).finally(() => setDataLoading(false));
  }, []);

  // Update floors when block changes
  useEffect(() => {
    if (form.block) {
      const blockLocs = allLocations.filter(l => l.block === form.block);
      const uniqueFloors = [...new Set(blockLocs.filter(l => l.floor != null).map(l => l.floor))].sort((a, b) => a - b);
      setFloors(uniqueFloors);
      setForm(f => ({ ...f, floor: '', locationId: '' }));
    }
  }, [form.block, allLocations]);

  // Update rooms when floor changes
  useEffect(() => {
    if (form.block && form.floor !== '') {
      setFilteredLocations(allLocations.filter(l => l.block === form.block && String(l.floor) === String(form.floor)));
    } else if (form.block) {
      setFilteredLocations(allLocations.filter(l => l.block === form.block));
    }
  }, [form.block, form.floor, allLocations]);

  // Save draft on form change
  useEffect(() => {
    saveFormDraft(DRAFT_KEY, form);
  }, [form]);

  // Similar incidents check
  useEffect(() => {
    if (form.categoryId && form.locationId) {
      reports.similar({ categoryId: form.categoryId, locationId: form.locationId })
        .then(res => setSimilarIncidents(res.data.incidents || []))
        .catch(() => setSimilarIncidents([]));
    }
  }, [form.categoryId, form.locationId]);

  // Routing dept preview
  useEffect(() => {
    if (form.categoryId && form.locationId) {
      const cat = cats.find(c => c.id === form.categoryId);
      const loc = allLocations.find(l => l.id === form.locationId);
      if (cat && loc) {
        if (cat.isDepartmentOwned && loc.ownerDepartment) {
          setRoutingDept(loc.ownerDepartment.name);
        } else if (cat.defaultDepartment) {
          setRoutingDept(cat.defaultDepartment.name);
        } else {
          setRoutingDept('Admin (Unassigned)');
        }
      }
    } else {
      setRoutingDept(null);
    }
  }, [form.categoryId, form.locationId, cats, allLocations]);

  const selectedLoc = allLocations.find(l => l.id === form.locationId);
  const selectedCat = cats.find(c => c.id === form.categoryId);

  function handleField(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleFileAdd(e) {
    const newFiles = Array.from(e.target.files);
    const combined = [...files, ...newFiles].slice(0, 3);
    setFiles(combined);
    e.target.value = '';
  }

  function removeFile(idx) {
    setFiles(files.filter((_, i) => i !== idx));
  }

  async function handlePropose() {
    if (!proposeForm.name || !proposeForm.type) { toast.error('Name and type required'); return; }
    try {
      const res = await locations.propose(proposeForm);
      if (res.data.duplicate) {
        toast(`Found existing: "${res.data.suggestion.name}". Using that instead.`, { icon: 'ℹ️' });
        const s = res.data.suggestion;
        setForm(f => ({ ...f, locationId: s.id }));
      } else {
        setProposedLocation(res.data.location);
        toast.success('Location proposed! Your report will be held for admin approval.');
      }
      setShowPropose(false);
    } catch (err) {
      toast.error(extractError(err));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.categoryId) { toast.error('Please select a category'); return; }
    if (!form.locationId && !proposedLocation) { toast.error('Please select a location'); return; }
    if (form.description.length < 10) { toast.error('Description must be at least 10 characters'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      const payload = {
        categoryId: form.categoryId,
        locationId: proposedLocation ? proposedLocation.id : form.locationId,
        description: form.description,
        idempotencyKey: form.idempotencyKey,
        ...(form.systemNumber ? { systemNumber: parseInt(form.systemNumber) } : {}),
        ...(linkToIncident ? { linkToIncidentId: linkToIncident } : {}),
      };
      fd.append('data', JSON.stringify(payload));
      files.forEach(f => fd.append('attachments', f));

      const res = await reports.create(fd);
      clearFormDraft(DRAFT_KEY);
      toast.success(`Ticket ${res.data.report.ticketNumber} submitted!`);
      navigate(`/student/tickets/${res.data.report.ticketNumber}`);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  if (dataLoading) return <div className="flex items-center justify-center h-64"><div className="spinner text-indigo-400 w-8 h-8 border-4" /></div>;

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Report an Issue</h1>
        <p className="page-subtitle">Fill in the details below to submit a campus issue report.</p>
      </div>

      {/* Safety banner */}
      <div className="safety-banner mb-6">
        <AlertTriangle size={16} className="flex-shrink-0" />
        <p className="text-xs">
          <strong>CampusPulse is NOT an emergency service.</strong> For immediate danger, contact college security now.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category */}
        <div className="form-section">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">1</span> Category</h3>
          <div>
            <label className="label">Issue Category *</label>
            <select id="category-select" className="select" value={form.categoryId} onChange={e => handleField('categoryId', e.target.value)} required>
              <option value="">Select a category...</option>
              {cats.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.isSafety ? '⚠️ Safety' : ''}
                </option>
              ))}
            </select>
            {selectedCat?.isSafety && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> Safety issue – auto-set to CRITICAL priority</p>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="form-section">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</span> Location</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Block</label>
              <select id="block-select" className="select" value={form.block} onChange={e => handleField('block', e.target.value)}>
                <option value="">Select block...</option>
                {blocks.map(b => <option key={b} value={b}>Block {b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Floor</label>
              <select id="floor-select" className="select" value={form.floor} onChange={e => handleField('floor', e.target.value)} disabled={!form.block}>
                <option value="">Select floor...</option>
                {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Room / Area *</label>
            <select id="location-select" className="select" value={form.locationId} onChange={e => { handleField('locationId', e.target.value); setProposedLocation(null); }} required={!proposedLocation}>
              <option value="">Select location...</option>
              {filteredLocations.map(l => (
                <option key={l.id} value={l.id}>{l.name} {l.type === 'lab' ? `(Lab, ${l.systemCount} systems)` : ''}</option>
              ))}
            </select>
          </div>

          {/* System number for labs */}
          {selectedLoc?.type === 'lab' && selectedLoc.systemCount && (
            <div className="mt-3">
              <label className="label">System Number (optional)</label>
              <select id="system-number-select" className="select" value={form.systemNumber} onChange={e => handleField('systemNumber', e.target.value)}>
                <option value="">Not applicable / Unknown</option>
                {Array.from({ length: selectedLoc.systemCount }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>System {n}</option>
                ))}
              </select>
            </div>
          )}

          {/* Propose new place */}
          <button type="button" className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1" onClick={() => setShowPropose(!showPropose)}>
            <Plus size={14} /> My place isn't listed – add new place
          </button>

          {showPropose && (
            <div className="mt-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
              <p className="text-xs text-indigo-300 font-medium">Propose a new location</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Block</label>
                  <input className="input" placeholder="e.g. A" value={proposeForm.block} onChange={e => setProposeForm(f => ({ ...f, block: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Floor</label>
                  <input type="number" className="input" placeholder="e.g. 2" value={proposeForm.floor} onChange={e => setProposeForm(f => ({ ...f, floor: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Name *</label>
                <input className="input" placeholder="e.g. Room 215" value={proposeForm.name} onChange={e => setProposeForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Type *</label>
                <select className="select" value={proposeForm.type} onChange={e => setProposeForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="classroom">Classroom</option>
                  <option value="lab">Lab</option>
                  <option value="washroom">Washroom</option>
                  <option value="corridor">Corridor</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button type="button" className="btn-primary btn-sm" onClick={handlePropose}>Submit Proposal</button>
            </div>
          )}

          {proposedLocation && (
            <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs flex items-start gap-2">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <p>Using proposed location: <strong>{proposedLocation.name}</strong>. Report will be held for admin approval.</p>
            </div>
          )}

          {/* Routing preview */}
          {routingDept && (
            <div className="mt-3 p-3 rounded-xl bg-slate-700/30 border border-slate-600/30 text-xs text-slate-400 flex items-center gap-2">
              <MapPin size={12} />
              This issue will be handled by: <strong className="text-slate-200">{routingDept}</strong>
            </div>
          )}
        </div>

        {/* Similar issues */}
        {similarIncidents.length > 0 && !linkToIncident && (
          <div className="glass rounded-2xl p-4 border border-yellow-500/20 bg-yellow-500/5">
            <p className="text-sm text-yellow-300 font-medium mb-3 flex items-center gap-2">
              <Info size={16} /> Similar open issues found in the same area
            </p>
            {similarIncidents.map(inc => (
              <div key={inc.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 mb-2 last:mb-0">
                <div>
                  <p className="text-sm text-slate-200">{inc.category?.name} – {inc.location?.name}</p>
                  <p className="text-xs text-slate-500">Ticket: {inc.reports?.[0]?.ticketNumber || 'N/A'}</p>
                </div>
                <button type="button" className="btn-sm btn-warning" onClick={() => setLinkToIncident(inc.id)}>
                  Same issue
                </button>
              </div>
            ))}
            <button type="button" className="text-xs text-slate-500 hover:text-slate-400 mt-2" onClick={() => setSimilarIncidents([])}>
              Different issue – continue with new report
            </button>
          </div>
        )}

        {linkToIncident && (
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center justify-between">
            <span>✓ Linking to existing incident – your experience will be added.</span>
            <button type="button" onClick={() => setLinkToIncident(null)} className="hover:text-indigo-200"><X size={14} /></button>
          </div>
        )}

        {/* Description */}
        <div className="form-section">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">3</span> Description</h3>
          <div>
            <label className="label">Describe the issue * <span className="text-slate-500">(min 10 characters)</span></label>
            <textarea
              id="description-textarea"
              className="textarea"
              rows={4}
              placeholder="Describe the issue in detail. What's broken? When did you notice it? Any relevant details..."
              value={form.description}
              onChange={e => handleField('description', e.target.value)}
              required
              minLength={10}
            />
            <p className={`text-xs mt-1 ${form.description.length < 10 ? 'text-slate-500' : 'text-emerald-400'}`}>
              {form.description.length} characters
            </p>
          </div>
        </div>

        {/* Attachments */}
        <div className="form-section">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">4</span> Photos (optional)</h3>
          <label className="cursor-pointer">
            <div className="border-2 border-dashed border-slate-700/60 rounded-xl p-6 text-center hover:border-indigo-500/50 transition-colors">
              <Upload size={24} className="mx-auto text-slate-500 mb-2" />
              <p className="text-sm text-slate-400">Click to upload photos</p>
              <p className="text-xs text-slate-600 mt-1">JPG, PNG, WebP · Max 5MB each · Up to 3 photos</p>
            </div>
            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileAdd} disabled={files.length >= 3} />
          </label>
          {files.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {files.map((file, idx) => (
                <div key={idx} className="relative">
                  <img src={URL.createObjectURL(file)} alt="" className="w-20 h-20 object-cover rounded-xl border border-slate-700" />
                  <button type="button" onClick={() => removeFile(idx)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button type="submit" className="btn-primary w-full justify-center btn-lg" disabled={loading}>
          {loading ? <><span className="spinner" /> Submitting...</> : '🚀 Submit Report'}
        </button>
      </form>
    </div>
  );
}
