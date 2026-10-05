import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { CustomFieldDefinition } from './types';

export function useCustomFields(projectId: string | undefined, moduleKey: string) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const dbModule = moduleKey === 'testcases' ? 'test_cases'
    : moduleKey === 'actionitems' ? 'action_items'
    : moduleKey === 'raid' ? 'raid_entries'
    : moduleKey === 'jobaids' ? 'job_aids'
    : moduleKey;

  const refresh = useCallback(async () => {
    if (!projectId) { setFields([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('project_id', projectId)
        .eq('module', dbModule)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setFields((data ?? []) as CustomFieldDefinition[]);
    } catch { setFields([]); }
    finally { setLoading(false); }
  }, [projectId, dbModule]);

  useEffect(() => { refresh(); }, [refresh]);

  const addField = useCallback(async (label: string, fieldType: string, options: string[] | null): Promise<CustomFieldDefinition | null> => {
    if (!projectId) return null;
    const fieldKey = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${Date.now()}`;
    const sortOrder = fields.length;
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert({ project_id: projectId, module: dbModule, label, field_key: fieldKey, field_type: fieldType, options, sort_order: sortOrder })
      .select().single();
    if (error) throw error;
    await refresh();
    return data as CustomFieldDefinition;
  }, [projectId, dbModule, fields.length, refresh]);

  const updateField = useCallback(async (id: string, patch: Partial<CustomFieldDefinition>) => {
    const { error } = await supabase.from('custom_field_definitions').update(patch).eq('id', id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const removeField = useCallback(async (id: string) => {
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { fields, loading, addField, updateField, removeField, refresh };
}
