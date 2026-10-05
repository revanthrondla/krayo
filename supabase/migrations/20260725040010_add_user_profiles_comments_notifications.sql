/*
# User Profiles, Comments with @Mentions, and Notifications

## Purpose
Adds three foundational tables to support a personalized home experience, collaborative comments with
user tagging, and an in-app notification feed with email delivery support.

## New Tables

### 1. user_profiles
Stores per-user preferences that persist across sessions.
- `id` (uuid, primary key, references auth.users)
- `display_name` (text, nullable) — user's preferred name
- `timezone` (text, default 'UTC') — IANA timezone string e.g. "America/New_York"
- `language` (text, default 'en') — ISO language code
- `notification_email` (boolean, default true) — receive email notifications
- `notification_mentions` (boolean, default true) — be notified when @mentioned
- `notification_assignments` (boolean, default true) — be notified on new assignments
- `created_at`, `updated_at`

### 2. comments
Stores comments on any module item (action items, requirements, test cases, defects, etc.).
Supports @mention syntax by storing an array of mentioned user IDs parsed from the body text.
- `id` (uuid, primary key)
- `project_id` (uuid, references projects) — scope comment to project for RLS
- `item_type` (text) — which module: 'action_item', 'requirement', 'test_case', 'defect', 'decision', 'raid_entry'
- `item_id` (uuid) — the ID of the item being commented on
- `user_id` (uuid, default auth.uid()) — author
- `body` (text) — comment text, may include @mention syntax
- `mentioned_user_ids` (uuid[]) — extracted @mentioned user IDs for quick lookup
- `edited_at` (timestamptz, nullable) — set when comment is edited
- `created_at`, `updated_at`

### 3. notifications
In-app notification feed. Each notification targets one user.
- `id` (uuid, primary key)
- `user_id` (uuid) — recipient
- `type` (text) — 'mention', 'assignment', 'comment', 'status_change'
- `project_id` (uuid, nullable) — related project context
- `item_type` (text, nullable) — e.g. 'action_item'
- `item_id` (uuid, nullable) — the specific item
- `actor_id` (uuid, nullable) — user who triggered the notification
- `message` (text) — human-readable notification text
- `read` (boolean, default false)
- `email_sent` (boolean, default false) — whether email was dispatched
- `created_at`

## Security (RLS)

- `user_profiles`: users can read and write only their own profile; all org members can read display names (for @mention autocomplete)
- `comments`: project members can read all comments in their project; authenticated users can insert their own; can edit/delete only their own
- `notifications`: users can only read and update (mark as read) their own notifications

## Important Notes
1. `mentioned_user_ids` is populated by the client parsing @mentions before insert. The notification edge function then fires for each mentioned user.
2. Email delivery requires a configured email provider (Resend/SendGrid API key) in the edge function secrets.
3. Comments are linked to items via `(item_type, item_id)` — no FK constraint since items live in different tables.
*/

-- user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_color text NOT NULL DEFAULT '#2F8074',
  timezone text NOT NULL DEFAULT 'UTC',
  language text NOT NULL DEFAULT 'en',
  notification_email boolean NOT NULL DEFAULT true,
  notification_mentions boolean NOT NULL DEFAULT true,
  notification_assignments boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read profiles (for @mention autocomplete)
DROP POLICY IF EXISTS "profiles_select" ON user_profiles;
CREATE POLICY "profiles_select" ON user_profiles
  FOR SELECT TO authenticated USING (true);

-- Users can only insert/update/delete their own profile
DROP POLICY IF EXISTS "profiles_insert" ON user_profiles;
CREATE POLICY "profiles_insert" ON user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON user_profiles;
CREATE POLICY "profiles_update" ON user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON user_profiles;
CREATE POLICY "profiles_delete" ON user_profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('action_item','requirement','test_case','defect','decision','raid_entry','job_aid','milestone')),
  item_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Project members can read all comments for their project
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments
  FOR SELECT TO authenticated USING (is_project_member(project_id));

-- Authenticated users can insert their own comments on projects they belong to
DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND is_project_member(project_id));

-- Users can only edit their own comments
DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_update" ON comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own comments
DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('mention','assignment','comment','status_change')),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  item_type text,
  item_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_comments_project_item ON comments(project_id, item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Add owner column to action_items for assignment tracking
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Updated_at trigger reuse
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_comments_updated_at ON comments;
CREATE TRIGGER trigger_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
