/*
# Create resource allocations table

## Overview
Adds project-level projected resource allocation tracking. Each entry records a
team member's projected hours on a project during a specific timeline (start/end
date). This enables both a per-project view of who is working when, and an
enterprise-wide combined view across all projects to assess resource availability.

## New Tables
1. `resource_allocations`
   - `id` (uuid, primary key)
   - `project_id` (uuid, FK to projects, cascade delete)
   - `user_id` (uuid, FK to auth.users, cascade delete) — the team member being allocated
   - `allocated_by` (uuid, FK to auth.users) — who created the allocation entry
   - `hours_per_week` (numeric, not null) — projected hours per week during the timeline
   - `start_date` (date, not null) — when involvement begins
   - `end_date` (date, not null) — when involvement ends
   - `role` (text) — role on this project (e.g. Lead, QA, Developer)
   - `notes` (text) — optional notes
   - `created_at`, `updated_at` (timestamptz)

## Indexes
- `idx_resource_allocations_project_id` for project queries
- `idx_resource_allocations_user_id` for per-member queries

## Security (RLS)
- RLS enabled.
- 4 policies (select/insert/update/delete) scoped to authenticated users who are
  members of the org that owns the project. Membership is checked via
  org_memberships. This allows any org member to manage allocations on the org's
  projects, consistent with how other project modules work in this app.
- `allocated_by` defaults to auth.uid() so inserts omit it safely.
*/

CREATE TABLE IF NOT EXISTS resource_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allocated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  hours_per_week numeric(6,1) NOT NULL DEFAULT 0 CHECK (hours_per_week >= 0 AND hours_per_week <= 168),
  start_date date NOT NULL,
  end_date date NOT NULL,
  role text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_date_order CHECK (end_date >= start_date)
);

ALTER TABLE resource_allocations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_resource_allocations_project_id ON resource_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_user_id ON resource_allocations(user_id);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_resource_allocations_updated_at') THEN
    CREATE TRIGGER trg_resource_allocations_updated_at BEFORE UPDATE ON resource_allocations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Policies: org members can CRUD allocations on their org's projects
DROP POLICY IF EXISTS "select_resource_allocations" ON resource_allocations;
CREATE POLICY "select_resource_allocations" ON resource_allocations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN org_memberships om ON om.org_id = p.org_id
      WHERE p.id = resource_allocations.project_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_resource_allocations" ON resource_allocations;
CREATE POLICY "insert_resource_allocations" ON resource_allocations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN org_memberships om ON om.org_id = p.org_id
      WHERE p.id = resource_allocations.project_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_resource_allocations" ON resource_allocations;
CREATE POLICY "update_resource_allocations" ON resource_allocations FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN org_memberships om ON om.org_id = p.org_id
      WHERE p.id = resource_allocations.project_id AND om.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN org_memberships om ON om.org_id = p.org_id
      WHERE p.id = resource_allocations.project_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_resource_allocations" ON resource_allocations;
CREATE POLICY "delete_resource_allocations" ON resource_allocations FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN org_memberships om ON om.org_id = p.org_id
      WHERE p.id = resource_allocations.project_id AND om.user_id = auth.uid()
    )
  );
