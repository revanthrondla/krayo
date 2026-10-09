/*
  # Protect the email_verified flag on user profiles

  1. Problem
     The row level security policies on `user_profiles` authorize a user to update
     their OWN row, but a row-level rule says nothing about which COLUMNS may be
     written. Combined with a table-wide UPDATE grant, any signed-in user could set
     `email_verified = true` on themselves and defeat the entire email verification
     flow.

  2. Changes
     - Revoke blanket INSERT and UPDATE on `public.user_profiles` from `anon` and
       `authenticated`.
     - Re-grant INSERT and UPDATE on exactly the profile columns a user is meant to
       edit. `email_verified` is deliberately excluded, so only the service role
       (the verify-email edge function) can set it.
     - SELECT and DELETE are left untouched, so existing reads and account deletion
       keep working.

  3. New function
     - `public.confirm_own_email()` — SECURITY DEFINER. Marks the CALLER's profile
       verified, but only when Supabase Auth itself has already recorded a
       confirmation (`auth.users.email_confirmed_at IS NOT NULL`). This keeps the
       legitimate post-confirmation screens working without trusting the browser.
       Returns true when the profile was marked verified, false otherwise.

  4. Security notes
     1. `email_verified` becomes server-controlled: it can only be set by the
        service role or by `confirm_own_email()` after the provider confirmed.
     2. The function is restricted to the `authenticated` role; `anon` and `public`
        cannot execute it.
     3. `search_path` is pinned to avoid resolution hijacking.
*/

REVOKE INSERT, UPDATE ON public.user_profiles FROM anon;
REVOKE INSERT, UPDATE ON public.user_profiles FROM authenticated;

GRANT INSERT (
  id,
  display_name,
  avatar_color,
  timezone,
  language,
  notification_email,
  notification_mentions,
  notification_assignments,
  created_at,
  updated_at
) ON public.user_profiles TO authenticated;

GRANT UPDATE (
  display_name,
  avatar_color,
  timezone,
  language,
  notification_email,
  notification_mentions,
  notification_assignments,
  updated_at
) ON public.user_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_own_email()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  confirmed timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.email_confirmed_at INTO confirmed
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF confirmed IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_profiles (id, email_verified)
  VALUES (auth.uid(), true)
  ON CONFLICT (id) DO UPDATE SET email_verified = true;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_own_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_own_email() FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_own_email() TO authenticated;
