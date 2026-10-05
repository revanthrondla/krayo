import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, FolderKanban, CheckSquare, Clock, AlertTriangle,
  Globe, Bell, Save, ArrowRight, Calendar, Building2,
  Plus, CreditCard, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useOrg } from '../lib/org-context';
import { supabase } from '../lib/supabase';
import { Loading } from '../components/States';
import { getProfile, upsertProfile, type UserProfile } from '../lib/notifications';
import type { ActionItem, Project, Org } from '../lib/types';
import { friendlyMessage } from '../lib/errors';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Madrid', 'Europe/Amsterdam', 'Africa/Cairo', 'Africa/Johannesburg',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
];

const LANGUAGES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  pt: 'Portuguese', hi: 'Hindi', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  trial: 'bg-gray-100 text-gray-600',
  team: 'bg-blue-50 text-blue-600',
  enterprise: 'bg-thread-bg text-thread',
};
const BILLING_COLORS: Record<string, string> = {
  active: 'bg-green-50 text-green-600',
  trialing: 'bg-yellow-50 text-yellow-700',
  past_due: 'bg-red-50 text-red-600',
  canceled: 'bg-gray-100 text-gray-500',
};

export function UserHomePage() {
  const { user } = useAuth();
  const { orgs, setActiveOrgId, setActiveProjectId, createProject } = useOrg();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myActionItems, setMyActionItems] = useState<ActionItem[]>([]);
  const [allOrgProjects, setAllOrgProjects] = useState<{ org: Org; projects: Project[] }[]>([]);
  const [loading, setLoading] = useState(true);

  // Preferences
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefsForm, setPrefsForm] = useState({ timezone: 'UTC', language: 'en', notification_email: true, notification_mentions: true, notification_assignments: true, display_name: '' });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // New project form state (per org)
  const [newProjectOrgId, setNewProjectOrgId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getProfile();
      setProfile(p);
      if (p) setPrefsForm({ timezone: p.timezone, language: p.language, notification_email: p.notification_email, notification_mentions: p.notification_mentions, notification_assignments: p.notification_assignments, display_name: p.display_name ?? '' });

      const orgProjectPairs: { org: Org; projects: Project[] }[] = [];
      for (const org of orgs) {
        const { data: orgProjects } = await supabase.from('projects').select('*').eq('org_id', org.id).order('created_at');
        orgProjectPairs.push({ org, projects: (orgProjects ?? []) as Project[] });
      }
      setAllOrgProjects(orgProjectPairs);

      if (user) {
        const allProjectIds = orgProjectPairs.flatMap((p) => p.projects.map((proj) => proj.id));
        if (allProjectIds.length > 0) {
          const { data: items } = await supabase
            .from('action_items')
            .select('*')
            .in('project_id', allProjectIds)
            .or(`owner_user_id.eq.${user.id},owner.ilike.%${user.email?.split('@')[0] ?? ''}%`)
            .order('due_date', { ascending: true, nullsFirst: false });
          setMyActionItems((items ?? []) as ActionItem[]);
        }
      }
    } catch (err) { console.error('Failed to load home data:', err); }
    setLoading(false);
  }, [user, orgs]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const updated = await upsertProfile({
        id: user!.id,
        display_name: prefsForm.display_name || null,
        timezone: prefsForm.timezone,
        language: prefsForm.language,
        notification_email: prefsForm.notification_email,
        notification_mentions: prefsForm.notification_mentions,
        notification_assignments: prefsForm.notification_assignments,
      });
      setProfile(updated);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    } catch (err) { console.error('Failed to save preferences:', err); }
    setSavingPrefs(false);
  };

  const openProject = (orgId: string, projectId: string) => {
    setActiveOrgId(orgId);
    setActiveProjectId(projectId);
    navigate(`/app/orgs/${orgId}/projects/${projectId}/overview`);
  };

  const openNewProjectForm = (orgId: string | null) => {
    setNewProjectOrgId(orgId);
    setNewProjectName('');
    setNewProjectDesc('');
    setCreateError(null);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !newProjectOrgId) return;
    const targetOrgId = newProjectOrgId;
    setCreatingProject(true);
    setCreateError(null);
    try {
      setActiveOrgId(targetOrgId);
      const project = await createProject(newProjectName.trim(), newProjectDesc.trim() || null);
      setNewProjectOrgId(null);
      setNewProjectName('');
      setNewProjectDesc('');
      await loadData();
      openProject(targetOrgId, project.id);
    } catch (err) {
      setCreateError(friendlyMessage(err, 'Failed to create project'));
    }
    setCreatingProject(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueItems = myActionItems.filter((a) => a.due_date && a.due_date < todayStr && a.status !== 'Done' && a.status !== 'Cancelled');
  const dueSoonItems = myActionItems.filter((a) => a.due_date && a.due_date >= todayStr && a.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] && a.status !== 'Done' && a.status !== 'Cancelled');
  const openItems = myActionItems.filter((a) => a.status === 'Open' || a.status === 'In Progress');
  const totalProjects = allOrgProjects.reduce((sum, p) => sum + p.projects.length, 0);

  if (loading) return <Loading label="Loading your home…" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Home size={20} className="text-thread" />
            Welcome, {profile?.display_name || user?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {orgs.length} organization{orgs.length !== 1 ? 's' : ''} · {totalProjects} project{totalProjects !== 1 ? 's' : ''} · {myActionItems.length} action item{myActionItems.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowPrefs(!showPrefs)}>
          <Globe size={15} />
          Preferences
          {showPrefs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Preferences panel */}
      {showPrefs && (
        <div className="card p-5 space-y-4 border-thread/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Globe size={16} className="text-thread" /><h2 className="text-sm font-semibold">User Preferences</h2></div>
            <button className="text-text-faint hover:text-text" onClick={() => setShowPrefs(false)}><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Display Name</label>
              <input className="input" value={prefsForm.display_name} onChange={(e) => setPrefsForm({ ...prefsForm, display_name: e.target.value })} placeholder="Your name" />
            </div>
            <div>
              <label className="label">Timezone</label>
              <select className="input" value={prefsForm.timezone} onChange={(e) => setPrefsForm({ ...prefsForm, timezone: e.target.value })}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Language</label>
              <select className="input" value={prefsForm.language} onChange={(e) => setPrefsForm({ ...prefsForm, language: e.target.value })}>
                {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ToggleRow label="Email notifications" icon={<Bell size={14} className="text-text-muted" />} value={prefsForm.notification_email} onChange={(v) => setPrefsForm({ ...prefsForm, notification_email: v })} />
            <ToggleRow label="Notify on @mentions" icon={<span className="text-text-muted text-xs font-bold">@</span>} value={prefsForm.notification_mentions} onChange={(v) => setPrefsForm({ ...prefsForm, notification_mentions: v })} />
            <ToggleRow label="Notify on assignments" icon={<CheckSquare size={14} className="text-text-muted" />} value={prefsForm.notification_assignments} onChange={(v) => setPrefsForm({ ...prefsForm, notification_assignments: v })} />
          </div>
          {prefsSaved && <p className="text-sm text-green-600">Preferences saved.</p>}
          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm" onClick={handleSavePrefs} disabled={savingPrefs}>
              {savingPrefs ? 'Saving…' : <><Save size={15} /> Save Preferences</>}
            </button>
          </div>
        </div>
      )}

      {/* My Action Items */}
      {myActionItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckSquare size={16} className="text-thread" /> My Action Items</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ActionItemCard icon={AlertTriangle} label="Overdue" items={overdueItems} color="text-red-600 bg-red-50" onOpen={openProject} allOrgProjects={allOrgProjects} />
            <ActionItemCard icon={Clock} label="Due This Week" items={dueSoonItems} color="text-orange-600 bg-orange-50" onOpen={openProject} allOrgProjects={allOrgProjects} />
            <ActionItemCard icon={CheckSquare} label="Open" items={openItems} color="text-blue-600 bg-blue-50" onOpen={openProject} allOrgProjects={allOrgProjects} />
          </div>
        </div>
      )}

      {/* Organizations + Projects */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 size={16} className="text-thread" /> Organizations & Projects</h2>

        {allOrgProjects.length === 0 && (
          <div className="card p-8 text-center">
            <Building2 size={32} className="text-text-faint mx-auto mb-3" />
            <p className="text-sm text-text-muted">No organizations yet. Use the org selector in the top bar to create one.</p>
          </div>
        )}

        {allOrgProjects.map(({ org, projects }) => (
          <div key={org.id} className="card overflow-hidden">
            {/* Org header */}
            <div className="flex items-center justify-between px-5 py-4 bg-paper/60 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-thread-bg flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-thread" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-text">{org.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`badge text-[10px] capitalize ${PLAN_COLORS[org.plan] ?? 'bg-gray-100 text-gray-600'}`}>{org.plan}</span>
                    <span className={`badge text-[10px] capitalize ${BILLING_COLORS[org.billing_status] ?? 'bg-gray-100 text-gray-500'}`}>{org.billing_status}</span>
                    <span className="text-xs text-text-faint flex items-center gap-1"><CreditCard size={11} /> {projects.length} project{projects.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => openNewProjectForm(newProjectOrgId === org.id ? null : org.id)}
              >
                {newProjectOrgId === org.id ? <X size={14} /> : <Plus size={14} />}
                {newProjectOrgId === org.id ? 'Cancel' : 'New project'}
              </button>
            </div>

            {/* Inline create project form */}
            {newProjectOrgId === org.id && (
              <div className="px-5 py-4 bg-thread-bg/20 border-b border-line space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Project name</label>
                    <input
                      className="input"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g. ERP Rollout"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                    />
                  </div>
                  <div>
                    <label className="label">Description (optional)</label>
                    <input
                      className="input"
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      placeholder="Brief description"
                    />
                  </div>
                </div>
                {createError && <p className="text-xs text-red-600">{createError}</p>}
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim()}>
                    {creatingProject ? 'Creating…' : 'Create project'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setNewProjectOrgId(null)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Projects list */}
            {projects.length === 0 ? (
              <div className="px-5 py-5 text-sm text-text-muted">No projects yet. Click "New project" to create one.</div>
            ) : (
              <div className="divide-y divide-line">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => openProject(org.id, project.id)}
                    className="flex items-center justify-between w-full px-5 py-3 text-left hover:bg-paper/70 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-thread-bg/60 flex items-center justify-center shrink-0">
                        <FolderKanban size={13} className="text-thread" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text group-hover:text-thread transition-colors">{project.name}</p>
                        {project.description && <p className="text-xs text-text-muted truncate">{project.description}</p>}
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-text-faint group-hover:text-thread transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* My action items zero-state (below orgs so it doesn't dominate) */}
      {myActionItems.length === 0 && totalProjects > 0 && (
        <div className="card p-5 text-center">
          <CheckSquare size={24} className="text-text-faint mx-auto mb-2" />
          <p className="text-sm text-text-muted">No action items assigned to you. You're all caught up.</p>
        </div>
      )}
    </div>
  );
}

function ActionItemCard({ icon: Icon, label, items, color, onOpen, allOrgProjects }: { icon: React.ElementType; label: string; items: ActionItem[]; color: string; onOpen: (orgId: string, projectId: string) => void; allOrgProjects: { org: Org; projects: Project[] }[] }) {
  const findOrgForProject = (projectId: string): { org: Org; project: Project } | null => {
    for (const pair of allOrgProjects) {
      const proj = pair.projects.find((p) => p.id === projectId);
      if (proj) return { org: pair.org, project: proj };
    }
    return null;
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}><Icon size={14} /></div>
        <span className="text-sm font-semibold">{label}</span>
        <span className="badge bg-paper text-text-muted ml-auto">{items.length}</span>
      </div>
      {items.length === 0 ? <p className="text-xs text-text-faint py-2">None</p> : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => {
            const ctx = findOrgForProject(item.project_id);
            return (
              <button key={item.id} className="flex items-center gap-2 w-full text-left hover:bg-paper rounded-lg p-1.5 transition-colors" onClick={() => ctx && onOpen(ctx.org.id, ctx.project.id)}>
                <span className="badge bg-thread-bg text-thread font-mono text-[10px] shrink-0">{item.code}</span>
                <span className="text-xs text-text truncate flex-1">{item.title}</span>
                {item.due_date && <span className="text-[10px] text-text-faint shrink-0 flex items-center gap-0.5"><Calendar size={10} />{new Date(item.due_date).toLocaleDateString()}</span>}
              </button>
            );
          })}
          {items.length > 5 && <p className="text-xs text-text-muted text-center pt-1">+{items.length - 5} more</p>}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-paper/60 border border-line">
      <div className="flex items-center gap-2">{icon}<span className="text-sm">{label}</span></div>
      <button onClick={() => onChange(!value)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-thread' : 'bg-line'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}
