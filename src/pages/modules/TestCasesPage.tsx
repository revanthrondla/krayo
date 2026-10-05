import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FlaskConical, Trash2, Pencil, MousePointerClick } from 'lucide-react';
import { useModuleData } from '../../lib/use-module-data';
import { ModuleToolbar } from '../../components/ModuleToolbar';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Loading, EmptyState } from '../../components/States';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org-context';
import { useCustomFields } from '../../lib/use-custom-fields';
import { CustomFieldInputs } from '../../components/CustomFieldInputs';
import type { TestCase, Requirement } from '../../lib/types';
import { friendlyMessage } from '../../lib/errors';

const BASE_EXPORT_HEADERS = ['code', 'title', 'cycle', 'steps', 'expected_result', 'status'];
const BASE_CSV_HEADERS = ['code', 'title', 'cycle', 'steps', 'expected_result', 'status'];
const CYCLES = ['CRP', 'SIT', 'UAT'];
const STATUSES = ['Not Run', 'In Progress', 'Passed', 'Failed', 'Blocked'];

export function TestCasesPage() {
  const { projectId, orgId } = useParams();
  const navigate = useNavigate();
  const { activeOrg } = useOrg();
  const { items, loading, insert, insertMany, update, remove } = useModuleData<TestCase>('test_cases', projectId);
  const { fields: customFields, refresh: refreshCustomFields } = useCustomFields(projectId, 'testcases');
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<TestCase | null>(null);
  const [form, setForm] = useState({ code: '', title: '', cycle: 'SIT', steps: '', expected_result: '', status: 'Not Run', requirement_id: '', customFields: {} as Record<string, string> });
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null);

  const exportHeaders = [...BASE_EXPORT_HEADERS, ...customFields.map((f) => f.field_key)];
  const csvHeaders = [...BASE_CSV_HEADERS, ...customFields.map((f) => f.field_key)];
  const itemsForExport = items.map((item) => ({ ...item, ...(item.custom_fields ?? {}) }));

  useEffect(() => {
    if (!projectId) return;
    supabase.from('requirements').select('id, code, title').eq('project_id', projectId).order('code').then(({ data }) => {
      setRequirements((data ?? []) as Requirement[]);
    });
  }, [projectId]);

  const openAdd = () => { setEditItem(null); setForm({ code: '', title: '', cycle: 'SIT', steps: '', expected_result: '', status: 'Not Run', requirement_id: '', customFields: {} }); setModal(true); };
  const openEdit = (item: TestCase) => { setEditItem(item); setForm({ code: item.code, title: item.title, cycle: item.cycle, steps: item.steps ?? '', expected_result: item.expected_result ?? '', status: item.status, requirement_id: item.requirement_id ?? '', customFields: item.custom_fields ?? {} }); setModal(true); };

  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) return;
    const duplicate = items.some((item) => item.code.toLowerCase() === form.code.trim().toLowerCase() && item.id !== editItem?.id);
    if (duplicate) { setSaveError(`Code "${form.code.trim()}" already exists. Codes must be unique.`); return; }
    setSaveError(null);
    const data = { code: form.code.trim(), title: form.title, cycle: form.cycle, steps: form.steps || null, expected_result: form.expected_result || null, status: form.status, requirement_id: form.requirement_id || null, custom_fields: form.customFields || {} };
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
      return { code: r.code ?? '', title: r.title ?? '', cycle: r.cycle ?? 'SIT', steps: r.steps ?? null, expected_result: r.expected_result ?? null, status: r.status ?? 'Not Run', custom_fields: customFieldValues };
    }));
  };

  const reqLabel = (id: string | null) => {
    if (!id) return null;
    const r = requirements.find((x) => x.id === id);
    return r ? `${r.code} — ${r.title}` : null;
  };

  if (loading) return <Loading label="Loading test cases…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><FlaskConical size={20} className="text-thread" /> Test Cases</h1><p className="text-sm text-text-muted mt-0.5">{items.length} test case{items.length !== 1 ? 's' : ''}</p></div>
        <div className="flex items-center gap-2"><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/app/orgs/${orgId}/projects/${projectId}/automation/record`)}><MousePointerClick size={14} /> Record steps</button><button className="btn btn-primary btn-sm" onClick={() => navigate(`/app/orgs/${orgId}/projects/${projectId}/automation/execute`)}><FlaskConical size={14} /> Run tests</button><ModuleToolbar moduleName="Test Cases" moduleKey="testcases" projectId={projectId} items={itemsForExport} exportHeaders={exportHeaders} csvHeaders={csvHeaders} onImport={handleImport} onAdd={openAdd} addLabel="Add test case" orgPlan={activeOrg?.plan} onCustomFieldsChanged={refreshCustomFields} /></div>
      </div>
      {items.length === 0 ? <EmptyState icon={FlaskConical} title="No test cases yet" message="Add test cases manually, import from CSV, or use AI to generate them from a description." /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-paper/50"><th className="text-left px-4 py-2.5 font-medium text-text-muted">Code</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Title</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Requirement</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Cycle</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Status</th>{customFields.map((f) => <th key={f.id} className="text-left px-4 py-2.5 font-medium text-text-muted">{f.label}</th>)}<th className="w-16 px-4 py-2.5"></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0 hover:bg-paper/50 transition-colors">
                  <td className="px-4 py-3"><span className="badge bg-thread-bg text-thread font-mono">{item.code}</span></td>
                  <td className="px-4 py-3 font-medium text-text">{item.title}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{reqLabel(item.requirement_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{item.cycle}</td>
                  <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                  {customFields.map((f) => <td key={f.id} className="px-4 py-3 text-text-muted text-xs">{item.custom_fields?.[f.field_key] ?? '—'}</td>)}
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><button className="text-text-faint hover:text-thread p-1" onClick={() => openEdit(item)}><Pencil size={14} /></button><button className="text-text-faint hover:text-red p-1" onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit test case' : 'Add test case'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. TC-001" /></div>
            <div><label className="label">Cycle</label><select className="input" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })}>{CYCLES.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Verify user can log in with valid credentials" /></div>
          <div>
            <label className="label">Linked Requirement</label>
            <select className="input" value={form.requirement_id} onChange={(e) => setForm({ ...form, requirement_id: e.target.value })}>
              <option value="">— None —</option>
              {requirements.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.title}</option>)}
            </select>
          </div>
          <div><label className="label">Steps</label><textarea className="input" rows={3} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} /></div>
          <div><label className="label">Expected Result</label><textarea className="input" rows={2} value={form.expected_result} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} /></div>
          <div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <CustomFieldInputs fields={customFields} values={form.customFields} onChange={(key, val) => setForm({ ...form, customFields: { ...form.customFields, [key]: val } })} />
        </div>
        {saveError && <p className="text-xs text-red mt-2">{saveError}</p>}
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost btn-sm" onClick={() => { setModal(false); setSaveError(null); }}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.code.trim() || !form.title.trim()}>Save</button></div>
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete test case"
        message={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}"? This cannot be undone.`}
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { 'Not Run': 'bg-gray-100 text-gray-600', 'In Progress': 'bg-blue-50 text-blue-600', Passed: 'bg-green-50 text-green-600', Failed: 'bg-red-50 text-red-600', Blocked: 'bg-orange-50 text-orange-600' };
  return <span className={`badge ${colors[value] ?? 'bg-gray-100 text-gray-600'}`}>{value}</span>;
}
