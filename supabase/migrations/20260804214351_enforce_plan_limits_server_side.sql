/*
  # Enforce plan limits in the database (F10)

  1. Problem
     The free-plan "1 project" limit was only checked in the browser before the insert,
     and the seat count purchased for an organization was never checked when a
     membership row was created. Both limits could be bypassed by calling the data API
     directly.

  2. Changes
     - `enforce_project_plan_limit()` BEFORE INSERT trigger on `projects` rejects a
       second project for an organization on the free plan.
     - `enforce_license_seat_limit()` BEFORE INSERT trigger on `org_memberships`
       rejects a membership that would exceed the organization's `license_seats`.
*/

CREATE OR REPLACE FUNCTION public.enforce_project_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_plan text;
  project_count integer;
BEGIN
  SELECT plan INTO org_plan FROM public.organizations WHERE id = NEW.org_id;
  IF org_plan = 'free' THEN
    SELECT count(*) INTO project_count FROM public.projects WHERE org_id = NEW.org_id;
    IF project_count >= 1 THEN
      RAISE EXCEPTION 'The Free plan is limited to 1 project. Upgrade for unlimited projects.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_project_plan_limit_trg ON projects;
CREATE TRIGGER enforce_project_plan_limit_trg
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_plan_limit();

CREATE OR REPLACE FUNCTION public.enforce_license_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  seats integer;
  used integer;
BEGIN
  SELECT license_seats INTO seats FROM public.organizations WHERE id = NEW.org_id;
  IF seats IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO used FROM public.org_memberships WHERE org_id = NEW.org_id;
  IF used >= seats THEN
    RAISE EXCEPTION 'All licensed seats for this organization are in use. Add seats to invite more people.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_license_seat_limit_trg ON org_memberships;
CREATE TRIGGER enforce_license_seat_limit_trg
  BEFORE INSERT ON org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_license_seat_limit();

REVOKE EXECUTE ON FUNCTION public.enforce_project_plan_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_license_seat_limit() FROM PUBLIC, anon, authenticated;
