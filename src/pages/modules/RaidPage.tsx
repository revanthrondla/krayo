import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldAlert, Trash2, Pencil } from 'lucide-react';
import { useModuleData } from '../../lib/use-module-data';
import { ModuleToolbar } from '../../components/ModuleToolbar';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Loading, EmptyState } from '../../components/States';
import { useOrg } from '../../lib/org-context';
import { useCustomFields } from '../../lib/use-custom-fields';
import { CustomFieldInputs } from '../../components/CustomFieldInputs';
import type { RaidEntry } from '../../lib/types';
import { friendlyMessage } from '../../lib/errors';

const BASE_EXPORT_HEADERS = ['code', 'title', 'type', 'description', 'owner', 'status'];
const BASE_CSV_HEADERS = ['code', 'title', 'type', 'description', 'owner', 'status'];
const TYPES = ['Risk', 'Assumption', 'Issue', 'Dependency'];
const STATUSES = ['Open', 'Monitoring', 'Mitigated', 'Closed'];

export function RaidPage() {
  const { projectId } = useParams();
  const { activeOrg } = useOrg();
  const { items, loading, insert, insertMany, update, remove } = useModuleData<RaidEntry>('raid_entries', projectId);
  const { fields: customFields, refresh: refreshCustomFields } = useCustomFields(projectId, 'raid');
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<RaidEntry | null>(null);
  const [form, setForm] = useState({ code: '', title: '', type: 'Risk', description: '', owner: '', status: 'Open', customFields: {} as Record<string, string> });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RaidEntry | null>(null);

  const exportHeaders = [...BASE_EXPORT_HEADERS, ...customFields.map((f) => f.field_key)];
  const csvHeaders = [...BASE_CSV_HEADERS, ...customFields.map((f) => f.field_key)];
  const itemsForExport = items.map((item) => ({ ...item, ...(item.custom_fields ?? {}) }));

  const openAdd = () => { setEditItem(null); setForm({ code: '', title: '', type: 'Risk', description: '', owner: '', status: 'Open', customFields: {} }); setModal(true); };
  const openEdit = (item: RaidEntry) => { setEditItem(item); setForm({ code: item.code, title: item.title, type: item.type, description: item.description ?? '', owner: item.owner ?? '', status: item.status, customFields: item.custom_fields ?? {} }); setModal(true); };
  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) return;
    const duplicate = items.some((item) => item.code.toLowerCase() === form.code.trim().toLowerCase() && item.id !== editItem?.id);
    if (duplicate) { setSaveError(`Code "${form.code.trim()}" already exists. Codes must be unique.`); return; }
    setSaveError(null);
    const data = { code: form.code.trim(), title: form.title, type: form.type, description: form.description || null, owner: form.owner || null, status: form.status, custom_fields: form.customFields || {} };
    try {
      if (editItem) await update(editItem.id, data); else await insert(data);
      setModal(false);
    } catch (err) {
      setSaveError(friendlyMessage(err, 'Failed to save. Code may already exist.'));
    }
  };
  const handleImport = async (rows: Record<string, string>[]) => {
    await insertMany(rows.map((r) => {
      const customFieldValues: Record<string, string> = {};
      customFields.forEach((f) => {
        const val = r[f.field_key];
        if (val) customFieldValues[f.field_key] = val;
      });
      return { code: r.code ?? '', title: r.title ?? '', type: r.type ?? 'Risk', description: r.description || null, owner: r.owner || null, status: r.status ?? 'Open', custom_fields: customFieldValues };
    }));
  };

  if (loading) return <Loading label="Loading RAID log…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><ShieldAlert size={20} className="text-thread" /> RAID Log</h1><p className="text-sm text-text-muted mt-0.5">{items.length} entr{items.length !== 1 ? 'ies' : 'y'}</p></div>
        <ModuleToolbar moduleName="RAID Log" moduleKey="raid" projectId={projectId} items={itemsForExport} exportHeaders={exportHeaders} csvHeaders={csvHeaders} onImport={handleImport} onAdd={openAdd} addLabel="Add entry" orgPlan={activeOrg?.plan} onCustomFieldsChanged={refreshCustomFields} />
      </div>
      {items.length === 0 ? <EmptyState icon={ShieldAlert} title="No RAID entries yet" message="Add risks, assumptions, issues, and dependencies manually, import from CSV, or use AI to generate them." /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-paper/50"><th className="text-left px-4 py-2.5 font-medium text-text-muted">Code</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Title</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Type</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Owner</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Status</th>{customFields.map((f) => <th key={f.id} className="text-left px-4 py-2.5 font-medium text-text-muted">{f.label}</th>)}<th className="w-16 px-4 py-2.5"></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0 hover:bg-paper/50 transition-colors">
                  <td className="px-4 py-3"><span className="badge bg-thread-bg text-thread font-mono">{item.code}</span></td>
                  <td className="px-4 py-3 font-medium text-text">{item.title}</td>
                  <td className="px-4 py-3"><TypeBadge value={item.type} /></td>
                  <td className="px-4 py-3 text-text-muted">{item.owner ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                  {customFields.map((f) => <td key={f.id} className="px-4 py-3 text-text-muted text-xs">{item.custom_fields?.[f.field_key] ?? '—'}</td>)}
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><button className="text-text-faint hover:text-thread p-1" onClick={() => openEdit(item)}><Pencil size={14} /></button><button className="text-text-faint hover:text-red p-1" onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit RAID entry' : 'Add RAID entry'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. RSK-001" /></div><div><label className="label">Type</label><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div></div>
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Third-party API may not be ready by launch" /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Owner</label><input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div><div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div></div>
          <CustomFieldInputs fields={customFields} values={form.customFields} onChange={(key, val) => setForm({ ...form, customFields: { ...form.customFields, [key]: val } })} />
        </div>
        {saveError && <p className="text-xs text-red mt-2">{saveError}</p>}
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost btn-sm" onClick={() => { setModal(false); setSaveError(null); }}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.code.trim() || !form.title.trim()}>Save</button></div>
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete RAID entry"
        message={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}"? This cannot be undone.`}
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function TypeBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { Risk: 'bg-red-50 text-red-600', Assumption: 'bg-blue-50 text-blue-600', Issue: 'bg-orange-50 text-orange-600', Dependency: 'bg-purple-50 text-purple-600' };
  return <span className={`badge ${colors[value] ?? 'bg-gray-100 text-gray-600'}`}>{value}</span>;
}
function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { Open: 'bg-blue-50 text-blue-600', Monitoring: 'bg-yellow-50 text-yellow-600', Mitigated: 'bg-green-50 text-green-600', Closed: 'bg-gray-100 text-gray-600' };
  return <span className={`badge ${colors[value] ?? 'bg-gray-100 text-gray-600'}`}>{value}</span>;
}
