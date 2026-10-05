import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { UserCog, Trash2, Pencil, Plus, Clock, Calendar, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading, EmptyState } from '../../components/States';
import { Modal } from '../../components/Modal';
import { useOrg } from '../../lib/org-context';
import { lookupUserEmails } from '../../lib/user-lookup';
import type { ResourceAllocation } from '../../lib/types';
import { friendlyMessage } from '../../lib/errors';

interface AssignableUser { id: string; email: string; display_name: string | null; }

export function ResourceAllocationPage() {
  const { projectId, orgId } = useParams();
  const { activeProject } = useOrg();
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<ResourceAllocation | null>(null);
  const [form, setForm] = useState({ user_id: '', hours_per_week: '', start_date: '', end_date: '', role: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId || !orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [allocRes, memRes] = await Promise.all([
        supabase.from('resource_allocations').select('*').eq('project_id', projectId).order('start_date'),
        supabase.from('org_memberships').select('user_id').eq('org_id', orgId),
      ]);
      if (allocRes.error) throw allocRes.error;
      setAllocations((allocRes.data ?? []) as ResourceAllocation[]);

      const userIds = (memRes.data ?? []).map((m: { user_id: string }) => m.user_id);
      if (userIds.length > 0) {
        const [profilesRes, authRes] = await Promise.all([
          supabase.from('user_profiles').select('id, display_name').in('id', userIds),
          lookupUserEmails(userIds),
        ]);
        const emailMap = new Map(((authRes.data ?? []) as { id: string; email: string }[]).map((u) => [u.id, u.email]));
        const nameMap = new Map((profilesRes.data ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
        setUsers(userIds.map((id) => ({ id, email: emailMap.get(id) ?? '', display_name: nameMap.get(id) ?? null })));
      }
    } catch (err) {
      console.error('Failed to load allocations:', err);
    }
    setLoading(false);
  }, [projectId, orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const userName = (id: string) => { const u = userMap.get(id); return u ? (u.display_name || u.email.split('@')[0]) : 'Unknown'; };

  const openAdd = () => { setEditItem(null); setForm({ user_id: '', hours_per_week: '', start_date: '', end_date: '', role: '', notes: '' }); setError(null); setModal(true); };
  const openEdit = (item: ResourceAllocation) => { setEditItem(item); setForm({ user_id: item.user_id, hours_per_week: String(item.hours_per_week), start_date: item.start_date, end_date: item.end_date, role: item.role ?? '', notes: item.notes ?? '' }); setError(null); setModal(true); };

  const handleSave = async () => {
    if (!projectId || !form.user_id || !form.hours_per_week || !form.start_date || !form.end_date) { setError('Member, hours/week, start and end dates are required.'); return; }
    const hpw = parseFloat(form.hours_per_week);
    if (isNaN(hpw) || hpw < 0 || hpw > 168) { setError('Hours per week must be between 0 and 168.'); return; }
    if (form.end_date < form.start_date) { setError('End date must be on or after start date.'); return; }
    setSaving(true); setError(null);
    const payload = {
      project_id: projectId,
      user_id: form.user_id,
      hours_per_week: hpw,
      start_date: form.start_date,
      end_date: form.end_date,
      role: form.role.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editItem) {
        const { error: err } = await supabase.from('resource_allocations').update(payload).eq('id', editItem.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('resource_allocations').insert(payload);
        if (err) throw err;
      }
      setModal(false);
      await loadData();
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to save allocation'));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try { await supabase.from('resource_allocations').delete().eq('id', id); await loadData(); }
    catch (err) { console.error('Failed to delete:', err); }
  };

  // Aggregate: total allocated hours per member for this project
  const memberTotals = new Map<string, number>();
  allocations.forEach((a) => memberTotals.set(a.user_id, (memberTotals.get(a.user_id) ?? 0) + a.hours_per_week));

  if (loading) return <Loading label="Loading resource allocations…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><UserCog size={20} className="text-thread" /> Resource Allocation</h1>
          <p className="text-sm text-text-muted mt-0.5">Track projected hours and involvement timelines for each team member on {activeProject?.name ?? 'this project'}.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={15} /> Add allocation</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <SummaryCard icon={Users} label="Team members allocated" value={memberTotals.size} color="text-thread bg-thread-bg" />
        <SummaryCard icon={Clock} label="Total hours/week projected" value={Array.from(memberTotals.values()).reduce((s, h) => s + h, 0)} color="text-blue-600 bg-blue-50" />
        <SummaryCard icon={Calendar} label="Allocation entries" value={allocations.length} color="text-green-600 bg-green-50" />
      </div>

      {allocations.length === 0 ? (
        <EmptyState icon={UserCog} title="No resource allocations yet" message="Add allocation entries to track each team member's projected hours and the timeline they are involved in this project." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper/50">
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Member</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Role</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Hours/Week</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Start</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">End</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Duration</th>
                <th className="w-20 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => {
                const weeks = Math.max(1, Math.round((new Date(a.end_date).getTime() - new Date(a.start_date).getTime()) / (7 * 86400000)) + 1);
                const totalHours = a.hours_per_week * weeks;
                return (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-text">{userName(a.user_id)}</td>
                    <td className="px-4 py-3 text-text-muted">{a.role ?? '—'}</td>
                    <td className="px-4 py-3"><span className="badge bg-thread-bg text-thread font-mono">{a.hours_per_week}h</span></td>
                    <td className="px-4 py-3 text-text-muted">{new Date(a.start_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-text-muted">{new Date(a.end_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-text-muted">{weeks} wk · {totalHours.toFixed(0)}h total</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1"><button className="text-text-faint hover:text-thread p-1" onClick={() => openEdit(a)}><Pencil size={14} /></button><button className="text-text-faint hover:text-red p-1" onClick={() => handleDelete(a.id)}><Trash2 size={14} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit allocation' : 'Add allocation'}>
        <div className="space-y-3">
          <div>
            <label className="label">Team member</label>
            <select className="input" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} disabled={!!editItem}>
              <option value="">— Select member —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hours / week</label>
              <input type="number" min={0} max={168} step={0.5} className="input" value={form.hours_per_week} onChange={(e) => setForm({ ...form, hours_per_week: e.target.value })} placeholder="20" />
            </div>
            <div>
              <label className="label">Role (optional)</label>
              <input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Lead, QA, Developer…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label">End date</label>
              <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div><label className="label">Notes (optional)</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon size={18} /></div>
        <div><p className="text-2xl font-bold text-text">{value}</p><p className="text-xs text-text-muted">{label}</p></div>
      </div>
    </div>
  );
}
