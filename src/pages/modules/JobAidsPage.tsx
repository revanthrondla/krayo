import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { useModuleData } from '../../lib/use-module-data';
import { ModuleToolbar } from '../../components/ModuleToolbar';
import { Modal } from '../../components/Modal';
import { Loading, EmptyState } from '../../components/States';
import { useOrg } from '../../lib/org-context';
import { useCustomFields } from '../../lib/use-custom-fields';
import { CustomFieldInputs } from '../../components/CustomFieldInputs';
import { safeExternalUrl } from '../../lib/safe-url';
import type { JobAid } from '../../lib/types';

const BASE_EXPORT_HEADERS = ['code', 'title', 'description', 'url'];
const BASE_CSV_HEADERS = ['code', 'title', 'description', 'url'];

export function JobAidsPage() {
  const { projectId } = useParams();
  const { activeOrg } = useOrg();
  const { items, loading, insert, insertMany, update, remove } = useModuleData<JobAid>('job_aids', projectId);
  const { fields: customFields, refresh: refreshCustomFields } = useCustomFields(projectId, 'jobaids');
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<JobAid | null>(null);
  const [form, setForm] = useState({ code: '', title: '', description: '', url: '', customFields: {} as Record<string, string> });

  const exportHeaders = [...BASE_EXPORT_HEADERS, ...customFields.map((f) => f.field_key)];
  const csvHeaders = [...BASE_CSV_HEADERS, ...customFields.map((f) => f.field_key)];
  const itemsForExport = items.map((item) => ({ ...item, ...(item.custom_fields ?? {}) }));

  const openAdd = () => { setEditItem(null); setForm({ code: '', title: '', description: '', url: '', customFields: {} }); setModal(true); };
  const openEdit = (item: JobAid) => { setEditItem(item); setForm({ code: item.code, title: item.title, description: item.description ?? '', url: item.url ?? '', customFields: item.custom_fields ?? {} }); setModal(true); };
  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) return;
    const data = { ...form, description: form.description || null, url: form.url || null, custom_fields: form.customFields || {} };
    if (editItem) await update(editItem.id, data); else await insert(data); setModal(false);
  };
  const handleImport = async (rows: Record<string, string>[]) => {
    await insertMany(rows.map((r) => {
      const customFieldValues: Record<string, string> = {};
      customFields.forEach((f) => {
        const val = r[f.field_key];
        if (val) customFieldValues[f.field_key] = val;
      });
      return { code: r.code ?? '', title: r.title ?? '', description: r.description || null, url: r.url || null, custom_fields: customFieldValues };
    }));
  };

  if (loading) return <Loading label="Loading job aids…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><BookOpen size={20} className="text-thread" /> Job Aids</h1><p className="text-sm text-text-muted mt-0.5">{items.length} job aid{items.length !== 1 ? 's' : ''}</p></div>
        <ModuleToolbar moduleName="Job Aids" moduleKey="jobaids" projectId={projectId} items={itemsForExport} exportHeaders={exportHeaders} csvHeaders={csvHeaders} onImport={handleImport} onAdd={openAdd} addLabel="Add job aid" orgPlan={activeOrg?.plan} onCustomFieldsChanged={refreshCustomFields} />
      </div>
      {items.length === 0 ? <EmptyState icon={BookOpen} title="No job aids yet" message="Add job aids, reference guides, and documentation manually, import from CSV, or use AI to generate them." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} className="card p-4 group">
              <div className="flex items-start justify-between mb-2">
                <span className="badge bg-thread-bg text-thread font-mono">{item.code}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="text-text-faint hover:text-thread p-1" onClick={() => openEdit(item)}><Pencil size={14} /></button>
                  <button className="text-text-faint hover:text-red p-1" onClick={() => remove(item.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 className="font-semibold text-sm text-text mb-1">{item.title}</h3>
              {item.description && <p className="text-xs text-text-muted line-clamp-2">{item.description}</p>}
              {customFields.length > 0 && (
                <div className="mt-2 space-y-1">
                  {customFields.map((f) => {
                    const val = item.custom_fields?.[f.field_key];
                    if (!val) return null;
                    return <div key={f.id} className="text-xs text-text-muted"><span className="font-medium">{f.label}:</span> {val}</div>;
                  })}
                </div>
              )}
              {safeExternalUrl(item.url) && <a href={safeExternalUrl(item.url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-thread hover:underline mt-2"><ExternalLink size={12} /> Open link</a>}
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit job aid' : 'Add job aid'}>
        <div className="space-y-3">
          <div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="JA-001" /></div>
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="How to run regression tests" /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">URL</label><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://wiki.example.com/guide" /></div>
          <CustomFieldInputs fields={customFields} values={form.customFields} onChange={(key, val) => setForm({ ...form, customFields: { ...form.customFields, [key]: val } })} />
        </div>
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.code.trim() || !form.title.trim()}>Save</button></div>
      </Modal>
    </div>
  );
}
