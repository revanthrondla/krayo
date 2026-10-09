/*
  # Allow the profile upsert to keep working

  1. Context
     The previous migration restricted column-level UPDATE on `public.user_profiles`
     to the user-editable preference columns. The app saves preferences with an
     upsert, which Postgres compiles to `INSERT ... ON CONFLICT (id) DO UPDATE SET
     id = excluded.id, ...`, so it also needs UPDATE on `id`.

  2. Change
     - Grant UPDATE on the `id` column to `authenticated`.

  3. Security notes
     1. This does not let anyone reassign a profile: the row policy enforces
        `auth.uid() = id` in both USING and WITH CHECK, so the only value that can
        be written is the caller's own id.
     2. `email_verified` remains excluded from every client grant.
*/

GRANT UPDATE (id) ON public.user_profiles TO authenticated;
