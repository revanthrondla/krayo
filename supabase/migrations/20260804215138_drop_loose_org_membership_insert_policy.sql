/*
  # Remove the remaining self-join membership policy (completes F1)

  1. Problem
     `org_memberships` carried two INSERT policies. The tightened
     `insert_memberships` policy was added, but the older
     `insert_org_memberships` policy still allowed `auth.uid() = user_id`
     unconditionally. Because policies combine with OR, any signed-in user could
     still insert themselves into any organization by id and read that tenant's data.

  2. Changes
     - Drop `insert_org_memberships`. Admin invites and the owner bootstrap remain
       covered by `insert_memberships`.
*/

DROP POLICY IF EXISTS "insert_org_memberships" ON org_memberships;
