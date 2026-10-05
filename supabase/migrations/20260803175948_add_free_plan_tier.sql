/*
# Add Free plan tier

1. Changes
- Updates the `organizations.plan` CHECK constraint to allow 'free' in addition to 'trial', 'team', 'enterprise'.
- Changes the default plan to 'free' so new organizations start on the free tier.
- Updates the `billing_status` default to 'active' so free orgs are not in a trialing state.
2. Security
- No RLS or policy changes.
3. Notes
- Existing orgs with plan='trial' are left as-is (no data migration).
- The 'trial' plan value is kept for backward compatibility with existing orgs.
*/

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('free', 'trial', 'team', 'enterprise'));

ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'free';
ALTER TABLE organizations ALTER COLUMN billing_status SET DEFAULT 'active';
