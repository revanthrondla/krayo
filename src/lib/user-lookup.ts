import { supabase } from './supabase';

export async function lookupUserEmails(userIds: string[]) {
  return supabase.functions.invoke<{ id: string; email: string }[] | null>('user-lookup', {
    body: { mode: 'by_ids', user_ids: userIds },
  });
}

export async function lookupUserByEmail(email: string) {
  return supabase.functions.invoke<{ id: string } | null>('user-lookup', {
    body: { mode: 'by_email', email },
  });
}
