/*
  # Sales leads from the Enterprise "Contact Sales" form

  1. New Tables
  - `sales_leads`
    - `id` (uuid, primary key)
    - `name` (text, not null) — submitter's full name
    - `email` (text, not null) — submitter's work email
    - `company` (text, not null) — company name
    - `team_size` (text, nullable) — selected team-size bucket
    - `message` (text, nullable) — free-form notes from the submitter
    - `status` (text, not null default 'new') — lead pipeline status
    - `created_at` (timestamptz, default now())

  2. Security
  - RLS enabled.
  - Anyone (anon + authenticated) can INSERT a lead — the contact form is public.
  - Only platform admins can SELECT and UPDATE leads (via is_platform_admin()).
  - No DELETE policy — leads are never hard-deleted from the client.
*/

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text NOT NULL,
  team_size text,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_sales_leads" ON sales_leads;
CREATE POLICY "insert_sales_leads" ON sales_leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "select_sales_leads" ON sales_leads;
CREATE POLICY "select_sales_leads" ON sales_leads FOR SELECT
  TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS "update_sales_leads" ON sales_leads;
CREATE POLICY "update_sales_leads" ON sales_leads FOR UPDATE
  TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
