/*
  # Restrict project membership management to organization admins (F6)

  1. Problem
     All write policies on `project_memberships` used `is_project_member(project_id)`,
     which resolves to plain organization membership. Any member could therefore add
     arbitrary users to a project, promote themselves to a project Admin role, or
     remove other people's access.

  2. Changes
     - Add `is_project_org_admin(project_id)` helper.
     - INSERT/UPDATE/DELETE now require organization admin rights on the project's org.
     - INSERT/UPDATE additionally require that the target user already belongs to that
       organization, so a membership row cannot name an outsider.
     - SELECT is unchanged so members still see the project roster.
*/

CREATE OR REPLACE FUNCTION public.is_project_org_admin(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.org_memberships m ON m.org_id = p.org_id
    WHERE p.id = _project_id
      AND m.user_id = auth.uid()
      AND m.role IN ('Owner', 'Admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_in_project_org(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.org_memberships m ON m.org_id = p.org_id
    WHERE p.id = _project_id AND m.user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_project_org_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_in_project_org(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_in_project_org(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "insert_project_memberships" ON project_memberships;
DROP POLICY IF EXISTS "update_project_memberships" ON project_memberships;
DROP POLICY IF EXISTS "delete_project_memberships" ON project_memberships;

CREATE POLICY "insert_project_memberships" ON project_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    is_project_org_admin(project_id)
    AND is_user_in_project_org(project_id, user_id)
  );

CREATE POLICY "update_project_memberships" ON project_memberships FOR UPDATE
  TO authenticated
  USING (is_project_org_admin(project_id))
  WITH CHECK (
    is_project_org_admin(project_id)
    AND is_user_in_project_org(project_id, user_id)
  );

CREATE POLICY "delete_project_memberships" ON project_memberships FOR DELETE
  TO authenticated
  USING (is_project_org_admin(project_id));
