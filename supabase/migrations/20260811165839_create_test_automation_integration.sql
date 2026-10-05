/*
# Test automation integration MVP

1. New tables
- `project_api_keys`
  - One active automation API key per project.
  - Stores only a SHA-256 hash and a short display prefix; the raw key is never persisted.
- `test_runs`
  - One imported automation execution per project.
  - Stores the external tool name, external report link, execution timing, and aggregate counts.
- `test_run_results`
  - One JUnit test result per test run.
  - Stores the incoming test identifier, matched test case, outcome, duration, failure text, and external report link.

2. Modified tables
- `test_cases`
  - No columns are changed. Incoming results update the existing `status` column through the ingestion function.

3. Security
- RLS is enabled on all three tables.
- Authenticated project members can view automation configuration and run history for projects they belong to.
- Authenticated project members can create, replace, and remove their project's API key through table policies. The raw secret is never readable after creation.
- Test runs and results are written by the server-side ingestion function with the service role and are readable only by project members.
- The browser cannot insert or modify test runs/results directly.

4. Important notes
- The API key is intended for CI systems to call the JUnit ingestion endpoint.
- Matching uses the existing test case `code` value, for example `TC-021`.
- Screenshots remain external links in `external_report_url`; no file storage is introduced in this MVP.
*/

CREATE TABLE IF NOT EXISTS public.project_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_api_keys_one_per_project
  ON public.project_api_keys (project_id);
CREATE INDEX IF NOT EXISTS project_api_keys_hash_idx
  ON public.project_api_keys (key_hash);

CREATE TABLE IF NOT EXISTS public.test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tool_name text NOT NULL DEFAULT 'JUnit',
  external_report_url text,
  started_at timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now(),
  total_count integer NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  passed_count integer NOT NULL DEFAULT 0 CHECK (passed_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  unmatched_count integer NOT NULL DEFAULT 0 CHECK (unmatched_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_runs_project_created_idx
  ON public.test_runs (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.test_run_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  incoming_name text NOT NULL,
  test_case_id uuid REFERENCES public.test_cases(id) ON DELETE SET NULL,
  test_case_code text,
  outcome text NOT NULL CHECK (outcome IN ('passed', 'failed', 'skipped', 'error', 'unknown')),
  duration_seconds numeric(12,3),
  failure_message text,
  external_report_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_run_results_run_idx
  ON public.test_run_results (test_run_id);
CREATE INDEX IF NOT EXISTS test_run_results_project_idx
  ON public.test_run_results (project_id, created_at DESC);

ALTER TABLE public.project_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_run_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_members_select_api_keys" ON public.project_api_keys;
CREATE POLICY "project_members_select_api_keys" ON public.project_api_keys FOR SELECT
  TO authenticated USING (is_project_member(project_id));
DROP POLICY IF EXISTS "project_members_insert_api_keys" ON public.project_api_keys;
CREATE POLICY "project_members_insert_api_keys" ON public.project_api_keys FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id) AND created_by = auth.uid());
DROP POLICY IF EXISTS "project_members_update_api_keys" ON public.project_api_keys;
CREATE POLICY "project_members_update_api_keys" ON public.project_api_keys FOR UPDATE
  TO authenticated USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));
DROP POLICY IF EXISTS "project_members_delete_api_keys" ON public.project_api_keys;
CREATE POLICY "project_members_delete_api_keys" ON public.project_api_keys FOR DELETE
  TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "project_members_select_test_runs" ON public.test_runs;
CREATE POLICY "project_members_select_test_runs" ON public.test_runs FOR SELECT
  TO authenticated USING (is_project_member(project_id));
DROP POLICY IF EXISTS "project_members_insert_test_runs" ON public.test_runs;
CREATE POLICY "project_members_insert_test_runs" ON public.test_runs FOR INSERT
  TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "project_members_update_test_runs" ON public.test_runs;
CREATE POLICY "project_members_update_test_runs" ON public.test_runs FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "project_members_delete_test_runs" ON public.test_runs;
CREATE POLICY "project_members_delete_test_runs" ON public.test_runs FOR DELETE
  TO authenticated USING (false);

DROP POLICY IF EXISTS "project_members_select_test_run_results" ON public.test_run_results;
CREATE POLICY "project_members_select_test_run_results" ON public.test_run_results FOR SELECT
  TO authenticated USING (is_project_member(project_id));
DROP POLICY IF EXISTS "project_members_insert_test_run_results" ON public.test_run_results;
CREATE POLICY "project_members_insert_test_run_results" ON public.test_run_results FOR INSERT
  TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "project_members_update_test_run_results" ON public.test_run_results;
CREATE POLICY "project_members_update_test_run_results" ON public.test_run_results FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "project_members_delete_test_run_results" ON public.test_run_results;
CREATE POLICY "project_members_delete_test_run_results" ON public.test_run_results FOR DELETE
  TO authenticated USING (false);

REVOKE UPDATE ON public.project_api_keys FROM authenticated;
GRANT UPDATE (last_used_at) ON public.project_api_keys TO authenticated;
