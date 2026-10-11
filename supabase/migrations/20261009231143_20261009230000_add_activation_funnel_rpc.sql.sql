/*
# Add activation funnel aggregate function

1. New Functions
- `get_activation_funnel()` — SECURITY DEFINER function that returns aggregate
  counts of each activation event across all users, for the admin funnel view.
  Returns one row per event_name with a count and the earliest occurrence timestamp.

2. Security
- SECURITY DEFINER so it can read all activation_events rows regardless of RLS.
- Execute granted to `authenticated` only — the admin dashboard is behind sign-in.
- The function is read-only: it performs SELECTs only, no writes.

3. Important Notes
- This function bypasses the per-user RLS on activation_events intentionally,
  because the admin funnel needs platform-wide aggregate counts.
- Only aggregate counts and timestamps are returned — no user IDs, org IDs,
  project IDs, or metadata values are exposed.
*/

CREATE OR REPLACE FUNCTION public.get_activation_funnel()
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
  GROUP BY event_name
  ORDER BY event_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_activation_funnel() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_activation_funnel() FROM anon;
