/*
# Re-grant EXECUTE on membership helper functions

## Context
A previous security lockdown revoked EXECUTE on ALL SECURITY DEFINER functions
from all roles. This broke RLS policies that call membership helper functions
(is_org_member, is_org_admin, is_project_member, is_platform_admin) — RLS
policies execute as the calling user, so they need EXECUTE permission on
these functions.

## Changes
- GRANT EXECUTE on is_org_member, is_org_admin, is_project_member,
  is_platform_admin TO authenticated and anon.
- The email lookup functions (get_user_emails, get_user_by_email) remain
  revoked — they expose email addresses and are now handled securely via
  edge functions instead.

## Security
These four functions only return booleans (membership/admin checks) and
cannot be exploited to leak user data. They are SECURITY DEFINER functions
that check org_memberships / auth.users internally.
*/

GRANT EXECUTE ON FUNCTION is_org_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_org_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_project_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated, anon;