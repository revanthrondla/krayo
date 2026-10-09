/**
 * Converts an unknown error into a message that is safe to show a user.
 *
 * Errors raised by the database or a backend call can contain schema names,
 * constraint names and policy details, so they are logged for developers and
 * replaced with a friendly message in the interface. Errors the app raises
 * itself (plain `Error` instances with no backend metadata) are passed through
 * because they are written for users.
 */
/**
 * Supabase Auth error codes whose meaning is safe and useful to show a user.
 * Auth errors carry a `status`/`code`, so without this list every sign-in
 * failure would collapse into the generic fallback.
 */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  email_not_confirmed: 'Please confirm your email address before signing in.',
  user_not_found: 'Invalid email or password.',
  user_banned: 'This account has been suspended. Please contact support.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  email_exists: 'An account with this email already exists. Try signing in instead.',
  weak_password: 'That password is too weak. Please choose a stronger one.',
  same_password: 'Your new password must be different from your current one.',
  over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes before requesting another.',
  otp_expired: 'This link is invalid or has expired. Please request a new one.',
  session_expired: 'Your session has expired. Please sign in again.',
  signup_disabled: 'New sign-ups are currently disabled.',
};

export function friendlyMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof console !== 'undefined') console.error(err);

  if (err && typeof err === 'object') {
    const auth = err as { __isAuthError?: unknown; code?: unknown; status?: unknown };
    if (auth.__isAuthError) {
      if (typeof auth.code === 'string' && AUTH_MESSAGES[auth.code]) return AUTH_MESSAGES[auth.code];
      if (auth.status === 429) return AUTH_MESSAGES.over_request_rate_limit;
    }
  }

  if (err && typeof err === 'object') {
    const candidate = err as { code?: unknown; details?: unknown; hint?: unknown; status?: unknown; message?: unknown };
    const looksBackend =
      candidate.code !== undefined ||
      candidate.details !== undefined ||
      candidate.hint !== undefined ||
      candidate.status !== undefined;
    if (looksBackend) return fallback;
    if (typeof candidate.message === 'string' && candidate.message.trim() && err instanceof Error) {
      return candidate.message;
    }
  }

  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}
