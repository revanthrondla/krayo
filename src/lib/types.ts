import { LayoutDashboard, ClipboardList, FlaskConical, Bug, Network, CheckSquare, Gavel, ShieldAlert, BookOpen, BarChart3, UserCog, Zap, type LucideIcon } from 'lucide-react';

export type ModuleKey =
  | 'overview' | 'executive' | 'requirements' | 'testcases' | 'defects'
  | 'rtm' | 'actionitems' | 'decisions' | 'raid' | 'jobaids' | 'resources' | 'automation';

export interface ModuleDef { key: ModuleKey; label: string; icon: string; table: string; }

export const MODULES: ModuleDef[] = [
  { key: 'overview', label: 'Overview', icon: 'LayoutDashboard', table: '' },
  { key: 'executive', label: 'Executive Dashboard', icon: 'BarChart3', table: 'project_milestones' },
  { key: 'requirements', label: 'Requirements', icon: 'ClipboardList', table: 'requirements' },
  { key: 'testcases', label: 'Test Cases', icon: 'FlaskConical', table: 'test_cases' },
  { key: 'defects', label: 'Defects', icon: 'Bug', table: 'defects' },
  { key: 'rtm', label: 'Traceability', icon: 'Network', table: 'rtm' },
  { key: 'actionitems', label: 'Action Items', icon: 'CheckSquare', table: 'action_items' },
  { key: 'decisions', label: 'Decisions', icon: 'Gavel', table: 'decisions' },
  { key: 'raid', label: 'RAID Log', icon: 'ShieldAlert', table: 'raid_entries' },
  { key: 'jobaids', label: 'Job Aids', icon: 'BookOpen', table: 'job_aids' },
  { key: 'resources', label: 'Resource Allocation', icon: 'UserCog', table: 'resource_allocations' },
  { key: 'automation', label: 'Test Automation', icon: 'Zap', table: '' },
];

export const MODULE_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, BarChart3, ClipboardList, FlaskConical, Bug, Network, CheckSquare, Gavel, ShieldAlert, BookOpen, UserCog, Zap,
};

export interface Org { id: string; name: string; plan: string; billing_status: string; owner_id: string; created_at: string; license_seats: number; license_cost_per_seat: number; provisioned_by: string | null; provisioned_at: string | null; }
export interface EnterpriseLicense { id: string; org_id: string; license_count: number; cost_per_seat: number; billing_cycle: string; status: string; provisioned_by: string | null; notes: string | null; created_at: string; updated_at: string; }
export interface EnterpriseSecuritySettings { id: string; org_id: string; restrict_project_visibility: boolean; require_project_membership: boolean; allow_cross_project_data: boolean; enforce_data_isolation: boolean; max_projects_per_org: number; sso_required: boolean; ip_allowlist: string | null; created_at: string; updated_at: string; }
export interface OrgMember { id: string; user_id: string; org_id: string; role: string; created_at: string; }
export interface Project { id: string; org_id: string; name: string; description: string | null; created_at: string; }
export interface ProjectMembership { id: string; user_id: string; project_id: string; role: string; created_at: string; }
export interface ProjectSecuritySettings { id: string; project_id: string; restrict_visibility: boolean; require_explicit_membership: boolean; allow_external_comments: boolean; enforce_two_factor: boolean; ip_allowlist: string | null; max_members: number; created_at: string; updated_at: string; }
export interface Milestone { id: string; project_id: string; name: string; description: string | null; phase: string; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null; status: string; owner: string | null; progress: number; sort_order: number; created_at: string; updated_at: string; }
export interface Requirement { id: string; project_id: string; code: string; title: string; description: string | null; category: string | null; priority: string; status: string; custom_fields?: Record<string, string> | null; created_at: string; updated_at: string; }
export interface TestCase { id: string; project_id: string; requirement_id: string | null; code: string; title: string; cycle: string; steps: string | null; expected_result: string | null; status: string; custom_fields?: Record<string, string> | null; created_at: string; updated_at: string; }
export interface Defect { id: string; project_id: string; test_case_id: string | null; code: string; title: string; severity: string; description: string | null; status: string; custom_fields?: Record<string, string> | null; created_at: string; updated_at: string; }
export interface ActionItem { id: string; project_id: string; code: string; title: string; owner: string | null; owner_user_id: string | null; due_date: string | null; status: string; notes: string | null; custom_fields?: Record<string, string> | null; created_at: string; updated_at: string; }
export interface Decision { id: string; project_id: string; requirement_id: string | null; code: string; title: string; description: string | null; decided_by: string | null; decision_date: string | null; custom_fields?: Record<string, string> | null; created_at: string; updated_at: string; }
export interface RaidEntry { id: string; project_id: string; code: string; title: string; type: string; description: string | null; owner: string | null; status: string; custom_fields?: Record<string, string> | null; created_at: string; updated_at: string; }
export interface JobAid { id: string; project_id: string; code: string; title: string; description: string | null; url: string | null; custom_fields?: Record<string, string> | null; created_at: string; updated_at: string; }
export interface UserProfile { id: string; display_name: string | null; avatar_color: string; timezone: string; language: string; notification_email: boolean; notification_mentions: boolean; notification_assignments: boolean; created_at: string; updated_at: string; }
export interface Comment { id: string; project_id: string; item_type: string; item_id: string; user_id: string; body: string; mentioned_user_ids: string[]; edited_at: string | null; created_at: string; updated_at: string; }
export interface Notification { id: string; user_id: string; type: string; project_id: string | null; item_type: string | null; item_id: string | null; actor_id: string | null; message: string; read: boolean; email_sent: boolean; created_at: string; }
export interface ResourceAllocation { id: string; project_id: string; user_id: string; allocated_by: string | null; hours_per_week: number; start_date: string; end_date: string; role: string | null; notes: string | null; created_at: string; updated_at: string; }

export interface CustomFieldDefinition { id: string; project_id: string; module: string; label: string; field_key: string; field_type: string; options: string[] | null; sort_order: number; created_at: string; updated_at: string; }

export interface SalesLead { id: string; name: string; email: string; company: string; team_size: string | null; message: string | null; status: string; created_at: string; }
export interface ProjectApiKey { id: string; project_id: string; key_prefix: string; last_used_at: string | null; created_at: string; }
export interface TestRun { id: string; project_id: string; tool_name: string; external_report_url: string | null; started_at: string | null; completed_at: string; total_count: number; passed_count: number; failed_count: number; skipped_count: number; unmatched_count: number; executed_by: string | null; execution_source: 'hosted' | 'junit_import'; created_at: string; }
export interface TestRunResult { id: string; test_run_id: string; project_id: string; incoming_name: string; test_case_id: string | null; test_case_code: string | null; outcome: 'passed' | 'failed' | 'skipped' | 'error' | 'unknown'; duration_seconds: number | null; failure_message: string | null; external_report_url: string | null; executed_by?: string | null; notes?: string | null; created_at: string; }

export const MODULE_DB_MAP: Record<string, string> = {
  requirements: 'requirements',
  testcases: 'test_cases',
  defects: 'defects',
  actionitems: 'action_items',
  decisions: 'decisions',
  raid: 'raid_entries',
  jobaids: 'job_aids',
};
