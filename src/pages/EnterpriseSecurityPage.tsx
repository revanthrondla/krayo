import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Eye, Users, Settings, Shield, Building2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org-context';
import { Loading } from '../components/States';
import type { EnterpriseSecuritySettings } from '../lib/types';
import { friendlyMessage } from '../lib/errors';

export function EnterpriseSecurityPage() {
  const { orgId } = useParams();
  const { activeOrg } = useOrg();
  const [settings, setSettings] = useState<EnterpriseSecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    restrict_project_visibility: true,
    require_project_membership: true,
    allow_cross_project_data: false,
    enforce_data_isolation: true,
    max_projects_per_org: 50,
    sso_required: false,
    ip_allowlist: '',
  });

  const fetchSettings = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('enterprise_security_settings')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();
      if (err) throw err;
      if (data) {
        const s = data as EnterpriseSecuritySettings;
        setSettings(s);
        setForm({
          restrict_project_visibility: s.restrict_project_visibility,
          require_project_membership: s.require_project_membership,
          allow_cross_project_data: s.allow_cross_project_data,
          enforce_data_isolation: s.enforce_data_isolation,
          max_projects_per_org: s.max_projects_per_org,
          sso_required: s.sso_required,
          ip_allowlist: s.ip_allowlist ?? '',
        });
      }
    } catch (err) {
      console.error('Failed to load security settings:', err);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const payload = {
        org_id: orgId,
        restrict_project_visibility: form.restrict_project_visibility,
        require_project_membership: form.require_project_membership,
        allow_cross_project_data: form.allow_cross_project_data,
        enforce_data_isolation: form.enforce_data_isolation,
        max_projects_per_org: form.max_projects_per_org,
        sso_required: form.sso_required,
        ip_allowlist: form.ip_allowlist || null,
      };
      if (settings) {
        const { error: err } = await supabase.from('enterprise_security_settings').update(payload).eq('id', settings.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('enterprise_security_settings').insert(payload);
        if (err) throw err;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await fetchSettings();
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to save security settings'));
    }
    setSaving(false);
  };

  if (loading) return <Loading label="Loading security settings…" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Shield size={20} className="text-thread" /> Enterprise Security</h1>
        <p className="text-sm text-text-muted mt-0.5">Control data access and security for {activeOrg?.name ?? 'your organization'}</p>
      </div>

      <div className="card p-5 bg-thread-bg/50 border-thread/20">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={16} className="text-thread" />
          <span className="text-sm font-semibold text-thread">Enterprise Isolation Active</span>
        </div>
        <p className="text-xs text-text-muted">All data in this enterprise is restricted to your organization's users only. Users from other enterprises cannot access any of your data. This is enforced at the database level.</p>
      </div>

      <div className="card p-5 space-y-5">
        <ToggleRow
          label="Enforce Data Isolation"
          description="Strictly isolate all org data from other enterprises. When enabled, RLS ensures no cross-organization data leakage is possible."
          value={form.enforce_data_isolation}
          onChange={(v) => setForm({ ...form, enforce_data_isolation: v })}
          icon={Lock}
          recommended
        />
        <ToggleRow
          label="Restrict Project Visibility"
          description="Users only see projects they are explicit members of. When disabled, all org members can see all projects."
          value={form.restrict_project_visibility}
          onChange={(v) => setForm({ ...form, restrict_project_visibility: v })}
          icon={Eye}
          recommended
        />
        <ToggleRow
          label="Require Project Membership"
          description="Users must be added as project members to access any project data. When disabled, all org members can access all project data."
          value={form.require_project_membership}
          onChange={(v) => setForm({ ...form, require_project_membership: v })}
          icon={Users}
          recommended
        />
        <ToggleRow
          label="Allow Cross-Project Data"
          description="Allow data references between projects within your enterprise. When disabled, each project's data is fully self-contained."
          value={form.allow_cross_project_data}
          onChange={(v) => setForm({ ...form, allow_cross_project_data: v })}
          icon={Settings}
        />
        <ToggleRow
          label="Require SSO"
          description="Require single sign-on authentication for all enterprise members."
          value={form.sso_required}
          onChange={(v) => setForm({ ...form, sso_required: v })}
          icon={Shield}
        />
        <div>
          <label className="label">Max Projects per Enterprise</label>
          <input type="number" min={1} className="input" value={form.max_projects_per_org} onChange={(e) => setForm({ ...form, max_projects_per_org: Number(e.target.value) })} />
          <p className="text-xs text-text-faint mt-1">Limit the number of projects that can be created in this enterprise.</p>
        </div>
        <div>
          <label className="label">IP Allowlist (optional)</label>
          <input className="input font-mono text-xs" value={form.ip_allowlist} onChange={(e) => setForm({ ...form, ip_allowlist: e.target.value })} placeholder="192.168.1.0/24, 10.0.0.0/8" />
          <p className="text-xs text-text-faint mt-1">Comma-separated CIDR ranges. Leave blank to allow all IPs.</p>
        </div>
      </div>

      {error && <div className="card p-3 bg-red-50 border-red-200"><p className="text-sm text-red-600">{error}</p></div>}
      {saved && <div className="card p-3 bg-green-50 border-green-200"><p className="text-sm text-green-600">Security settings saved successfully.</p></div>}

      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : <><Save size={16} /> Save Security Settings</>}
        </button>
      </div>
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
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-thread' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}
