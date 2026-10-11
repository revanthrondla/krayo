/*
# Add org-scoped activation funnel RPC

1. New Functions
- `get_org_activation_funnel(_org_id uuid)` — SECURITY DEFINER function that
  returns aggregate activation event counts scoped to a single organization.
  Returns one row per event_name with a count and the earliest occurrence.
  Only callable by authenticated users who are members of the specified org.

2. Security
- SECURITY DEFINER so it can read all activation_events rows for the org
  regardless of per-user RLS (activation_events SELECT is scoped to
  auth.uid() = user_id, so an org admin couldn't see other members' events).
- The function checks org membership before returning data — non-members
  get an empty result set.
- Execute granted to `authenticated` only; revoked from `anon`.
- Only aggregate counts and timestamps are returned — no user IDs, project
  IDs, or metadata values are exposed.

3. Important Notes
- Replaces the platform-wide `get_activation_funnel()` for the per-org view.
- The platform-wide function remains for the platform admin dashboard.
*/

CREATE OR REPLACE FUNCTION public.get_org_activation_funnel(_org_id uuid)
RETURNS TABLE (
  event_name text,
  event_count bigint,
  first_seen timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    event_name,
    COUNT(*)::bigint AS event_count,
    MIN(created_at) AS first_seen
  FROM public.activation_events
  WHERE org_id = _org_id
  GROUP BY event_name
  ORDER BY event_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_activation_funnel(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_org_activation_funnel(uuid) FROM anon;
