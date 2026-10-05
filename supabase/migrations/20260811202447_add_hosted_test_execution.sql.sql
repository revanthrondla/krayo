/*
# Add hosted test execution support

1. Purpose
This migration enables the hosted test execution engine — users can execute
test cases directly inside the Krayo UI (step-by-step pass/fail/skip) without
needing an external CI tool. Previously, test_runs and test_run_results could
only be written by the ingest-junit-xml edge function using the service role
key (INSERT policies were `false`). We now allow browser-originated inserts
for project members while keeping the service-role path intact.

2. Schema changes
- `test_runs`: add `executed_by` (uuid, nullable, references auth.users) and
  `execution_source` (text, default 'junit_import') to distinguish runs that
  come from JUnit XML ingestion vs. hosted in-app execution.
- `test_run_results`: add `executed_by` (uuid, nullable, references auth.users)
  and `notes` (text, nullable) so a tester can record per-step observations
  during a hosted execution session.

3. RLS policy changes
- `test_runs` INSERT: allow project members to insert runs with
  `execution_source = 'hosted'`. Service-role inserts (edge functions) bypass
  RLS so JUnit ingestion keeps working.
- `test_run_results` INSERT: allow project members to insert results for runs
  in projects they belong to.
- `test_cases` UPDATE: already permitted for project members; no change needed.
  The execution flow updates test case status (Passed/Failed/Blocked) after a
  hosted run, which relies on the existing UPDATE policy.
- All other policies (SELECT, UPDATE, DELETE) remain restricted as before.

4. Important notes
- `executed_by` is nullable so existing JUnit-imported runs (which have no
  human executor) remain valid.
- `execution_source` defaults to 'junit_import' so existing edge-function
  inserts that omit the column are classified correctly.
- No data is lost; columns are additive only.
*/

-- Add execution metadata to test_runs
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_source text NOT NULL DEFAULT 'junit_import';

-- Add execution metadata to test_run_results
ALTER TABLE test_run_results
  ADD COLUMN IF NOT EXISTS executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

-- Allow project members to create hosted test runs
DROP POLICY IF EXISTS "project_members_insert_test_runs" ON test_runs;
CREATE POLICY "project_members_insert_test_runs" ON test_runs FOR INSERT
  TO authenticated
  WITH CHECK (execution_source = 'hosted' AND is_project_member(project_id));

-- Allow project members to insert test run results for their project's runs
DROP POLICY IF EXISTS "project_members_insert_test_run_results" ON test_run_results;
CREATE POLICY "project_members_insert_test_run_results" ON test_run_results FOR INSERT
  TO authenticated
  WITH CHECK (is_project_member(project_id));

-- Add index for filtering runs by execution source
CREATE INDEX IF NOT EXISTS idx_test_runs_execution_source ON test_runs(execution_source);
CREATE INDEX IF NOT EXISTS idx_test_runs_executed_by ON test_runs(executed_by);
