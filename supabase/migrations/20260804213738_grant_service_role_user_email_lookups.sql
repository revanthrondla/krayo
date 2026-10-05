/*
  # Allow the service role to resolve user emails (supports F2 and F4)

  Earlier migrations revoked EXECUTE on the auth lookup helpers from PUBLIC,
  anon and authenticated. The edge functions run under the service role and
  need them, so grant EXECUTE explicitly to service_role only.
*/

GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_by_email(text) TO service_role;
