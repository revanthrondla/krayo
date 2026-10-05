/*
  # Restrict organization self-enrollment (F1)

  1. Problem
     The `insert_memberships` policy allowed `auth.uid() = user_id`, which let any
     authenticated user insert themselves into ANY organization with any role,
     granting full read/write access to that tenant's projects and module data.

  2. Changes
     - Replace the INSERT policy so self-insert is only allowed for an organization
       the caller already owns (`organizations.owner_id = auth.uid()`).
     - Add a SECURITY DEFINER trigger on `organizations` that creates the Owner
       membership row for the creator, so the bootstrap path no longer needs the
       open self-insert branch.
*/

DROP POLICY IF EXISTS "insert_memberships" ON org_memberships;

CREATE POLICY "insert_memberships" ON org_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_admin(org_id)
    OR (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = org_memberships.org_id AND o.owner_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.create_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.org_memberships (org_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'Owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_owner_membership() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_create_owner_membership ON organizations;
CREATE TRIGGER trg_create_owner_membership
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_owner_membership();
