/*
# Enterprise Licensing & Security Settings

## Purpose
Adds platform-level admin controls for provisioning enterprise customers, managing license counts and costs,
and per-enterprise security settings to control data access restrictions.

## Changes

### 1. New column on `organizations`
- `license_seats` (integer, default 10) — maximum number of users allowed in this organization.
- `license_cost_per_seat` (numeric, default 0) — monthly cost per seat for licensing/billing.
- `provisioned_by` (uuid, nullable) — the platform admin who provisioned this enterprise.
- `provisioned_at` (timestamptz, nullable) — when the enterprise was provisioned.

### 2. New table: `enterprise_licenses`
Tracks license provisioning records for each enterprise organization.
- `id` (uuid, primary key)
- `org_id` (uuid, references organizations) — the enterprise org
- `license_count` (integer) — number of seats provisioned
- `cost_per_seat` (numeric) — monthly cost per seat
- `billing_cycle` (text: monthly, annual) — billing frequency
- `status` (text: active, suspended, expired) — license status
- `provisioned_by` (uuid) — platform admin who created/updated this license
- `notes` (text, nullable) — admin notes
- `created_at`, `updated_at` (timestamps)

### 3. New table: `enterprise_security_settings`
Per-enterprise security configuration. Each org gets one row controlling data access restrictions.
- `id` (uuid, primary key)
- `org_id` (uuid, references organizations, unique) — the enterprise org
- `restrict_project_visibility` (boolean, default true) — if true, users only see projects they're members of
- `require_project_membership` (boolean, default true) — if true, users must be explicit project members to access project data
- `allow_cross_project_data` (boolean, default false) — if false, data from one project cannot reference/expose another project's data
- `enforce_data_isolation` (boolean, default true) — if true, RLS enforces strict org-level data isolation
- `max_projects_per_org` (integer, default 50) — limit on number of projects
- `sso_required` (boolean, default false) — if true, SSO is required for org members
- `ip_allowlist` (text, nullable) — comma-separated IP ranges allowed to access org data
- `created_at`, `updated_at` (timestamps)

### 4. New function: `is_platform_admin()`
Returns true if the current authenticated user is a platform admin (stored in raw_app_meta_data).
Platform admins can manage all enterprises, licenses, and security settings.

### 5. Security (RLS)
- `enterprise_licenses`: platform admins have full CRUD; org admins can SELECT their own org's license
- `enterprise_security_settings`: platform admins have full CRUD; org admins can SELECT and UPDATE their own org's settings
- `organizations`: platform admins can SELECT all orgs; existing policies remain for org members

## Important Notes
1. Platform admin status is determined by `auth.jwt() -> 'app_metadata' ->> 'is_platform_admin' = 'true'`
2. To make a user a platform admin, update their `raw_app_meta_data` in auth.users:
   `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_platform_admin": true}' WHERE email = 'admin@example.com'`
3. Enterprise data isolation is already enforced by existing RLS policies (is_org_member, is_project_member)
4. The new security settings table provides a configurable layer on top of existing RLS
*/

-- Add licensing columns to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_seats integer NOT NULL DEFAULT 10;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_cost_per_seat numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS provisioned_by uuid;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS provisioned_at timestamptz;

-- Create enterprise_licenses table
CREATE TABLE IF NOT EXISTS enterprise_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  license_count integer NOT NULL DEFAULT 10,
  cost_per_seat numeric(10,2) NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  provisioned_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create enterprise_security_settings table
CREATE TABLE IF NOT EXISTS enterprise_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  restrict_project_visibility boolean NOT NULL DEFAULT true,
  require_project_membership boolean NOT NULL DEFAULT true,
  allow_cross_project_data boolean NOT NULL DEFAULT false,
  enforce_data_isolation boolean NOT NULL DEFAULT true,
  max_projects_per_org integer NOT NULL DEFAULT 50,
  sso_required boolean NOT NULL DEFAULT false,
  ip_allowlist text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Enable RLS
ALTER TABLE enterprise_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_security_settings ENABLE ROW LEVEL SECURITY;

-- Platform admin function
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  );
$function$;

-- Enterprise licenses policies (platform admin full CRUD, org admin read-only)
DROP POLICY IF EXISTS "select_enterprise_licenses" ON enterprise_licenses;
CREATE POLICY "select_enterprise_licenses" ON enterprise_licenses
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_org_admin(org_id));

DROP POLICY IF EXISTS "insert_enterprise_licenses" ON enterprise_licenses;
CREATE POLICY "insert_enterprise_licenses" ON enterprise_licenses
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "update_enterprise_licenses" ON enterprise_licenses;
CREATE POLICY "update_enterprise_licenses" ON enterprise_licenses
  FOR UPDATE TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "delete_enterprise_licenses" ON enterprise_licenses;
CREATE POLICY "delete_enterprise_licenses" ON enterprise_licenses
  FOR DELETE TO authenticated
  USING (is_platform_admin());

-- Enterprise security settings policies (platform admin full CRUD, org admin read + update own)
DROP POLICY IF EXISTS "select_enterprise_security" ON enterprise_security_settings;
CREATE POLICY "select_enterprise_security" ON enterprise_security_settings
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_org_admin(org_id));

DROP POLICY IF EXISTS "insert_enterprise_security" ON enterprise_security_settings;
CREATE POLICY "insert_enterprise_security" ON enterprise_security_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "update_enterprise_security" ON enterprise_security_settings;
CREATE POLICY "update_enterprise_security" ON enterprise_security_settings
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR is_org_admin(org_id))
  WITH CHECK (is_platform_admin() OR is_org_admin(org_id));

DROP POLICY IF EXISTS "delete_enterprise_security" ON enterprise_security_settings;
CREATE POLICY "delete_enterprise_security" ON enterprise_security_settings
  FOR DELETE TO authenticated
  USING (is_platform_admin());

-- Update organizations SELECT policy to allow platform admins to see all orgs
DROP POLICY IF EXISTS "select_own_orgs" ON organizations;
CREATE POLICY "select_own_orgs" ON organizations
  FOR SELECT TO authenticated
  USING ((auth.uid() = owner_id) OR is_org_member(id) OR is_platform_admin());

-- Update organizations UPDATE policy to allow platform admins
DROP POLICY IF EXISTS "update_orgs" ON organizations;
CREATE POLICY "update_orgs" ON organizations
  FOR UPDATE TO authenticated
  USING (is_org_admin(id) OR is_platform_admin())
  WITH CHECK (is_org_admin(id) OR is_platform_admin());

-- Add index for license lookups
CREATE INDEX IF NOT EXISTS idx_enterprise_licenses_org_id ON enterprise_licenses(org_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_security_org_id ON enterprise_security_settings(org_id);

-- Add updated_at trigger for enterprise_licenses
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_enterprise_licenses_updated_at ON enterprise_licenses;
CREATE TRIGGER trigger_enterprise_licenses_updated_at
  BEFORE UPDATE ON enterprise_licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_enterprise_security_updated_at ON enterprise_security_settings;
CREATE TRIGGER trigger_enterprise_security_updated_at
  BEFORE UPDATE ON enterprise_security_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
