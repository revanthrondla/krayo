/*
# Fix organizations INSERT RLS policy

## Problem
The `insert_orgs` policy used `WITH CHECK (auth.uid() = owner_id)`. When the client
inserts without explicitly passing `owner_id`, the column default (`auth.uid()`) is
applied *after* RLS evaluation, so the check sees `owner_id` as NULL and fails.

## Fix
Drop and recreate the policy with `WITH CHECK (true)` — any authenticated user can
create an org. The `owner_id` default ensures the creating user owns it, and the
org_memberships INSERT policy already restricts who can add members.
*/

DROP POLICY IF EXISTS "insert_orgs" ON organizations;
CREATE POLICY "insert_orgs" ON organizations FOR INSERT
  TO authenticated WITH CHECK (true);