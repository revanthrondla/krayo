import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardList, Trash2, Pencil } from 'lucide-react';
import { useModuleData } from '../../lib/use-module-data';
import { ModuleToolbar } from '../../components/ModuleToolbar';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Loading, EmptyState } from '../../components/States';
import { useOrg } from '../../lib/org-context';
import { useCustomFields } from '../../lib/use-custom-fields';
import { CustomFieldInputs } from '../../components/CustomFieldInputs';
import type { Requirement } from '../../lib/types';
import { friendlyMessage } from '../../lib/errors';

const BASE_EXPORT_HEADERS = ['code', 'title', 'description', 'category', 'priority', 'status'];
const BASE_CSV_HEADERS = ['code', 'title', 'description', 'category', 'priority', 'status'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Draft', 'Reviewed', 'Approved', 'Implemented', 'Deprecated'];
const CATEGORIES = ['Functional', 'Non-Functional', 'Security', 'Performance', 'Usability', 'Business'];

export function RequirementsPage() {
  const { projectId } = useParams();
  const { activeOrg } = useOrg();
  const { items, loading, insert, insertMany, update, remove } = useModuleData<Requirement>('requirements', projectId);
  const { fields: customFields, refresh: refreshCustomFields } = useCustomFields(projectId, 'requirements');
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<Requirement | null>(null);
  const [form, setForm] = useState({ code: '', title: '', description: '', category: 'Functional', priority: 'Medium', status: 'Draft', customFields: {} as Record<string, string> });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Requirement | null>(null);

  const exportHeaders = [...BASE_EXPORT_HEADERS, ...customFields.map((f) => f.field_key)];
  const csvHeaders = [...BASE_CSV_HEADERS, ...customFields.map((f) => f.field_key)];
  const itemsForExport = items.map((item) => ({ ...item, ...(item.custom_fields ?? {}) }));

  const openAdd = () => { setEditItem(null); setForm({ code: '', title: '', description: '', category: 'Functional', priority: 'Medium', status: 'Draft', customFields: {} }); setModal(true); };
  const openEdit = (item: Requirement) => { setEditItem(item); setForm({ code: item.code, title: item.title, description: item.description ?? '', category: item.category ?? 'Functional', priority: item.priority, status: item.status, customFields: item.custom_fields ?? {} }); setModal(true); };
  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) return;
    const duplicate = items.some((item) => item.code.toLowerCase() === form.code.trim().toLowerCase() && item.id !== editItem?.id);
    if (duplicate) { setSaveError(`Code "${form.code.trim()}" already exists. Codes must be unique.`); return; }
    setSaveError(null);
    const data = { code: form.code.trim(), title: form.title, description: form.description, category: form.category, priority: form.priority, status: form.status, custom_fields: form.customFields || {} };
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
      return { code: r.code ?? '', title: r.title ?? '', description: r.description ?? null, category: r.category ?? null, priority: r.priority ?? 'Medium', status: r.status ?? 'Draft', custom_fields: customFieldValues };
    }));
  };

  if (loading) return <Loading label="Loading requirements…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><ClipboardList size={20} className="text-thread" /> Requirements</h1><p className="text-sm text-text-muted mt-0.5">{items.length} requirement{items.length !== 1 ? 's' : ''}</p></div>
        <ModuleToolbar moduleName="Requirements" moduleKey="requirements" projectId={projectId} items={itemsForExport} exportHeaders={exportHeaders} csvHeaders={csvHeaders} onImport={handleImport} onAdd={openAdd} addLabel="Add requirement" orgPlan={activeOrg?.plan} onCustomFieldsChanged={refreshCustomFields} />
      </div>
      {items.length === 0 ? <EmptyState icon={ClipboardList} title="No requirements yet" message="Add requirements manually, import from CSV, or use AI to generate them from a description." /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-paper/50"><th className="text-left px-4 py-2.5 font-medium text-text-muted">Code</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Title</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Category</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Priority</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Status</th>{customFields.map((f) => <th key={f.id} className="text-left px-4 py-2.5 font-medium text-text-muted">{f.label}</th>)}<th className="w-16 px-4 py-2.5"></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0 hover:bg-paper/50 transition-colors">
                  <td className="px-4 py-3"><span className="badge bg-thread-bg text-thread font-mono">{item.code}</span></td>
                  <td className="px-4 py-3 font-medium text-text">{item.title}</td>
                  <td className="px-4 py-3 text-text-muted">{item.category ?? '—'}</td>
                  <td className="px-4 py-3"><PriorityBadge value={item.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                  {customFields.map((f) => <td key={f.id} className="px-4 py-3 text-text-muted text-xs">{item.custom_fields?.[f.field_key] ?? '—'}</td>)}
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><button className="text-text-faint hover:text-thread p-1" onClick={() => openEdit(item)}><Pencil size={14} /></button><button className="text-text-faint hover:text-red p-1" onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit requirement' : 'Add requirement'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. REQ-001" /></div><div><label className="label">Category</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div></div>
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. User login with email and password" /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Priority</label><select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div><div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div></div>
          <CustomFieldInputs fields={customFields} values={form.customFields} onChange={(key, val) => setForm({ ...form, customFields: { ...form.customFields, [key]: val } })} />
        </div>
        {saveError && <p className="text-xs text-red mt-2">{saveError}</p>}
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost btn-sm" onClick={() => { setModal(false); setSaveError(null); }}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.code.trim() || !form.title.trim()}>Save</button></div>
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete requirement"
        message={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}"? This cannot be undone.`}
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { Low: 'bg-gray-100 text-gray-600', Medium: 'bg-blue-50 text-blue-600', High: 'bg-orange-50 text-orange-600', Critical: 'bg-red-50 text-red-600' };
  return <span className={`badge ${colors[value] ?? 'bg-gray-100 text-gray-600'}`}>{value}</span>;
}
function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { Draft: 'bg-gray-100 text-gray-600', Reviewed: 'bg-yellow-50 text-yellow-600', Approved: 'bg-green-50 text-green-600', Implemented: 'bg-thread-bg text-thread', Deprecated: 'bg-red-50 text-red-600' };
  return <span className={`badge ${colors[value] ?? 'bg-gray-100 text-gray-600'}`}>{value}</span>;
}
