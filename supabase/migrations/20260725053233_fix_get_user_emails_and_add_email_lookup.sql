/*
# Correct get_user_emails to SECURITY DEFINER + add get_user_by_email RPC

## Overview
The previous security migration switched get_user_emails to SECURITY INVOKER, but
that breaks the function: the `authenticated` role cannot read `auth.users` directly
(RLS on auth.users restricts each user to their own row). The function must remain
SECURITY DEFINER to read other users' emails for @mention autocomplete.

The real fix for the "Public Can Execute" advisory is REVOKE EXECUTE FROM PUBLIC so
anon cannot call it, while keeping GRANT to authenticated (intentional — the app
requires sign-in). This resolves the anon exposure while preserving functionality.

Also adds `get_user_by_email(_email text)` — a SECURITY DEFINER function that looks
up a user id by email address, used by the org invite flow (previously queried the
now-dropped user_emails view). Restricted to authenticated only.

## Functions modified
- `public.get_user_emails(uuid[])` — back to SECURITY DEFINER, search_path = pg_catalog,
  REVOKE FROM PUBLIC, GRANT TO authenticated
- `public.get_user_by_email(text)` — NEW, SECURITY DEFINER, returns (id uuid, email text),
  REVOKE FROM PUBLIC, GRANT TO authenticated

## Security
- anon can no longer execute either function
- authenticated can (intentional — app requires sign-in)
- Both functions have fixed search_path
*/

-- Fix get_user_emails: SECURITY DEFINER (needed to read auth.users), restricted to authenticated
CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT id, email FROM auth.users WHERE id = ANY(user_ids);
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;

-- New: get_user_by_email for invite flow (replaces dropped user_emails view lookup)
CREATE OR REPLACE FUNCTION public.get_user_by_email(_email text)
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT id, email FROM auth.users WHERE email = lower(_email);
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_by_email(text) TO authenticated;
