/*
# Create project_milestones table for Executive Dashboard

## Purpose
The Executive Dashboard needs to track project timelines, milestones, and
projected completion dates. This table stores milestones per project with
planned and actual dates, status, and dependencies.

## New Table: project_milestones
- id (uuid, PK)
- project_id (uuid, FK to projects.id, CASCADE on delete)
- name (text, not null) — milestone name
- description (text, nullable) — details
- phase (text, not null) — project phase: Initiation, Planning, Execution, Monitoring, Closure
- planned_start (date, nullable) — planned start date
- planned_end (date, nullable) — planned end date
- actual_start (date, nullable) — actual start date
- actual_end (date, nullable) — actual end date
- status (text, not null, default 'Not Started') — Not Started, In Progress, Completed, Delayed, At Risk
- owner (text, nullable) — responsible person
- progress (integer, default 0) — 0-100 completion percentage
- sort_order (integer, default 0) — ordering within the project
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

## Security
- RLS enabled on project_milestones
- 4 CRUD policies scoped to authenticated users via project membership check:
  uses EXISTS subquery on org_memberships to verify the user belongs to the
  organization that owns the project.

## Notes
1. The membership check joins through projects -> organizations -> org_memberships
   to verify the authenticated user is a member of the org that owns this project.
2. Progress is stored as 0-100 integer for the dashboard progress bars.
3. Phase aligns with PMBOK process groups for the project management framework.
*/

CREATE TABLE IF NOT EXISTS project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  phase text NOT NULL DEFAULT 'Execution',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  status text NOT NULL DEFAULT 'Not Started',
  owner text,
  progress integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_milestones" ON project_milestones;
CREATE POLICY "select_milestones" ON project_milestones FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organizations o ON o.id = p.org_id
      JOIN org_memberships m ON m.org_id = o.id
      WHERE p.id = project_milestones.project_id
      AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_milestones" ON project_milestones;
CREATE POLICY "insert_milestones" ON project_milestones FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organizations o ON o.id = p.org_id
      JOIN org_memberships m ON m.org_id = o.id
      WHERE p.id = project_milestones.project_id
      AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_milestones" ON project_milestones;
CREATE POLICY "update_milestones" ON project_milestones FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organizations o ON o.id = p.org_id
      JOIN org_memberships m ON m.org_id = o.id
      WHERE p.id = project_milestones.project_id
      AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organizations o ON o.id = p.org_id
      JOIN org_memberships m ON m.org_id = o.id
      WHERE p.id = project_milestones.project_id
      AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_milestones" ON project_milestones;
CREATE POLICY "delete_milestones" ON project_milestones FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organizations o ON o.id = p.org_id
      JOIN org_memberships m ON m.org_id = o.id
      WHERE p.id = project_milestones.project_id
      AND m.user_id = auth.uid()
    )
  );
