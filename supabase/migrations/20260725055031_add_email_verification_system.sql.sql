/*
# Add email verification system

1. Modified Tables
- `user_profiles`: adds `email_verified` boolean column (default false) to track
  whether the user has verified their email address via the custom verification flow.

2. New Tables
- `email_verification_tokens`: stores one-time tokens used to verify email ownership.
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, cascade delete)
  - `token` (text, unique, not null) — the verification token
  - `expires_at` (timestamptz, not null) — token expiry (24 hours)
  - `used` (boolean, default false) — whether the token has been consumed
  - `created_at` (timestamptz, default now())

3. Security
- RLS enabled on `email_verification_tokens`.
- Users can only read their own tokens (SELECT scoped to auth.uid() = user_id).
- All writes (INSERT/UPDATE/DELETE) are performed by the service role inside edge
  functions, so no client-side INSERT/UPDATE/DELETE policies are granted to anon
  or authenticated roles. This prevents token forgery or tampering.

4. Important Notes
  1. Supabase's built-in email confirmation remains OFF. This is a separate,
     custom verification layer that supplements (not replaces) Supabase auth.
  2. Token generation and email sending happen inside edge functions using the
     service role key, so tokens are never exposed to the client.
  3. Tokens expire after 24 hours and are single-use.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_verification_tokens" ON email_verification_tokens;
CREATE POLICY "select_own_verification_tokens"
  ON email_verification_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);