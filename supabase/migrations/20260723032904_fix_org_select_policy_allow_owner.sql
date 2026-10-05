/*
# Fix organizations SELECT policy to allow owners

## Problem
When a user creates an org, the INSERT succeeds (WITH CHECK true) but the
returning SELECT fails because `is_org_member(id)` checks `org_memberships`,
and no membership row exists yet at that point. PostgREST returns 403
"new row violates row-level security policy" because `.single()` expects
exactly one row back.

## Fix
Update the SELECT policy to also allow the owner (auth.uid() = owner_id)
to read their orgs, in addition to the existing is_org_member check.
This way the owner can read back a freshly-created org before the
membership row is inserted.

## Changes
- Drop and recreate `select_own_orgs` policy with `auth.uid() = owner_id OR is_org_member(id)`.
*/

DROP POLICY IF EXISTS "select_own_orgs" ON organizations;
CREATE POLICY "select_own_orgs" ON organizations FOR SELECT
  TO authenticated USING (auth.uid() = owner_id OR is_org_member(id));
