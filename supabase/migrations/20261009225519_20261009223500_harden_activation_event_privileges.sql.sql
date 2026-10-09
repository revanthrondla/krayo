/*
# Restrict activation event writes

1. Modified Tables
- `activation_events`: client inserts are limited to organization, project, event name, and non-sensitive metadata.
- `user_id` and `created_at` remain database-controlled.

2. Security
- Anonymous roles receive no table privileges.
- Authenticated users can insert only the client-owned event fields.
- Authenticated users can read their own rows through the existing row policy.
- Update and delete privileges are removed to preserve append-only history.

3. Important Notes
- The existing row-level insert policy still verifies the authenticated actor and project or organization membership.
*/

REVOKE ALL ON public.activation_events FROM anon;
REVOKE ALL ON public.activation_events FROM authenticated;
GRANT SELECT ON public.activation_events TO authenticated;
GRANT INSERT (org_id, project_id, event_name, metadata) ON public.activation_events TO authenticated;
