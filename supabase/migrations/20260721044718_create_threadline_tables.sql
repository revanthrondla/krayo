/*
# Threadline MVP Schema — Tables (Part 1)

## Overview
Creates all tables for Threadline: organizations with role-based memberships,
projects, and all traceability modules (requirements, test cases, defects, action
items, decisions, RAID entries, job aids). RLS policies are added in a follow-up
migration so helper functions can reference these tables.

## New Tables
1. `organizations` — top-level tenant (id, name, plan, billing_status, owner_id, created_at)
2. `org_memberships` — join table (user_id, org_id, role: Owner/Admin/BillingAdmin/Member)
3. `projects` — a project within an org (org_id, name, description, created_at)
4. `project_memberships` — per-project role override (user_id, project_id, role)
5. `requirements` — code, title, description, category, priority, status, project_id
6. `test_cases` — code, title, cycle (CRP/SIT/UAT), steps, expected_result, status, requirement_id
7. `defects` — code, title, severity, description, status, test_case_id
8. `action_items` — code, title, owner, due_date, status, notes
9. `decisions` — code, title, description, decided_by, decision_date, requirement_id
10. `raid_entries` — code, title, type (Risk/Assumption/Issue/Dependency), description, owner, status
11. `job_aids` — code, title, description, url

## Important Notes
1. owner_id / user_id columns default to auth.uid() where the client inserts without
   passing an explicit user id.
2. Foreign keys use ON DELETE CASCADE so removing an org/project cleans up children.
3. updated_at columns auto-update via triggers on all module tables.
4. RLS is enabled on every table; policies are added in Part 2.
*/

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'team', 'enterprise')),
  billing_status text NOT NULL DEFAULT 'trialing' CHECK (billing_status IN ('active', 'trialing', 'past_due', 'canceled')),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORG MEMBERSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Member' CHECK (role IN ('Owner', 'Admin', 'BillingAdmin', 'Member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROJECT MEMBERSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS project_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Contributor' CHECK (role IN ('ProjectAdmin', 'Contributor', 'Viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REQUIREMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Reviewed', 'Approved', 'Implemented', 'Deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TEST CASES
-- ============================================================

CREATE TABLE IF NOT EXISTS test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES requirements(id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  cycle text NOT NULL DEFAULT 'UAT' CHECK (cycle IN ('CRP', 'SIT', 'UAT')),
  steps text,
  expected_result text,
  status text NOT NULL DEFAULT 'Not Run' CHECK (status IN ('Not Run', 'In Progress', 'Passed', 'Failed', 'Blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DEFECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_case_id uuid REFERENCES test_cases(id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  description text,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Fixed', 'Verified', 'Closed', 'Rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE defects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ACTION ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  owner text,
  due_date date,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Done', 'Cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DECISIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES requirements(id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  decided_by text,
  decision_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RAID ENTRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS raid_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'Risk' CHECK (type IN ('Risk', 'Assumption', 'Issue', 'Dependency')),
  description text,
  owner text,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Monitoring', 'Mitigated', 'Closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE raid_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- JOB AIDS
-- ============================================================

CREATE TABLE IF NOT EXISTS job_aids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_aids ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_project_memberships_project_id ON project_memberships(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_requirement_id ON test_cases(requirement_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_cycle ON test_cases(cycle);
CREATE INDEX IF NOT EXISTS idx_defects_project_id ON defects(project_id);
CREATE INDEX IF NOT EXISTS idx_defects_test_case_id ON defects(test_case_id);
CREATE INDEX IF NOT EXISTS idx_defects_status ON defects(status);
CREATE INDEX IF NOT EXISTS idx_action_items_project_id ON action_items(project_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_decisions_project_id ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_raid_entries_project_id ON raid_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_raid_entries_type ON raid_entries(type);
CREATE INDEX IF NOT EXISTS idx_job_aids_project_id ON job_aids(project_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['requirements','test_cases','defects','action_items','decisions','raid_entries','job_aids'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || t || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END $$;