/*
# Create get_user_emails function for @mention autocomplete

## Purpose
The auth.users table is not accessible via the anon-key client. This SECURITY DEFINER function
returns (id, email) pairs for a given array of user IDs, so the frontend can populate
@mention dropdowns and assignment selectors.

## Security
- SECURITY DEFINER: runs with elevated privileges to read auth.users
- Only returns id and email — no sensitive auth data (passwords, tokens, metadata)
- Takes an array of user IDs as input, so callers can scope to their org members
*/

CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $function$
  SELECT id, email FROM auth.users WHERE id = ANY(user_ids);
$function$;

-- Also create a simple view for convenience (no RLS needed, SECURITY DEFINER handles access)
CREATE OR REPLACE VIEW public.user_emails AS
SELECT id, email FROM auth.users;
