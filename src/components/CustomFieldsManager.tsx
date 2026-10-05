import { useState } from 'react';
import { Trash2, Plus, Loader2, Settings2 } from 'lucide-react';
import { Modal } from './Modal';
import { useCustomFields } from '../lib/use-custom-fields';
import type { CustomFieldDefinition } from '../lib/types';
import { friendlyMessage } from '../lib/errors';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
];

export function CustomFieldsManager({ open, onClose, projectId, moduleKey, moduleName }: {
  open: boolean; onClose: () => void; projectId: string | undefined; moduleKey: string; moduleName: string;
}) {
  const { fields, loading, addField, removeField } = useCustomFields(projectId, moduleKey);
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [optionsText, setOptionsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!label.trim()) return;
    setSaving(true); setError(null);
    try {
      const options = fieldType === 'select' && optionsText.trim()
        ? optionsText.split(',').map((o) => o.trim()).filter(Boolean)
        : null;
      await addField(label.trim(), fieldType, options);
      setLabel(''); setFieldType('text'); setOptionsText('');
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to add field'));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try { await removeField(id); } catch (err) {
      setError(friendlyMessage(err, 'Failed to delete field'));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Custom Fields — ${moduleName}`} maxWidth="max-w-lg">
      <p className="text-xs text-text-muted mb-4">
        Add up to 10 custom fields for {moduleName.toLowerCase()}. These appear in the add/edit form, the table, and CSV import/export.
      </p>

      {error && <p className="text-xs text-red mb-3">{error}</p>}

      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 size={20} className="animate-spin text-text-faint" /></div>
        ) : fields.length === 0 ? (
          <p className="text-xs text-text-faint text-center py-4">No custom fields yet. Add one below.</p>
        ) : (
          fields.map((f: CustomFieldDefinition) => (
            <div key={f.id} className="flex items-center justify-between card p-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-text truncate">{f.label}</span>
                <span className="badge bg-paper text-text-muted text-[10px]">{f.field_type}</span>
                {f.options && <span className="text-[10px] text-text-faint truncate">{f.options.join(', ')}</span>}
              </div>
              <button className="text-text-faint hover:text-red p-1 shrink-0" onClick={() => handleDelete(f.id)}><Trash2 size={14} /></button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-line pt-4">
        {fields.length >= 10 && (
          <p className="text-xs text-orange-600 mb-2">Maximum of 10 custom fields reached. Remove one to add more.</p>
        )}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Field Label</label>
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Test Environment" disabled={fields.length >= 10} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={fieldType} onChange={(e) => setFieldType(e.target.value)} disabled={fields.length >= 10}>
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          {fieldType === 'select' && (
            <div>
              <label className="label">Dropdown Options (comma-separated)</label>
              <input className="input" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Option 1, Option 2, Option 3" disabled={fields.length >= 10} />
            </div>
          )}
          <button className="btn btn-primary btn-sm w-full" onClick={handleAdd} disabled={saving || !label.trim() || fields.length >= 10}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : <><Plus size={14} /> Add field</>}
          </button>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button className="btn btn-ghost btn-sm" onClick={onClose}><Settings2 size={14} /> Done</button>
      </div>
    </Modal>
  );
}
