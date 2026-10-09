import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart3, Calendar, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Plus, Pencil, Trash2, ClipboardList, FlaskConical, Bug,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org-context';
import { Modal } from '../../components/Modal';
import { Loading, EmptyState } from '../../components/States';
import type { Milestone, Requirement, TestCase, Defect, ActionItem, RaidEntry } from '../../lib/types';

const PHASES = ['Initiation', 'Planning', 'Execution', 'Monitoring', 'Closure'];
const MILESTONE_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Delayed', 'At Risk'];

interface DashboardData {
  milestones: Milestone[];
  requirements: Requirement[];
  testCases: TestCase[];
  defects: Defect[];
  actionItems: ActionItem[];
  raidEntries: RaidEntry[];
}

export function ExecutiveDashboardPage() {
  const { projectId } = useParams();
  const { activeProject } = useOrg();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<Milestone | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', phase: 'Execution',
    planned_start: '', planned_end: '', actual_start: '', actual_end: '',
    status: 'Not Started', owner: '', progress: 0, sort_order: 0,
  });

  const fetchData = useCallback(async () => {
    if (!projectId) { setData(null); setLoading(false); return; }
    setLoading(true);
    try {
      const [ms, reqs, tcs, defs, ais, raid] = await Promise.all([
        supabase.from('project_milestones').select('*').eq('project_id', projectId).order('sort_order'),
        supabase.from('requirements').select('*').eq('project_id', projectId),
        supabase.from('test_cases').select('*').eq('project_id', projectId),
        supabase.from('defects').select('*').eq('project_id', projectId),
        supabase.from('action_items').select('*').eq('project_id', projectId),
        supabase.from('raid_entries').select('*').eq('project_id', projectId),
      ]);
      setData({
        milestones: (ms.data ?? []) as Milestone[],
        requirements: (reqs.data ?? []) as Requirement[],
        testCases: (tcs.data ?? []) as TestCase[],
        defects: (defs.data ?? []) as Defect[],
        actionItems: (ais.data ?? []) as ActionItem[],
        raidEntries: (raid.data ?? []) as RaidEntry[],
      });
    } catch (err) { console.error('Failed to load dashboard data:', err); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', description: '', phase: 'Execution', planned_start: '', planned_end: '', actual_start: '', actual_end: '', status: 'Not Started', owner: '', progress: 0, sort_order: data?.milestones.length ?? 0 });
    setModal(true);
  };
  const openEdit = (m: Milestone) => {
    setEditItem(m);
    setForm({ name: m.name, description: m.description ?? '', phase: m.phase, planned_start: m.planned_start ?? '', planned_end: m.planned_end ?? '', actual_start: m.actual_start ?? '', actual_end: m.actual_end ?? '', status: m.status, owner: m.owner ?? '', progress: m.progress, sort_order: m.sort_order });
    setModal(true);
  };

  const handleSave = async () => {
    if (!projectId || !form.name.trim()) return;
    const payload = {
      name: form.name.trim(), description: form.description || null, phase: form.phase,
      planned_start: form.planned_start || null, planned_end: form.planned_end || null,
      actual_start: form.actual_start || null, actual_end: form.actual_end || null,
      status: form.status, owner: form.owner || null, progress: Number(form.progress), sort_order: Number(form.sort_order),
    };
    if (editItem) { await supabase.from('project_milestones').update(payload).eq('id', editItem.id); }
    else { await supabase.from('project_milestones').insert({ ...payload, project_id: projectId }); }
    setModal(false); fetchData();
  };

  const handleDelete = async (id: string) => { await supabase.from('project_milestones').delete().eq('id', id); fetchData(); };

  if (loading) return <Loading label="Loading executive dashboard…" />;
  if (!data) return <EmptyState icon={BarChart3} title="No data" message="Select a project to view the executive dashboard." />;

  const todayStr = new Date().toISOString().split('T')[0];
  const totalReqs = data.requirements.length;
  const approvedReqs = data.requirements.filter((r) => r.status === 'Approved' || r.status === 'Implemented').length;
  const totalTcs = data.testCases.length;
  const passTcs = data.testCases.filter((t) => t.status === 'Passed').length;
  const failTcs = data.testCases.filter((t) => t.status === 'Failed').length;
  const totalDefs = data.defects.length;
  const openDefs = data.defects.filter((d) => d.status === 'Open' || d.status === 'In Progress').length;
  const openCriticalDefs = data.defects.filter((d) => (d.status === 'Open' || d.status === 'In Progress') && d.severity === 'Critical').length;
  const openDefSeverityCounts = ['Critical', 'High', 'Medium', 'Low'].map((sev) => {
    const count = data.defects.filter((d) => (d.status === 'Open' || d.status === 'In Progress') && d.severity === sev).length;
    return { sev, count };
  }).filter((s) => s.count > 0);
  const openDefSeveritySummary = openDefSeverityCounts.length > 0
    ? openDefSeverityCounts.map((s) => `${s.count} ${s.sev.toLowerCase()}`).join(' · ')
    : '0 open';
  const totalAis = data.actionItems.length;
  const openAis = data.actionItems.filter((a) => a.status === 'Open' || a.status === 'In Progress').length;
  const doneAis = data.actionItems.filter((a) => a.status === 'Done').length;
  const openRisks = data.raidEntries.filter((r) => r.type === 'Risk' && r.status === 'Open').length;
  const openIssues = data.raidEntries.filter((r) => r.type === 'Issue' && r.status === 'Open').length;

  const pastDueAis = data.actionItems.filter((a) => a.due_date && a.due_date < todayStr && a.status !== 'Done' && a.status !== 'Cancelled');
  const completedMs = data.milestones.filter((m) => m.status === 'Completed').length;
  const inProgressMs = data.milestones.filter((m) => m.status === 'In Progress').length;
  const delayedMs = data.milestones.filter((m) => m.status === 'Delayed').length;
  const atRiskMs = data.milestones.filter((m) => m.status === 'At Risk').length;
  const totalMs = data.milestones.length;
  const pastDueMs = data.milestones.filter((m) => m.planned_end && m.planned_end < todayStr && m.status !== 'Completed');

  const plannedEnds = data.milestones.filter((m) => m.planned_end).map((m) => m.planned_end!);
  const latestPlannedEnd = plannedEnds.length > 0 ? plannedEnds.sort().reverse()[0] : null;
  const delayDays = delayedMs * 7 + pastDueMs.length * 14;
  const projectedEnd = latestPlannedEnd ? new Date(new Date(latestPlannedEnd).getTime() + delayDays * 86400000).toISOString().split('T')[0] : null;

  const overallProgress = totalMs > 0 ? Math.round(data.milestones.reduce((sum, m) => sum + m.progress, 0) / totalMs) : totalReqs > 0 ? Math.round((approvedReqs / totalReqs) * 100) : 0;
  const healthScore = Math.max(0, Math.min(100, 100 - (openDefs * 5) - (openCriticalDefs * 10) - (delayedMs * 10) - (atRiskMs * 5) - (openIssues * 5) - (pastDueAis.length * 3)));
  const healthLabel = healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'At Risk' : 'Critical';
  const healthColor = healthScore >= 80 ? 'text-green-600 bg-green-50' : healthScore >= 60 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';

  const phaseProgress = PHASES.map((phase) => {
    const phaseMs = data.milestones.filter((m) => m.phase === phase);
    return { phase, progress: phaseMs.length > 0 ? Math.round(phaseMs.reduce((sum, m) => sum + m.progress, 0) / phaseMs.length) : 0, count: phaseMs.length };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 size={20} className="text-thread" /> Executive Dashboard</h1><p className="text-sm text-text-muted mt-0.5">{activeProject?.name ?? 'Project'}</p></div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={15} /> Add Milestone</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard icon={CheckCircle2} label="Overall Progress" value={`${overallProgress}%`} color="text-thread" />
        <KpiCard icon={TrendingUp} label="Project Health" value={healthLabel} color={healthColor} />
        <KpiCard icon={ClipboardList} label="Requirements" value={`${approvedReqs}/${totalReqs}`} sub="delivered" />
        <KpiCard icon={FlaskConical} label="Test Pass Rate" value={totalTcs > 0 ? `${Math.round((passTcs / totalTcs) * 100)}%` : '—'} sub={`${passTcs} pass / ${failTcs} fail`} />
        <KpiCard icon={Bug} label="Open Defects" value={String(openDefs)} sub={openDefSeveritySummary} color={openDefs > 0 ? 'text-orange-600' : 'text-green-600'} />
        <KpiCard icon={AlertTriangle} label="Open Risks" value={String(openRisks + openIssues)} sub={`${openRisks} risks / ${openIssues} issues`} color={openRisks + openIssues > 0 ? 'text-orange-600' : 'text-green-600'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Calendar size={16} className="text-thread" /> Project Timeline</h2>
          {data.milestones.length === 0 ? <p className="text-sm text-text-muted py-8 text-center">No milestones yet. Add milestones to track the project timeline.</p> : (
            <div className="space-y-3">
              {data.milestones.map((m) => {
                const isPastDue = m.planned_end && m.planned_end < todayStr && m.status !== 'Completed';
                return (
                  <div key={m.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`badge ${msStatusColor(m.status)} font-mono`}>{m.phase}</span>
                        <span className="text-sm font-medium text-text truncate">{m.name}</span>
                        {isPastDue && <span className="badge bg-red-50 text-red-600 shrink-0"><AlertTriangle size={10} className="mr-0.5" /> Past Due</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-text-muted">{m.planned_end ?? 'No date'}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <button className="text-text-faint hover:text-thread p-1" onClick={() => openEdit(m)}><Pencil size={12} /></button>
                          <button className="text-text-faint hover:text-red p-1" onClick={() => handleDelete(m.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${m.status === 'Completed' ? 'bg-green-500' : m.status === 'Delayed' ? 'bg-red-500' : m.status === 'At Risk' ? 'bg-orange-500' : 'bg-thread'}`} style={{ width: `${m.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono text-text-muted w-9 text-right">{m.progress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock size={16} className="text-thread" /> Projected Completion</h2>
          <div className="space-y-3">
            <div><p className="text-xs text-text-muted mb-1">Planned End Date</p><p className="text-lg font-semibold">{latestPlannedEnd ? formatDate(latestPlannedEnd) : 'Not set'}</p></div>
            <div><p className="text-xs text-text-muted mb-1">Projected End Date</p><p className={`text-lg font-semibold ${delayDays > 0 ? 'text-red-600' : 'text-green-600'}`}>{projectedEnd ? formatDate(projectedEnd) : 'Not set'}</p>{delayDays > 0 && <p className="text-xs text-red-500 mt-0.5">+{delayDays} days projected delay</p>}</div>
            <div className="pt-3 border-t border-line">
              <div className="flex justify-between text-sm mb-1"><span className="text-text-muted">Completed</span><span className="font-medium text-green-600">{completedMs}</span></div>
              <div className="flex justify-between text-sm mb-1"><span className="text-text-muted">In Progress</span><span className="font-medium text-blue-600">{inProgressMs}</span></div>
              <div className="flex justify-between text-sm mb-1"><span className="text-text-muted">Delayed</span><span className="font-medium text-red-600">{delayedMs}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">At Risk</span><span className="font-medium text-orange-600">{atRiskMs}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4">PMBOK Phase Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {phaseProgress.map((pp) => (
            <div key={pp.phase}>
              <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-text">{pp.phase}</span><span className="text-xs font-mono text-text-muted">{pp.progress}%</span></div>
              <div className="h-2 bg-paper rounded-full overflow-hidden mb-1"><div className="h-full bg-thread rounded-full transition-all" style={{ width: `${pp.progress}%` }} /></div>
              <p className="text-[10px] text-text-faint">{pp.count} milestone{pp.count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Past Due Milestones ({pastDueMs.length})</h2>
          {pastDueMs.length === 0 ? <p className="text-sm text-text-muted">No past due milestones.</p> : (
            <div className="space-y-2">{pastDueMs.map((m) => (<div key={m.id} className="flex items-center justify-between text-sm"><span className="font-medium text-text">{m.name}</span><span className="badge bg-red-50 text-red-600">{formatDate(m.planned_end!)}</span></div>))}</div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Past Due Action Items ({pastDueAis.length})</h2>
          {pastDueAis.length === 0 ? <p className="text-sm text-text-muted">No past due action items.</p> : (
            <div className="space-y-2">{pastDueAis.map((a) => (<div key={a.id} className="flex items-center justify-between text-sm"><div className="min-w-0"><span className="font-medium text-text truncate">{a.title}</span>{a.owner && <span className="text-xs text-text-muted ml-2">— {a.owner}</span>}</div><span className="badge bg-red-50 text-red-600 shrink-0 ml-2">{formatDate(a.due_date!)}</span></div>))}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3">Defect Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Total</span><span className="font-medium">{totalDefs}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Open / In Progress</span><span className="font-medium text-orange-600">{openDefs}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Critical (open)</span><span className="font-medium text-red-600">{openCriticalDefs}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Fixed / Verified</span><span className="font-medium text-green-600">{data.defects.filter((d) => d.status === 'Fixed' || d.status === 'Verified').length}</span></div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3">Action Items</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Total</span><span className="font-medium">{totalAis}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Open</span><span className="font-medium text-blue-600">{openAis}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Done</span><span className="font-medium text-green-600">{doneAis}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Past Due</span><span className="font-medium text-red-600">{pastDueAis.length}</span></div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3">RAID Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Open Risks</span><span className="font-medium text-red-600">{openRisks}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Open Issues</span><span className="font-medium text-orange-600">{openIssues}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Assumptions</span><span className="font-medium">{data.raidEntries.filter((r) => r.type === 'Assumption').length}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Dependencies</span><span className="font-medium">{data.raidEntries.filter((r) => r.type === 'Dependency').length}</span></div>
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit milestone' : 'Add milestone'} maxWidth="max-w-xl">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Requirements Gathering" /></div>
            <div><label className="label">Phase</label><select className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>{PHASES.map((p) => <option key={p}>{p}</option>)}</select></div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Planned Start</label><input type="date" className="input" value={form.planned_start} onChange={(e) => setForm({ ...form, planned_start: e.target.value })} /></div>
            <div><label className="label">Planned End</label><input type="date" className="input" value={form.planned_end} onChange={(e) => setForm({ ...form, planned_end: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Actual Start</label><input type="date" className="input" value={form.actual_start} onChange={(e) => setForm({ ...form, actual_start: e.target.value })} /></div>
            <div><label className="label">Actual End</label><input type="date" className="input" value={form.actual_end} onChange={(e) => setForm({ ...form, actual_end: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{MILESTONE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Owner</label><input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="John Doe" /></div>
            <div><label className="label">Progress %</label><input type="number" min={0} max={100} className="input" value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.name.trim()}>Save</button></div>
      </Modal>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2"><Icon size={16} className="text-text-muted" /><span className="text-xs text-text-muted">{label}</span></div>
      <p className={`text-xl font-bold ${color ?? 'text-text'}`}>{value}</p>
      {sub && <p className="text-xs text-text-faint mt-0.5">{sub}</p>}
    </div>
  );
}

function msStatusColor(status: string): string {
  const colors: Record<string, string> = { 'Not Started': 'bg-gray-100 text-gray-600', 'In Progress': 'bg-blue-50 text-blue-600', Completed: 'bg-green-50 text-green-600', Delayed: 'bg-red-50 text-red-600', 'At Risk': 'bg-orange-50 text-orange-600' };
  return colors[status] ?? 'bg-gray-100 text-gray-600';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
