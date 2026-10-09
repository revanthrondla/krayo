import { supabase } from './supabase';

export type ActivationEventName =
  | 'organization_created'
  | 'project_created'
  | 'starter_project_created'
  | 'first_requirement_created'
  | 'first_test_case_created'
  | 'first_defect_created'
  | 'teammate_invited'
  | 'ai_generation_used'
  | 'upgrade_started'
  | 'upgrade_completed';

export async function recordActivationEvent(eventName: ActivationEventName, options: { orgId?: string; projectId?: string; metadata?: Record<string, unknown> } = {}): Promise<void> {
  try {
    const query = supabase
      .from('activation_events')
      .select('id')
      .eq('event_name', eventName)
      .limit(1);
    const scopedQuery = options.projectId ? query.eq('project_id', options.projectId) : options.orgId ? query.eq('org_id', options.orgId) : query;
    const { data: existing, error: lookupError } = await scopedQuery.maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return;

    const { error } = await supabase.from('activation_events').insert({
      org_id: options.orgId ?? null,
      project_id: options.projectId ?? null,
      event_name: eventName,
      metadata: options.metadata ?? {},
    });
    if (error) throw error;
  } catch (error) {
    console.error('Failed to record activation event:', error);
  }
}
