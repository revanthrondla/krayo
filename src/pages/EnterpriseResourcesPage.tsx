import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart3, Users, Clock, Calendar, ArrowRight, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org-context';
import { lookupUserEmails } from '../lib/user-lookup';
import { Loading, EmptyState } from '../components/States';
import type { ResourceAllocation, Project } from '../lib/types';

interface AssignableUser { id: string; email: string; display_name: string | null; }
interface AllocationWithProject extends ResourceAllocation { project_name: string; project_id_ref: string; }

export function EnterpriseResourcesPage() {
  const { orgId } = useParams();
  const { activeOrg } = useOrg();
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState<AllocationWithProject[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: orgProjects, error: pErr } = await supabase.from('projects').select('*').eq('org_id', orgId).order('name');
      if (pErr) throw pErr;
      const projList = (orgProjects ?? []) as Project[];
      setProjects(projList);
      const projMap = new Map(projList.map((p) => [p.id, p.name]));

      const projectIds = projList.map((p) => p.id);
      let allAllocations: ResourceAllocation[] = [];
      if (projectIds.length > 0) {
        const { data: allocs, error: aErr } = await supabase.from('resource_allocations').select('*').in('project_id', projectIds).order('start_date');
        if (aErr) throw aErr;
        allAllocations = (allocs ?? []) as ResourceAllocation[];
      }
      const enriched: AllocationWithProject[] = allAllocations.map((a) => ({
        ...a,
        project_name: projMap.get(a.project_id) ?? 'Unknown',
        project_id_ref: a.project_id,
      }));
      setAllocations(enriched);

      const userIds = Array.from(new Set(allAllocations.map((a) => a.user_id)));
      if (userIds.length > 0) {
        const [profilesRes, authRes] = await Promise.all([
          supabase.from('user_profiles').select('id, display_name').in('id', userIds),
          lookupUserEmails(userIds),
        ]);
        const emailMap = new Map(((authRes.data ?? []) as { id: string; email: string }[]).map((u) => [u.id, u.email]));
        const nameMap = new Map((profilesRes.data ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
        setUsers(userIds.map((id) => ({ id, email: emailMap.get(id) ?? '', display_name: nameMap.get(id) ?? null })));
      } else {
        setUsers([]);
      }
    } catch (err) { console.error('Failed to load enterprise allocations:', err); }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const userName = (id: string) => { const u = userMap.get(id); return u ? (u.display_name || u.email.split('@')[0]) : 'Unknown'; };

  // Per-member aggregation across all projects
  interface MemberAgg { totalHoursPerWeek: number; entries: AllocationWithProject[]; }
  const memberAgg = new Map<string, MemberAgg>();
  allocations.forEach((a) => {
    const existing = memberAgg.get(a.user_id) ?? { totalHoursPerWeek: 0, entries: [] };
    existing.totalHoursPerWeek += a.hours_per_week;
    existing.entries.push(a);
    memberAgg.set(a.user_id, existing);
  });

  // Per-project aggregation
  interface ProjectAgg { totalHoursPerWeek: number; members: number; }
  const projectAgg = new Map<string, ProjectAgg>();
  allocations.forEach((a) => {
    const existing = projectAgg.get(a.project_id) ?? { totalHoursPerWeek: 0, members: 0 };
    existing.totalHoursPerWeek += a.hours_per_week;
    projectAgg.set(a.project_id, existing);
  });
  const projectMembers = new Map<string, Set<string>>();
  allocations.forEach((a) => {
    const set = projectMembers.get(a.project_id) ?? new Set<string>();
    set.add(a.user_id);
    projectMembers.set(a.project_id, set);
  });

  if (loading) return <Loading label="Loading enterprise resource view…" />;

  const totalHours = allocations.reduce((s, a) => s + a.hours_per_week, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 size={20} className="text-thread" /> Enterprise Resource Allocation</h1>
        <p className="text-sm text-text-muted mt-0.5">Combined view of projected resource hours across all projects in {activeOrg?.name ?? 'your organization'}. Use this to assess team availability and avoid over-allocation.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="Members allocated" value={memberAgg.size} color="text-thread bg-thread-bg" />
        <SummaryCard icon={Building2} label="Projects with allocations" value={projectAgg.size} color="text-blue-600 bg-blue-50" />
        <SummaryCard icon={Clock} label="Total hours/week" value={totalHours} color="text-green-600 bg-green-50" />
        <SummaryCard icon={Calendar} label="Allocation entries" value={allocations.length} color="text-orange-600 bg-orange-50" />
      </div>

      {allocations.length === 0 ? (
        <EmptyState icon={BarChart3} title="No allocations across projects yet" message="Once team members add resource allocations to individual projects, this view will combine them to show availability and capacity across your organization." />
      ) : (
        <>
          {/* Per-member availability table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-line bg-paper/50">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Users size={16} className="text-thread" /> Member Availability</h2>
              <p className="text-xs text-text-muted mt-0.5">Projected weekly hours per member across all projects. A standard work week is 40 hours — values above that indicate potential over-allocation.</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Member</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Projects</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Total hrs/week</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Availability</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(memberAgg.entries()).sort((a, b) => b[1].totalHoursPerWeek - a[1].totalHoursPerWeek).map(([userId, agg]) => {
                  const projCount = new Set(agg.entries.map((e) => e.project_id)).size;
                  const pct = Math.min(100, (agg.totalHoursPerWeek / 40) * 100);
                  const over = agg.totalHoursPerWeek > 40;
                  return (
                    <tr key={userId} className="border-b border-line last:border-0 hover:bg-paper/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-text">{userName(userId)}</td>
                      <td className="px-4 py-3 text-text-muted">{projCount}</td>
                      <td className="px-4 py-3"><span className={`badge font-mono ${over ? 'bg-red-50 text-red-600' : 'bg-thread-bg text-thread'}`}>{agg.totalHoursPerWeek}h</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-line overflow-hidden max-w-[160px]">
                            <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-thread'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs ${over ? 'text-red-600 font-medium' : 'text-text-muted'}`}>{Math.round(pct)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Per-project breakdown */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-line bg-paper/50">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 size={16} className="text-thread" /> Project Breakdown</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Project</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Members</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Total hrs/week</th>
                  <th className="w-16 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {projects.filter((p) => projectAgg.has(p.id)).map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-paper/50 transition-colors group">
                    <td className="px-4 py-3 font-medium text-text">{p.name}</td>
                    <td className="px-4 py-3 text-text-muted">{projectMembers.get(p.id)?.size ?? 0}</td>
                    <td className="px-4 py-3"><span className="badge bg-thread-bg text-thread font-mono">{projectAgg.get(p.id)?.totalHoursPerWeek ?? 0}h</span></td>
                    <td className="px-4 py-3"><button className="text-text-faint hover:text-thread p-1" onClick={() => navigate(`/app/orgs/${orgId}/projects/${p.id}/resources`)}><ArrowRight size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
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
