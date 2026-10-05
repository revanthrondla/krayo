import { supabase } from './supabase';
import { lookupUserEmails } from './user-lookup';

export interface UserProfile {
  id: string; display_name: string | null; avatar_color: string;
  timezone: string; language: string;
  notification_email: boolean; notification_mentions: boolean; notification_assignments: boolean;
  email_verified: boolean;
  created_at: string; updated_at: string;
}

export async function getProfile(): Promise<UserProfile | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) return null;
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data as UserProfile | null;
}

export async function upsertProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('user_profiles').upsert(profile).select().maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export async function getOrgMembersForMention(orgId: string): Promise<{ id: string; email: string; display_name: string | null }[]> {
  const { data, error } = await supabase
    .from('org_memberships')
    .select('user_id')
    .eq('org_id', orgId);
  if (error || !data) return [];
  const userIds = data.map((d: { user_id: string }) => d.user_id);
  const [profilesRes, authRes] = await Promise.all([
    supabase.from('user_profiles').select('id, display_name').in('id', userIds),
    lookupUserEmails(userIds),
  ]);
  const emailMap = new Map(((authRes.data ?? []) as { id: string; email: string }[]).map((u) => [u.id, u.email]));
  const nameMap = new Map((profilesRes.data ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
  return userIds.map((id) => ({ id, email: emailMap.get(id) ?? '', display_name: nameMap.get(id) ?? null }));
}

export async function sendNotifications(params: {
  type: string; recipientIds: string[]; projectId?: string;
  itemType?: string; itemId?: string; actorId?: string; message: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('send-notification', { body: params });
  if (error) console.error('Failed to send notification:', error);
}

export async function getNotifications(): Promise<Notification[]> {
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('read', false);
}

export interface Notification {
  id: string; user_id: string; type: string; project_id: string | null;
  item_type: string | null; item_id: string | null; actor_id: string | null;
  message: string; read: boolean; email_sent: boolean; created_at: string;
}
