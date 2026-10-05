/*
  # Remove anonymous execute rights on membership helper functions

  These SECURITY DEFINER helpers only ever report on the calling user's own
  membership, so they were not exploitable by an anonymous caller, but there is no
  reason for the unauthenticated role to be able to call them at all.
*/

REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
