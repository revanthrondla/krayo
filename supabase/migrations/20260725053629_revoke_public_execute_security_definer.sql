/*
# Revoke public/anon execute on SECURITY DEFINER functions

## Overview
Supabase security advisor flags that all SECURITY DEFINER functions are executable
by `anon` (via PUBLIC) and `authenticated` via the REST RPC endpoint. This migration
revokes execute from PUBLIC and anon for every flagged function.

## Why revoke without breaking RLS
The membership helpers (is_org_member, is_project_member, is_org_admin,
is_platform_admin) are called **inside RLS policies**. When a function is invoked from
within a policy expression, PostgreSQL checks execute permission against the table
owner (the `postgres` superuser role that owns the policies), not the calling role.
Revoking EXECUTE from anon/authenticated therefore does NOT affect policy-internal
calls — those continue to work because the policy runs as the table owner. It only
blocks direct REST RPC invocations from untrusted clients.

## get_user_emails / get_user_by_email
These are intentionally called from the frontend via RPC (for @mention autocomplete
and org invite lookups). They must remain SECURITY DEFINER to read auth.users, and
they must remain executable by authenticated (the app requires sign-in). We revoke
from anon only — the "Signed-In Users Can Execute" advisory is expected and
intentional for these two functions.

## Functions
- is_org_member(uuid)        — REVOKE FROM PUBLIC, anon
- is_project_member(uuid)    — REVOKE FROM PUBLIC, anon
- is_org_admin(uuid)         — REVOKE FROM PUBLIC, anon
- is_platform_admin()        — REVOKE FROM PUBLIC, anon
- get_user_emails(uuid[])    — REVOKE FROM PUBLIC, anon (keep authenticated)
- get_user_by_email(text)    — REVOKE FROM PUBLIC, anon (keep authenticated)
*/

-- Membership helpers: revoke all direct execute (policy-internal calls unaffected)
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;

-- Email lookup helpers: revoke anon, keep authenticated (intentional app use)
REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM PUBLIC, anon;
