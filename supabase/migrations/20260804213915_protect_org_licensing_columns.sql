/*
  # Protect plan and licensing columns on organizations (F5)

  1. Problem
     `update_organizations` allows any org Owner/Admin to update the row, and row
     policies are not column policies, so an admin could set `plan = 'enterprise'`
     and grant themselves every paid feature without a subscription.

  2. Changes
     - Revoke UPDATE on organizations from `authenticated` and re-grant it only on
       `name`, so ordinary admins can still rename their organization.
     - Revoke INSERT on the privileged columns; org creation only needs name/owner.
     - Add `admin_set_org_licensing()` and `admin_provision_org()` SECURITY DEFINER
       functions, executable by authenticated callers but guarded by
       `is_platform_admin()`, for the platform admin dashboard.
     - The Stripe webhook writes `plan`/`billing_status` under the service role and
       is unaffected by these grants.
*/

REVOKE UPDATE ON organizations FROM authenticated;
GRANT UPDATE (name) ON organizations TO authenticated;

REVOKE INSERT ON organizations FROM authenticated;
GRANT INSERT (name, owner_id) ON organizations TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_org_licensing(
  _org_id uuid,
  _name text,
  _license_seats integer,
  _cost_per_seat numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _license_seats IS NULL OR _license_seats < 1 THEN
    RAISE EXCEPTION 'License seats must be at least 1';
  END IF;
  IF _cost_per_seat IS NULL OR _cost_per_seat < 0 THEN
    RAISE EXCEPTION 'Cost per seat must not be negative';
  END IF;

  UPDATE public.organizations
  SET name = COALESCE(NULLIF(btrim(_name), ''), name),
      license_seats = _license_seats,
      license_cost_per_seat = _cost_per_seat
  WHERE id = _org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_provision_org(
  _name text,
  _license_seats integer,
  _cost_per_seat numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  IF _license_seats IS NULL OR _license_seats < 1 THEN
    RAISE EXCEPTION 'License seats must be at least 1';
  END IF;

  INSERT INTO public.organizations (name, plan, billing_status, owner_id, license_seats, license_cost_per_seat)
  VALUES (btrim(_name), 'enterprise', 'active', auth.uid(), _license_seats, COALESCE(_cost_per_seat, 0))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_org_licensing(uuid, text, integer, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_provision_org(text, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_org_licensing(uuid, text, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_provision_org(text, integer, numeric) TO authenticated;
