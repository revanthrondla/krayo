import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Lock, Eye, Users, Save, Plus, Trash2, Mail, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org-context';
import { Loading, EmptyState } from '../../components/States';
import { Modal } from '../../components/Modal';
import type { ProjectSecuritySettings, ProjectMembership } from '../../lib/types';
import { friendlyMessage } from '../../lib/errors';

export function ProjectSecurityPage() {
  const { orgId, projectId } = useParams();
  const { activeProject } = useOrg();
  const [settings, setSettings] = useState<ProjectSecuritySettings | null>(null);
  const [members, setMembers] = useState<ProjectMembership[]>([]);
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [orgMembers, setOrgMembers] = useState<{ user_id: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('Contributor');
  const [adding, setAdding] = useState(false);

  const [form, setForm] = useState({
    restrict_visibility: true,
    require_explicit_membership: true,
    allow_external_comments: false,
    enforce_two_factor: false,
    ip_allowlist: '',
    max_members: 50,
  });

  const fetchData = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [secRes, memRes] = await Promise.all([
        supabase.from('project_security_settings').select('*').eq('project_id', projectId).maybeSingle(),
        supabase.from('project_memberships').select('*').eq('project_id', projectId).order('created_at'),
      ]);
      if (secRes.data) {
        const s = secRes.data as ProjectSecuritySettings;
        setSettings(s);
        setForm({
          restrict_visibility: s.restrict_visibility,
          require_explicit_membership: s.require_explicit_membership,
          allow_external_comments: s.allow_external_comments,
          enforce_two_factor: s.enforce_two_factor,
          ip_allowlist: s.ip_allowlist ?? '',
          max_members: s.max_members,
        });
      }
      const memData = (memRes.data ?? []) as ProjectMembership[];
      setMembers(memData);
      if (memData.length > 0) {
        const { data: emails } = await supabase.rpc('get_user_emails', { user_ids: memData.map((m) => m.user_id) });
        const map: Record<string, string> = {};
        for (const e of (emails ?? []) as { id: string; email: string }[]) map[e.id] = e.email;
        setMemberEmails(map);
      }
      if (orgId) {
        const { data: orgMem } = await supabase.from('org_memberships').select('user_id, role').eq('org_id', orgId);
        setOrgMembers((orgMem ?? []) as { user_id: string; role: string }[]);
      }
    } catch (err) {
      console.error('Failed to load project security:', err);
    }
    setLoading(false);
  }, [projectId, orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const payload = {
        project_id: projectId,
        restrict_visibility: form.restrict_visibility,
        require_explicit_membership: form.require_explicit_membership,
        allow_external_comments: form.allow_external_comments,
        enforce_two_factor: form.enforce_two_factor,
        ip_allowlist: form.ip_allowlist || null,
        max_members: form.max_members,
      };
      if (settings) {
        const { error: err } = await supabase.from('project_security_settings').update(payload).eq('id', settings.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('project_security_settings').insert(payload);
        if (err) throw err;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await fetchData();
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to save security settings'));
    }
    setSaving(false);
  };

  const handleAddMember = async () => {
    if (!projectId || !addUserId.trim()) return;
    setAdding(true); setError(null);
    try {
      const { error: err } = await supabase.from('project_memberships').insert({ project_id: projectId, user_id: addUserId, role: addRole });
      if (err) throw err;
      setAddMemberOpen(false); setAddUserId(''); setAddRole('Contributor');
      await fetchData();
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to add member'));
    }
    setAdding(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the project?')) return;
    await supabase.from('project_memberships').delete().eq('id', memberId);
    await fetchData();
  };

  if (loading) return <Loading label="Loading project security…" />;

  const availableOrgMembers = orgMembers.filter((m) => !members.some((pm) => pm.user_id === m.user_id));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Shield size={20} className="text-thread" /> Security & Members</h1>
        <p className="text-sm text-text-muted mt-0.5">Manage access and security for {activeProject?.name ?? 'this project'}</p>
      </div>

      <div className="card p-5 bg-thread-bg/50 border-thread/20">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} className="text-thread" />
          <span className="text-sm font-semibold text-thread">Project-Level Security</span>
        </div>
        <p className="text-xs text-text-muted">These settings apply to this project only and can tighten (but not loosen) your organization's enterprise security policies.</p>
      </div>

      <div className="card p-5 space-y-5">
        <ToggleRow label="Restrict Project Visibility" description="Only explicit project members can see this project in lists and navigation." value={form.restrict_visibility} onChange={(v) => setForm({ ...form, restrict_visibility: v })} icon={Eye} recommended />
        <ToggleRow label="Require Explicit Membership" description="Users must be added as project members to access any data in this project." value={form.require_explicit_membership} onChange={(v) => setForm({ ...form, require_explicit_membership: v })} icon={Users} recommended />
        <ToggleRow label="Allow External Comments" description="Allow org members who are not project members to leave comments on items." value={form.allow_external_comments} onChange={(v) => setForm({ ...form, allow_external_comments: v })} icon={Mail} />
        <ToggleRow label="Enforce Two-Factor Auth" description="Require 2FA for all members accessing this project (advisory flag for compliance tracking)." value={form.enforce_two_factor} onChange={(v) => setForm({ ...form, enforce_two_factor: v })} icon={Shield} />
        <div>
          <label className="label">Max Project Members</label>
          <input type="number" min={1} className="input" value={form.max_members} onChange={(e) => setForm({ ...form, max_members: Number(e.target.value) })} />
          <p className="text-xs text-text-faint mt-1">Cap on how many users can be added to this project.</p>
        </div>
        <div>
          <label className="label">IP Allowlist (optional)</label>
          <input className="input font-mono text-xs" value={form.ip_allowlist} onChange={(e) => setForm({ ...form, ip_allowlist: e.target.value })} placeholder="192.168.1.0/24, 10.0.0.0/8" />
          <p className="text-xs text-text-faint mt-1">Comma-separated CIDR ranges. Leave blank to allow all IPs.</p>
        </div>
      </div>

      {error && <div className="card p-3 bg-red-50 border-red-200"><p className="text-sm text-red-600 flex items-center gap-2"><AlertCircle size={15} />{error}</p></div>}
      {saved && <div className="card p-3 bg-green-50 border-green-200"><p className="text-sm text-green-600">Security settings saved successfully.</p></div>}

      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : <><Save size={16} /> Save Security Settings</>}
        </button>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Users size={16} className="text-thread" /> Project Members ({members.length})</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddMemberOpen(true)} disabled={availableOrgMembers.length === 0}>
            <Plus size={14} /> Add member
          </button>
        </div>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No project members" message="Add org members to this project so they can access its data." />
        ) : (
          <div className="divide-y divide-line">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-thread-bg flex items-center justify-center text-xs font-bold text-thread shrink-0">
                    {(memberEmails[m.user_id] ?? '?')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{memberEmails[m.user_id] ?? 'Unknown user'}</p>
                    <span className="badge bg-paper text-text-muted text-[10px]">{m.role}</span>
                  </div>
                </div>
                <button className="text-text-faint hover:text-red p-1.5" onClick={() => handleRemoveMember(m.id)} title="Remove member"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Add project member" maxWidth="max-w-sm">
        <div className="space-y-3">
          <div>
            <label className="label">Select org member</label>
            <select className="input" value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
              <option value="">Choose a user…</option>
              {availableOrgMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.user_id.slice(0, 8)}… ({m.role})</option>
              ))}
            </select>
            <p className="text-xs text-text-faint mt-1">Only members of your organization can be added.</p>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={addRole} onChange={(e) => setAddRole(e.target.value)}>
              <option value="Contributor">Contributor</option>
              <option value="ProjectAdmin">Project Admin</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost btn-sm" onClick={() => setAddMemberOpen(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleAddMember} disabled={adding || !addUserId}>{adding ? 'Adding…' : 'Add member'}</button>
        </div>
      </Modal>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange, icon: Icon, recommended }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; icon: React.ElementType; recommended?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-thread-bg flex items-center justify-center shrink-0 mt-0.5"><Icon size={15} className="text-thread" /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text">{label}</p>
            {recommended && <span className="badge bg-thread-bg text-thread text-[10px]">Recommended</span>}
          </div>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <button onClick={() => onChange(!value)} className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-thread' : 'bg-line'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}
