/*
  # Limit profile reads to the owner and organization co-members (F7)

  1. Problem
     `profiles_select` used `USING (true)`, so any signed-in account could read the
     full directory of every user's display name and avatar across all tenants.

  2. Changes
     - Replace the policy with one allowing a user to read their own profile, or the
       profile of someone who shares at least one organization with them.
*/

CREATE OR REPLACE FUNCTION public.shares_org_with(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships a
    JOIN public.org_memberships b ON b.org_id = a.org_id
    WHERE a.user_id = auth.uid()
      AND b.user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.shares_org_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_org_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select" ON user_profiles;

CREATE POLICY "profiles_select" ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR shares_org_with(id));
