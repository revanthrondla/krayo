import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckSquare, Trash2, Pencil, MessageSquare, X } from 'lucide-react';
import { useModuleData } from '../../lib/use-module-data';
import { ModuleToolbar } from '../../components/ModuleToolbar';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Loading, EmptyState } from '../../components/States';
import { CommentPanel } from '../../components/CommentPanel';
import { useAuth } from '../../lib/auth';
import { useOrg } from '../../lib/org-context';
import { sendNotifications } from '../../lib/notifications';
import { lookupUserEmails } from '../../lib/user-lookup';
import { supabase } from '../../lib/supabase';
import { useCustomFields } from '../../lib/use-custom-fields';
import { CustomFieldInputs } from '../../components/CustomFieldInputs';
import type { ActionItem } from '../../lib/types';
import { friendlyMessage } from '../../lib/errors';

const BASE_EXPORT_HEADERS = ['code', 'title', 'owner', 'due_date', 'status', 'notes'];
const BASE_CSV_HEADERS = ['code', 'title', 'owner', 'due_date', 'status', 'notes'];
const STATUSES = ['Open', 'In Progress', 'Done', 'Cancelled'];

interface AssignableUser { id: string; email: string; display_name: string | null; }

export function ActionItemsPage() {
  const { projectId, orgId } = useParams();
  const { user } = useAuth();
  const { activeOrg } = useOrg();
  const { items, loading, insert, insertMany, update, remove } = useModuleData<ActionItem>('action_items', projectId);
  const { fields: customFields, refresh: refreshCustomFields } = useCustomFields(projectId, 'actionitems');
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<ActionItem | null>(null);
  const [form, setForm] = useState({ code: '', title: '', owner: '', owner_user_id: '', due_date: '', status: 'Open', notes: '', customFields: {} as Record<string, string> });
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [detailItem, setDetailItem] = useState<ActionItem | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActionItem | null>(null);

  const exportHeaders = [...BASE_EXPORT_HEADERS, ...customFields.map((f) => f.field_key)];
  const csvHeaders = [...BASE_CSV_HEADERS, ...customFields.map((f) => f.field_key)];
  const itemsForExport = items.map((item) => ({ ...item, ...(item.custom_fields ?? {}) }));

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data: memberships } = await supabase.from('org_memberships').select('user_id').eq('org_id', orgId);
      if (!memberships || memberships.length === 0) return;
      const userIds = memberships.map((m: { user_id: string }) => m.user_id);
      const [profilesRes, authRes] = await Promise.all([
        supabase.from('user_profiles').select('id, display_name').in('id', userIds),
        lookupUserEmails(userIds),
      ]);
      const emailMap = new Map(((authRes.data ?? []) as { id: string; email: string }[]).map((u) => [u.id, u.email]));
      const nameMap = new Map((profilesRes.data ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
      setAssignableUsers(userIds.map((id) => ({ id, email: emailMap.get(id) ?? '', display_name: nameMap.get(id) ?? null })));
    })();
  }, [orgId]);

  const openAdd = () => { setEditItem(null); setForm({ code: '', title: '', owner: '', owner_user_id: '', due_date: '', status: 'Open', notes: '', customFields: {} }); setModal(true); };
  const openEdit = (item: ActionItem) => { setEditItem(item); setForm({ code: item.code, title: item.title, owner: item.owner ?? '', owner_user_id: item.owner_user_id ?? '', due_date: item.due_date ?? '', status: item.status, notes: item.notes ?? '', customFields: item.custom_fields ?? {} }); setModal(true); };

  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) return;
    const duplicate = items.some((item) => item.code.toLowerCase() === form.code.trim().toLowerCase() && item.id !== editItem?.id);
    if (duplicate) { setSaveError(`Code "${form.code.trim()}" already exists. Codes must be unique.`); return; }
    setSaveError(null);
    const assignedUser = assignableUsers.find((u) => u.id === form.owner_user_id);
    const ownerName = assignedUser ? (assignedUser.display_name || assignedUser.email.split('@')[0]) : (form.owner || null);
    const data = {
      code: form.code.trim(), title: form.title,
      owner: ownerName,
      owner_user_id: form.owner_user_id || null,
      due_date: form.due_date || null, status: form.status, notes: form.notes || null,
      custom_fields: form.customFields || {},
    };
    try {
      if (editItem) {
        await update(editItem.id, data);
      // Notify if newly assigned
      if (form.owner_user_id && form.owner_user_id !== editItem.owner_user_id && user) {
        await sendNotifications({
          type: 'assignment',
          recipientIds: [form.owner_user_id],
          projectId,
          itemType: 'action_item',
          itemId: editItem.id,
          actorId: user.id,
          message: `You were assigned to ${form.code}: ${form.title}`,
        });
      }
    } else {
      const inserted = await insert(data); if (form.owner_user_id && user) {
        await sendNotifications({
          type: 'assignment',
          recipientIds: [form.owner_user_id],
          projectId,
          itemType: 'action_item',
          itemId: inserted.id,
          actorId: user.id,
          message: `You were assigned to ${form.code}: ${form.title}`,
        });
      }
    }
    } catch (err) {
      setSaveError(friendlyMessage(err, 'Failed to save. Code may already exist.'));
      return;
    }
    setModal(false);
  };

  const handleImport = async (rows: Record<string, string>[]) => {
    await insertMany(rows.map((r) => {
      const customFieldValues: Record<string, string> = {};
      customFields.forEach((f) => {
        const val = r[f.field_key];
        if (val) customFieldValues[f.field_key] = val;
      });
      return { code: r.code ?? '', title: r.title ?? '', owner: r.owner || null, due_date: r.due_date || null, status: r.status ?? 'Open', notes: r.notes || null, custom_fields: customFieldValues };
    }));
  };

  if (loading) return <Loading label="Loading action items…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><CheckSquare size={20} className="text-thread" /> Action Items</h1><p className="text-sm text-text-muted mt-0.5">{items.length} action item{items.length !== 1 ? 's' : ''}</p></div>
        <ModuleToolbar moduleName="Action Items" moduleKey="actionitems" projectId={projectId} items={itemsForExport} exportHeaders={exportHeaders} csvHeaders={csvHeaders} onImport={handleImport} onAdd={openAdd} addLabel="Add action item" orgPlan={activeOrg?.plan} onCustomFieldsChanged={refreshCustomFields} />
      </div>
      {items.length === 0 ? <EmptyState icon={CheckSquare} title="No action items yet" message="Add action items manually, import from CSV, or use AI to generate them from a description." /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-paper/50"><th className="text-left px-4 py-2.5 font-medium text-text-muted">Code</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Title</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Owner</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Due Date</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Status</th>{customFields.map((f) => <th key={f.id} className="text-left px-4 py-2.5 font-medium text-text-muted">{f.label}</th>)}<th className="w-20 px-4 py-2.5"></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0 hover:bg-paper/50 transition-colors">
                  <td className="px-4 py-3"><span className="badge bg-thread-bg text-thread font-mono">{item.code}</span></td>
                  <td className="px-4 py-3 font-medium text-text cursor-pointer hover:text-thread" onClick={() => setDetailItem(item)}>{item.title}</td>
                  <td className="px-4 py-3 text-text-muted">{item.owner ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{item.due_date ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                  {customFields.map((f) => <td key={f.id} className="px-4 py-3 text-text-muted text-xs">{item.custom_fields?.[f.field_key] ?? '—'}</td>)}
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><button className="text-text-faint hover:text-thread p-1" title="Comments" onClick={() => setDetailItem(item)}><MessageSquare size={14} /></button><button className="text-text-faint hover:text-thread p-1" onClick={() => openEdit(item)}><Pencil size={14} /></button><button className="text-text-faint hover:text-red p-1" onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit action item' : 'Add action item'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. AI-001" /></div>
            <div>
              <label className="label">Assign To</label>
              <select className="input" value={form.owner_user_id} onChange={(e) => setForm({ ...form, owner_user_id: e.target.value, owner: e.target.value ? (assignableUsers.find((u) => u.id === e.target.value)?.display_name || assignableUsers.find((u) => u.id === e.target.value)?.email.split('@')[0] || '') : '' })}>
                <option value="">— Unassigned —</option>
                {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.email}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Review test plan with stakeholders" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div><div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <CustomFieldInputs fields={customFields} values={form.customFields} onChange={(key, val) => setForm({ ...form, customFields: { ...form.customFields, [key]: val } })} />
        </div>
        {saveError && <p className="text-xs text-red mt-2">{saveError}</p>}
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost btn-sm" onClick={() => { setModal(false); setSaveError(null); }}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.code.trim() || !form.title.trim()}>Save</button></div>
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete action item"
        message={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}"? This cannot be undone.`}
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Detail drawer with comments */}
      {detailItem && projectId && orgId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-ink/40" onClick={() => setDetailItem(null)} />
          <div className="relative w-full max-w-md bg-card shadow-xl h-full overflow-y-auto animate-slide-up p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><span className="badge bg-thread-bg text-thread font-mono">{detailItem.code}</span><h2 className="text-base font-semibold">{detailItem.title}</h2></div>
              <button className="text-text-faint hover:text-text" onClick={() => setDetailItem(null)}><X size={18} /></button>
            </div>
            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-text-muted text-xs">Owner</span><p className="font-medium">{detailItem.owner ?? 'Unassigned'}</p></div>
                <div><span className="text-text-muted text-xs">Due Date</span><p className="font-medium">{detailItem.due_date ?? 'None'}</p></div>
                <div><span className="text-text-muted text-xs">Status</span><div><StatusBadge value={detailItem.status} /></div></div>
              </div>
              {detailItem.notes && <div><span className="text-text-muted text-xs">Notes</span><p className="text-sm text-text mt-1">{detailItem.notes}</p></div>}
            </div>
            <div className="border-t border-line pt-4">
              <CommentPanel projectId={projectId} orgId={orgId} itemType="action_item" itemId={detailItem.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { Open: 'bg-blue-50 text-blue-600', 'In Progress': 'bg-yellow-50 text-yellow-600', Done: 'bg-green-50 text-green-600', Cancelled: 'bg-gray-100 text-gray-400' };
  return <span className={`badge ${colors[value] ?? 'bg-gray-100 text-gray-600'}`}>{value}</span>;
}
