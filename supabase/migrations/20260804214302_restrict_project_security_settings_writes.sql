/*
  # Restrict project security settings writes to organization admins (F8)

  1. Problem
     Every write policy on `project_security_settings` only required plain project
     membership, so any member could disable audit logging, change data classification
     or delete the security configuration of a project.

  2. Changes
     - INSERT/UPDATE/DELETE now require organization admin rights on the project's org.
     - SELECT is unchanged so members can still view the settings.
*/

DROP POLICY IF EXISTS "insert_project_security" ON project_security_settings;
DROP POLICY IF EXISTS "update_project_security" ON project_security_settings;
DROP POLICY IF EXISTS "delete_project_security" ON project_security_settings;

CREATE POLICY "insert_project_security" ON project_security_settings FOR INSERT
  TO authenticated
  WITH CHECK (is_project_org_admin(project_id));

CREATE POLICY "update_project_security" ON project_security_settings FOR UPDATE
  TO authenticated
  USING (is_project_org_admin(project_id))
  WITH CHECK (is_project_org_admin(project_id));

CREATE POLICY "delete_project_security" ON project_security_settings FOR DELETE
  TO authenticated
  USING (is_project_org_admin(project_id));
