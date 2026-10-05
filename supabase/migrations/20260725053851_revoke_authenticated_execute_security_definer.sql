/*
# Revoke authenticated execute on SECURITY DEFINER functions

## Membership helpers (is_org_member, is_project_member, is_org_admin, is_platform_admin)
Revoked from authenticated. These are ONLY used inside RLS policy expressions.
Policy-internal function calls execute as the table owner (superuser), which bypasses
the EXECUTE permission check entirely — so revoking from authenticated does not break
any policies. It only blocks direct REST RPC calls from clients, which is the goal.

## Email lookup helpers (get_user_emails, get_user_by_email)
Revoked from authenticated. The frontend previously called these via RPC, but that
exposed a SECURITY DEFINER function that reads auth.users. The email-lookup logic is
moved to a `user-lookup` edge function that uses the service role key (bypassing RLS)
and verifies the caller's JWT before returning data. The frontend is updated to call
the edge function via supabase.functions.invoke() instead of supabase.rpc().
*/

REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM authenticated;
