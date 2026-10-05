/*
# Fix security advisories: search paths, SECURITY DEFINER exposure, view exposure, RLS bypass

## Overview
Resolves every advisory from the Supabase security linter:

1. **Function Search Path Mutable** — All SECURITY DEFINER / trigger functions had no
   explicit `search_path`, leaving them mutable. Each is now recreated with
   `SET search_path = public, auth` (or `public` where auth is not needed) so the
   search path is fixed and cannot be hijacked.

2. **Public Can Execute SECURITY DEFINER Function** — The membership helper functions
   (`is_org_member`, `is_project_member`, `is_org_admin`, `is_platform_admin`,
   `get_user_emails`) were executable by `anon` and `authenticated` via the REST RPC
   endpoint. `REVOKE EXECUTE` from `PUBLIC` and grant only to `authenticated` (the
   app requires sign-in, so these are never called by anon). `get_user_emails` is
   additionally switched to `SECURITY INVOKER` since it only needs to read auth.users
   and the caller is already authenticated.

3. **Exposed Auth Users / Security Definer View** — `public.user_emails` was a
   SECURITY DEFINER view over `auth.users` exposed in the public schema. It is
   dropped entirely. The frontend now uses the `get_user_emails` RPC instead (which
   is restricted to authenticated callers and only returns id+email).

4. **RLS Policy Always True** — Two INSERT policies used `WITH CHECK (true)`:
   - `notifications.insert_orgs` — replaced with `WITH CHECK (auth.uid() = owner_id)`
     and the frontend now passes `owner_id` explicitly on org creation, so the
     ownership check succeeds.
   - `notifications.notifications_insert` — the send-notification edge function
     inserts rows for *other* users using the service role key (which bypasses RLS),
     so this policy is only hit by direct client inserts. Replaced with
     `WITH CHECK (auth.uid() = user_id)` so a client can only insert notifications
     for itself; the edge function's service-role insert is unaffected.

## Functions modified
- `public.set_updated_at()` — add `SET search_path = public`
- `public.update_updated_at_column()` — add `SET search_path = public`
- `public.is_org_member(uuid)` — add `SET search_path = public`, REVOKE EXECUTE from PUBLIC
- `public.is_project_member(uuid)` — add `SET search_path = public`, REVOKE EXECUTE from PUBLIC
- `public.is_org_admin(uuid)` — add `SET search_path = public`, REVOKE EXECUTE from PUBLIC
- `public.is_platform_admin()` — add `SET search_path = public`, REVOKE EXECUTE from PUBLIC
- `public.get_user_emails(uuid[])` — switch to SECURITY INVOKER, add `SET search_path = pg_catalog`, REVOKE EXECUTE from PUBLIC

## Views modified
- `public.user_emails` — DROPPED (replaced by get_user_emails RPC)

## Policies modified
- `organizations.insert_orgs` — `WITH CHECK (auth.uid() = owner_id)`
- `notifications.notifications_insert` — `WITH CHECK (auth.uid() = user_id)`

## Security changes
- REVOKE EXECUTE ON ALL listed functions FROM PUBLIC.
- GRANT EXECUTE ON membership helpers TO authenticated only.
- Drop public.user_emails view.

## Important Notes
1. The app requires sign-in (authenticated session), so anon never legitimately
   calls these functions — revoking from PUBLIC and granting to authenticated
   is safe.
2. The send-notification edge function uses the service role key, which bypasses
   RLS, so tightening notifications_insert does not break notification delivery.
3. The frontend is updated in the same change to pass owner_id when creating an
   org and to call get_user_emails via RPC instead of querying the dropped view.
*/

-- ============================================================
-- 1. FIX TRIGGER FUNCTIONS — add immutable search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. FIX MEMBERSHIP HELPERS — search_path + revoke public execute
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE org_id = _org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.org_memberships m ON m.org_id = p.org_id
    WHERE p.id = _project_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE org_id = _org_id
      AND user_id = auth.uid()
      AND role IN ('Owner', 'Admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  );
$function$;

-- Revoke public execute and restrict to authenticated
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ============================================================
-- 3. FIX get_user_emails — SECURITY INVOKER + revoke public execute
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
  SELECT id, email FROM auth.users WHERE id = ANY(user_ids);
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;

-- ============================================================
-- 4. DROP exposed user_emails view
-- ============================================================

DROP VIEW IF EXISTS public.user_emails;

-- ============================================================
-- 5. FIX RLS POLICIES — remove WITH CHECK (true)
-- ============================================================

-- organizations: require owner_id to match the authenticated user
DROP POLICY IF EXISTS "insert_orgs" ON organizations;
CREATE POLICY "insert_orgs" ON organizations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

-- notifications: client can only insert for itself; edge function uses service role (bypasses RLS)
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
