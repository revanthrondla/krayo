/*
  # Stop email verification tokens being readable through the Data API (F12)

  1. Problem
     `email_verification_tokens` had a SELECT policy allowing a user to read their own
     token rows. Verification tokens are bearer secrets and no client code reads them;
     only the `verify-email` and `send-verification-email` edge functions (service role)
     touch the table. A readable token lets any session that can read the row confirm
     an address without receiving the email.

  2. Changes
     - Drop the SELECT policy so no client role can read tokens. The service role used
       by the edge functions bypasses RLS and keeps working.
*/

DROP POLICY IF EXISTS "select_own_verification_tokens" ON email_verification_tokens;
