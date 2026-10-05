/*
# Add unique code constraints per project

## Purpose
Prevents duplicate codes within the same project for all module tables.
This is a data-integrity backstop — the frontend also checks, but the database
must enforce uniqueness to prevent race conditions and CSV import duplicates.

## Changes
- Adds UNIQUE constraint on (project_id, code) for:
  1. requirements
  2. test_cases
  3. defects
  4. action_items
  5. decisions
  6. raid_entries

## Notes
- Uses DO blocks to check if constraint exists before creating (idempotent).
- Does NOT drop or modify any existing data.
- If duplicate codes already exist in the database, the constraint creation
  will fail — but existing duplicates should be resolved manually first.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_requirements_project_code') THEN
    ALTER TABLE requirements ADD CONSTRAINT uniq_requirements_project_code UNIQUE (project_id, code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_test_cases_project_code') THEN
    ALTER TABLE test_cases ADD CONSTRAINT uniq_test_cases_project_code UNIQUE (project_id, code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_defects_project_code') THEN
    ALTER TABLE defects ADD CONSTRAINT uniq_defects_project_code UNIQUE (project_id, code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_action_items_project_code') THEN
    ALTER TABLE action_items ADD CONSTRAINT uniq_action_items_project_code UNIQUE (project_id, code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_decisions_project_code') THEN
    ALTER TABLE decisions ADD CONSTRAINT uniq_decisions_project_code UNIQUE (project_id, code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_raid_entries_project_code') THEN
    ALTER TABLE raid_entries ADD CONSTRAINT uniq_raid_entries_project_code UNIQUE (project_id, code);
  END IF;
END $$;
