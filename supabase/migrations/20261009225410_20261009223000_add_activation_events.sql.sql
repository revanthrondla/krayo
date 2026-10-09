/*
# Add activation event tracking

1. New Tables
- `activation_events`
- `id` (uuid, primary key): unique event identifier.
- `user_id` (uuid): authenticated user who performed the event, filled from the session.
- `org_id` (uuid, nullable): organization associated with the event.
- `project_id` (uuid, nullable): project associated with the event.
- `event_name` (text): allowlisted product milestone name.
- `metadata` (jsonb): non-sensitive context for later funnel analysis.
- `created_at` (timestamptz): event timestamp.

2. Security
- Row level security is enabled.
- Authenticated users may insert events only for themselves and only for organizations they belong to.
- Authenticated users may read their own events.
- Anonymous users have no access.
- The event name is constrained to the initial activation milestones used by onboarding.

3. Important Notes
- Events are append-only from the client; no update or delete policies are granted.
- The table is intentionally limited to product milestones and should not store message bodies, credentials, or other sensitive content.
*/

CREATE TABLE IF NOT EXISTS public.activation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  event_name text NOT NULL CHECK (event_name IN (
    'organization_created',
    'project_created',
    'starter_project_created',
    'first_requirement_created',
    'first_test_case_created',
    'first_defect_created',
    'teammate_invited',
    'ai_generation_used',
    'upgrade_started',
    'upgrade_completed'
  )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activation_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS activation_events_user_created_idx
  ON public.activation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activation_events_org_created_idx
  ON public.activation_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activation_events_project_name_idx
  ON public.activation_events (project_id, event_name);

DROP POLICY IF EXISTS "Users can insert own activation events" ON public.activation_events;
CREATE POLICY "Users can insert own activation events"
ON public.activation_events FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    org_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.org_memberships m
      WHERE m.org_id = activation_events.org_id
        AND m.user_id = auth.uid()
    )
  )
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = activation_events.project_id
        AND m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can read own activation events" ON public.activation_events;
CREATE POLICY "Users can read own activation events"
ON public.activation_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
