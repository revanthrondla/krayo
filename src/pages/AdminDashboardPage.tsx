import { useCallback, useEffect, useState } from 'react';
import {
  Shield, Building2, Users, DollarSign, Plus, Pencil, Trash2,
  CheckCircle2, AlertCircle, Search, Settings, Lock, Eye, Mail, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/Modal';
import { Loading, EmptyState } from '../components/States';
import type { Org, EnterpriseLicense, EnterpriseSecuritySettings, SalesLead } from '../lib/types';
import { friendlyMessage } from '../lib/errors';

export function AdminDashboardPage() {

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [licenses, setLicenses] = useState<EnterpriseLicense[]>([]);
  const [securitySettings, setSecuritySettings] = useState<EnterpriseSecuritySettings[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [provisionModal, setProvisionModal] = useState(false);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [securityModalOrg, setSecurityModalOrg] = useState<Org | null>(null);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [form, setForm] = useState({ name: '', license_seats: 10, cost_per_seat: 25, billing_cycle: 'monthly', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsRes, licensesRes, securityRes, leadsRes] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('enterprise_licenses').select('*'),
        supabase.from('enterprise_security_settings').select('*'),
        supabase.from('sales_leads').select('*').order('created_at', { ascending: false }),
      ]);
      const orgData = (orgsRes.data ?? []) as Org[];
      const licData = (licensesRes.data ?? []) as EnterpriseLicense[];
      const secData = (securityRes.data ?? []) as EnterpriseSecuritySettings[];
      const leadData = (leadsRes.data ?? []) as SalesLead[];
      setOrgs(orgData);
      setLicenses(licData);
      setSecuritySettings(secData);
      setLeads(leadData);

      const counts: Record<string, number> = {};
      if (orgData.length > 0) {
        const memberRes = await supabase.from('org_memberships').select('org_id');
        for (const m of (memberRes.data ?? []) as { org_id: string }[]) {
          counts[m.org_id] = (counts[m.org_id] ?? 0) + 1;
        }
      }
      setMemberCounts(counts);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openProvision = () => {
    setEditOrg(null);
    setForm({ name: '', license_seats: 10, cost_per_seat: 25, billing_cycle: 'monthly', notes: '' });
    setProvisionModal(true);
  };

  const openEditLicense = (org: Org) => {
    const existing = licenses.find((l) => l.org_id === org.id);
    setEditOrg(org);
    setForm({
      name: org.name,
      license_seats: existing?.license_count ?? org.license_seats,
      cost_per_seat: existing?.cost_per_seat ?? Number(org.license_cost_per_seat),
      billing_cycle: existing?.billing_cycle ?? 'monthly',
      notes: existing?.notes ?? '',
    });
    setProvisionModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setError(null);
    try {
      if (editOrg) {
        const { error: licErr } = await supabase.rpc('admin_set_org_licensing', {
          _org_id: editOrg.id,
          _name: form.name.trim(),
          _license_seats: form.license_seats,
          _cost_per_seat: form.cost_per_seat,
        });
        if (licErr) throw licErr;

        const existing = licenses.find((l) => l.org_id === editOrg.id);
        if (existing) {
          await supabase.from('enterprise_licenses').update({
            license_count: form.license_seats,
            cost_per_seat: form.cost_per_seat,
            billing_cycle: form.billing_cycle,
            notes: form.notes || null,
          }).eq('id', existing.id);
        } else {
          await supabase.from('enterprise_licenses').insert({
            org_id: editOrg.id,
            license_count: form.license_seats,
            cost_per_seat: form.cost_per_seat,
            billing_cycle: form.billing_cycle,
            status: 'active',
            notes: form.notes || null,
          });
        }
      } else {
        const { data: newOrgId, error: orgErr } = await supabase.rpc('admin_provision_org', {
          _name: form.name.trim(),
          _license_seats: form.license_seats,
          _cost_per_seat: form.cost_per_seat,
        });

        if (orgErr) throw orgErr;
        const orgId = newOrgId as string;

        await supabase.from('enterprise_licenses').insert({
          org_id: orgId,
          license_count: form.license_seats,
          cost_per_seat: form.cost_per_seat,
          billing_cycle: form.billing_cycle,
          status: 'active',
          notes: form.notes || null,
        });

        await supabase.from('enterprise_security_settings').insert({
          org_id: orgId,
          restrict_project_visibility: true,
          require_project_membership: true,
          allow_cross_project_data: false,
          enforce_data_isolation: true,
          max_projects_per_org: 50,
          sso_required: false,
        });
      }
      setProvisionModal(false);
      await fetchData();
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to save enterprise'));
    }
    setSaving(false);
  };

  const handleToggleLicenseStatus = async (org: Org) => {
    const lic = licenses.find((l) => l.org_id === org.id);
    if (!lic) return;
    const newStatus = lic.status === 'active' ? 'suspended' : 'active';
    await supabase.from('enterprise_licenses').update({ status: newStatus }).eq('id', lic.id);
    await fetchData();
  };

  const handleDeleteOrg = async (org: Org) => {
    if (!confirm(`Delete enterprise "${org.name}"? This will remove all associated data.`)) return;
    await supabase.from('organizations').delete().eq('id', org.id);
    await fetchData();
  };

  const filteredOrgs = orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  const totalSeats = licenses.reduce((sum, l) => sum + l.license_count, 0);
  const totalMonthlyCost = licenses.filter((l) => l.billing_cycle === 'monthly' && l.status === 'active').reduce((sum, l) => sum + l.license_count * Number(l.cost_per_seat), 0);
  const totalAnnualCost = licenses.filter((l) => l.billing_cycle === 'annual' && l.status === 'active').reduce((sum, l) => sum + l.license_count * Number(l.cost_per_seat), 0);
  const activeLicenses = licenses.filter((l) => l.status === 'active').length;
  const suspendedLicenses = licenses.filter((l) => l.status === 'suspended').length;

  if (loading) return <Loading label="Loading admin dashboard…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Shield size={20} className="text-thread" /> Platform Admin</h1>
          <p className="text-sm text-text-muted mt-0.5">Provision and manage enterprise customers</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openProvision}><Plus size={15} /> Provision Enterprise</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard icon={Building2} label="Enterprises" value={String(orgs.length)} />
        <StatCard icon={Users} label="Total Seats" value={String(totalSeats)} />
        <StatCard icon={CheckCircle2} label="Active Licenses" value={String(activeLicenses)} color="text-green-600" />
        <StatCard icon={AlertCircle} label="Suspended" value={String(suspendedLicenses)} color={suspendedLicenses > 0 ? 'text-orange-600' : ''} />
        <StatCard icon={DollarSign} label="Monthly Revenue" value={`${totalMonthlyCost.toLocaleString()}`} color="text-green-600" />
        <StatCard icon={DollarSign} label="Annual Revenue" value={`${totalAnnualCost.toLocaleString()}`} color="text-green-600" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={Mail} label="Total Leads" value={String(leads.length)} />
        <StatCard icon={Clock} label="New" value={String(leads.filter((l) => l.status === 'new').length)} color="text-thread" />
        <StatCard icon={CheckCircle2} label="Contacted" value={String(leads.filter((l) => l.status === 'contacted').length)} color="text-green-600" />
      </div>

      <div className="card p-4">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input className="input pl-9" placeholder="Search enterprises…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {filteredOrgs.length === 0 ? (
          <EmptyState icon={Building2} title="No enterprises found" message="Provision your first enterprise customer to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/50">
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Enterprise</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Members</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">License Seats</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Cost/Seat</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Billing</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Monthly Cost</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">License Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Security</th>
                  <th className="w-24 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => {
                  const lic = licenses.find((l) => l.org_id === org.id);
                  const sec = securitySettings.find((s) => s.org_id === org.id);
                  const memberCount = memberCounts[org.id] ?? 0;
                  const monthlyCost = lic ? lic.license_count * Number(lic.cost_per_seat) : 0;
                  const isOverLimit = lic ? memberCount > lic.license_count : false;

                  return (
                    <tr key={org.id} className="border-b border-line last:border-0 hover:bg-paper/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text">{org.name}</div>
                        <div className="text-xs text-text-faint capitalize">{org.plan} plan</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${isOverLimit ? 'text-red-600' : 'text-text'}`}>{memberCount}</span>
                        <span className="text-text-faint"> / {lic?.license_count ?? org.license_seats}</span>
                        {isOverLimit && <span className="badge bg-red-50 text-red-600 ml-1">Over limit</span>}
                      </td>
                      <td className="px-4 py-3">{lic?.license_count ?? org.license_seats}</td>
                      <td className="px-4 py-3">${lic?.cost_per_seat ?? Number(org.license_cost_per_seat)}</td>
                      <td className="px-4 py-3 capitalize">{lic?.billing_cycle ?? 'monthly'}</td>
                      <td className="px-4 py-3 font-medium">${monthlyCost.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {lic ? (
                          <button onClick={() => handleToggleLicenseStatus(org)} className={`badge cursor-pointer hover:opacity-80 transition-opacity ${lic.status === 'active' ? 'bg-green-50 text-green-600' : lic.status === 'suspended' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                            {lic.status}
                          </button>
                        ) : <span className="text-text-faint text-xs">No license</span>}
                      </td>
                      <td className="px-4 py-3">
                        {sec ? (
                          <div className="flex items-center gap-1">
                            {sec.enforce_data_isolation && <span title="Data isolation enforced" className="text-green-600"><Lock size={14} /></span>}
                            {sec.restrict_project_visibility && <span title="Project visibility restricted" className="text-thread"><Eye size={14} /></span>}
                            <span className="text-xs text-text-muted">{sec.max_projects_per_org} max</span>
                          </div>
                        ) : <span className="text-text-faint text-xs">Default</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="text-text-faint hover:text-thread p-1" title="Edit license" onClick={() => openEditLicense(org)}><Pencil size={14} /></button>
                          <button className="text-text-faint hover:text-thread p-1" title="Security settings" onClick={() => setSecurityModalOrg(org)}><Settings size={14} /></button>
                          <button className="text-text-faint hover:text-red p-1" title="Delete" onClick={() => handleDeleteOrg(org)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={provisionModal} onClose={() => setProvisionModal(false)} title={editOrg ? `Edit License — ${editOrg.name}` : 'Provision New Enterprise'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div>
            <label className="label">Enterprise Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Corporation" disabled={!!editOrg} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">License Seats (user limit)</label>
              <input type="number" min={1} className="input" value={form.license_seats} onChange={(e) => setForm({ ...form, license_seats: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Cost per Seat ($/month)</label>
              <input type="number" min={0} step="0.01" className="input" value={form.cost_per_seat} onChange={(e) => setForm({ ...form, cost_per_seat: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Billing Cycle</label>
            <select className="input" value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="label">Admin Notes (optional)</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes about this enterprise customer" />
          </div>
          <div className="card bg-paper p-3 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Total seats</span><span className="font-medium">{form.license_seats}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Cost per seat</span><span className="font-medium">${form.cost_per_seat}</span></div>
            <div className="flex justify-between mt-1 pt-1 border-t border-line"><span className="text-text-muted font-medium">{form.billing_cycle === 'annual' ? 'Annual cost' : 'Monthly cost'}</span><span className="font-bold text-thread">${(form.license_seats * form.cost_per_seat).toLocaleString()}</span></div>
          </div>
          {error && <p className="text-xs text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost btn-sm" onClick={() => setProvisionModal(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : editOrg ? 'Update License' : 'Provision Enterprise'}</button>
        </div>
      </Modal>

      {securityModalOrg && (
        <SecuritySettingsModal
          org={securityModalOrg}
          existing={securitySettings.find((s) => s.org_id === securityModalOrg.id) ?? null}
          onClose={() => setSecurityModalOrg(null)}
          onSaved={fetchData}
        />
      )}

      <LeadTable leads={leads} search={leadSearch} onSearch={setLeadSearch} onUpdate={fetchData} />
    </div>
  );
}

function SecuritySettingsModal({ org, existing, onClose, onSaved }: { org: Org; existing: EnterpriseSecuritySettings | null; onClose: () => void; onSaved: () => void; }) {
  const [form, setForm] = useState({
    restrict_project_visibility: existing?.restrict_project_visibility ?? true,
    require_project_membership: existing?.require_project_membership ?? true,
    allow_cross_project_data: existing?.allow_cross_project_data ?? false,
    enforce_data_isolation: existing?.enforce_data_isolation ?? true,
    max_projects_per_org: existing?.max_projects_per_org ?? 50,
    sso_required: existing?.sso_required ?? false,
    ip_allowlist: existing?.ip_allowlist ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const payload = {
        org_id: org.id,
        restrict_project_visibility: form.restrict_project_visibility,
        require_project_membership: form.require_project_membership,
        allow_cross_project_data: form.allow_cross_project_data,
        enforce_data_isolation: form.enforce_data_isolation,
        max_projects_per_org: form.max_projects_per_org,
        sso_required: form.sso_required,
        ip_allowlist: form.ip_allowlist || null,
      };
      if (existing) {
        await supabase.from('enterprise_security_settings').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('enterprise_security_settings').insert(payload);
      }
      onClose(); onSaved();
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to save security settings'));
    }
    setSaving(false);
  };

  return (
    <Modal open={true} onClose={onClose} title={`Security Settings — ${org.name}`} maxWidth="max-w-lg">
      <div className="space-y-4">
        <ToggleRow
          label="Enforce Data Isolation"
          description="Strictly isolate all org data from other enterprises via RLS. Disable only for testing."
          value={form.enforce_data_isolation}
          onChange={(v) => setForm({ ...form, enforce_data_isolation: v })}
          icon={Lock}
        />
        <ToggleRow
          label="Restrict Project Visibility"
          description="Users only see projects they are explicit members of."
          value={form.restrict_project_visibility}
          onChange={(v) => setForm({ ...form, restrict_project_visibility: v })}
          icon={Eye}
        />
        <ToggleRow
          label="Require Project Membership"
          description="Users must be project members to access any project data."
          value={form.require_project_membership}
          onChange={(v) => setForm({ ...form, require_project_membership: v })}
          icon={Users}
        />
        <ToggleRow
          label="Allow Cross-Project Data"
          description="Allow data references between projects within the same enterprise."
          value={form.allow_cross_project_data}
          onChange={(v) => setForm({ ...form, allow_cross_project_data: v })}
          icon={Settings}
        />
        <ToggleRow
          label="Require SSO"
          description="Require single sign-on for all enterprise members."
          value={form.sso_required}
          onChange={(v) => setForm({ ...form, sso_required: v })}
          icon={Shield}
        />
        <div>
          <label className="label">Max Projects per Enterprise</label>
          <input type="number" min={1} className="input" value={form.max_projects_per_org} onChange={(e) => setForm({ ...form, max_projects_per_org: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">IP Allowlist (optional)</label>
          <input className="input font-mono text-xs" value={form.ip_allowlist} onChange={(e) => setForm({ ...form, ip_allowlist: e.target.value })} placeholder="192.168.1.0/24, 10.0.0.0/8" />
          <p className="text-xs text-text-faint mt-1">Comma-separated CIDR ranges. Leave blank to allow all IPs.</p>
        </div>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>
    </Modal>
  );
}

function ToggleRow({ label, description, value, onChange, icon: Icon }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; icon: React.ElementType }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-thread-bg flex items-center justify-center shrink-0 mt-0.5"><Icon size={15} className="text-thread" /></div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">{label}</p>
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

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2"><Icon size={16} className="text-text-muted" /><span className="text-xs text-text-muted">{label}</span></div>
      <p className={`text-xl font-bold ${color ?? 'text-text'}`}>{value}</p>
    </div>
  );
}

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'closed'] as const;

function LeadTable({ leads, search, onSearch, onUpdate }: { leads: SalesLead[]; search: string; onSearch: (v: string) => void; onUpdate: () => void }) {
  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return !q || l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.company.toLowerCase().includes(q);
  });

  const cycleStatus = async (lead: SalesLead, dir: 1 | -1) => {
    const idx = LEAD_STATUSES.indexOf(lead.status as typeof LEAD_STATUSES[number]);
    const next = LEAD_STATUSES[Math.max(0, Math.min(LEAD_STATUSES.length - 1, idx + dir))];
    if (next === lead.status) return;
    await supabase.from('sales_leads').update({ status: next }).eq('id', lead.id);
    onUpdate();
  };

  return (
    <section className="card overflow-hidden">
      <div className="p-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-thread" />
          <h2 className="text-sm font-semibold">Sales Leads</h2>
          <span className="text-xs text-text-faint">({leads.length})</span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input className="input pl-8 py-1.5 text-sm w-48" placeholder="Search leads…" value={search} onChange={(e) => onSearch(e.target.value)} />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="p-8"><EmptyState icon={Mail} title="No leads yet" message="Enterprise contact form submissions will appear here." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted border-b border-line">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Team Size</th>
                <th className="px-4 py-2.5 font-medium">Message</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-line/50 hover:bg-thread-bg/20">
                  <td className="px-4 py-3 font-medium text-text">{lead.name}</td>
                  <td className="px-4 py-3 text-text-muted"><a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a></td>
                  <td className="px-4 py-3 text-text">{lead.company}</td>
                  <td className="px-4 py-3 text-text-muted">{lead.team_size ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted max-w-xs truncate" title={lead.message ?? ''}>{lead.message ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        lead.status === 'new' ? 'bg-thread-bg text-thread' :
                        lead.status === 'contacted' ? 'bg-blue-50 text-blue-600' :
                        lead.status === 'qualified' ? 'bg-green-50 text-green-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>{lead.status}</span>
                      <button className="text-text-faint hover:text-text p-0.5" onClick={() => cycleStatus(lead, -1)} title="Previous status">‹</button>
                      <button className="text-text-faint hover:text-text p-0.5" onClick={() => cycleStatus(lead, 1)} title="Next status">›</button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-faint whitespace-nowrap">{new Date(lead.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
