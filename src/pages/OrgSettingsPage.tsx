import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Plus, Trash2, AlertCircle, ChevronDown, X, FolderOpen, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org-context';
import { Loading, EmptyState } from '../components/States';
import { Modal } from '../components/Modal';
import type { OrgMember } from '../lib/types';
import { lookupUserEmails, lookupUserByEmail } from '../lib/user-lookup';
import { friendlyMessage } from '../lib/errors';

interface ProjectAssignment { project_id: string; role: string; }

// ---------------------------------------------------------------------------
// Multi-select dropdown for project assignment
// ---------------------------------------------------------------------------
function ProjectMultiSelect({
  projects,
  assignments,
  onChange,
}: {
  projects: { id: string; name: string }[];
  assignments: Record<string, string>; // projectId -> role (empty = not selected)
  onChange: (next: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = projects.filter((p) => !!assignments[p.id]);
  const label = selected.length === 0 ? 'No projects assigned' : selected.length === 1 ? selected[0].name : `${selected.length} projects`;

  const toggle = (projectId: string) => {
    const next = { ...assignments };
    if (next[projectId]) { delete next[projectId]; } else { next[projectId] = 'Contributor'; }
    onChange(next);
  };

  const setRole = (projectId: string, role: string) => {
    onChange({ ...assignments, [projectId]: role });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left text-sm w-full"
      >
        <span className={selected.length === 0 ? 'text-text-faint' : 'text-text'}>{label}</span>
        <ChevronDown size={15} className={`text-text-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-line rounded-xl shadow-lg overflow-hidden">
          {projects.length === 0 ? (
            <p className="text-xs text-text-muted px-3 py-3">No projects yet.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-line">
              {projects.map((p) => {
                const isSelected = !!assignments[p.id];
                return (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-paper/80 transition-colors">
                    <input
                      type="checkbox"
                      id={`proj-${p.id}`}
                      checked={isSelected}
                      onChange={() => toggle(p.id)}
                      className="w-4 h-4 rounded accent-thread shrink-0"
                    />
                    <label htmlFor={`proj-${p.id}`} className="text-sm flex-1 cursor-pointer truncate">{p.name}</label>
                    {isSelected && (
                      <select
                        value={assignments[p.id]}
                        onChange={(e) => { e.stopPropagation(); setRole(p.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs border border-line rounded px-1.5 py-0.5 bg-paper shrink-0"
                      >
                        <option value="Contributor">Contributor</option>
                        <option value="ProjectAdmin">Project Admin</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 bg-thread-bg text-thread text-xs px-2 py-0.5 rounded-full">
              {p.name}
              <span className="text-thread/60">·</span>
              <span className="text-thread/70">{assignments[p.id]}</span>
              <button type="button" onClick={() => toggle(p.id)} className="ml-0.5 hover:text-red transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline project assignment editor for an existing member row
// ---------------------------------------------------------------------------
function MemberProjectEditor({
  member,
  projects,
  onDone,
}: {
  member: OrgMember;
  projects: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [originalAssignments, setOriginalAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('project_memberships')
        .select('project_id, role')
        .eq('user_id', member.user_id);
      const map: Record<string, string> = {};
      for (const pm of (data ?? []) as ProjectAssignment[]) map[pm.project_id] = pm.role;
      setAssignments(map);
      setOriginalAssignments(map);
      setLoading(false);
    })();
  }, [member.user_id]);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const desired = Object.keys(assignments);
      const original = Object.keys(originalAssignments);
      const toAdd = desired.filter((pid) => !originalAssignments[pid]);
      const toRemove = original.filter((pid) => !assignments[pid]);
      const toUpdate = desired.filter((pid) => originalAssignments[pid] && assignments[pid] !== originalAssignments[pid]);

      if (toAdd.length > 0) {
        const { error: err } = await supabase.from('project_memberships').upsert(
          toAdd.map((pid) => ({ project_id: pid, user_id: member.user_id, role: assignments[pid] })),
          { onConflict: 'user_id,project_id' }
        );
        if (err) throw err;
      }
      for (const pid of toRemove) {
        await supabase.from('project_memberships').delete().eq('project_id', pid).eq('user_id', member.user_id);
      }
      for (const pid of toUpdate) {
        await supabase.from('project_memberships').update({ role: assignments[pid] }).eq('project_id', pid).eq('user_id', member.user_id);
      }
      setOriginalAssignments({ ...assignments });
      onDone();
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to save'));
    }
    setSaving(false);
  };

  if (loading) return <p className="text-xs text-text-muted py-1">Loading…</p>;

  const isDirty = JSON.stringify(assignments) !== JSON.stringify(originalAssignments);

  return (
    <div className="mt-2 pl-12 space-y-2">
      <ProjectMultiSelect projects={projects} assignments={assignments} onChange={setAssignments} />
      {error && <p className="text-xs text-red">{error}</p>}
      {isDirty && (
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm text-xs" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn btn-ghost btn-sm text-xs" onClick={() => { setAssignments(originalAssignments); }}>
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function OrgSettingsPage() {
  const { orgId } = useParams();
  const { activeOrg, projects, createProject, setActiveProjectId, refreshOrgs } = useOrg();
  const navigate = useNavigate();
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [membersLoading, setMembersLoading] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member'); // org role, not project role
  const [inviteProjects, setInviteProjects] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!orgId) { setMembersLoading(false); return; }
    setMembersLoading(true);
    try {
      const { data, error: err } = await supabase.from('org_memberships').select('*').eq('org_id', orgId).order('created_at');
      if (err) throw err;
      const memData = (data ?? []) as OrgMember[];
      setMembers(memData);
      if (memData.length > 0) {
        const { data: emails } = await lookupUserEmails(memData.map((m) => m.user_id));
        const map: Record<string, string> = {};
        for (const e of (emails ?? []) as { id: string; email: string }[]) map[e.id] = e.email;
        setMemberEmails(map);
      }
    } catch (err) { console.error('Failed to load members:', err); }
    setMembersLoading(false);
  }, [orgId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  if (!activeOrg) return <Loading label="Loading organization…" />;

  const handleCreate = async () => {
    if (!projName.trim()) return;
    setCreating(true); setProjError(null);
    try {
      const project = await createProject(projName.trim(), projDesc.trim() || null);
      setProjName(''); setProjDesc('');
      setActiveProjectId(project.id);
      navigate(`/app/orgs/${orgId}/projects/${project.id}/overview`);
    } catch (err) { setProjError(friendlyMessage(err, 'Failed to create project')); }
    setCreating(false);
  };

  const openInvite = () => {
    setInviteEmail(''); setInviteRole('Member'); setInviteProjects({}); setInviteError(null);
    setInviteOpen(true);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    setInviting(true); setInviteError(null);
    try {
      const { data: existingUser, error: lookupErr } = await lookupUserByEmail(inviteEmail.trim());
      if (lookupErr) throw lookupErr;
      const user = existingUser as { id: string; email: string } | null;
      if (!user) {
        setInviteError('No account found with that email. Ask the person to sign up first, then invite them.');
        setInviting(false); return;
      }
      if (members.some((m) => m.user_id === user.id)) {
        setInviteError('This user is already a member of the organization.');
        setInviting(false); return;
      }

      const { error: insertErr } = await supabase.from('org_memberships').insert({ org_id: orgId, user_id: user.id, role: inviteRole });
      if (insertErr) throw insertErr;

      const projectEntries = Object.entries(inviteProjects);
      if (projectEntries.length > 0) {
        const { error: pmErr } = await supabase.from('project_memberships').upsert(
          projectEntries.map(([pid, role]) => ({ project_id: pid, user_id: user.id, role })),
          { onConflict: 'user_id,project_id' }
        );
        if (pmErr) throw pmErr;
      }

      setInviteOpen(false);
      await fetchMembers(); await refreshOrgs();
    } catch (err) { setInviteError(friendlyMessage(err, 'Failed to invite member')); }
    setInviting(false);
  };

  const handleRoleChange = async (member: OrgMember, newRole: string) => {
    await supabase.from('org_memberships').update({ role: newRole }).eq('id', member.id);
    await fetchMembers();
  };

  const handleRemoveMember = async (member: OrgMember) => {
    if (member.role === 'Owner') return;
    if (!confirm(`Remove ${memberEmails[member.user_id] ?? 'this member'} from the organization? They will also lose access to all projects.`)) return;
    await supabase.from('org_memberships').delete().eq('id', member.id);
    await supabase.from('project_memberships').delete().eq('user_id', member.user_id);
    await fetchMembers(); await refreshOrgs();
  };

  const seatCount = activeOrg.license_seats;
  const usedSeats = members.length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-1">Organization Settings</h1>
        <p className="text-sm text-text-muted">Manage your organization, members, and projects.</p>
      </div>

      {/* Org summary */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Organization</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-text-muted">Name</span><span className="font-medium">{activeOrg.name}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Plan</span>
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize">{activeOrg.plan}</span>
              {activeOrg.plan === 'free' && (
                <button className="btn btn-primary btn-sm text-xs" onClick={() => navigate('/app/billing')}>
                  Upgrade <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between"><span className="text-text-muted">Billing</span><span className="font-medium capitalize">{activeOrg.billing_status}</span></div>
          <div className="flex justify-between">
            <span className="text-text-muted">License seats</span>
            <span className={`font-medium ${usedSeats >= seatCount ? 'text-orange-600' : ''}`}>{usedSeats} / {seatCount} used</span>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><Users size={16} className="text-thread" /> Members ({members.length})</h2>
            <p className="text-xs text-text-muted mt-0.5">Invite team members and manage their project access from here.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openInvite} disabled={usedSeats >= seatCount}>
            <Plus size={14} /> Invite member
          </button>
        </div>

        {membersLoading ? <Loading label="Loading members…" /> : members.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" message="Invite team members to your organization." />
        ) : (
          <div className="divide-y divide-line">
            {members.map((m) => {
              const isExpanded = expandedMember === m.id;
              return (
                <div key={m.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-thread-bg flex items-center justify-center text-sm font-bold text-thread shrink-0">
                        {(memberEmails[m.user_id] ?? '?')[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{memberEmails[m.user_id] ?? 'Unknown user'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {m.role === 'Owner' ? (
                            <span className="badge bg-thread-bg text-thread text-[10px]">Owner</span>
                          ) : (
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m, e.target.value)}
                              className="text-xs border border-line rounded-md px-1.5 py-0.5 bg-paper text-text-muted cursor-pointer hover:border-thread"
                            >
                              <option value="Member">Member</option>
                              <option value="Admin">Admin</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="flex items-center gap-1 text-xs text-thread hover:text-thread/80 px-2 py-1 rounded-lg hover:bg-thread-bg transition-colors"
                        onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                      >
                        <FolderOpen size={13} />
                        <span>Projects</span>
                        <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {m.role !== 'Owner' && (
                        <button className="text-text-faint hover:text-red p-1.5 rounded-lg hover:bg-red/5 transition-colors" onClick={() => handleRemoveMember(m)} title="Remove member">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <MemberProjectEditor
                      member={m}
                      projects={projects}
                      onDone={fetchMembers}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {usedSeats >= seatCount && (
          <div className="mt-3 flex items-start gap-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Your organization is at its seat limit ({seatCount}). Remove a member or contact your admin to increase the license seat count.</span>
          </div>
        )}
      </div>

      {/* Projects list */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Projects ({projects.length})</h2>
        {projects.length === 0 ? <p className="text-sm text-text-muted">No projects yet. Create one below.</p> : (
          <div className="space-y-1">
            {projects.map((p) => (
              <button key={p.id} className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-paper transition-colors text-sm" onClick={() => { setActiveProjectId(p.id); navigate(`/app/orgs/${orgId}/projects/${p.id}/overview`); }}>
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-text-muted">{p.description ?? 'No description'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create project */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Create new project</h2>
        <div className="space-y-3">
          <div><label className="label">Project name</label><input className="input" value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="e.g. ERP Rollout" /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={projDesc} onChange={(e) => setProjDesc(e.target.value)} /></div>
          {projError && <p className="text-xs text-red">{projError}</p>}
          <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating || !projName.trim()}>{creating ? 'Creating…' : 'Create project'}</button>
        </div>
      </div>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite member to organization" maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="label">Email address</label>
            <input className="input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" autoFocus />
            <p className="text-xs text-text-faint mt-1">The person must already have a Krayo account.</p>
          </div>
          <div>
            <label className="label">Org role</label>
            <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="Member">Member — can access assigned projects</option>
              <option value="Admin">Admin — can manage org settings and members</option>
            </select>
          </div>
          <div>
            <label className="label">Assign to projects <span className="text-text-faint font-normal">(optional)</span></label>
            <ProjectMultiSelect projects={projects} assignments={inviteProjects} onChange={setInviteProjects} />
            <p className="text-xs text-text-faint mt-1.5">You can always change project access later from this page.</p>
          </div>
          {inviteError && (
            <p className="text-xs text-red flex items-start gap-1.5">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />{inviteError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost btn-sm" onClick={() => setInviteOpen(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? 'Adding…' : 'Add member'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
