/*
  # Restrict renaming and deleting projects to organization admins (F9)

  1. Problem
     `update_projects` and `delete_projects` only required `is_org_member(org_id)`, so
     any member of an organization could rename or permanently delete any project in
     that organization, cascading away all of its module data.

  2. Changes
     - UPDATE and DELETE on `projects` now require `is_org_admin(org_id)`.
     - SELECT and INSERT are unchanged so members can still see and create projects.
*/

DROP POLICY IF EXISTS "update_projects" ON projects;
DROP POLICY IF EXISTS "delete_projects" ON projects;

CREATE POLICY "update_projects" ON projects FOR UPDATE
  TO authenticated
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "delete_projects" ON projects FOR DELETE
  TO authenticated
  USING (is_org_admin(org_id));
