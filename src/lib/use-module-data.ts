import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { friendlyMessage } from './errors';
import { recordActivationEvent, type ActivationEventName } from './activation';

export function useModuleData<T extends { id: string; project_id: string }>(table: string, projectId: string | undefined) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) { setItems([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase.from(table).select('*').eq('project_id', projectId).order('created_at', { ascending: true });
      if (err) throw err;
      setItems((data ?? []) as T[]);
    } catch (err) { setError(friendlyMessage(err, 'Failed to load data')); setItems([]); }
    finally { setLoading(false); }
  }, [table, projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const insert = useCallback(async (row: Record<string, unknown>): Promise<T> => {
    const { data, error: err } = await supabase.from(table).insert({ ...row, project_id: projectId }).select().single();
    if (err) throw err;
    const eventName: ActivationEventName | null = table === 'requirements' ? 'first_requirement_created' : table === 'test_cases' ? 'first_test_case_created' : table === 'defects' ? 'first_defect_created' : null;
    if (eventName && projectId) await recordActivationEvent(eventName, { projectId });
    await refresh();
    return data as T;
  }, [table, projectId, refresh]);

  const insertMany = useCallback(async (rows: Record<string, unknown>[]): Promise<void> => {
    const rowsWithProject = rows.map((r) => ({ ...r, project_id: projectId }));
    const { error: err } = await supabase.from(table).insert(rowsWithProject);
    if (err) throw err;
    const eventName: ActivationEventName | null = table === 'requirements' ? 'first_requirement_created' : table === 'test_cases' ? 'first_test_case_created' : table === 'defects' ? 'first_defect_created' : null;
    if (eventName && projectId) await recordActivationEvent(eventName, { projectId });
    await refresh();
  }, [table, projectId, refresh]);

  const update = useCallback(async (id: string, patch: Record<string, unknown>): Promise<void> => {
    const { error: err } = await supabase.from(table).update(patch).eq('id', id);
    if (err) throw err;
    await refresh();
  }, [table, refresh]);

  const remove = useCallback(async (id: string): Promise<void> => {
    const { error: err } = await supabase.from(table).delete().eq('id', id);
    if (err) throw err;
    await refresh();
  }, [table, refresh]);

  return { items, loading, error, refresh, insert, insertMany, update, remove };
}
