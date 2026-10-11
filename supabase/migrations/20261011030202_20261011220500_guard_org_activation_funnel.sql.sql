/*
# Guard org activation funnel RPC with membership check

1. Modified Functions
- `get_org_activation_funnel(_org_id uuid)` — now checks that the caller is
  a member of the specified org before returning data. Non-members get an
  empty result set instead of other orgs' data.

2. Security
- The function body now starts with a membership check using the existing
  `is_org_member` function. If the caller is not a member, the query
  returns zero rows.
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
    AND public.is_org_member(_org_id)
  GROUP BY event_name
  ORDER BY event_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_activation_funnel(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_org_activation_funnel(uuid) FROM anon;
