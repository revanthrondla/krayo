/*
# Protect stored automation API key hashes

1. Change
- The `project_api_keys.key_hash` column is no longer selectable by authenticated clients.
- Authenticated clients may read only the key id, project id, prefix, last-used timestamp, and creation timestamp.

2. Security
- This prevents the browser from retrieving the server's API-key verifier.
- CI systems still authenticate through the server-side ingestion function, which runs with privileged database access.
*/

REVOKE SELECT ON public.project_api_keys FROM authenticated;
GRANT SELECT (id, project_id, key_prefix, last_used_at, created_at) ON public.project_api_keys TO authenticated;
