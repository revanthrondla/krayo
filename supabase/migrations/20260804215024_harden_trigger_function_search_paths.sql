/*
  # Pin trigger function search paths and revoke client execute rights (F19)

  1. Problem
     `set_updated_at`, `set_license_seats_for_plan` and `enforce_max_custom_fields`
     ran with a mutable `search_path`, which allows an object created earlier in the
     search path to be resolved instead of the intended one. `enforce_max_custom_fields`
     was also directly executable by the `anon` and `authenticated` roles.

  2. Changes
     - Pin `search_path` to `public, pg_temp` on all three functions.
     - Revoke EXECUTE from PUBLIC, anon and authenticated; triggers still fire because
       trigger execution does not require an EXECUTE grant on the caller.
*/

ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_license_seats_for_plan() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_max_custom_fields() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_license_seats_for_plan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_max_custom_fields() FROM PUBLIC, anon, authenticated;
