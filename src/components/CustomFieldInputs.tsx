import type { CustomFieldDefinition } from '../lib/types';

export function CustomFieldInputs({ fields, values, onChange }: {
  fields: CustomFieldDefinition[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (fields.length === 0) return null;

  return (
    <>
      <div className="border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Custom Fields</p>
      </div>
      {fields.map((f) => (
        <div key={f.id}>
          <label className="label">{f.label}</label>
          {f.field_type === 'select' ? (
            <select className="input" value={values[f.field_key] ?? ''} onChange={(e) => onChange(f.field_key, e.target.value)}>
              <option value="">— None —</option>
              {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
              className="input"
              value={values[f.field_key] ?? ''}
              onChange={(e) => onChange(f.field_key, e.target.value)}
            />
          )}
        </div>
      ))}
    </>
  );
}
