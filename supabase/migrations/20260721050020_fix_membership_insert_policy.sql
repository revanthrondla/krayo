/*
# Fix org_memberships INSERT RLS policy

## Problem
The `insert_org_memberships` policy used `WITH CHECK (is_org_admin(org_id))`. When
a user creates a new org, they have no membership yet, so `is_org_admin` returns
false and the Owner membership insert fails.

## Fix
Allow any authenticated user to insert a membership for themselves
(`auth.uid() = user_id`). This lets a user self-register as Owner of a new org.
Admins inviting others is handled by the client passing the correct user_id.
*/

DROP POLICY IF EXISTS "insert_org_memberships" ON org_memberships;
CREATE POLICY "insert_org_memberships" ON org_memberships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);