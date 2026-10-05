/*
# Fix org_memberships INSERT policy for admin invites

## Problem
The INSERT policy on `org_memberships` only allowed `auth.uid() = user_id`,
meaning users could only add themselves. Org admins/owners need to invite
other users into the organization.

## Changes
- Drop the old `insert_org_memberships` policy.
- Create a new policy that allows org admins/owners to insert memberships
  for any user_id (so they can invite team members), AND still allows a
  user to self-insert (for the initial org creation flow).
*/

DROP POLICY IF EXISTS "insert_org_memberships" ON org_memberships;
CREATE POLICY "insert_org_memberships" ON org_memberships
  FOR INSERT TO authenticated
  WITH CHECK (is_org_admin(org_id) OR auth.uid() = user_id);
