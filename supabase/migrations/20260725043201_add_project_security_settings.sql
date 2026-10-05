/*
# Add project-level security settings

## Purpose
Enterprise admins need to manage security and access at the project level, not just the org level.
This adds per-project security settings that can override (tighten) the org-level defaults.

## New Tables
- `project_security_settings`
  - `id` (uuid, primary key)
  - `project_id` (uuid, FK to projects, unique — one row per project)
  - `restrict_visibility` (bool, default true) — only project members can see this project
  - `require_explicit_membership` (bool, default true) — users must be added as project members
  - `allow_external_comments` (bool, default false) — allow comments from non-project-members
  - `enforce_two_factor` (bool, default false) — require 2FA for project access (advisory flag)
  - `ip_allowlist` (text, nullable) — comma-separated CIDR ranges for project access
  - `max_members` (int, default 50) — cap on project members
  - `created_at`, `updated_at` (timestamps)

## Security
- RLS enabled on `project_security_settings`.
- Only project members (via `is_project_member`) can SELECT/INSERT/UPDATE/DELETE.
  In practice only org owners / admins will manage these, but the membership check
  keeps it consistent with the rest of the project-scoped tables.
*/

CREATE TABLE IF NOT EXISTS project_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  restrict_visibility boolean NOT NULL DEFAULT true,
  require_explicit_membership boolean NOT NULL DEFAULT true,
  allow_external_comments boolean NOT NULL DEFAULT false,
  enforce_two_factor boolean NOT NULL DEFAULT false,
  ip_allowlist text,
  max_members integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_project_security" ON project_security_settings;
CREATE POLICY "select_project_security" ON project_security_settings
  FOR SELECT TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_project_security" ON project_security_settings;
CREATE POLICY "insert_project_security" ON project_security_settings
  FOR INSERT TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_project_security" ON project_security_settings;
CREATE POLICY "update_project_security" ON project_security_settings
  FOR UPDATE TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_project_security" ON project_security_settings;
CREATE POLICY "delete_project_security" ON project_security_settings
  FOR DELETE TO authenticated USING (is_project_member(project_id));
