/*
# Add Custom Fields Feature

1. New Tables
- `custom_field_definitions`
  - id, project_id (FK→projects cascade), module (text), label, field_key, field_type, options (text[]), sort_order, timestamps
  - Unique on (project_id, module, field_key)

2. Modified Tables
- Adds custom_fields jsonb (default '{}') to: requirements, test_cases, defects, action_items, decisions, raid_entries, job_aids

3. Security
- RLS enabled, project-member-scoped CRUD (uses existing is_project_member function)
*/

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('requirements','test_cases','defects','action_items','decisions','raid_entries','job_aids')),
  label text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','number','date','select')),
  options text[] DEFAULT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, module, field_key)
);

-- Trigger: max 10 custom fields per project+module
CREATE OR REPLACE FUNCTION enforce_max_custom_fields()
RETURNS trigger AS $$
DECLARE
  field_count int;
BEGIN
  SELECT COUNT(*) INTO field_count
  FROM custom_field_definitions
  WHERE project_id = NEW.project_id AND module = NEW.module;

  IF TG_OP = 'INSERT' AND field_count >= 10 THEN
    RAISE EXCEPTION 'Maximum of 10 custom fields per module reached';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_max_custom_fields_insert ON custom_field_definitions;
CREATE TRIGGER enforce_max_custom_fields_insert
  BEFORE INSERT ON custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION enforce_max_custom_fields();

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_field_definitions_updated_at ON custom_field_definitions;
CREATE TRIGGER custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add custom_fields jsonb to all 7 module tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requirements' AND column_name = 'custom_fields') THEN
    ALTER TABLE requirements ADD COLUMN custom_fields jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_cases' AND column_name = 'custom_fields') THEN
    ALTER TABLE test_cases ADD COLUMN custom_fields jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'defects' AND column_name = 'custom_fields') THEN
    ALTER TABLE defects ADD COLUMN custom_fields jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'action_items' AND column_name = 'custom_fields') THEN
    ALTER TABLE action_items ADD COLUMN custom_fields jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decisions' AND column_name = 'custom_fields') THEN
    ALTER TABLE decisions ADD COLUMN custom_fields jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_entries' AND column_name = 'custom_fields') THEN
    ALTER TABLE raid_entries ADD COLUMN custom_fields jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_aids' AND column_name = 'custom_fields') THEN
    ALTER TABLE job_aids ADD COLUMN custom_fields jsonb DEFAULT '{}';
  END IF;
END $$;

-- RLS
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_custom_fields" ON custom_field_definitions;
CREATE POLICY "select_custom_fields"
ON custom_field_definitions FOR SELECT
TO authenticated
USING (is_project_member(project_id));

DROP POLICY IF EXISTS "insert_custom_fields" ON custom_field_definitions;
CREATE POLICY "insert_custom_fields"
ON custom_field_definitions FOR INSERT
TO authenticated
WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "update_custom_fields" ON custom_field_definitions;
CREATE POLICY "update_custom_fields"
ON custom_field_definitions FOR UPDATE
TO authenticated
USING (is_project_member(project_id))
WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "delete_custom_fields" ON custom_field_definitions;
CREATE POLICY "delete_custom_fields"
ON custom_field_definitions FOR DELETE
TO authenticated
USING (is_project_member(project_id));

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_project_module
  ON custom_field_definitions(project_id, module);
