/*
# Threadline MVP Schema — Helper Functions & RLS Policies (Part 2)

## Overview
Adds SECURITY DEFINER helper functions that check membership, then applies Row Level
Security policies to every table created in Part 1.

## Helper Functions
- `is_org_member(_org_id uuid)` — true if auth.uid() has a row in org_memberships for that org.
- `is_project_member(_project_id uuid)` — true if auth.uid() is a member of the org that owns that project.
- `is_org_admin(_org_id uuid)` — true if auth.uid() is Owner or Admin of that org.

## Security (RLS)
- `organizations`: SELECT for members; INSERT for owner; UPDATE/DELETE for org admins.
- `org_memberships`: SELECT for members of the same org; INSERT/UPDATE/DELETE for org admins.
- `projects`: full CRUD for org members.
- `project_memberships`: full CRUD for members of the owning org.
- All module tables (requirements, test_cases, defects, action_items, decisions,
  raid_entries, job_aids): full CRUD for members of the owning org.

## Important Notes
1. Policies are dropped first (DROP POLICY IF EXISTS) so this migration is idempotent.
2. All policies use auth.uid() — never current_user.
3. SELECT policies have USING only; INSERT has WITH CHECK only; UPDATE has both;
   DELETE has USING only. Four separate policies per table, no FOR ALL.
*/

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_id = _org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_project_member(_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN org_memberships m ON m.org_id = p.org_id
    WHERE p.id = _project_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_org_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_id = _org_id
      AND user_id = auth.uid()
      AND role IN ('Owner', 'Admin')
  );
$$;

-- ============================================================
-- ORGANIZATIONS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_own_orgs" ON organizations;
CREATE POLICY "select_own_orgs" ON organizations FOR SELECT
  TO authenticated USING (is_org_member(id));

DROP POLICY IF EXISTS "insert_orgs" ON organizations;
CREATE POLICY "insert_orgs" ON organizations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_orgs" ON organizations;
CREATE POLICY "update_orgs" ON organizations FOR UPDATE
  TO authenticated USING (is_org_admin(id)) WITH CHECK (is_org_admin(id));

DROP POLICY IF EXISTS "delete_orgs" ON organizations;
CREATE POLICY "delete_orgs" ON organizations FOR DELETE
  TO authenticated USING (is_org_admin(id));

-- ============================================================
-- ORG MEMBERSHIPS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_org_memberships" ON org_memberships;
CREATE POLICY "select_org_memberships" ON org_memberships FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "insert_org_memberships" ON org_memberships;
CREATE POLICY "insert_org_memberships" ON org_memberships FOR INSERT
  TO authenticated WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "update_org_memberships" ON org_memberships;
CREATE POLICY "update_org_memberships" ON org_memberships FOR UPDATE
  TO authenticated USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "delete_org_memberships" ON org_memberships;
CREATE POLICY "delete_org_memberships" ON org_memberships FOR DELETE
  TO authenticated USING (is_org_admin(org_id));

-- ============================================================
-- PROJECTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_projects" ON projects;
CREATE POLICY "select_projects" ON projects FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "insert_projects" ON projects;
CREATE POLICY "insert_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (is_org_member(org_id));

DROP POLICY IF EXISTS "update_projects" ON projects;
CREATE POLICY "update_projects" ON projects FOR UPDATE
  TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

DROP POLICY IF EXISTS "delete_projects" ON projects;
CREATE POLICY "delete_projects" ON projects FOR DELETE
  TO authenticated USING (is_org_member(org_id));

-- ============================================================
-- PROJECT MEMBERSHIPS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_project_memberships" ON project_memberships;
CREATE POLICY "select_project_memberships" ON project_memberships FOR SELECT
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_project_memberships" ON project_memberships;
CREATE POLICY "insert_project_memberships" ON project_memberships FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_project_memberships" ON project_memberships;
CREATE POLICY "update_project_memberships" ON project_memberships FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_project_memberships" ON project_memberships;
CREATE POLICY "delete_project_memberships" ON project_memberships FOR DELETE
  TO authenticated USING (is_project_member(project_id));

-- ============================================================
-- REQUIREMENTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_requirements" ON requirements;
CREATE POLICY "select_requirements" ON requirements FOR SELECT
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_requirements" ON requirements;
CREATE POLICY "insert_requirements" ON requirements FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_requirements" ON requirements;
CREATE POLICY "update_requirements" ON requirements FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_requirements" ON requirements;
CREATE POLICY "delete_requirements" ON requirements FOR DELETE
  TO authenticated USING (is_project_member(project_id));

-- ============================================================
-- TEST CASES POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_test_cases" ON test_cases;
CREATE POLICY "select_test_cases" ON test_cases FOR SELECT
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_test_cases" ON test_cases;
CREATE POLICY "insert_test_cases" ON test_cases FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_test_cases" ON test_cases;
CREATE POLICY "update_test_cases" ON test_cases FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_test_cases" ON test_cases;
CREATE POLICY "delete_test_cases" ON test_cases FOR DELETE
  TO authenticated USING (is_project_member(project_id));

-- ============================================================
-- DEFECTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_defects" ON defects;
CREATE POLICY "select_defects" ON defects FOR SELECT
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_defects" ON defects;
CREATE POLICY "insert_defects" ON defects FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_defects" ON defects;
CREATE POLICY "update_defects" ON defects FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_defects" ON defects;
CREATE POLICY "delete_defects" ON defects FOR DELETE
  TO authenticated USING (is_project_member(project_id));

-- ============================================================
-- ACTION ITEMS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_action_items" ON action_items;
CREATE POLICY "select_action_items" ON action_items FOR SELECT
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_action_items" ON action_items;
CREATE POLICY "insert_action_items" ON action_items FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_action_items" ON action_items;
CREATE POLICY "update_action_items" ON action_items FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_action_items" ON action_items;
CREATE POLICY "delete_action_items" ON action_items FOR DELETE
  TO authenticated USING (is_project_member(project_id));

-- ============================================================
-- DECISIONS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_decisions" ON decisions;
CREATE POLICY "select_decisions" ON decisions FOR SELECT
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_decisions" ON decisions;
CREATE POLICY "insert_decisions" ON decisions FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_decisions" ON decisions;
CREATE POLICY "update_decisions" ON decisions FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_decisions" ON decisions;
CREATE POLICY "delete_decisions" ON decisions FOR DELETE
  TO authenticated USING (is_project_member(project_id));

-- ============================================================
-- RAID ENTRIES POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_raid_entries" ON raid_entries;
CREATE POLICY "select_raid_entries" ON raid_entries FOR SELECT
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_raid_entries" ON raid_entries;
CREATE POLICY "insert_raid_entries" ON raid_entries FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_raid_entries" ON raid_entries;
CREATE POLICY "update_raid_entries" ON raid_entries FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_raid_entries" ON raid_entries;
CREATE POLICY "delete_raid_entries" ON raid_entries FOR DELETE
  TO authenticated USING (is_project_member(project_id));

-- ============================================================
-- JOB AIDS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_job_aids" ON job_aids;
CREATE POLICY "select_job_aids" ON job_aids FOR SELECT
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_job_aids" ON job_aids;
CREATE POLICY "insert_job_aids" ON job_aids FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_job_aids" ON job_aids;
CREATE POLICY "update_job_aids" ON job_aids FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_job_aids" ON job_aids;
CREATE POLICY "delete_job_aids" ON job_aids FOR DELETE
  TO authenticated USING (is_project_member(project_id));