/*
# Set license_seats defaults by plan

1. Changes
- Updates existing free-plan orgs to have 1 license seat (solo only).
- Updates existing team-plan orgs to have 10 license seats.
- Updates existing enterprise-plan orgs to have 100000 license seats (effectively unlimited).
- Adds a trigger so that when an org's plan changes, license_seats is automatically set to the correct default for that plan.
2. Security
- No RLS or policy changes.
3. Notes
- Existing orgs on 'trial' plan are left as-is.
- The trigger only fires on plan change, not on every update, so manual seat adjustments by admins are preserved.
*/

UPDATE organizations SET license_seats = 1 WHERE plan = 'free';
UPDATE organizations SET license_seats = 10 WHERE plan = 'team';
UPDATE organizations SET license_seats = 100000 WHERE plan = 'enterprise';

DROP FUNCTION IF EXISTS set_license_seats_for_plan();
CREATE FUNCTION set_license_seats_for_plan() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    NEW.license_seats := CASE NEW.plan
      WHEN 'free' THEN 1
      WHEN 'team' THEN 10
      WHEN 'enterprise' THEN 100000
      ELSE NEW.license_seats
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_license_seats ON organizations;
CREATE TRIGGER trg_set_license_seats
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_license_seats_for_plan();
